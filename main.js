const { app, BrowserWindow, screen, globalShortcut, ipcMain } = require("electron");
const { callLLMTools, parseJsonFromLLM } = require('./main/ChatLLM')
const { startMCP, listTools, callTool, stopMcpServer } = require('./main/Mcp')
const { v4: uuidv4 } = require("uuid");
const { marked } = require('marked');
const hljs = require('highlight.js');
const path = require("path");

let win = null;

function createOverlay() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    win = new BrowserWindow({
      show: false,
      frame: false,
      transparent: true,
      fullscreenable: true,
      simpleFullscreen: true, 
      skipTaskbar: true,
      alwaysOnTop: true,
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
    win.setSimpleFullScreen(true);
    win.show();
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

  globalShortcut.register("Option+Shift+=", () => {
    if (!win) return;
    if (!win.isVisible()) win.show();
    win.webContents.send("toggle-regions");
  });

  win.loadFile(path.join(__dirname, "public/index.html"));
}

ipcMain.handle('uuid', async () => {
  return uuidv4()
});

ipcMain.handle('marked', async (event, buffer) => {
  return marked.parse(buffer);
});

ipcMain.handle('highlight', (_event, { code }) => {
  if (typeof code !== 'string') code = String(code ?? '');

  let result = hljs.highlightAuto(code);

  return {
    html: result.value,          // highlighted HTML spans
    language: result.language,   // detected language
  };
});

ipcMain.handle('chat', async (event, messageId, message, history) => {
  const webContents = event.sender;

  feedback = ""
  let attempt = 0 
  while (attempt < 5)
  {
    const content = await callLLMTools(message, history, feedback)
    const result = parseJsonFromLLM(content.content);
    if (result.success) {
      console.log(result.tool);
      break
    }
    else {
      feedback = result.tool;
      console.log(result.tool);
    }
      
      
    attempt += 1;
  }

  // try {
  //   await chatWithLLM(message, history, (chunk) => {
  //     webContents.send(`chat-chunk-${messageId}`, chunk);
  //   });

  //   webContents.send(`chat-end-${messageId}`);
  //   return { messageId };
  // } catch (err) {
  //   console.error('Chat error:', err);
  //   webContents.send(`chat-error-${messageId}`, err.message);
  //   return { messageId };
  // }
});

ipcMain.handle('listTools', async (event) => {
  const tools = await listTools();
  return JSON.stringify(tools, null, 2);
})

ipcMain.handle('callTool', async (event, name, args) => {
  const response = await callTool(name, args);
  return JSON.stringify(response, null, 2);
})

app.whenReady().then(async () => {
  await startMCP();

  // const result = await callTool("custom_ping", {});
  // console.log("PING RESULT:", result);

  // const tools = await listTools();
  // console.log(JSON.stringify(tools, null, 2));

  createOverlay();
})

app.dock.hide();

app.on("will-quit", () => {
  stopMcpServer();
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});