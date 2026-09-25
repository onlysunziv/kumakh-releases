const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function validateProductionDatabaseConfig(root = path.resolve(__dirname, '..'), environment = process.env) {
  const configuredFile = environment.TURSO_CONFIG_FILE;
  let source = environment;
  if (configuredFile) {
    const file = path.resolve(root, configuredFile);
    if (!fs.existsSync(file)) throw new Error(`Production Turso configuration file does not exist: ${file}`);
    source = dotenv.parse(fs.readFileSync(file, 'utf8'));
  }
  const url = String(source.TURSO_DATABASE_URL || '').trim();
  const authToken = String(source.TURSO_AUTH_TOKEN || '').trim();
  if (!url || !authToken) {
    throw new Error('Production Turso configuration is required. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN, or TURSO_CONFIG_FILE, before packaging.');
  }
  let parsed;
  try { parsed = new URL(url); } catch (_) { throw new Error('TURSO_DATABASE_URL must be a valid URL.'); }
  if (!['libsql:', 'turso:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('TURSO_DATABASE_URL must use libsql://, turso://, or https:// and include a host.');
  }
  return { url, authToken };
}

function generateTursoConfig(root = path.resolve(__dirname, '..'), environment = process.env) {
  const config = validateProductionDatabaseConfig(root, environment);
  const output = path.join(root, 'build', 'turso-config.env');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temporary = `${output}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `TURSO_DATABASE_URL=${config.url}\nTURSO_AUTH_TOKEN=${config.authToken}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, output);
  console.log(`Generated production Turso configuration for ${new URL(config.url).host}.`);
  return output;
}

if (require.main === module) {
  try { generateTursoConfig(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { generateTursoConfig, validateProductionDatabaseConfig };
