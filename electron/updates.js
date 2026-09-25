const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Keep upstream HTTP diagnostics (which can contain authorization URLs) out of logs.
function safeLogger(log) {
  const secrets = Object.entries(process.env).filter(([key, value]) => /TOKEN|PASSWORD|SECRET|PRIVATE_KEY/.test(key) && value?.length >= 8).map(([, value]) => value);
  return Object.fromEntries(['info', 'warn', 'error', 'debug'].map(level => [level, (...args) => {
    let text = args.map(value => value instanceof Error ? value.message : String(value)).join(' ')
      .replace(/https?:\/\/[^\s"<>]+/gi, '[URL]')
      .replace(/(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)/g, '[REDACTED]')
      .replace(/authorization\s*[:=][^\r\n]*/gi, 'authorization=[REDACTED]')
      .replace(/(authorization|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]');
    for (const secret of secrets) text = text.split(secret).join('[REDACTED]');
    log[level](text);
  }]));
}

function createUpdateService({ app, ipcMain, updater, logger, getWindows, canInstall, prepareInstall, confirmInstall, installFailed, platform = process.platform }) {
  const log = safeLogger(logger);
  const enabled = app.isPackaged && platform === 'win32';
  const stateFile = path.join(app.getPath('userData'), 'update-status.json');
  let lastChecked = null;
  let savedStatus = enabled ? 'idle' : 'disabled';
  let savedLatestVersion = null;
  let savedReleaseNotes = '';
  let savedError = null;
  let savedTechnicalError = '';
  try { const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8')); if (Number.isFinite(Date.parse(saved.lastChecked))) lastChecked = saved.lastChecked; } catch (_) { /* First run. */ }
  try {
    const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (enabled && ['current', 'available', 'error'].includes(saved.status)) savedStatus = saved.status;
    if (typeof saved.latestVersion === 'string' && saved.latestVersion.length <= 64) savedLatestVersion = saved.latestVersion;
    if (typeof saved.releaseNotes === 'string') savedReleaseNotes = saved.releaseNotes.slice(0, 30000);
    if (typeof saved.error === 'string') savedError = saved.error.slice(0, 1000);
    if (typeof saved.technicalError === 'string') savedTechnicalError = saved.technicalError.slice(0, 2000);
  } catch (_) { /* First run. */ }
  let state = { currentVersion: app.getVersion(), latestVersion: savedLatestVersion, status: savedStatus, lastChecked, releaseNotes: savedReleaseNotes, progress: null, error: savedError, technicalError: savedTechnicalError, enabled };
  let checking = false, downloading = false, installing = false;
  let startupTimer, interval;
  const snapshot = () => structuredClone(state);
  const persist = () => {
    try {
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify({
        lastChecked: state.lastChecked,
        status: state.status,
        latestVersion: state.latestVersion,
        releaseNotes: state.releaseNotes,
        error: state.error,
        technicalError: state.technicalError,
      }));
    } catch (_) { log.warn('Could not persist update status'); }
  };
  const send = (change) => {
    state = { ...state, ...change };
    persist();
    for (const win of getWindows()) if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send('kumakh:update-state', snapshot());
    return snapshot();
  };
  const technicalDetails = error => {
    if (!error) return '';
    const value = error instanceof Error ? error.message : error.message || String(error);
    return String(value).replace(/https?:\/\/[^\s"<>]+/gi, '[URL]').slice(0, 2000);
  };
  const describeError = error => {
    const message = technicalDetails(error);
    const originalMessage = String(error?.message || error || '');
    const code = String(error?.code || '').toUpperCase();
    const statusCode = Number(error?.statusCode || error?.response?.statusCode || error?.status || 0);
    if (/latest\.yml/i.test(originalMessage) && /(404|not found|missing|ENOENT)/i.test(originalMessage)) return 'Update metadata (latest.yml) was not found on the release server.';
    if (statusCode === 404 || /\b404\b/.test(message)) return 'The update release or required update file was not found.';
    if (statusCode === 403 || /\b403\b/.test(message)) return 'Access to the update server was denied.';
    if (code === 'ERR_NETWORK_IO_SUSPENDED' || /ERR_NETWORK_IO_SUSPENDED/i.test(message)) return 'The network request was suspended by the operating system. Reconnect and try again.';
    if (code === 'ETIMEDOUT' || /timeout|timed out/i.test(message)) return 'The update server did not respond in time.';
    if (code === 'ENOTFOUND' || code === 'ENETUNREACH' || code === 'ECONNREFUSED' || /network is unreachable|no internet|offline|internet connection/i.test(message)) return 'No internet connection.';
    if (/checksum|sha512|integrity verification/i.test(message)) return 'The downloaded update file failed integrity verification.';
    return 'The update could not be completed.';
  };
  const fail = error => {
    if (state.status === 'error' && state.technicalError) {
      if (installing) { installing = false; installFailed?.(); }
      return snapshot();
    }
    const details = technicalDetails(error);
    log.error(`Update operation failed: ${details || 'unknown error'}`);
    send({ status: 'error', error: describeError(error), technicalError: details, progress: null });
    if (installing) { installing = false; installFailed?.(); }
  };
  const noteText = info => (Array.isArray(info.releaseNotes) ? info.releaseNotes.map(item => `${item.version || ''}\n${item.note || ''}`).join('\n\n') : String(info.releaseNotes || '')).slice(0, 30000);
  if (enabled) {
    updater.logger = log;
    updater.setFeedURL?.({
      provider: 'github',
      owner: 'onlysunziv',
      repo: 'kumakh-releases',
      releaseType: 'release',
    });
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.on('checking-for-update', () => { log.info('Checking for update'); send({ status: 'checking', error: null, technicalError: '', latestVersion: null }); });
    updater.on('update-available', info => { log.info(`Update available: ${info.version}`); send({ status: 'available', latestVersion: info.version, error: null, technicalError: '', releaseNotes: noteText(info), progress: null }); });
    updater.on('update-not-available', info => { log.info(`Application is up to date at ${info.version || state.currentVersion}`); send({ status: 'current', currentVersion: state.currentVersion, latestVersion: info.version || state.currentVersion, error: null, technicalError: '', releaseNotes: '', progress: null }); });
    updater.on('download-progress', progress => send({ status: 'downloading', progress: { percent: Math.max(0, Math.min(100, Number(progress.percent) || 0)), transferred: Number(progress.transferred) || 0, total: Number(progress.total) || 0 } }));
    updater.on('update-downloaded', info => { log.info(`Update downloaded: ${info.version}`); send({ status: 'ready', latestVersion: info.version, error: null, technicalError: '', progress: null }); });
    updater.on('error', fail);
  }
  async function check() {
    if (!enabled || checking || downloading || installing || state.status === 'ready') return snapshot();
    checking = true;
    send({ status: 'checking', error: null, technicalError: '', latestVersion: null, releaseNotes: '', lastChecked: new Date().toISOString() });
    try { await updater.checkForUpdates(); } catch (error) { fail(error); }
    finally { checking = false; }
    return snapshot();
  }
  async function download() {
    if (!enabled || checking || downloading || installing || state.status !== 'available') return snapshot();
    downloading = true;
    send({ status: 'downloading', error: null, progress: { percent: 0, transferred: 0, total: 0 } });
    try { await updater.downloadUpdate(); } catch (error) { fail(error); }
    finally { downloading = false; }
    return snapshot();
  }
  async function install(event) {
    if (!enabled || installing || downloading || state.status !== 'ready') return snapshot();
    if (!canInstall(event)) return { ...snapshot(), notice: 'Save or cancel your work and sign out first. Then select Restart & Install on the login screen.' };
    installing = true;
    try {
      if (!await confirmInstall(event)) return snapshot();
      if (!canInstall(event)) return { ...snapshot(), notice: 'An operation is still active. Please wait and try again.' };
      send({ status: 'installing', error: null });
      await prepareInstall();
      updater.quitAndInstall(false, true);
    } catch (error) { fail(error); }
    finally { if (state.status !== 'installing') installing = false; }
    return snapshot();
  }
  const allowedUrls = new Set(['index.html', 'login.html', 'pages/cafe.html'].map(name => pathToFileURL(path.join(__dirname, '..', 'frontend', name)).href));
  function trusted(event) {
    return getWindows().some(win => !win.isDestroyed() && win.webContents === event.sender)
      && event.senderFrame === event.sender.mainFrame && allowedUrls.has(event.senderFrame.url.split(/[?#]/)[0]);
  }
  for (const [channel, handler] of Object.entries({ state: snapshot, check, download, install })) {
    ipcMain.handle(`kumakh:update-${channel}`, (event) => {
      if (!trusted(event)) throw new Error('Update request denied.');
      return handler(event);
    });
  }
  return {
    snapshot, check, download, install,
    schedule() {
      if (!enabled || startupTimer) return;
      startupTimer = setTimeout(check, 12000);
      interval = setInterval(check, 6 * 60 * 60 * 1000);
      startupTimer.unref?.(); interval.unref?.();
    },
    dispose() { clearTimeout(startupTimer); clearInterval(interval); },
  };
}

module.exports = { createUpdateService, safeLogger };
