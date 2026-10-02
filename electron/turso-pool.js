const fs = require("fs");
const path = require("path");
const { AsyncLocalStorage } = require("async_hooks");
const columns = require("../database/columns.json");

function splitSql(sql) {
  return sql.replace(/^\s*--.*$/gm, "").split(/;\s*(?=(?:[^'"]|'[^']*'|"[^"]*")*$)/).map((statement) => statement.trim()).filter(Boolean);
}

function databasePath(file) {
  return path.resolve(file);
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const isReplicaLockError = (error) => /locking error|locked|error 33/i.test(String(error?.message || error));
const replicaExists = file => fs.existsSync(file) && fs.statSync(file).size > 0;
const isReplicaDeserializationError = error => /(?:sync engine operation failed.*deserialization error|deserialization error.*expected value at line 1 column 1|stale replica|invalid sync metadata)/i.test(String(error?.message || error));
const syncErrorMessage = error => {
  const message = String(error?.message || error || "Unknown Turso sync error").trim();
  const code = error?.code ? ` [${error.code}]` : "";
  return `${message}${code}`;
};
const { normalizeSyncUrl } = require('./turso-config');
const { protectCloudRow } = require('./sync-conflicts');
const { registerSecret, redact } = require('./database-errors');

class TursoPool {
  constructor(file, { syncUrl, authToken, seed = true, recoveryAttempted = false } = {}) {
    this.file = databasePath(file);
    this.context = new AsyncLocalStorage();
    this.tail = Promise.resolve();
    this.syncTail = Promise.resolve();
    this.syncUrl = syncUrl ? normalizeSyncUrl(syncUrl) : null;
    this.authToken = authToken;
    registerSecret(authToken);
    this.seed = seed;
    this.recoveryAttempted = recoveryAttempted;
    this.previouslySynced = replicaExists(this.file);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.client = null;
    this.status = {
      state: syncUrl ? "syncing" : "offline",
      pending: false,
      lastSyncAt: null,
      lastError: null,
      domain: this.syncUrl ? new URL(this.syncUrl).hostname : null,
    };
    try { this.status.lastSyncAt = JSON.parse(fs.readFileSync(`${this.file}.sync-status.json`, "utf8")).lastSyncAt || null; } catch { /* first launch */ }
    if (this.syncUrl) this.logSync("connect-start", { authTokenPresent: Boolean(authToken) });
    this.clientReady = import("@tursodatabase/sync").then(({ connect }) => connect({
      path: this.file,
      url: this.syncUrl,
      authToken,
      clientName: "KUMAKH-POS",
      transform: mutation => this.transformMutation(mutation),
      fetch: (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) }),
    }));
    this.ready = this.initialize(seed).catch(async error => {
      this.status.state = "offline";
      this.status.lastError = error.code || "TURSO_CONNECTION_FAILED";
      if (this.syncUrl) this.logSync("connect-error", { error: redact(syncErrorMessage(error)) });
      if (this.client) await this.client.close().catch(() => {});
      throw error;
    });
  }

  replicaFiles() {
    return [
      this.file,
      `${this.file}-wal`,
      `${this.file}-shm`,
      `${this.file}-info`,
      `${this.file}-changes`,
      `${this.file}-wal-revert`,
      path.join(path.dirname(this.file), "database_sync_state.json"),
    ].filter(file => fs.existsSync(file));
  }

  async recoverDesynchronizedReplica(error) {
    if (this.recoveryAttempted || !replicaExists(this.file)) throw error;

    const recoveryDirectory = path.join(
      path.dirname(this.file),
      "backups",
      `kumakh-replica-recovery-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    );
    fs.mkdirSync(recoveryDirectory, { recursive: true });
    const files = this.replicaFiles();
    const backupFiles = files.map(file => {
      const target = path.join(recoveryDirectory, path.basename(file));
      fs.copyFileSync(file, target, fs.constants.COPYFILE_EXCL);
      return { file, target };
    });

    // A push is the safety gate: if local changes cannot be sent to Turso,
    // rebuilding this replica could discard unsynchronized records.
    try {
      await this.pushNow();
    } catch (pushError) {
      throw Object.assign(
        new Error(`Local replica sync metadata is invalid and pending changes could not be preserved. Backup: ${recoveryDirectory}. ${syncErrorMessage(error)}`),
        { cause: pushError, code: "TURSO_REPLICA_RECOVERY_UNSAFE", backupDirectory: recoveryDirectory },
      );
    }

    const displacedFiles = [];
    let rebuilding = false;
    try {
      await this.client.close();
      this.client = null;
      // Closing can checkpoint/remove WAL files, so enumerate again.
      for (const file of this.replicaFiles()) {
        const displaced = `${file}.stale-${process.pid}`;
        fs.renameSync(file, displaced);
        displacedFiles.push({ file, displaced });
      }

      rebuilding = true;
      this.recoveryAttempted = true;
      this.client = await import("@tursodatabase/sync").then(({ connect }) => connect({
        path: this.file,
        url: this.syncUrl,
        authToken: this.authToken,
        clientName: "KUMAKH-POS",
        transform: mutation => this.transformMutation(mutation),
        fetch: (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) }),
      }));
      await this.pull();
      for (const { displaced } of displacedFiles) fs.rmSync(displaced, { force: true });
      return;
    } catch (recoveryError) {
      if (this.client) await this.client.close().catch(() => {});
      this.client = null;
      // A failed bootstrap may leave a new database AND new native metadata.
      // Remove only those exact replica files before restoring the old set.
      if (rebuilding) {
        for (const file of this.replicaFiles()) fs.rmSync(file, { force: true });
      }
      for (const { file, displaced } of displacedFiles) {
        if (!fs.existsSync(file) && fs.existsSync(displaced)) fs.renameSync(displaced, file);
      }
      throw Object.assign(
        new Error(`Local replica recovery failed after backup ${recoveryDirectory}: ${syncErrorMessage(recoveryError)}`),
        { cause: recoveryError, code: "TURSO_REPLICA_RECOVERY_FAILED", backupDirectory: recoveryDirectory },
      );
    }
  }

  async initialize(seed) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.client = await this.clientReady;
    if (this.syncUrl && !this.previouslySynced) {
      this.status.lastSyncAt = new Date().toISOString();
      this.status.state = "synced";
      this.logSync("bootstrap", { downloadedRecords: (await this.rowFingerprints()).size });
    }
    const statePath = path.join(path.dirname(this.file), "database_sync_state.json");
    const previouslySynced = this.previouslySynced;
    let syncError;
    // Every launch refreshes the cache from Turso. Existing replicas can be
    // used in explicit offline mode; a new replica must bootstrap online.
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        // Pull, rebase guarded offline writes, push, then pull the cloud result.
        if (previouslySynced) await this.sync();
        else await this.pull();
        syncError = null;
        break;
      } catch (error) {
        syncError = error;
        if (isReplicaDeserializationError(error) && previouslySynced) {
          await this.recoverDesynchronizedReplica(error);
          syncError = null;
          break;
        }
        if (!isReplicaLockError(error) || attempt === 4) break;
        await wait(attempt * 750);
      }
    }
    if (syncError) {
      if (!previouslySynced) {
        throw Object.assign(new Error(`Initial Turso bootstrap failed: ${syncErrorMessage(syncError)}`), { cause: syncError, code: "TURSO_INITIAL_SYNC_FAILED" });
      }
      console.warn("LOCAL/OFFLINE MODE: Turso startup sync failed:", redact(syncErrorMessage(syncError)));
    }
    const [{ user_version: version }] = await this.all("PRAGMA user_version");
    if (version > require('./schema-migrations').CURRENT_SCHEMA_VERSION) throw new Error("Database schema is newer than this application");
    if (version < 1) {
      await require('./schema-migrations').assertEmptyDatabase(this);
      await this.exec('BEGIN IMMEDIATE');
      try {
      await this.exec(fs.readFileSync(path.join(__dirname, "../database/KUMAKH_DATABASE.sql"), "utf8"));
      if (seed) await this.exec(fs.readFileSync(path.join(__dirname, "../database/seed.sql"), "utf8"));
      await this.validateSchema();
      await this.exec(`PRAGMA user_version=${require('./schema-migrations').CURRENT_SCHEMA_VERSION}`);
      await this.exec('COMMIT');
      } catch (error) { await this.exec('ROLLBACK'); throw error; }
    }
    if (version >= 1) await require("./schema-migrations").migrateSchema(this, version);
    await this.validateSchema();
    if (syncError) await this.refreshPending();

    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify({ initial_sync_completed: Boolean(this.status.lastSyncAt), lastSyncAt: this.status.lastSyncAt }, null, 2), "utf8");
  }

  async validateSchema() {
    for (const [table, expected] of Object.entries(columns)) {
      const actual = await this.all(`PRAGMA table_info("${table}")`);
      const missing = Object.keys(expected).filter((name) => !actual.some((column) => column.name === name));
      if (missing.length) throw new Error(`Schema migration required: ${table} missing ${missing.join(", ")}`);
    }
    if ((await this.all("PRAGMA foreign_key_check")).length) throw new Error("Database foreign-key validation failed");
  }

  async exec(sql) {
    return this.exclusive(async () => {
      if (/\b(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql)) return this.client.exec(sql);
      for (const statement of splitSql(sql)) await this.client.exec(statement);
      this.status.pending = Boolean(this.syncUrl);
    });
  }

  async all(sql, params = []) {
    return this.exclusive(async () => {
      const statement = await this.client.prepare(sql);
      return statement.all(...params);
    });
  }

  async run(sql, params = []) {
    return this.exclusive(async () => {
      const result = await (await this.client.prepare(sql)).run(...params);
      this.status.pending = Boolean(this.syncUrl);
      return {
        insertId: result.lastInsertRowid,
        affectedRows: result.changes,
        changedRows: result.changes,
      };
    });
  }

  exclusive(work) {
    if (this.context.getStore() === this) return work();
    const result = this.tail.then(() => this.context.run(this, work));
    this.tail = result.catch(() => {});
    return result;
  }

  async transaction(work) {
    await this.ready;
    if (this.context.getStore() === this && this.inTransaction) return work();
    return this.exclusive(async () => {
      const original = this.client;
      const transactionFactory = this.client.transactionAsync(async (txn) => {
        this.client = txn;
        try { return await work(); }
        finally { this.client = original; }
      });
      this.inTransaction = true;
      try {
        return await transactionFactory();
      } catch (error) {
        console.error("Turso transaction rolled back:", error.code || "operation failed");
        throw error;
      } finally {
        this.client = original;
        this.inTransaction = false;
      }
    });
  }

  async query(sql, params = []) {
    await this.ready;
    const result = /^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql)
      ? await this.all(sql, params)
      : [await this.run(sql, params)];
    return [result, []];
  }

  async backup(destination) {
    await this.ready;
    const root = path.resolve(path.dirname(this.file), "..");
    const target = destination || path.join(root, "backups", `kumakh_${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.existsSync(target)) throw new Error("Backup destination already exists");
    await this.migrationBackup(target);
    return target;
  }

  async migrationBackup(target) {
    return this.serializeSync(() => this.exclusive(async () => {
      if (this.syncUrl) await this.client.checkpoint();
      else {
        const result = await (await this.client.prepare('PRAGMA wal_checkpoint(TRUNCATE)')).all();
        if (result.some(row => Number(Object.values(row)[0]) !== 0)) throw new Error('Database is busy; backup refused');
      }
      fs.copyFileSync(this.file, target, fs.constants.COPYFILE_EXCL);
    }));
  }

  async sync() {
    if (!this.syncUrl) return null;
    if (this.syncPromise) return this.syncPromise;
    const operation = this.serializeSync(async () => {
      this.status.state = "syncing";
      try {
        const firstPull = await this.pullNow();
        await this.pushNow();
        const pulled = (await this.pullNow()) || firstPull;
        // Native CDC stats can include acknowledged replay history. The full
        // round trip holds the SQL lock, so no new local write can be pending.
        this.status.pending = false;
        this.status.state = "synced";
        this.status.lastSyncAt = new Date().toISOString();
        this.status.lastError = null;
        this.logSync("sync-complete");
        return pulled;
      } catch (error) {
        this.status.state = "offline";
        this.status.lastError = error.code || "SYNC_OFFLINE";
        throw error;
      }
    });
    this.syncPromise = operation;
    try { return await operation; }
    finally { this.syncPromise = null; }
  }

  async push() {
    if (!this.syncUrl) return null;
    if (this.pushPromise) return this.pushPromise;
    const operation = this.serializeSync(async () => {
      await this.pullNow();
      await this.pushNow();
      const changed = await this.pullNow();
      this.status.pending = false;
      return changed;
    });
    this.pushPromise = operation;
    try { return await operation; }
    finally { this.pushPromise = null; }
  }

  async pushNow() {
    try {
      this.uploadedMutations = 0;
      this.pushing = true;
      await this.client.push();
      this.status.pending = false;
      this.status.state = "synced";
      this.status.lastSyncAt = new Date().toISOString();
      this.status.lastError = null;
      this.logSync("push", { uploadedRecords: this.uploadedMutations, uploadedCountMeaning: "submitted guarded row mutations" });
      return true;
    } catch (error) {
      this.status.pending = true;
      this.status.state = "offline";
      this.status.lastError = error.code || "TURSO_PUSH_FAILED";
      this.logSync("push-error", { error: redact(syncErrorMessage(error)) });
      throw error;
    } finally {
      this.pushing = false;
    }
  }

  async pull() {
    if (!this.syncUrl) return null;
    return this.serializeSync(() => this.pullNow());
  }

  async pullNow() {
    try {
      const before = await this.rowFingerprints();
      const changed = await this.client.pull();
      const after = changed ? await this.rowFingerprints() : before;
      let downloadedRecords = 0, downloadedDeletes = 0;
      for (const [key, value] of after) if (before.get(key) !== value) downloadedRecords++;
      for (const key of before.keys()) if (!after.has(key)) downloadedDeletes++;
      this.status.downloadedRecords = downloadedRecords;
      this.status.downloadedDeletes = downloadedDeletes;
      await this.refreshPending();
      this.status.state = "synced";
      this.status.lastSyncAt = new Date().toISOString();
      this.status.lastError = null;
      this.logSync("pull", { downloadedRecords, downloadedDeletes });
      return changed;
    } catch (error) {
      this.status.state = "offline";
      this.status.lastError = error.code || "TURSO_PULL_FAILED";
      this.logSync("pull-error", { error: redact(syncErrorMessage(error)) });
      throw error;
    }
  }

  serializeSync(work) {
    // The native transaction callback temporarily owns this.client. Sync and
    // checkpoint must use the same lock as SQL, never the transaction handle.
    const result = this.syncTail.then(() => this.context.exit(() => this.exclusive(work)));
    this.syncTail = result.catch(() => {});
    return result;
  }

  transformMutation(mutation) {
    const result = protectCloudRow(mutation);
    if (this.file) {
      // Preserve intent before the server may reject a stale mutation. This is
      // a local recovery file, never the diagnostic log or renderer payload.
      const directory = path.join(path.dirname(this.file), 'backups');
      fs.mkdirSync(directory, { recursive: true });
      fs.appendFileSync(path.join(directory, 'sync-intents.jsonl'), JSON.stringify(mutation) + '\n', { mode: 0o600 });
      if (this.pushing) this.uploadedMutations++;
    }
    return result;
  }

  async rowFingerprints() {
    const result = new Map();
    if (!this.file || typeof this.client.prepare !== 'function') return result;
    const crypto = require('node:crypto');
    const tables = await this.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    for (const { name } of tables) {
      if (!Object.hasOwn(columns, name)) continue;
      const info = await this.all('PRAGMA table_info("' + name + '")');
      const keys = info.filter(column => column.pk).sort((a, b) => a.pk - b.pk).map(column => column.name);
      for (const row of await this.all('SELECT * FROM "' + name + '"')) {
        const key = name + ':' + JSON.stringify(keys.map(key => row[key]));
        result.set(key, crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex'));
      }
    }
    return result;
  }

  logSync(event, extra = {}) {
    const details = { event, domain: new URL(this.syncUrl).hostname, connectionStatus: this.status.state,
      lastSyncAt: this.status.lastSyncAt, pending: this.status.pending, ...extra };
    this.status.domain = details.domain;
    console.info('Turso sync:', JSON.stringify(details));
    if (this.file) {
      try {
      const directory = path.join(path.dirname(this.file), 'logs');
      fs.mkdirSync(directory, { recursive: true });
      fs.appendFileSync(path.join(directory, 'turso-sync.jsonl'), JSON.stringify({ time: new Date().toISOString(), ...details }) + '\n');
      fs.writeFileSync(`${this.file}.sync-status.json`, JSON.stringify({ lastSyncAt: this.status.lastSyncAt }));
      } catch (error) { console.warn('Turso diagnostic log unavailable:', error.code); }
    }
  }

  syncStatus() {
    return { ...this.status };
  }

  async refreshPending() {
    if (this.syncUrl && typeof this.client.stats === 'function') {
      const stats = await this.client.stats();
      this.status.pending = Number(stats.cdcOperations) > 0;
    }
  }

  async end() {
    await this.ready;
    await this.tail;
    try {
      await this.push();
    } catch (error) {
      console.warn("Turso final sync unavailable; local changes remain queued in the replica:", redact(error.message));
    }
    await this.syncTail;
    await this.exclusive(() => this.client.close());
  }
}

module.exports = { TursoPool, normalizeSyncUrl, replicaExists, isReplicaDeserializationError, syncErrorMessage };
