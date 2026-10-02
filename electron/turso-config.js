const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');

function normalizeSyncUrl(value) {
  const text = String(value || '').trim().replace(/\/+$/, '');
  let url;
  try { url = new URL(text); } catch { /* report a safe error below */ }
  if (!url || !['libsql:', 'turso:', 'https:'].includes(url.protocol) || !url.hostname ||
      url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/') ||
      /^(app|docs|api)\.turso\.tech$/i.test(url.hostname) || url.hostname === 'turso.tech') {
    throw Object.assign(new Error('TURSO_DATABASE_URL must be a database endpoint (libsql://, turso://, or https://), not a dashboard link.'), { code: 'TURSO_DATABASE_URL_INVALID' });
  }
  return text;
}
const readEnvFile = file => file && fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};

function resolveConfiguration({ app, resourcesPath, environment = process.env, root = path.resolve(__dirname, '..') } = {}) {
  const runtimeFile = app?.isReady() ? path.join(app.getPath('userData'), 'runtime.env') : null;
  const runtime = readEnvFile(runtimeFile);
  const packaged = app?.isPackaged;
  const source = packaged ? path.join(resourcesPath, 'config', 'turso.env') : path.join(root, '.env');
  // A release carries one complete configuration. Never mix its URL/token with
  // a stale per-PC runtime.env or the developer's shell environment.
  const values = packaged ? readEnvFile(source) : { ...readEnvFile(source), ...environment };
  const rawUrl = String(values.TURSO_DATABASE_URL || '').trim();
  const authToken = String(values.TURSO_AUTH_TOKEN || '').trim();
  if (!rawUrl || !authToken) {
    if (!packaged) return null;
    throw Object.assign(new Error('Packaged Turso URL or token is missing. Rebuild the installer with complete database credentials.'), { code: 'TURSO_PACKAGED_CONFIGURATION_MISSING' });
  }
  return { url: normalizeSyncUrl(rawUrl), authToken, source,
    previousUrl: runtime.TURSO_DATABASE_URL || null };
}

function bindReplica(file, configured) {
  const identity = `${file}.cloud.json`;
  const saved = fs.existsSync(identity) ? JSON.parse(fs.readFileSync(identity, 'utf8')).url : configured.previousUrl;
  // Never send the old database's change log to a different cloud endpoint.
  // Keep the complete old replica and bootstrap a separate cache instead.
  if ((saved && saved.replace(/\/+$/, '') !== configured.url) || (!saved && fs.existsSync(file))) {
    const key = crypto.createHash('sha256').update(configured.url).digest('hex').slice(0, 16);
    file = path.join(path.dirname(file), `cloud-${key}`, 'kumakh-sync.db');
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.cloud.json`, JSON.stringify({ url: configured.url }), { mode: 0o600 });
  return file;
}

module.exports = { normalizeSyncUrl, resolveConfiguration, bindReplica };
