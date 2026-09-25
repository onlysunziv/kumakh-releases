const messages = {
  LOCAL_DATABASE_OPEN_FAILED: 'KUMAKH could not open its local database. Check folder permissions and disk space. Existing records have not been reset.',
  TURSO_CONNECTION_FAILED: 'KUMAKH could not reach Turso. Local changes are retained and will be retried.',
  TURSO_AUTH_FAILED: 'Turso rejected the database credentials.',
  SYNC_FAILED: 'Cloud synchronization is unavailable. Local changes are retained and will be retried.',
  DATABASE_CORRUPTED: 'The local database did not pass validation. Keep this database and its sidecar files; contact your administrator before attempting recovery.',
};
function databaseError(code, detail, cause) {
  return Object.assign(new Error(detail || messages[code], cause ? { cause } : undefined), { code });
}
function classifyDatabaseError(error, fallback = 'LOCAL_DATABASE_OPEN_FAILED') {
  if (messages[error?.code]) return error;
  const text = `${error?.code || ''} ${error?.message || error}`;
  const code = /EACCES|EPERM|ENOSPC|EROFS|SQLITE_CANTOPEN|SQLITE_BUSY|locking error/i.test(text) ? 'LOCAL_DATABASE_OPEN_FAILED'
    : /SQLITE_CORRUPT|SQLITE_NOTADB|malformed|not a database|integrity|foreign.key validation|schema.*validation|missing.*columns/i.test(text) ? 'DATABASE_CORRUPTED'
    : /(?:\b401\b|\b403\b|unauthori[sz]ed|forbidden|token.*(?:expired|invalid)|authentication)/i.test(text) ? 'TURSO_AUTH_FAILED'
      : /ENOTFOUND|ECONN|ETIMEDOUT|fetch failed|network|timeout|timed out|unable to connect/i.test(text) ? (fallback === 'SYNC_FAILED' ? 'SYNC_FAILED' : 'TURSO_CONNECTION_FAILED') : fallback;
  return databaseError(code, String(error?.message || error), error);
}
const secrets = new Set();
function registerSecret(value) { if (value) secrets.add(String(value)); }
function redact(value) {
  let text = String(value);
  for (const secret of secrets) text = text.split(secret).join('[REDACTED]');
  return text.replace(/(?:https?|libsql|turso):\/\/[^\s"<>]+/gi, '[DATABASE_URL]')
    .replace(/Bearer\s+[^\s";,]+/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED]');
}
function logDatabaseError(log, error, fallback) {
  const classified = classifyDatabaseError(error, fallback);
  log.error(`[${classified.code}] ${redact(error?.stack || error)}`);
  return classified;
}
module.exports = { messages, databaseError, classifyDatabaseError, registerSecret, redact, logDatabaseError };
