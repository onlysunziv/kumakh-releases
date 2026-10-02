// Default is read-only. --write-probe uses one temporary setting, then removes it.
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { TursoPool, normalizeSyncUrl } = require('../electron/turso-pool');

async function checkTurso({ writeProbe = false } = {}) {
  const syncUrl = normalizeSyncUrl(process.env.TURSO_DATABASE_URL || '');
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!authToken) throw new Error('TURSO_AUTH_TOKEN is required.');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kcmt-cloud-check-'));
  let reader, writer, probeKey;
  try {
    const { connect } = await import('@tursodatabase/sync');
    reader = await connect({ path:path.join(directory,'reader.db'), url:syncUrl, authToken, transform: require('../electron/sync-conflicts').protectCloudRow });
    await reader.pull();
    const counts = {};
    for (const table of ['Students','Staff','Courses','Purchases','ReportSubmissions']) {
      const [row] = await (await reader.prepare(`SELECT COUNT(*) AS count FROM "${table}"`)).all();
      counts[table] = row.count;
    }
    console.log('Fresh cloud replica:', JSON.stringify(counts));
    if (writeProbe) {
      const file = path.join(directory,'writer','replica.db');
      writer = new TursoPool(file,{syncUrl,authToken,seed:false});
      await writer.ready;
      probeKey = `diagnostic.sync.${randomUUID()}`;
      await writer.transaction(() => writer.query("INSERT INTO SystemSettings (key,value,updated_at) VALUES (?,?,datetime('now'))",[probeKey,'offline-restart-probe']));
      // Close without uploading: the next process must recover the durable log.
      await writer.client.close();
      writer = null;
      writer = new TursoPool(file,{syncUrl,authToken,seed:false});
      await writer.ready;
      await reader.pull();
      const rows = await (await reader.prepare('SELECT value FROM SystemSettings WHERE key=?')).all(probeKey);
      if (rows[0]?.value !== 'offline-restart-probe') throw new Error('Offline write did not reach the independent reader after restart.');
      console.log('PASS: offline write survived restart and reached a second installation.');
      await writer.query('UPDATE SystemSettings SET value=? WHERE key=?',['stale-offline',probeKey]);
      await (await reader.prepare('UPDATE SystemSettings SET value=? WHERE key=?')).run('new-cloud',probeKey);
      await reader.push();
      await writer.sync();
      if ((await writer.query('SELECT value FROM SystemSettings WHERE key=?',[probeKey]))[0][0]?.value !== 'new-cloud') throw new Error('Stale offline update replaced a newer cloud value.');
      await writer.query('DELETE FROM SystemSettings WHERE key=?',[probeKey]);
      await (await reader.prepare('UPDATE SystemSettings SET value=? WHERE key=?')).run('newest-cloud',probeKey);
      await reader.push();
      await writer.sync();
      if ((await writer.query('SELECT value FROM SystemSettings WHERE key=?',[probeKey]))[0][0]?.value !== 'newest-cloud') throw new Error('Stale offline delete removed a newer cloud value.');
      console.log('PASS: stale edits/deletes preserve newer cloud values and replicas converge.');
      await writer.query('DELETE FROM SystemSettings WHERE key=?',[probeKey]);
      await writer.sync();
      await reader.pull();
      if ((await (await reader.prepare('SELECT key FROM SystemSettings WHERE key=?')).all(probeKey)).length) throw new Error('Probe cleanup did not replicate.');
      probeKey = null;
      console.log('PASS: deletion replicated; temporary cloud probe removed.');
    }
  } finally {
    try {
      if (writer) {
        if (probeKey) {
          await writer.ready;
          await writer.query('DELETE FROM SystemSettings WHERE key=?',[probeKey]);
          await writer.push();
          probeKey = null;
        }
        await writer.end();
      }
    } finally {
      if (reader) await reader.close();
      if (!probeKey) fs.rmSync(directory,{recursive:true,force:true});
      else console.error('Probe recovery files retained:',directory);
    }
  }
}

if (require.main === module) checkTurso({writeProbe:process.argv.includes('--write-probe')}).catch(error => {
  console.error('Turso check failed:',error.message);
  process.exitCode = 1;
});
module.exports = { checkTurso };
