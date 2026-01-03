const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayAPI", {
  uuid: () => ipcRenderer.invoke("uuid"),

  marked: (buffer) => ipcRenderer.invoke("marked", buffer),
  highlight: (code) =>ipcRenderer.invoke('highlight', { code }),

  onToggleRegions: (cb) => ipcRenderer.on("toggle-regions", cb),
  
  chat: (messageId, message, history) => ipcRenderer.invoke("chat", messageId, message, history),
  listenToChatStream: (messageId, handlers) => {
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
  }
});