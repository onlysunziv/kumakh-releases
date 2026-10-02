// Real Electron renderer + preload, with isolated data and no external writes.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kcmt-sync-ui-'));
app.setPath('userData', temporary);
app.disableHardwareAcceleration();
let db, win;
let state = { state: 'offline', pending: true, revision: 0 };
app.whenReady().then(async () => {
  const { Database } = require('../electron/database');
  db = new Database(path.join(temporary, 'fixture.db'), { seed: true });
  await db.open();
  ipcMain.handle('kumakh:api-request', (_, action, payload) => db.request(action, payload));
  ipcMain.handle('kumakh:read-page', (_, name) => fs.readFileSync(path.join(root, 'frontend/pages', path.basename(name)), 'utf8'));
  ipcMain.handle('kumakh:sync-status', () => state);
  ipcMain.handle('kumakh:update-state', () => ({ currentVersion: '1.0.17', state: 'idle' }));
  win = new BrowserWindow({ show: false, width: 1366, height: 900, webPreferences: {
    offscreen: true, backgroundThrottling: false, preload: path.join(root, 'electron/preload.js'),
    contextIsolation: true, nodeIntegration: false, sandbox: false,
  } });
  win.webContents.on('console-message', (_, level, message) => { if (level >= 2) console.error('Renderer:', message); });
  const run = async source => { try { return await win.webContents.executeJavaScript(source); } catch (error) { throw new Error(source.slice(0,100) + ': ' + error.message); } };
  const idle = () => run('new Promise(resolve => window.kumakhLoading.whenIdle(resolve))');
  const settle = () => new Promise(resolve => setTimeout(resolve, 700));
  await win.loadFile(path.join(root, 'frontend/login.html'));
  await settle();
  assert.match(await run("document.getElementById('cloudSyncStatus').textContent"), /LOCAL\/OFFLINE MODE/);
  await run(`sessionStorage.setItem('kumakhSession', JSON.stringify({isAuthenticated:true,sessionToken:'local-fixture',role:'ADMIN',userId:'user-admin',username:'kcmtadmin',permissions:[]}))`);
  await win.loadFile(path.join(root, 'frontend/index.html'));
  await idle();
  await run("loadPage('students')");
  await idle();
  await db.save('Students', { id: 'cloud-student', registration_number: 'SYNC-UI', full_name: 'Cloud Sync Smoke Student', registration_fee: 0, training_course_fee: 0, discount: 0 });
  state = { state: 'synced', revision: 1, domain: 'fixture.turso.io', lastSyncAt: new Date().toISOString() };
  win.webContents.send('kumakh:sync-status', state);
  await settle(); await idle();
  assert.equal(await run("document.getElementById('pageContent').textContent.includes('Cloud Sync Smoke Student')"), true);
  assert.match(await run("document.getElementById('cloudSyncStatus').textContent"), /CLOUD CONNECTED/);
  await run(`const input = document.createElement('input'); input.id='unsaved-sync-test'; document.getElementById('pageContent').appendChild(input); input.value='Keep my draft'; input.dispatchEvent(new Event('input', {bubbles:true}));`);
  win.webContents.send('kumakh:sync-status', { ...state, revision: 2 });
  await settle();
  assert.equal(await run("document.getElementById('unsaved-sync-test').value"), 'Keep my draft');
  assert.equal(await run("document.querySelector('#cloudSyncStatus button').hidden"), false);
  win.webContents.send('kumakh:sync-status', { ...state, state: 'offline', pending: true, revision: 2 });
  await settle();
  assert.match(await run("document.getElementById('cloudSyncStatus').textContent"), /LOCAL\/OFFLINE MODE/);
  const screenshot = process.argv.find(arg => arg.endsWith('.png'));
  if (screenshot) fs.writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG());
  console.log('PASS: login/workspace offline indicator, cloud refresh through real IPC, unsaved draft preservation.');
}).catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (win && !win.isDestroyed()) win.destroy();
  if (db) await db.close();
  // Chromium still owns cache handles until process exit. This temporary
  // profile is intentionally retained for OS cleanup.
  app.exit(process.exitCode || 0);
});
