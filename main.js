const { app, BrowserWindow, screen, globalShortcut } = require("electron");
const path = require("path");
let win = null;

function createOverlay() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    win = new BrowserWindow({
    show: false, // IMPORTANT
    x: 0,
    y: 0,
    width,
    height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver", 1);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.once("ready-to-show", () => {
    app.focus({ steal: true });
    win.show();
    win.focus();
  });
  
  // Keep window focused at all times
  win.on("blur", () => {
    if (win.isVisible()) {
      win.focus();
    }
  });

  screen.on("display-metrics-changed", () => {
    if (win?.isVisible()) {
      app.focus({ steal: true });
      win.focus();
    }
  });

  globalShortcut.register("Escape", () => {
    if (!win) return;

    if (win.isVisible()) {
      win.hide();
    } else {
      app.focus({ steal: true });
      win.show();
      win.focus();
    }
  });

  win.loadFile(path.join(__dirname, "public/index.html"));
}

app.whenReady().then(createOverlay);

app.dock.hide();

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});