const fs = require('fs');
const path = require('path');
const asar = require('@electron/asar');
const { validateRelease } = require('./validate-release');
const verifyPackage = require('./verify-package');

async function verifyRelease(root = path.resolve(__dirname, '..')) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const output = path.join(root, pkg.build.directories.output);
  const appOutDir = path.join(output, 'win-unpacked');
  const resources = path.join(appOutDir, 'resources');
  const installer = path.join(output, `${pkg.build.productName}-Setup-${pkg.version}.exe`);
  const archive = path.join(resources, 'app.asar');

  for (const required of [installer, path.join(appOutDir, `${pkg.build.productName}.exe`), archive]) {
    if (!fs.existsSync(required)) throw new Error(`Release verification failed: required build output missing: ${required}`);
  }
  console.log('[PASS] Windows x64 unpacked build and installer exist.');

  const packagedConfig = path.join(resources, 'config', 'turso.env');
  if (!fs.existsSync(packagedConfig)) throw new Error('Release verification failed: packaged Turso configuration is missing.');
  const entries = asar.listPackage(archive).map(file => file.replace(/^[/\\]/, '').replaceAll('\\', '/'));
  for (const file of [
    'electron/main.js',
    'electron/database.js',
    'electron/turso-pool.js',
    'electron/schema-migrations.js',
    'database/KUMAKH_DATABASE.sql',
    'node_modules/@tursodatabase/sync/package.json',
    'node_modules/@tursodatabase/sync-win32-x64-msvc/package.json',
    'node_modules/sqlite3/package.json',
  ]) {
    if (!entries.includes(file)) throw new Error(`Release verification failed: app.asar is missing ${file}.`);
  }
  console.log('[PASS] ASAR contains startup, migrations, Turso client, schema and production dependencies.');

  const packageConfig = pkg.build;
  if (!packageConfig.asarUnpack.some(pattern => pattern.includes('sqlite3') && pattern.endsWith('.node'))
      || !packageConfig.asarUnpack.some(pattern => pattern.includes('@tursodatabase') && pattern.endsWith('.node'))) {
    throw new Error('Release verification failed: electron-builder asarUnpack does not cover database native modules.');
  }
  const databasePathSource = fs.readFileSync(path.join(root, 'electron', 'database-path.js'), 'utf8');
  if (!/getPath\(['"]userData['"]\)/.test(databasePathSource)) throw new Error('Release verification failed: local database is not resolved through Electron userData.');
  console.log('[PASS] Native modules are unpacked and writable database path uses app.getPath(userData).');

  await verifyPackage({
    appOutDir,
    electronPlatformName: 'win32',
    arch: 'x64',
    packager: {
      projectDir: root,
      appInfo: { productFilename: pkg.build.productName },
    },
  });
  console.log('[PASS] Packaged Electron runtime loaded and exercised sqlite3 and local libSQL.');

  validateRelease(root);
  console.log('[PASS] Installer metadata and hashes validate.');
  return installer;
}

if (require.main === module) {
  verifyRelease().then(installer => console.log(`Release verification passed: ${installer}`)).catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
  });
}

module.exports = { verifyRelease };
