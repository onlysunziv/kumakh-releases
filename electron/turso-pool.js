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
const syncErrorMessage = error => {
  const message = String(error?.message || error || "Unknown Turso sync error").trim();
  const code = error?.code ? ` [${error.code}]` : "";
  return `${message}${code}`;
};
const normalizeSyncUrl = value => {
  const url = String(value || "").trim().replace(/\/+$/, "");
  if (!/^(?:libsql|turso|https?):\/\/[^/\s]+(?:\/[^/\s]*)?$/i.test(url)) {
    throw Object.assign(new Error("TURSO_DATABASE_URL must be a valid libsql://, turso://, or https:// URL."), { code: "TURSO_DATABASE_URL_INVALID" });
  }
  return url;
};

class TursoPool {
  constructor(file, { syncUrl, authToken, seed = true } = {}) {
    this.file = databasePath(file);
    this.context = new AsyncLocalStorage();
    this.tail = Promise.resolve();
    this.syncTail = Promise.resolve();
    this.syncUrl = syncUrl ? normalizeSyncUrl(syncUrl) : null;
    this.client = null;
    this.status = {
      state: syncUrl ? "syncing" : "offline",
      pending: false,
      lastSyncAt: null,
      lastError: null,
    };
    this.clientReady = import("@tursodatabase/sync").then(({ connect }) => connect({
      path: this.file,
      url: syncUrl,
      authToken,
      clientName: "KUMAKH-POS",
    }));
    this.ready = this.initialize(seed).catch(async error => {
      if (this.client) await this.client.close().catch(() => {});
      throw error;
    });
  }

  async initialize(seed) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.client = await this.clientReady;
    const statePath = path.join(path.dirname(this.file), "database_sync_state.json");
    const previouslySynced = replicaExists(this.file);
    let syncError;
    // Always pull at startup. Existing replicas remain authoritative locally
    // when the cloud is temporarily unavailable; a new replica must bootstrap.
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        await this.pull();
        syncError = null;
        break;
      } catch (error) {
        syncError = error;
        if (!isReplicaLockError(error) || attempt === 4) break;
        await wait(attempt * 750);
      }
    }
    if (syncError) {
      if (!previouslySynced) {
        throw Object.assign(new Error(`Initial Turso bootstrap failed: ${syncErrorMessage(syncError)}`), { cause: syncError, code: "TURSO_INITIAL_SYNC_FAILED" });
      }
      console.warn("Turso initial sync unavailable; continuing with the local replica:", syncErrorMessage(syncError));
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

    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify({ initial_sync_completed: true, updated_at: new Date().toISOString() }, null, 2), "utf8");
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
    return this.serializeSync(async () => {
      this.status.state = "syncing";
      try {
        await this.pushNow();
        const pulled = await this.pullNow();
        this.status.state = "synced";
        this.status.lastSyncAt = new Date().toISOString();
        this.status.lastError = null;
        return pulled;
      } catch (error) {
        this.status.state = "offline";
        this.status.lastError = error.code || "SYNC_OFFLINE";
        throw error;
      }
    });
  }

  async push() {
    if (!this.syncUrl) return null;
    return this.serializeSync(() => this.pushNow());
  }

  async pushNow() {
    try {
      await this.client.push();
      this.status.pending = false;
      return true;
    } catch (error) {
      this.status.pending = true;
      this.status.state = "offline";
      this.status.lastError = error.code || "TURSO_PUSH_FAILED";
      throw error;
    }
  }

  async pull() {
    if (!this.syncUrl) return null;
    return this.serializeSync(() => this.pullNow());
  }

  async pullNow() {
    try {
      const changed = await this.client.pull();
      this.status.state = "synced";
      this.status.lastSyncAt = new Date().toISOString();
      this.status.lastError = null;
      return changed;
    } catch (error) {
      this.status.state = "offline";
      this.status.lastError = error.code || "TURSO_PULL_FAILED";
      throw error;
    }
  }

  serializeSync(work) {
    const result = this.syncTail.then(work);
    this.syncTail = result.catch(() => {});
    return result;
  }

  syncStatus() {
    return { ...this.status };
  }

  async end() {
    await this.ready;
    await this.tail;
    try {
      await this.push();
    } catch (error) {
      console.warn("Turso final sync unavailable; local changes remain queued in the replica:", error.message);
    }
    await this.client.close();
  }
}

module.exports = { TursoPool, normalizeSyncUrl, replicaExists, syncErrorMessage };
