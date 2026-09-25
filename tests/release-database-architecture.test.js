const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateProductionDatabaseConfig } = require('../scripts/build-win');

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
      /must be a valid URL/,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('database and configuration are outside replaceable installation files', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.js'), 'utf8');
  const database = fs.readFileSync(path.join(__dirname, '..', 'electron', 'database.js'), 'utf8');
  assert.match(main, /app\.setPath\("userData"/);
  assert.match(database, /runtime\.env/);
  assert.match(database, /resources.*config.*turso\.env/);
  assert.doesNotMatch(database, /database\.json/);
});
