// Runs before artifact publication, on the actual packaged archive.
const fs = require('fs');
const path = require('path');
const asar = require('@electron/asar');

module.exports = async function verifyPackage(context) {
  const stagingConfig = path.join(context.packager.projectDir, 'build', 'turso-config.env');
  try {
    const dotenv = require('dotenv');
    const resourceConfig = path.join(context.appOutDir, 'resources', 'config', 'turso.env');
    if (!fs.existsSync(resourceConfig)) throw new Error('Packaged application is missing resources/config/turso.env.');
    const config = dotenv.parse(fs.readFileSync(resourceConfig));
    if (!config.TURSO_DATABASE_URL || !config.TURSO_AUTH_TOKEN) throw new Error('Packaged application has incomplete Turso configuration.');
    const archive = path.join(context.appOutDir, 'resources', 'app.asar');
    const files = asar.listPackage(archive).map(name => name.replace(/^[/\\]/, '').replaceAll('\\', '/'));
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
  }
};
