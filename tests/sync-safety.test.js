const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveConfiguration, bindReplica, normalizeSyncUrl } = require('../electron/turso-config');
const { protectCloudRow } = require('../electron/sync-conflicts');
const { SQLitePool } = require('../electron/sqlite-pool');

test('packaged URL and token are a pair, immune to stale per-PC and shell overrides', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kcmt-config-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'config'));
  fs.writeFileSync(path.join(root, 'runtime.env'), 'TURSO_DATABASE_URL=libsql://old.turso.io\nTURSO_AUTH_TOKEN=old');
  const file = path.join(root, 'config/turso.env');
  fs.writeFileSync(file, 'TURSO_DATABASE_URL=libsql://correct.turso.io\nTURSO_AUTH_TOKEN=packaged');
  const options = { app: { isPackaged: true, isReady: () => true, getPath: () => root }, resourcesPath: root,
    environment: { TURSO_DATABASE_URL: 'libsql://shell.turso.io', TURSO_AUTH_TOKEN: 'shell' } };
  const config = resolveConfiguration(options);
  assert.equal(config.url, 'libsql://correct.turso.io');
  assert.equal(config.authToken, 'packaged');
  fs.writeFileSync(file, 'TURSO_DATABASE_URL=libsql://correct.turso.io');
  assert.throws(() => resolveConfiguration(options), { code: 'TURSO_PACKAGED_CONFIGURATION_MISSING' });
  fs.unlinkSync(file);
  assert.throws(() => resolveConfiguration(options), { code: 'TURSO_PACKAGED_CONFIGURATION_MISSING' });
});

test('dashboard URLs are rejected and changing cloud databases isolates the complete old replica', t => {
  for (const url of ['https://app.turso.tech', 'https://app.turso.tech/abc', 'https://db.turso.io?token=secret']) {
    assert.throws(() => normalizeSyncUrl(url), { code: 'TURSO_DATABASE_URL_INVALID' });
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kcmt-binding-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'replica.db');
  fs.writeFileSync(file, 'old records');
  fs.writeFileSync(file + '-changes', 'offline writes');
  const config = { url: 'libsql://new.turso.io', previousUrl: 'libsql://old.turso.io' };
  const isolated = bindReplica(file, config);
  assert.notEqual(isolated, file);
  assert.equal(bindReplica(file, config), isolated);
  assert.equal(fs.readFileSync(file, 'utf8'), 'old records');
  assert.equal(fs.readFileSync(file + '-changes', 'utf8'), 'offline writes');
});

test('guarded SQL preserves newer cloud edits and deletes, including nulls and colliding inserts', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kcmt-cas-'));
  const pool = new SQLitePool(path.join(root, 'fixture.db'), { seed: false });
  await pool.ready;
  t.after(async () => { await pool.end(); fs.rmSync(root, { recursive: true, force: true }); });
  const apply = async mutation => {
    const { stmt } = protectCloudRow({ tableName: 'SystemSettings', ...mutation });
    return pool.run(stmt.sql, stmt.values);
  };
  const base = { key: 'probe', value: null, updated_at: 'test' };
  await apply({ changeType: 'insert', after: base });
  await apply({ changeType: 'update', before: base, after: { ...base, value: 'new cloud' }, updates: { value: 'new cloud' } });
  await apply({ changeType: 'update', before: base, after: { ...base, value: 'old local' }, updates: { value: 'old local' } });
  await apply({ changeType: 'delete', before: base });
  await apply({ changeType: 'insert', after: { ...base, value: 'stale insert' } });
  assert.equal((await pool.all('SELECT value FROM SystemSettings WHERE key=?', ['probe']))[0].value, 'new cloud');
  await apply({ changeType: 'delete', before: { ...base, value: 'new cloud' } });
  await apply({ changeType: 'update', before: base, after: { ...base, value: 'resurrect' } });
  assert.equal((await pool.all('SELECT * FROM SystemSettings')).length, 0);
  assert.throws(() => protectCloudRow({ tableName: 'SystemSettings', changeType: 'delete' }), /INCOMPLETE/);
});
