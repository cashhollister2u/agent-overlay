const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayAPI", {
  uuid: () => ipcRenderer.invoke("uuid"),

  marked: (buffer) => ipcRenderer.invoke("marked", buffer),
  highlight: (code) =>ipcRenderer.invoke('highlight', { code }),

  onToggleRegions: (callback) => ipcRenderer.on("toggle-regions", callback),
  
  addWidget: (callback) => {ipcRenderer.on("addWidget", (_event, payload) => callback(payload));},

  chat: (messageId, message, history, skipTools) => ipcRenderer.invoke("chat", messageId, message, history, skipTools),
  listenToChatStream: (messageId, handlers) => {
     if (handlers.onToolCall)
      ipcRenderer.on(`tool-call-${messageId}`, (_, toolName) => handlers.onToolCall(toolName));
    if (handlers.onChunk)
      ipcRenderer.on(`chat-chunk-${messageId}`, (_, chunk) => handlers.onChunk(chunk));
    if (handlers.onEnd)
      ipcRenderer.once(`chat-end-${messageId}`, () => handlers.onEnd());
    if (handlers.onError)
      ipcRenderer.once(`chat-error-${messageId}`, (_, err) => handlers.onError(err));
  },
  removeChatListeners: (messageId) => {
    ipcRenderer.removeAllListeners(`chat-chunk-${messageId}`);
    ipcRenderer.removeAllListeners(`chat-end-${messageId}`);
    ipcRenderer.removeAllListeners(`chat-error-${messageId}`);
  },

  listTools: () => ipcRenderer.invoke("listTools"),
  callTool: (name, args) => ipcRenderer.invoke("callTool", name, args),
});