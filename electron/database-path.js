const fs = require('fs');
const path = require('path');

function databasePath() {
  const electron = process.versions.electron ? require('electron') : null;
  if (electron?.app?.getPath) {
    const databaseDirectory = path.join(electron.app.getPath('userData'), 'database');
    fs.mkdirSync(databaseDirectory, { recursive: true });
    const replica = path.join(databaseDirectory, 'kumakh-sync.db');
    const legacy = path.join(databaseDirectory, 'kumakh.db');
    // Some releases already used this name for a real replica. Preserve its
    // native change log rather than migrating it as ordinary SQLite.
    if (!fs.existsSync(replica) && fs.existsSync(`${legacy}-info`)) return legacy;
    // Legacy SQLite records are imported explicitly by Database.open().
    // They must never be opened directly as a new Turso replica.
    return replica;
  }
  return path.join(path.resolve(__dirname, '..'), 'database', 'kumakh.db');
}

module.exports = { databasePath };
