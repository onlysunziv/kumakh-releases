const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { migrate } = require('../scripts/migrate-mysql');
const { SQLitePool } = require('../electron/sqlite-pool');
const schema = require('../database/columns.json');

function sourceFixture(rows) {
  return {
    async query(sql) {
      if (/^SET |^START /.test(sql)) return [];
      if (sql.includes('information_schema')) return [[{ name: 'Courses', engine: 'InnoDB' }]];
      if (sql.startsWith('SHOW COLUMNS')) return [Object.keys(schema.Courses).map(Field => ({ Field }))];
      if (sql.includes('COUNT(*)')) return [[{ count: rows.length }]];
      if (sql.startsWith('SELECT *')) return [rows];
      throw new Error('Unexpected source query');
    },
    async rollback() {}, async end() {},
  };
}

test('import validates values, never overwrites, and rolls back constraint failures', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kumakh-import-'));
  const destination = path.join(directory, 'kumakh.db');
  const row = { id: 'original-id', course_name: 'Original', duration: null, total_fee: '123.45', status: 'Active', created_at: '2026-09-15 01:02:03', updated_at: '2026-09-15 01:02:03', data_json: '{}' };
  try {
    const report = await migrate({ sourceConnection: sourceFixture([row]), destination });
    assert.equal(report.status, 'Verified');
    assert.equal(report.tables[0].read, 1);
    assert.equal(report.tables[0].inserted, 1);
    const database = new SQLitePool(destination);
    await database.ready;
    assert.deepEqual(await database.all('SELECT * FROM Courses'), [row]);
    await database.end();
    const original = fs.readFileSync(destination);
    await assert.rejects(migrate({ sourceConnection: sourceFixture([row]), destination }), /Destination exists/);
    assert.deepEqual(fs.readFileSync(destination), original);
    const other = path.join(directory, 'invalid.db');
    await assert.rejects(migrate({ sourceConnection: sourceFixture([row, row]), destination: other }), /UNIQUE/);
    assert.equal(fs.existsSync(other), false);
    const staged = fs.readdirSync(directory).find(name => name.startsWith('migration-'));
    const rolledBack = new SQLitePool(path.join(directory, staged));
    await rolledBack.ready;
    assert.deepEqual(await rolledBack.all('SELECT * FROM Courses'), []);
    await rolledBack.end();
  } finally {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
