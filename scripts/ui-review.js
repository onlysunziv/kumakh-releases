// Hidden-window visual smoke check; uses a disposable database, never live data.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Database } = require('../electron/database');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kumakh-ui-'));
app.setPath('userData', path.join(temporary, 'browser'));
let database;
app.whenReady().then(async () => {
  database = new Database(path.join(temporary, 'kumakh.db'));
  await database.open();
  ipcMain.handle('review:page', (_event, name) => fs.readFileSync(path.join(root, 'frontend/pages', path.basename(name)), 'utf8'));
  ipcMain.handle('review:api', (_event, action, payload) => database.request(action, payload));
  const window = new BrowserWindow({ show: false, width: 1366, height: 900, webPreferences: { offscreen: true, backgroundThrottling: false, preload: path.join(__dirname, 'ui-review-preload.js'), sandbox: false } });
  const output = path.join(root, '.ui-review');
  fs.mkdirSync(output, { recursive: true });
  const results = [];
  await window.loadFile(path.join(root, 'frontend/index.html'));
  await new Promise(resolve => setTimeout(resolve, 1200));
  for (const page of ['dashboard', 'course', 'students', 'staff', 'payments', 'salary', 'payment-out', 'purchases', 'expenses', 'vendors', 'reports', 'settings']) {
    await window.webContents.executeJavaScript(`loadPage(${JSON.stringify(page)})`);
    await new Promise(resolve => setTimeout(resolve, 650));
    const metrics = await window.webContents.executeJavaScript(`({page:${JSON.stringify(page)}, active:document.querySelector('.nav-item.active')?.dataset.page, horizontalOverflow:document.documentElement.scrollWidth>innerWidth, error:!!document.querySelector('.page-load-error'), busy:document.getElementById('pageContent').getAttribute('aria-busy')})`);
    require('assert').equal(metrics.active, page);
    results.push(metrics);
    if (['dashboard', 'students', 'reports'].includes(page)) {
      fs.writeFileSync(path.join(output, page + '.png'), (await window.webContents.capturePage()).toPNG());
    }
  }
  window.setSize(1100, 720);
  await window.webContents.executeJavaScript("loadPage('vendors')");
  await new Promise(resolve => setTimeout(resolve, 650));
  fs.writeFileSync(path.join(output, 'vendors-1100.png'), (await window.webContents.capturePage()).toPNG());
  await window.loadFile(path.join(root, 'frontend/pages/cafe.html'));
  await new Promise(resolve => setTimeout(resolve, 1500));
  fs.writeFileSync(path.join(output, 'cafe.png'), (await window.webContents.capturePage()).toPNG());
  await window.loadFile(path.join(root, 'frontend/login.html'));
  const toggle = await window.webContents.executeJavaScript("document.getElementById('togglePassword').click(); const first=document.getElementById('password').type; document.getElementById('togglePassword').click(); ({first,second:document.getElementById('password').type,icon:!!document.getElementById('toggleIcon')})");
  require('assert').deepStrictEqual(toggle, {first: 'text', second: 'password', icon: true});
  fs.writeFileSync(path.join(output, 'login.png'), (await window.webContents.capturePage()).toPNG());
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
  window.destroy();
  await database.pool.end(); database = null;
  app.quit();
}).catch(async error => { console.error(error); if (database) await database.pool.end(); app.exit(1); });
