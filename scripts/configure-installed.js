// Explicit, one-time provisioning on each Windows PC. Never runs during a build.
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
function configure() {
  if (process.platform !== 'win32' || !process.env.APPDATA) throw new Error('Run on the Windows user account that runs KUMAKH.');
  const source = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../.env')));
  const keys = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'REPORTS_APPS_SCRIPT_URL', 'REPORTS_API_TOKEN'];
  if (!source.TURSO_DATABASE_URL || !source.TURSO_AUTH_TOKEN) throw new Error('The local .env must contain the existing Turso configuration.');
  const folder = path.join(process.env.APPDATA, 'kumakh-college-management-system');
  const destination = path.join(folder, 'runtime.env');
  fs.mkdirSync(folder, { recursive: true });
  const contents = keys.filter(key => source[key]).map(key => {
    if (/[\r\n"\\]/.test(source[key])) throw new Error(`Unsupported character in ${key}; provision runtime.env manually.`);
    return `${key}="${source[key]}"`;
  }).join('\n') + '\n';
  fs.writeFileSync(destination, contents, { flag: 'wx', mode: 0o600 });
  console.log(`Created ${destination}. Existing database and turso.env were not changed. No credential values were printed.`);
}
try { configure(); } catch (error) {
  console.error(error.code === 'EEXIST' ? 'runtime.env already exists; it was not overwritten.' : error.message);
  process.exitCode = 1;
}
