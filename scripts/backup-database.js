const { Database } = require('../electron/database');
const { databasePath } = require('../electron/sqlite-pool');
const fs = require('fs');
(async () => {
  if (!fs.existsSync(databasePath())) throw new Error('No database exists to back up');
  const database = new Database(undefined, { initializePermissions: false });
  try {
    await database.open();
    if (typeof database.pool.sync === 'function') await database.pool.sync();
    console.log(await database.pool.backup());
  } finally { await database.close(); }
})().catch(error => { console.error('Backup failed:', error.code || error.message); process.exitCode = 1; });
