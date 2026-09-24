const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs/promises");
const path = require("path");
const { createWindow } = require("./window");
const { getDatabase, closeDatabase } = require("./database");
const { databasePath } = require("./sqlite-pool");

const isDev = !app.isPackaged;
let syncTimer;
let updates;
let activeOperations = 0;
let preparingUpdate = false;
let databaseClosedForUpdate = false;
const applicationWindows = new Set();

function openApplicationWindow() {
  const window = createWindow('login.html');
  applicationWindows.add(window);
  window.on('closed', () => applicationWindows.delete(window));
  window.webContents.on('will-navigate', event => { if (preparingUpdate) event.preventDefault(); });
  window.once('ready-to-show', () => updates?.schedule());
  return window;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [window] = BrowserWindow.getAllWindows();
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
}

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  console.info(`KUMAKH local replica: ${databasePath()}`);
  const database = await getDatabase({ seed: false, initializePermissions: false });
  syncTimer = setInterval(() => {
    database.syncNow().catch(error => console.warn('Turso background sync unavailable:', error.code || error.message));
  }, 30000);
  syncTimer.unref();
  // Initial Google Sheets import is no longer part of application startup.
  // Turso is the operational source of truth; Sheets is report output only.
  ipcMain.handle('kumakh:setup-status', () => ({ required: false, report: { status: 'DISABLED' } }));
  ipcMain.handle('kumakh:setup-continue', async event => {
    await event.sender.loadFile(path.join(__dirname, '..', 'frontend', 'login.html'));
  });
  ipcMain.handle('kumakh:setup-exit', () => app.quit());
  await database.ensurePermissionCatalog();
  // Convert legacy SQLite chunks to disk without deleting the originals.
  const [legacy] = await database.pool.query('SELECT * FROM StudentMedia WHERE active=1 AND local_path IS NULL');
  for (const row of legacy) await require('./person-files').materialize(database, row);
  ipcMain.handle("kumakh:api-request", async (_event, action, payload) => {
    if (preparingUpdate) throw new Error('The application is restarting to install an update.');
    activeOperations += 1;
    try {
    const database = await getDatabase();
    const result = await database.request(action, payload || {}, {
      onReportProgress: (progress) => {
        if (!_event.sender.isDestroyed()) {
          _event.sender.send('kumakh:report-progress', { ...progress, requestId: payload?.progressRequestId });
        }
      },
    });
    // Never delay a local UI operation on cloud synchronization. Turso sync
    // runs independently so login and offline work remain responsive.
    database.pushChanges().catch(error => {
      console.warn('Turso push pending; local operation succeeded and will retry:', error.code || error.message);
    });
    return result;
    } finally { activeOperations -= 1; }
  });
  ipcMain.handle('kumakh:sync-status', () => database.getSyncStatus());

  ipcMain.handle("kumakh:read-page", async (_event, pageFileName) => {
    const safeFileName = String(pageFileName || "").trim();
    if (!/^[a-z-]+\.html$/i.test(safeFileName)) {
      throw new Error("Invalid page requested.");
    }

    const pagesDirectory = path.join(__dirname, "..", "frontend", "pages");
    const pagePath = path.join(pagesDirectory, safeFileName);
    if (path.dirname(pagePath) !== pagesDirectory) {
      throw new Error("Invalid page requested.");
    }

    return fs.readFile(pagePath, "utf8");
  });

  // Rendering in Electron keeps the A4 PDF identical to the on-screen bill
  // and avoids exposing filesystem or Drive credentials to the renderer.
  ipcMain.handle("kumakh:purchase-bill-pdf", async (_event, documentHtml) => {
    if (preparingUpdate) throw new Error('The application is restarting to install an update.');
    const html = String(documentHtml || "");
    if (!html || html.length > 2_000_000)
      throw new Error("Invalid purchase bill document.");
    const pdfWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    activeOperations += 1;
    try {
      await pdfWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
      );
      const pdf = await pdfWindow.webContents.printToPDF({
        pageSize: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margins: { marginType: "none" },
      });
      return pdf.toString("base64");
    } finally {
      activeOperations -= 1;
      if (!pdfWindow.isDestroyed()) pdfWindow.destroy();
    }
  });

  const log = require('electron-log/main');
  log.transports.file.level = 'info';
  log.transports.file.maxSize = 2 * 1024 * 1024;
  const loginUrl = require('url').pathToFileURL(path.join(__dirname, '..', 'frontend', 'login.html')).href;
  updates = require('./updates').createUpdateService({
    app, ipcMain, updater: require('electron-updater').autoUpdater, logger: log,
    getWindows: () => [...applicationWindows],
    canInstall: () => !preparingUpdate && activeOperations === 0 && applicationWindows.size > 0
      && [...applicationWindows].every(win => win.webContents.getURL() === loginUrl),
    confirmInstall: async event => (await require('electron').dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
      type: 'question', title: 'Install KUMAKH update',
      message: 'Restart and install the downloaded update now?',
      detail: 'Your saved college data will be preserved.',
      buttons: ['Install Later', 'Restart & Install'], defaultId: 0, cancelId: 0, noLink: true,
    })).response === 1,
    prepareInstall: async () => {
      preparingUpdate = true;
      clearInterval(syncTimer);
      await closeDatabase();
      databaseClosedForUpdate = true;
      databaseShutdownStarted = true;
    },
    installFailed: () => {
      require('electron').dialog.showErrorBox('Update installation failed', 'KUMAKH could not start the installer. Your data has not been reset. Reopen the application and try again.');
      // A closed database must never be reused by existing IPC closures.
      if (preparingUpdate) { app.relaunch(); if (databaseClosedForUpdate) app.quit(); else app.exit(1); }
    },
  });
  openApplicationWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openApplicationWindow();
    }
  });
}).catch((error) => {
  console.error("Database startup failed:", error.code || error.message);
  if (error.stack) console.error(error.stack);
  require("electron").dialog.showErrorBox(
    "Database unavailable",
    `The local database replica could not be opened.\n\n${error.code || "DATABASE_STARTUP_FAILED"}: ${error.message}\n\nNo records were reset.`,
  );
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

let databaseShutdownStarted = false;
app.on("before-quit", (event) => {
  updates?.dispose();
  if (databaseShutdownStarted) return;
  event.preventDefault();
  databaseShutdownStarted = true;
  closeDatabase()
    .catch((error) => {
      console.error("Failed to close SQLite database:", error.code || error.message);
    })
    .finally(() => {
      clearInterval(syncTimer);
      app.quit();
    });
});

if (isDev) {
  app.commandLine.appendSwitch("enable-features", "CanvasOopRasterization");
}
