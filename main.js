const { app, BrowserWindow, screen, globalShortcut } = require("electron");
const path = require("path");

let win = null;

function createOverlay() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
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
    focusable: true, // overlays usually shouldn’t steal focus
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  globalShortcut.register("Escape", () => {
    if (!win) return;

    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
    }
  });

  // mac/win behavior varies; this is the “strong” level
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Click-through overlay
  // win.setIgnoreMouseEvents(true, { forward: true });

  win.loadFile(path.join(__dirname, "public/index.html")); // <— adjust path if needed
}

app.whenReady().then(createOverlay);

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});