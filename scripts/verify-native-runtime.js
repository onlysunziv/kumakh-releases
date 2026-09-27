const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');

function sqliteQuery(database, sql, values = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, values, (error, row) => error ? reject(error) : resolve(row));
  });
}

function sqliteRun(database, sql, values = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, values, function (error) {
      if (error) reject(error);
      else resolve({ changes: this.changes });
    });
  });
}

async function verifyPackagedRuntime(appOutDir) {
  if (!process.versions.electron) throw new Error('Native package probe must run under the packaged Electron executable.');
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error(`Expected packaged Windows x64 runtime, got ${process.platform} ${process.arch}.`);
  }
  const archive = path.join(appOutDir, 'resources', 'app.asar');
  const unpackedNodeModules = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules');
  const appRequire = createRequire(path.join(archive, 'electron', 'main.js'));
  const bindingPath = path.join(
    unpackedNodeModules,
    '@tursodatabase',
    'sync-win32-x64-msvc',
    'sync.win32-x64-msvc.node',
  );
  const sqliteBindingPath = path.join(
    unpackedNodeModules,
    'sqlite3',
    'build',
    'Release',
    'node_sqlite3.node',
  );
  const runtimePath = path.join(path.dirname(bindingPath), 'vcruntime140.dll');
  if (!fs.existsSync(runtimePath)) throw new Error(`App-local Microsoft runtime is missing: ${runtimePath}`);

  appRequire('@tursodatabase/sync-win32-x64-msvc');
  const sqlite3 = appRequire('sqlite3');
  const { connect } = await import(pathToFileURL(path.join(
    archive,
    'node_modules',
    '@tursodatabase',
    'sync',
    'dist',
    'promise.js',
  )).href);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kumakh-native-runtime-'));
  let sqlite;
  let replica;
  try {
    sqlite = await new Promise((resolve, reject) => {
      const instance = new sqlite3.Database(path.join(directory, 'sqlite3.db'), error => error ? reject(error) : resolve(instance));
    });
    await sqliteRun(sqlite, 'CREATE TABLE native_probe(value TEXT)');
    await sqliteRun(sqlite, 'INSERT INTO native_probe(value) VALUES (?)', ['sqlite3-ok']);
    assert.equal((await sqliteQuery(sqlite, 'SELECT value FROM native_probe')).value, 'sqlite3-ok');
    await new Promise((resolve, reject) => sqlite.close(error => error ? reject(error) : resolve()));
    sqlite = null;

    replica = await connect({ path: path.join(directory, 'turso-replica.db'), clientName: 'KUMAKH-PACKAGE-VERIFY' });
    await replica.exec('CREATE TABLE native_probe(value TEXT)');
    await (await replica.prepare('INSERT INTO native_probe(value) VALUES (?)')).run('turso-sync-ok');
    assert.equal((await (await replica.prepare('SELECT value FROM native_probe')).all())[0].value, 'turso-sync-ok');
    console.log(JSON.stringify({
      electron: process.versions.electron,
      node: process.versions.node,
      platform: process.platform,
      architecture: process.arch,
      tursoBinding: bindingPath,
      sqliteBinding: sqliteBindingPath,
      appLocalRuntime: runtimePath,
      sqliteReadWrite: 'passed',
      tursoLocalReplicaReadWrite: 'passed',
    }));
  } finally {
    if (sqlite) await new Promise(resolve => sqlite.close(resolve));
    if (replica) await replica.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

if (require.main === module) {
  verifyPackagedRuntime(path.resolve(process.argv[2] || '.')).catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
  });
}

module.exports = { verifyPackagedRuntime };
