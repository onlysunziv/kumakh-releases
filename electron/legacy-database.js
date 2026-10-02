const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// An ordinary SQLite file has no Turso change log. Opening it as a replica
// cannot upload its existing rows; copy missing records through tracked SQL.
async function importLegacyDatabase(pool, legacyFile) {
  if (!fs.existsSync(legacyFile) || path.resolve(legacyFile) === pool.file) return null;
  if (fs.existsSync(`${legacyFile}-info`)) {
    const {TursoPool} = require('./turso-pool');
    const legacy = new TursoPool(legacyFile,{syncUrl:pool.syncUrl,authToken:pool.authToken,seed:false});
    try { await legacy.ready; await legacy.sync(); }
    finally { await legacy.end(); }
    await pool.sync();
    return null;
  }
  const sqlite3 = require('sqlite3');
  const source = await new Promise((resolve,reject) => {
    const db = new sqlite3.Database(legacyFile,sqlite3.OPEN_READONLY,error => error ? reject(error) : resolve(db));
  });
  const read = (sql,params=[]) => new Promise((resolve,reject) => source.all(sql,params,(error,rows) => error ? reject(error) : resolve(rows)));
  try {
    await read('BEGIN');
    const tables = await read("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const order = [...fs.readFileSync(path.join(__dirname,'../database/KUMAKH_DATABASE.sql'),'utf8').matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map(match=>match[1]);
    const snapshot = [];
    for (const {name} of tables) {
      if (!order.includes(name)) throw new Error(`Legacy database contains an unsupported table: ${name}. Original database retained.`);
      const rows = await read(`SELECT * FROM "${name}"`);
      if (rows.length) snapshot.push({name,rows});
    }
    if (!snapshot.length) return {inserted:0,existing:0};
    snapshot.sort((a,b)=>order.indexOf(a.name)-order.indexOf(b.name));
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    const marker = `migration.legacy.${fingerprint}`;
    if ((await pool.query('SELECT value FROM SystemSettings WHERE key=?',[marker]))[0].length) return null;
    const backupDirectory = path.join(path.dirname(legacyFile),'backups');
    fs.mkdirSync(backupDirectory,{recursive:true});
    const backup = path.join(backupDirectory,`legacy-${fingerprint}.json`);
    // Keep a consistent snapshot (including any WAL records) before importing.
    if (!fs.existsSync(backup)) fs.writeFileSync(backup,JSON.stringify(snapshot),{flag:'wx',mode:0o600});
    const result = {inserted:0,existing:0,backup};
    await pool.transaction(async () => {
      for (const {name,rows} of snapshot) {
        const [columns] = await pool.query(`PRAGMA table_info("${name}")`);
        const fields = Object.keys(rows[0]);
        if (fields.some(field=>!columns.some(column=>column.name===field))) throw new Error(`Legacy ${name} schema is incompatible. Backup: ${backup}`);
        const keys = columns.filter(column=>column.pk).sort((a,b)=>a.pk-b.pk).map(column=>column.name);
        if (!keys.length) throw new Error(`Legacy ${name} has no stable primary key. Backup: ${backup}`);
        const quote = field => '"'+field.replaceAll('"','""')+'"';
        for (const row of rows) {
          const [existing] = await pool.query(`SELECT 1 FROM "${name}" WHERE ${keys.map(field=>quote(field)+'=?').join(' AND ')}`,keys.map(field=>row[field]));
          if (existing.length) { result.existing++; continue; }
          // Do not hide unique/FK failures: roll back the entire migration.
          await pool.query(`INSERT INTO "${name}" (${fields.map(quote).join(',')}) VALUES (${fields.map(()=>'?').join(',')})`,fields.map(field=>row[field]));
          result.inserted++;
        }
      }
      const [invalid] = await pool.query('PRAGMA foreign_key_check');
      if (invalid.length) throw new Error(`Legacy import failed foreign-key validation. Backup: ${backup}`);
      await pool.query("INSERT INTO SystemSettings (key,value,updated_at) VALUES (?,?,datetime('now'))",[marker,JSON.stringify(result)]);
    });
    return result;
  } finally {
    await new Promise(resolve=>source.close(resolve));
  }
}
module.exports = { importLegacyDatabase };
