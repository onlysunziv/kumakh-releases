// Real Electron/preload/renderer smoke test. Uses a disposable database and a
// fake update provider: never contacts GitHub, Turso, Google or an installer.
const { app, BrowserWindow, ipcMain } = require('electron');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const sourceRoot = process.argv.includes('--packaged') ? path.join(root, 'dist/win-unpacked/resources/app.asar') : root;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kumakh-update-ui-'));
app.setPath('userData', temporary);
app.disableHardwareAcceleration();
const { Database } = require(path.join(sourceRoot, 'electron/database'));
let db, win, service;
app.whenReady().then(async () => {
  db = new Database(path.join(temporary, 'fixture.db'), { seed: !process.argv.includes('--packaged') });
  await db.open();
  ipcMain.handle('kumakh:api-request', (_, action, payload) => db.request(action, payload));
  ipcMain.handle('kumakh:read-page', (_, name) => fs.readFileSync(path.join(sourceRoot, 'frontend/pages', path.basename(name)), 'utf8'));
  ipcMain.handle('kumakh:sync-status', () => ({ state: 'offline' }));
  const updater = new EventEmitter();
  let finishDownload;
  updater.checkForUpdates = async () => updater.emit('update-available', { version: '1.0.1', releaseNotes: '<img src=x onerror="window.unsafeReleaseNotes=true">\nSample release notes.' });
  updater.downloadUpdate = () => new Promise(resolve => { finishDownload = () => { updater.emit('update-downloaded', { version: '1.0.1' }); resolve(); }; });
  let installs = 0;
  updater.quitAndInstall = () => { installs++; };
  service = require(path.join(sourceRoot, 'electron/updates')).createUpdateService({
    app: { isPackaged: true, getVersion: () => '1.0.0', getPath: () => temporary },
    ipcMain, updater, logger: { info() {}, warn() {}, debug() {}, error() {} },
    getWindows: () => win ? [win] : [],
    canInstall: () => win.webContents.getURL().endsWith('/login.html'),
    confirmInstall: async () => true, prepareInstall: async () => {},
  });
  win = new BrowserWindow({ show: false, width: 1366, height: 950, webPreferences: { backgroundThrottling: false, offscreen: true, preload: path.join(sourceRoot, 'electron/preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false } });
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 2) console.error('Renderer:', message); });
  const execute = async script => {
    try { return await win.webContents.executeJavaScript(script); }
    catch (error) { throw new Error(`${script.slice(0, 120)}: ${error.message}`); }
  };
  await win.loadFile(path.join(sourceRoot, 'frontend/login.html'));
  await execute(`sessionStorage.setItem('kumakhSession', JSON.stringify({isAuthenticated:true,sessionToken:'local-fixture',role:'ADMIN',userId:'user-admin',username:'kcmtadmin',fullName:'Administrator',permissions:[]}))`);
  await win.loadFile(path.join(sourceRoot, 'frontend/index.html'));
  await execute(`new Promise(resolve => window.kumakhLoading.whenIdle(resolve))`);
  await execute(`loadPage('settings')`);
  await execute(`new Promise(resolve => window.kumakhLoading.whenIdle(resolve))`);
  await execute(`document.querySelector('[data-settings-tab="updates"]').click(); window.kumakhApp.checkForUpdates()`);
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(await execute(`document.querySelector('[data-update-value="currentVersion"]').textContent`), '1.0.0');
  assert.equal(await execute(`document.querySelector('[data-update-value="latestVersion"]').textContent`), '1.0.1');
  assert.equal(await execute(`Boolean(window.unsafeReleaseNotes || document.querySelector('[data-update-notes] img'))`), false);
  await execute(`document.querySelector('[data-update-action="download"]').click()`);
  updater.emit('download-progress', { percent: 72, transferred: 31 * 1024 * 1024, total: 43 * 1024 * 1024 });
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(await execute(`document.querySelector('progress').value`), 72);
  await new Promise(resolve => setTimeout(resolve, 600));
  const output = path.join(root, '.ui-review'); fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'update-downloading.png'), (await win.webContents.capturePage()).toPNG());
  finishDownload();
  await new Promise(resolve => setTimeout(resolve, 100));
  const blocked = await execute(`window.kumakhApp.installUpdate()`);
  assert.match(blocked.notice, /sign out/); assert.equal(installs, 0);
  await execute(`document.querySelector('[data-update-action="later"]').click()`);
  assert.equal(await execute(`document.getElementById('softwareUpdateAnnouncement').hidden`), true);
  await win.loadFile(path.join(sourceRoot, 'frontend/login.html'));
  await execute(`document.querySelector('details').open = true; window.initializeSoftwareUpdate()`);
  await execute(`document.querySelector('[data-software-update]').scrollIntoView({block:'center'})`);
  await new Promise(resolve => setTimeout(resolve, 600));
  fs.writeFileSync(path.join(output, 'update-login-ready.png'), (await win.webContents.capturePage()).toPNG());
  await execute(`window.kumakhApp.installUpdate()`);
  assert.equal(installs, 1);
  console.log('PASS: real preload IPC, Settings UI, escaped release notes, 72% progress, postponement, workspace restart block, login install request.');
}).catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  service?.dispose(); if (win && !win.isDestroyed()) win.destroy();
  if (db) await db.close();
  app.exit(process.exitCode || 0);
});
