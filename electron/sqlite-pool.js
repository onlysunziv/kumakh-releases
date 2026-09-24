const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { AsyncLocalStorage } = require('async_hooks');
const columns = require('../database/columns.json');

function databasePath() {
  const electron = process.versions.electron ? require('electron') : null;
  if (electron?.app?.getPath) {
    const configured = Boolean(String(process.env.TURSO_DATABASE_URL || '').trim());
    const databaseDirectory = path.join(electron.app.getPath('userData'), 'database');
    fs.mkdirSync(databaseDirectory, { recursive: true });
    return path.join(databaseDirectory, configured ? 'kumakh-sync.db' : 'kumakh.db');
  }
  return path.join(path.resolve(__dirname, '..'), 'database', 'kumakh.db');
}

function decimal(value, precision, scale) {
  const match = String(value).match(/^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!match || !(match[2] || match[3])) throw new Error('Invalid decimal value');
  const digits = (match[2] || '') + (match[3] || '');
  const power = Number(match[4] || 0) - (match[3] || '').length + scale;
  if (Math.abs(power) > 1000) throw new Error('Decimal value out of range');
  let integer = BigInt(digits || '0');
  if (power >= 0) integer *= 10n ** BigInt(power);
  else {
    const divisor = 10n ** BigInt(-power);
    integer = integer / divisor + ((integer % divisor) * 2n >= divisor ? 1n : 0n);
  }
  if (integer >= 10n ** BigInt(precision)) throw new Error('Decimal value out of range');
  const text = integer.toString().padStart(scale + 1, '0');
  return (match[1] === '-' && integer ? '-' : '') + (scale ? text.slice(0, -scale) + '.' + text.slice(-scale) : text);
}

function bindValue(value, definition) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) {
    // mysql2 used the local timezone, with dateStrings enabled on reads.
    const pad = n => String(n).padStart(2, '0');
    value = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }
  if (definition?.scale !== undefined) return decimal(value, definition.precision, definition.scale);
  if (definition?.type === 'DATE') return String(value).slice(0, 10);
  if (typeof value === 'boolean') return Number(value);
  if (typeof value === 'object' && !Buffer.isBuffer(value)) return JSON.stringify(value);
  return value;
}

class SQLitePool {
  constructor(file = databasePath(), { seed = true } = {}) {
    this.file = path.resolve(file);
    this.context = new AsyncLocalStorage();
    this.tail = Promise.resolve();
    this.ready = this.initialize(seed);
  }

  async initialize(seed) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    await new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.file, error => error ? reject(error) : resolve());
    });
    try {
      await this.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;');
      const [{ user_version: version }] = await this.all('PRAGMA user_version');
      if (version > require('./schema-migrations').CURRENT_SCHEMA_VERSION) throw new Error('Database schema is newer than this application');
      if (version < 1) {
        await require('./schema-migrations').assertEmptyDatabase(this);
        await this.exec('BEGIN IMMEDIATE');
        try {
          await this.exec(fs.readFileSync(path.join(__dirname, '../database/KUMAKH_DATABASE.sql'), 'utf8'));
          if (seed) await this.exec(fs.readFileSync(path.join(__dirname, '../database/seed.sql'), 'utf8'));
          await this.exec('PRAGMA user_version=1; COMMIT');
        } catch (error) { await this.exec('ROLLBACK'); throw error; }
      }
      await require('./schema-migrations').migrateSchema(this, version);
      await this.validateSchema();
    } catch (error) {
      await new Promise(resolve => this.db.close(resolve));
      throw error;
    }
  }

  async validateSchema() {
    for (const [table, expected] of Object.entries(columns)) {
      const actual = await this.all(`PRAGMA table_info("${table}")`);
      const missing = Object.keys(expected).filter(name => !actual.some(column => column.name === name));
      if (missing.length) throw new Error(`Schema migration required: ${table} missing ${missing.join(', ')}`);
    }
    if ((await this.all('PRAGMA foreign_key_check')).length) throw new Error('Database foreign-key validation failed');
  }

  exec(sql) { return new Promise((resolve, reject) => this.db.exec(sql, error => error ? reject(error) : resolve())); }
  all(sql, params = []) { return new Promise((resolve, reject) => this.db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows))); }
  run(sql, params = []) {
    return new Promise((resolve, reject) => this.db.run(sql, params, function(error) {
      if (error) reject(error);
      else resolve({ insertId: this.lastID, affectedRows: this.changes, changedRows: this.changes });
    }));
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
      await this.exec('BEGIN IMMEDIATE');
      this.inTransaction = true;
      try { const value = await work(); await this.exec('COMMIT'); return value; }
      catch (error) { await this.exec('ROLLBACK'); console.error('SQLite transaction rolled back:', error.code || 'operation failed'); throw error; }
      finally { this.inTransaction = false; }
    });
  }

  async query(sql, params = []) {
    await this.ready;
    return this.exclusive(async () => {
      let definitions = [];
      const insert = sql.match(/^\s*INSERT\s+INTO\s+[`"]?(\w+)[`"]?\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      const update = sql.match(/^\s*UPDATE\s+[`"]?(\w+)[`"]?\s+SET\s+([\s\S]*?)\s+WHERE/i);
      if (insert) {
        const names = insert[2].split(',').map(name => name.trim().replace(/[`"]+/g, ''));
        insert[3].split(',').forEach((value, index) => { if (value.trim() === '?') definitions.push(columns[insert[1]]?.[names[index]]); });
      } else if (update) {
        for (const match of update[2].matchAll(/[`"]?(\w+)[`"]?\s*=\s*\?/g)) definitions.push(columns[update[1]]?.[match[1]]);
      }
      const bound = params.map((value, index) => bindValue(value, definitions[index]));
      if (/^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql)) return [await this.all(sql, bound), []];
      return [await this.run(sql, bound), []];
    });
  }

  async backup(destination) {
    await this.ready;
    const root = path.resolve(path.dirname(this.file), '..');
    const target = destination || path.join(root, 'backups', `kumakh_${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.existsSync(target)) throw new Error('Backup destination already exists');
    // VACUUM INTO takes a consistent SQLite snapshot, including concurrent writes.
    await this.exclusive(() => this.run('VACUUM INTO ?', [target]));
    return target;
  }

  async end() { await this.ready; return this.exclusive(() => new Promise((resolve, reject) => this.db.close(error => error ? reject(error) : resolve()))); }
}

module.exports = { SQLitePool, databasePath, bindValue, decimal };
