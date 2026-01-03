const { app, BrowserWindow, screen, globalShortcut, ipcMain } = require("electron");
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const http = require("http");
const axios = require("axios");
const path = require("path");

let win = null;
let mcpProcess = null;
let mcpTools = []; 

async function startMCP() {
  const pyPath = path.join(__dirname, "mcp", ".venv", "bin", "python"); // mac/linux
  // windows would be: path.join(__dirname, "mcp", ".venv", "Scripts", "python.exe")

  const serverPath = path.join(__dirname, "mcp", "mcp_server.py");

  const py = spawn(pyPath, ["-u", serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });

  py.stderr.on("data", (d) => console.log("[py:err]", d.toString()));
  py.stdout.on("data", (d) => console.log("[py:out]", d.toString()));

  py.on("exit", (code) => console.log("python exited", code));

  // establishes handshake
  const initMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 0,
    method: "initialize",
    params: {
      protocolVersion: "v1",
      capabilities: {},
      clientInfo: {
        name: "electron-app",
        version: "1.0.0"
      }
    }
  }) + "\n";

  //tests that the connection is established
  const pingMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "custom_ping",
      arguments: {}
    }
  }) + "\n";

  // Send ping after receiving init response
  py.stdout.on("data", (d) => {
    const line = d.toString();
    try {
      const msg = JSON.parse(line);
      if (msg.id === 0 && msg.result !== undefined) {
        console.log("Initialization complete, sending ping...");
        py.stdin.write(pingMsg);
      }
    } catch (err) {
      console.error("Failed to parse py stdout:", err);
    }
  });

  // Kick off initialization
  py.stdin.write(initMsg);
}

async function chatWithMistral(message, history, onChunk) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 11434,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const body = JSON.stringify({
      model: 'mistral',
      stream: true,
      messages: [...history, { role: "user", content: message }]
    });

    req.write(body);
    req.end();

    let buffer = "";

    req.on("response", (res) => {
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        buffer += chunk;
        const lines = buffer.split("\n");

        buffer = lines.pop(); // save incomplete last line

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const parsed = JSON.parse(line);
            const content = parsed.message?.content || "";

            if (content && typeof onChunk === "function") {
              onChunk(content);
            }
          } catch (err) {
            console.error("Stream parse error:", err);
          }
        }
      });

      res.on("end", () => {
        resolve();
      });
    });

    req.on("error", (err) => reject(err));
  });
}

// Call MCP tool via JSON-RPC
async function callMcpTool(toolName, args) {
  return new Promise((resolve, reject) => {
    const id = Date.now();
    const msg = JSON.stringify({
      jsonrpc: "2.0",
      id: id,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    }) + "\n";

    const handler = (d) => {
      try {
        const response = JSON.parse(d.toString());
        if (response.id === id) {
          mcpProcess.stdout.off("data", handler);
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response.result);
          }
        }
      } catch (err) {
        // Not our response, ignore
      }
    };

    mcpProcess.stdout.on("data", handler);
    mcpProcess.stdin.write(msg);

    // Timeout after 30 seconds
    setTimeout(() => {
      mcpProcess.stdout.off("data", handler);
      reject(new Error("Tool call timeout"));
    }, 30000);
  });
}

function stopMcpServer() {
  if (mcpProcess) {
    mcpProcess.kill();
    mcpProcess = null;
  }
}

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

ipcMain.handle('chat', async (event, messageId, message, history) => {
  const webContents = event.sender;

  try {
    await chatWithMistral(message, history, (chunk) => {
      webContents.send(`chat-chunk-${messageId}`, chunk);
    });

    webContents.send(`chat-end-${messageId}`);
    return { messageId };
  } catch (err) {
    console.error('Chat error:', err);
    webContents.send(`chat-error-${messageId}`, err.message);
    return { messageId };
  }
});

app.whenReady().then(async () => {
  await startMCP();
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