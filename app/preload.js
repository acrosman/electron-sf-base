// Preload script.
const { contextBridge, ipcRenderer } = require('electron');  // eslint-disable-line

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object.
// Big hat tip: https://stackoverflow.com/a/59814127/24215.
contextBridge.exposeInMainWorld(
  'api',
  {
    send: (channel, data) => {
      // List channels to allow.
      const validChannels = [
        'find_text',
        'get_log_messages',
        'get_preferences',
        'sf_login',
        'sf_logout',
        'send_log',
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    receive: (channel, func) => {
      const validChannels = [
        'current_preferences',
        'log_messages',
        'response_login',
        'response_logout',
        'response_generic',
        'start_find',
      ];
      if (validChannels.includes(channel)) {
        // Remove the event to avoid information leaks.
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
  },
);
