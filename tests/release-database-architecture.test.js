const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateProductionDatabaseConfig } = require('../scripts/build-win');

test('installed applications use Turso even when passed local fixture options', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kcmt-turso-only-'));
  const databaseFile = path.join(__dirname, '../electron/database.js');
  const nativeRequire = require('node:module').createRequire(databaseFile);
  const module = {exports:{}};
  class TestTursoPool { constructor(file,options) { this.file=file;this.options=options; } }
  fs.mkdirSync(path.join(directory,'resources','config'), {recursive:true});
  fs.writeFileSync(path.join(directory,'resources','config','turso.env'),'TURSO_DATABASE_URL=libsql://test.turso.io\nTURSO_AUTH_TOKEN=test-token\n');
  try {
    require('node:vm').runInNewContext(fs.readFileSync(databaseFile,'utf8'),{
      module, __dirname:path.dirname(databaseFile),
      process:{versions:{electron:'32.3.3'},env:{},resourcesPath:path.join(directory,'resources')},
      require:name=>{
        if(name==='electron') return {app:{isPackaged:true,isReady:()=>true,getPath:()=>directory}};
        if(name==='./turso-pool') return {TursoPool:TestTursoPool};
        if(name==='./sqlite-pool') throw Error('Installed applications must not open standalone SQLite');
        return nativeRequire(name);
      },
    });
    const db = new module.exports.Database(path.join(directory,'replica.db'),{forceSQLite:true});
    assert.ok(db.pool instanceof TestTursoPool);
    assert.equal(db.pool.options.syncUrl,'libsql://test.turso.io');
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});

test('production packaging fails when Turso configuration is absent', () => {
  assert.throws(
    () => validateProductionDatabaseConfig(process.cwd(), {}),
    /Production Turso configuration is required/,
  );
});

test('production packaging validates the URL and accepts an explicit secure config file', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kumakh-build-config-'));
  const config = path.join(directory, 'production.env');
  fs.writeFileSync(config, 'TURSO_DATABASE_URL=libsql://production.example\nTURSO_AUTH_TOKEN=release-secret\n');
  try {
    assert.deepEqual(
      validateProductionDatabaseConfig(directory, { TURSO_CONFIG_FILE: config }),
      { url: 'libsql://production.example', authToken: 'release-secret' },
    );
    assert.throws(
      () => validateProductionDatabaseConfig(directory, {
        TURSO_DATABASE_URL: 'not-a-url',
        TURSO_AUTH_TOKEN: 'release-secret',
      }),
      /must be a database endpoint/,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('database and configuration are outside replaceable installation files', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.js'), 'utf8');
  const database = fs.readFileSync(path.join(__dirname, '..', 'electron', 'database.js'), 'utf8');
  const media = fs.readFileSync(path.join(__dirname, '..', 'electron', 'person-files.js'), 'utf8');
  assert.match(main, /app\.setPath\("userData"/);
  assert.match(main, /SELECT \* FROM StudentMedia WHERE active=1/);
  const config = fs.readFileSync(path.join(__dirname, '..', 'electron', 'turso-config.js'), 'utf8');
  assert.match(config, /runtime\.env/);
  assert.match(config, /resourcesPath.*config.*turso\.env/);
  assert.match(media, /getPath\('userData'\)/);
  assert.match(media, /persistentRoot\(db, 'media'\)/);
  assert.match(media, /function portablePath/);
  assert.doesNotMatch(database, /database\.json/);
});
