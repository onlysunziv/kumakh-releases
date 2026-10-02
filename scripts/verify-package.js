// Runs before artifact publication, on the actual packaged archive.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const asar = require('@electron/asar');
const { peMachine } = require('./prepare-native-runtime');

module.exports = async function verifyPackage(context) {
  const stagingConfig = path.join(context.packager.projectDir, 'build', 'turso-config.env');
  const stagedRuntime = path.join(context.packager.projectDir, 'build', 'native-runtime', 'vcruntime140.dll');
  try {
    const dotenv = require('dotenv');
    const resourceConfig = path.join(context.appOutDir, 'resources', 'config', 'turso.env');
    if (!fs.existsSync(resourceConfig)) throw new Error('Packaged application is missing resources/config/turso.env.');
    const config = dotenv.parse(fs.readFileSync(resourceConfig));
    if (!config.TURSO_DATABASE_URL || !config.TURSO_AUTH_TOKEN) throw new Error('Packaged application has incomplete Turso configuration.');
    require('../electron/turso-config').normalizeSyncUrl(config.TURSO_DATABASE_URL);
    const archive = path.join(context.appOutDir, 'resources', 'app.asar');
    const files = asar.listPackage(archive).map(name => name.replace(/^[/\\]/, '').replaceAll('\\', '/'));
    if (context.electronPlatformName === 'win32') {
      const unpacked = path.join(context.appOutDir, 'resources', 'app.asar.unpacked', 'node_modules');
      const nativeBindings = [
        path.join(unpacked, '@tursodatabase', 'sync-win32-x64-msvc', 'sync.win32-x64-msvc.node'),
        path.join(unpacked, 'sqlite3', 'build', 'Release', 'node_sqlite3.node'),
      ];
      for (const binding of nativeBindings) {
        if (!fs.existsSync(binding)) throw new Error(`Packaged Windows x64 database binding is missing: ${path.relative(context.appOutDir, binding)}`);
        if (peMachine(binding) !== 0x8664) throw new Error(`Packaged database binding is not x64: ${path.relative(context.appOutDir, binding)}`);
      }
      const runtime = path.join(path.dirname(nativeBindings[0]), 'vcruntime140.dll');
      if (!fs.existsSync(runtime)) throw new Error('Packaged Turso binding is missing app-local VCRUNTIME140.dll.');
      if (peMachine(runtime) !== 0x8664) throw new Error('Packaged VCRUNTIME140.dll is not x64.');
      const requiredPackages = [
        'node_modules/@tursodatabase/sync/package.json',
        'node_modules/@tursodatabase/sync-win32-x64-msvc/package.json',
        'node_modules/sqlite3/package.json',
      ];
      for (const requiredPackage of requiredPackages) {
        if (!files.includes(requiredPackage)) throw new Error(`Packaged database dependency is missing from app.asar: ${requiredPackage}`);
      }
      const executable = path.join(context.appOutDir, `${context.packager.appInfo.productFilename || 'KCMT'}.exe`);
      const probe = path.join(context.packager.projectDir, 'scripts', 'verify-native-runtime.js');
      const probeExpression = `require(${JSON.stringify(probe)}).verifyPackagedRuntime(${JSON.stringify(context.appOutDir)}).catch(error => { console.error(error.stack || error); process.exitCode = 1; })`;
      const result = spawnSync(executable, ['-e', probeExpression], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        encoding: 'utf8',
        timeout: 60000,
        windowsHide: true,
      });
      if (result.error || result.status !== 0) {
        throw new Error(`Packaged Electron native database runtime probe failed.\n${result.stderr || result.error?.message || `Exit code: ${result.status}`}`);
      }
      if (result.stdout) console.log(result.stdout.trim());
      console.log('Verified packaged Windows x64 Turso/sqlite3 bindings and app-local VCRUNTIME140.dll.');
    }
    const forbidden = /(^|\/)(\.env(?:\..*)?|turso\.env|backups|files|purchase-bills)(\/|$)|\.(db|sqlite|sqlite3)(-|$)|\.(pem|pfx|p12)$/i;
    const secretPattern = /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|"type"\s*:\s*"service_account")/;
    const secrets = [];
    const envFile = path.join(context.packager.projectDir, '.env');
    const values = { ...(fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {}), ...process.env };
    for (const [key, value] of Object.entries(values)) if (/TOKEN|PASSWORD|SECRET|PRIVATE_KEY/.test(key) && String(value).length >= 12) secrets.push(String(value));
    for (const file of files) {
      if (forbidden.test(file)) throw new Error(`Private data or credential file was packaged: ${file}`);
      if (file.startsWith('node_modules/') || !/\.(js|json|html|sql|yml|yaml)$/i.test(file)) continue;
      const content = asar.extractFile(archive, path.normalize(file)).toString();
      if (secretPattern.test(content) || secrets.some(secret => content.includes(secret))) throw new Error(`Credential detected in packaged source: ${file}. Value withheld.`);
    }
    console.log('Packaged application verified: no database, user files, environment files or detected credentials.');
  } finally {
    fs.rmSync(stagingConfig, { force: true });
    fs.rmSync(stagedRuntime, { force: true });
  }
};
