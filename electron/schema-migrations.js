// Additive only: existing media chunks and records remain recoverable.
const mediaColumns = {
  local_path: 'TEXT', file_hash: 'TEXT', uploaded_hash: 'TEXT', drive_file_id: 'TEXT',
  drive_url: 'TEXT', drive_folder_id: 'TEXT', upload_status: "TEXT NOT NULL DEFAULT 'LOCAL_ONLY'",
  last_upload_date: 'TEXT', active: 'INTEGER NOT NULL DEFAULT 1',
};
const CURRENT_SCHEMA_VERSION = 2;
// Add new ordered, additive steps here. Never change or reseed an existing step.
const migrations = [{ version: 2, async apply(pool) {
  const existing = await pool.all('PRAGMA table_info(StudentMedia)');
  if (!existing.length) throw new Error('StudentMedia is missing; refusing to recreate production tables');
  for (const [name, definition] of Object.entries(mediaColumns)) {
    if (!existing.some(column => column.name === name)) await pool.exec(`ALTER TABLE StudentMedia ADD COLUMN ${name} ${definition}`);
  }
} }];

async function assertEmptyDatabase(pool) {
  const tables = await pool.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  if (tables.length) throw new Error('Unversioned database contains existing tables. A reviewed data migration is required; no schema or seed was applied.');
}

async function migrateSchema(pool, version) {
  if (version > CURRENT_SCHEMA_VERSION) throw new Error('Database schema is newer than this application');
  if (version === CURRENT_SCHEMA_VERSION) return;
  let backup;
  if (version >= 1) {
    const fs = require('fs'), path = require('path');
    const parent = path.dirname(pool.file);
    const directory = path.join(path.basename(parent) === 'database' ? path.dirname(parent) : parent, 'backups');
    fs.mkdirSync(directory, { recursive: true });
    backup = path.join(directory, `before-schema-v${CURRENT_SCHEMA_VERSION}-${new Date().toISOString().replace(/[:.]/g, '-')}-${require('crypto').randomUUID()}.db`);
    // Turso checkpoints its WAL under its operation lock before copying. SQLite
    // uses its online backup SQL. Both finish before any migration statement.
    if (pool.migrationBackup) await pool.migrationBackup(backup);
    else await pool.run('VACUUM INTO ?', [backup]);
    if (!fs.statSync(backup).size) throw new Error('Schema backup is empty; migration refused');
  }
  await pool.exec('BEGIN IMMEDIATE');
  try {
    for (const migration of migrations) {
      if (migration.version > version) await migration.apply(pool);
    }
    await pool.validateSchema();
    const integrity = await pool.all('PRAGMA integrity_check');
    if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok') throw new Error('Database integrity validation failed');
    await pool.exec(`PRAGMA user_version=${CURRENT_SCHEMA_VERSION}`);
    const [recorded] = await pool.all('PRAGMA user_version');
    if (recorded.user_version !== CURRENT_SCHEMA_VERSION) throw new Error('Schema version validation failed');
    await pool.exec('COMMIT');
  } catch (error) {
    try { await pool.exec('ROLLBACK'); } catch (_) { /* Retain original failure and backup location. */ }
    throw new Error(`Schema migration failed; no reset attempted.${backup ? ` Backup: ${backup}.` : ''} ${error.message}`, { cause: error });
  }
}
module.exports = { migrateSchema, mediaColumns, assertEmptyDatabase, CURRENT_SCHEMA_VERSION };
