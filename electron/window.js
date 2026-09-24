const { BrowserWindow, shell } = require("electron");
const path = require("path");

function createWindow(startPage = 'login.html') {
  const mainWindow = new BrowserWindow({
    width: 1450,
    height: 950,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#f4f7fb",
    title: "Kumakh College Management System",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      enableRemoteModule: false,
    },
  });

  mainWindow.maximize();
  mainWindow.loadFile(path.join(__dirname, "..", "frontend", startPage));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Keep the desktop shell secure while allowing users to open saved Drive documents.
    if (/^https:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  return mainWindow;
}

module.exports = { createWindow };
