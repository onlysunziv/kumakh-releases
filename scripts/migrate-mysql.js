// Only this optional utility uses MySQL; the application never imports it.
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { SQLitePool, databasePath, bindValue } = require('../electron/sqlite-pool');
const schema = require('../database/columns.json');
const quote = value => '`' + String(value).replace(/`/g, '``') + '`';

async function migrate({ inspect = false, sourceConnection, destination = databasePath() } = {}) {
  const source = sourceConnection || await require('mysql2/promise').createConnection({
    host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || 'kumakhpos', user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', dateStrings: true, connectTimeout: 5000,
  });
  const report = { status: 'Checking', tables: [], skipped: 0, failed: 0 };
  let target;
  const targetPath = path.resolve(destination);
  const stage = path.join(path.dirname(targetPath), `migration-${require('crypto').randomUUID()}.db`);
  try {
    await source.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await source.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    const [tables] = await source.query("SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'");
    for (const table of tables) {
      if (!schema[table.name]) throw new Error(`Unrecognized source table: ${table.name}; migration needs schema review`);
      if (table.engine !== 'InnoDB') throw new Error(`Cannot snapshot non-InnoDB table ${table.name}`);
      const [fields] = await source.query(`SHOW COLUMNS FROM ${quote(table.name)}`);
      const extras = fields.filter(field => !schema[table.name][field.Field]);
      if (extras.length) throw new Error(`Unmapped columns in ${table.name}: ${extras.map(field => field.Field).join(', ')}`);
      const missing = Object.keys(schema[table.name]).filter(name => !fields.some(field => field.Field === name));
      if (missing.length) throw new Error(`Source schema missing ${table.name}.${missing.join(', ')}`);
      const [[{ count }]] = await source.query(`SELECT COUNT(*) AS count FROM ${quote(table.name)}`);
      report.tables.push({ table: table.name, read: Number(count), inserted: 0, skipped: 0, failed: 0 });
    }
    if (inspect) { report.status = 'Inspected'; return report; }
    if (fs.existsSync(targetPath)) throw new Error('Destination exists. Back it up and intentionally move it aside before migration; no overwrite is allowed');
    target = new SQLitePool(stage, { seed: false });
    await target.ready;
    await target.transaction(async () => {
      // Enforce all relationships at COMMIT, permitting existing cyclic ordering.
      await target.exec('PRAGMA defer_foreign_keys=ON');
      for (const entry of report.tables) {
        const [rows] = await source.query(`SELECT * FROM ${quote(entry.table)}`);
        const names = Object.keys(schema[entry.table]);
        const sql = `INSERT INTO ${quote(entry.table)} (${names.map(quote).join(',')}) VALUES (${names.map(() => '?').join(',')})`;
        for (const row of rows) {
          try {
            const bound = names.map(name => bindValue(row[name], schema[entry.table][name]));
            await target.run(sql, bound);
            entry.inserted++;
          } catch (error) { entry.failed++; report.failed++; throw error; }
        }
        const [{ count }] = await target.all(`SELECT COUNT(*) AS count FROM ${quote(entry.table)}`);
        if (Number(count) !== entry.read) throw new Error(`Row-count mismatch: ${entry.table}`);
        // Compare every field of every row, including exact decimal values and IDs.
        const canonical = row => JSON.stringify(names.map(name => bindValue(row[name], schema[entry.table][name])));
        const original = rows.map(canonical).sort();
        const copied = (await target.all(`SELECT * FROM ${quote(entry.table)}`)).map(canonical).sort();
        if (original.some((value, index) => value !== copied[index])) throw new Error(`Value verification failed: ${entry.table}`);
        entry.verified = true;
      }
      if ((await target.all('PRAGMA foreign_key_check')).length) throw new Error('Foreign-key validation failed');
    });
    await target.end(); target = null;
    // Atomic no-clobber publication; the completed staging DB remains recoverable.
    fs.linkSync(stage, targetPath);
    fs.unlinkSync(stage);
    report.status = 'Verified';
    return report;
  } catch (error) {
    report.status = 'Failed';
    report.committedRows = 0;
    report.error = error.code || error.message;
    report.stagingFile = fs.existsSync(stage) ? stage : undefined;
    error.migrationReport = report;
    throw error;
  } finally {
    if (target) await target.end();
    await source.rollback();
    await source.end();
  }
}

if (require.main === module) {
  const inspect = process.argv.includes('--inspect');
  if (!inspect && !process.argv.includes('--run')) {
    console.log('Usage: node scripts/migrate-mysql.js --inspect | --run\nStop KUMAKH before importing. Original MySQL data is read-only.');
  } else migrate({ inspect }).then(report => console.log(JSON.stringify(report, null, 2))).catch(error => {
    console.error(JSON.stringify(error.migrationReport || { status: 'Failed', error: error.code || error.message }, null, 2));
    process.exitCode = 1;
  });
}
module.exports = { migrate };
