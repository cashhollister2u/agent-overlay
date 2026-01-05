const { app, BrowserWindow, screen, globalShortcut, ipcMain } = require("electron");
const { selectTool, validateTool, chatWithLLM } = require('./main/ChatLLM')
const { AITools } = require('./main/AITools')
const { AppDatabase } = require('./main/AppDatabase')
const { startMCP, listTools, callTool, stopMcpServer } = require('./main/Mcp')
const { v4: uuidv4 } = require("uuid");
const { marked } = require('marked');
const hljs = require('highlight.js');
const path = require("path");

let win = null;
let db = null;

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

ipcMain.handle('chat', async (event, messageId, message, history, skipTools=false) => {
  const webContents = event.sender;
  let toolContext = null

  if (!skipTools)
  {
    let feedback = "";
    let validatedTool = null;
    let attempt = 0 
    while (attempt < 5)
    {
      webContents.send(`tool-call-${messageId}`, 'Selecting Tool...');
      // AI Selects the best fit tool 
      const content = await selectTool(message, history, feedback)
      // The tool is validated based on the tools available in the mcp server
      const result = await validateTool(content.content);
      if (result.success) {
        validatedTool = result.tool;
        break
      }
      else {
        feedback = result.tool;
        console.log(result.tool);
      }      
      attempt += 1;
    }

    webContents.send(`tool-call-${messageId}`, `Calling tool: ${validatedTool.tool}`);

    //After the tool is validated the tool is called on the mcp server
    const response = await callTool(validatedTool.tool, validatedTool.arguments)
    // The response is recieved from the server and parsed to json object
    toolContext = JSON.parse(response.content[0].text);

    // This allows the mpc server to call subiquent tool calls related to the UI management
    const aiTools = new AITools(toolContext.function_name)
    console.log('validated', await aiTools.validate())
    if (await aiTools.validate()) 
    {
      const uiToolResponse = await aiTools.execute(win, toolContext.args)
      // skip further ai chat calls if the ui tool response specifies 
      if (uiToolResponse.skipAIResponse) {
        webContents.send(`chat-chunk-${messageId}`, uiToolResponse.response);
        webContents.send(`chat-end-${messageId}`);
        return
      }
    }
  }

  // Main Chat response that takes tool info into consideration
  try {
    await chatWithLLM(message, history, toolContext?.content ?? "", (chunk) => {
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

ipcMain.handle('listTools', async (event) => {
  const tools = await listTools();
  return JSON.stringify(tools, null, 2);
})

ipcMain.handle('callTool', async (event, name, args) => {
  const response = await callTool(name, args);
  return JSON.stringify(response, null, 2);
})

ipcMain.handle('get-conversations', async (event) => {
  const response = await db.getConversations();
})

ipcMain.handle('addConversation', async (event, convoId, convoTitle) => {
  let response = await db.addConversation(convoId, convoTitle);
  console.log('added convo to db')
  response = await db.getConversations();
  console.log(response)

})

app.whenReady().then(async () => {
  await startMCP();
  db = new AppDatabase();
  db.init();
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