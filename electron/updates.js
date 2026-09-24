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
  try { const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8')); if (Number.isFinite(Date.parse(saved.lastChecked))) lastChecked = saved.lastChecked; } catch (_) { /* First run. */ }
  let state = { currentVersion: app.getVersion(), latestVersion: null, status: enabled ? 'idle' : 'disabled', lastChecked, releaseNotes: '', progress: null, error: null, enabled };
  let checking = false, downloading = false, installing = false;
  let startupTimer, interval;
  const snapshot = () => structuredClone(state);
  const send = (change) => {
    state = { ...state, ...change };
    for (const win of getWindows()) if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send('kumakh:update-state', snapshot());
    return snapshot();
  };
  const fail = () => {
    log.error('Update operation failed. Check connectivity, release artifacts and installer permissions.');
    send({ status: 'error', error: 'The update could not be completed. Check your internet connection and try again. If it persists, contact your administrator.', progress: null });
    if (installing) { installing = false; installFailed?.(); }
  };
  const noteText = info => (Array.isArray(info.releaseNotes) ? info.releaseNotes.map(item => `${item.version || ''}\n${item.note || ''}`).join('\n\n') : String(info.releaseNotes || '')).slice(0, 30000);
  if (enabled) {
    updater.logger = log;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.on('checking-for-update', () => { log.info('Checking for update'); send({ status: 'checking', error: null }); });
    updater.on('update-available', info => { log.info(`Update available: ${info.version}`); send({ status: 'available', latestVersion: info.version, releaseNotes: noteText(info), progress: null }); });
    updater.on('update-not-available', info => { log.info('Application is up to date'); send({ status: 'current', latestVersion: info.version, releaseNotes: '', progress: null }); });
    updater.on('download-progress', progress => send({ status: 'downloading', progress: { percent: Math.max(0, Math.min(100, Number(progress.percent) || 0)), transferred: Number(progress.transferred) || 0, total: Number(progress.total) || 0 } }));
    updater.on('update-downloaded', info => { log.info(`Update downloaded: ${info.version}`); send({ status: 'ready', latestVersion: info.version, error: null, progress: null }); });
    updater.on('error', fail);
  }
  async function check() {
    if (!enabled || checking || downloading || installing || state.status === 'ready') return snapshot();
    checking = true;
    send({ status: 'checking', error: null, latestVersion: null, releaseNotes: '', lastChecked: new Date().toISOString() });
    try {
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify({ lastChecked: state.lastChecked }));
    } catch (_) { log.warn('Could not persist the last update check time'); }
    try { await updater.checkForUpdates(); } catch (_) { fail(); }
    finally { checking = false; }
    return snapshot();
  }
  async function download() {
    if (!enabled || checking || downloading || installing || state.status !== 'available') return snapshot();
    downloading = true;
    send({ status: 'downloading', error: null, progress: { percent: 0, transferred: 0, total: 0 } });
    try { await updater.downloadUpdate(); } catch (_) { fail(); }
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
    } catch (_) { fail(); }
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
