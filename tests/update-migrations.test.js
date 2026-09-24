const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sqlite3 = require('sqlite3');
const { SQLitePool } = require('../electron/sqlite-pool');
const { migrateSchema } = require('../electron/schema-migrations');
const { TursoPool } = require('../electron/turso-pool');

async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kumakh-schema-'));
  const file = path.join(directory, 'database', 'kumakh.db');
  const pool = new SQLitePool(file, { seed: false }); await pool.ready;
  await pool.run("INSERT INTO Courses (id,course_name,total_fee,created_at,updated_at,data_json) VALUES ('preserved','College data','123.45','2026-09-24','2026-09-24','{}')");
  t.after(async () => { await pool.end(); fs.rmSync(directory, { recursive: true, force: true }); });
  return { directory, file, pool };
}

test('migration snapshot preserves records, validates and records version', async t => {
  const { directory, pool } = await fixture(t);
  await pool.exec('PRAGMA user_version=1');
  await migrateSchema(pool, 1);
  assert.equal((await pool.all('PRAGMA user_version'))[0].user_version, 2);
  assert.equal((await pool.all('SELECT total_fee FROM Courses'))[0].total_fee, '123.45');
  const backup = fs.readdirSync(path.join(directory, 'backups'))[0];
  const db = new sqlite3.Database(path.join(directory, 'backups', backup), sqlite3.OPEN_READONLY);
  const rows = await new Promise((resolve, reject) => db.all('SELECT * FROM Courses', (error, rows) => error ? reject(error) : resolve(rows)));
  assert.equal(rows[0].id, 'preserved');
  await new Promise(resolve => db.close(resolve));
});

test('migration validation failure rolls back changes and version and retains backup', async t => {
  const { directory, pool } = await fixture(t);
  await pool.exec('ALTER TABLE StudentMedia DROP COLUMN local_path; PRAGMA user_version=1');
  const validate = pool.validateSchema;
  pool.validateSchema = async () => { throw new Error('Injected validation failure'); };
  await assert.rejects(migrateSchema(pool, 1), /Backup:.*Injected validation failure/);
  assert.equal((await pool.all('PRAGMA user_version'))[0].user_version, 1);
  assert.ok(!(await pool.all('PRAGMA table_info(StudentMedia)')).some(column => column.name === 'local_path'));
  assert.equal((await pool.all('SELECT COUNT(*) AS n FROM Courses'))[0].n, 1);
  assert.equal(fs.readdirSync(path.join(directory, 'backups')).length, 1);
  pool.validateSchema = validate;
});

test('unversioned populated databases fail closed without creating tables or seed data', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kumakh-unversioned-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'old.db');
  const raw = new sqlite3.Database(file);
  await new Promise((resolve, reject) => raw.exec("CREATE TABLE Existing(value TEXT); INSERT INTO Existing VALUES ('keep');", error => error ? reject(error) : resolve()));
  await new Promise(resolve => raw.close(resolve));
  const before = fs.readFileSync(file);
  const pool = new SQLitePool(file);
  await assert.rejects(pool.ready, /Unversioned database/);
  assert.deepEqual(fs.readFileSync(file), before);
});

test('Turso engine checkpoints backup and transactionally upgrades an existing local replica', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kumakh-turso-upgrade-'));
  const file = path.join(directory, 'database', 'replica.db');
  let pool = new TursoPool(file, { seed: false });
  await pool.ready;
  t.after(async () => { await pool.end(); fs.rmSync(directory, { recursive: true, force: true }); });
  await pool.run("INSERT INTO Courses (id,course_name,total_fee,created_at,updated_at,data_json) VALUES ('kept','Real data','5.50','2026-09-24','2026-09-24','{}')");
  await pool.exec('PRAGMA user_version=1');
  await pool.end();
  pool = new TursoPool(file, { seed: false });
  await pool.ready;
  assert.equal((await pool.all('PRAGMA user_version'))[0].user_version, 2);
  assert.equal((await pool.all('SELECT total_fee FROM Courses'))[0].total_fee, '5.50');
  const backup = path.join(directory, 'backups', fs.readdirSync(path.join(directory, 'backups'))[0]);
  const raw = new sqlite3.Database(backup, sqlite3.OPEN_READONLY);
  const rows = await new Promise((resolve, reject) => raw.all('SELECT id FROM Courses', (error, rows) => error ? reject(error) : resolve(rows)));
  assert.equal(rows[0].id, 'kept');
  await new Promise(resolve => raw.close(resolve));
});
