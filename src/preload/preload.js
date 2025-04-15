// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
// src/main/preload.js
import { contextBridge, ipcRenderer } from 'electron';

// List of allowed IPC channels
const validChannels = {
  // Commands that expect responses (invoke)
  invoke: [
    'drone:connect',
    'drone:command'
  ],
  // One-way messages (send)
  send: [
    'drone:stream-toggle',
    'drone:capture-photo',
    'drone:recording-toggle',
    'drone:shutdown'
  ],
  // Events from main to renderer (on)
  receive: [
    'drone:state-update',
    'drone:error',
    'drone:connected',
    'drone:disconnected',
    'drone:stream-status',
    'drone:recording-status',
    'drone:photo-captured',
    'drone:recording-stopped'
  ]
};

// Expose protected methods that allow the renderer process to use IPC
contextBridge.exposeInMainWorld('electronAPI', {
  // Two-way communication (invoke/handle)
  invoke: async (channel, data) => {
    if (validChannels.invoke.includes(channel)) {
      return await ipcRenderer.invoke(channel, data);
    }
    console.warn(`Invalid invoke channel: ${channel}`);
    return null;
  },

  // One-way sending (send/on)
  send: (channel, data) => {
    if (validChannels.send.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.warn(`Invalid send channel: ${channel}`);
    }
  },

  // Event listeners (on/removeListener)
  on: (channel, callback) => {
    if (validChannels.receive.includes(channel)) {
      // Wrap the callback to avoid exposing the event object to renderer
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      
      // Return a cleanup function
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
    console.warn(`Invalid receive channel: ${channel}`);
    return () => {}; // Return no-op cleanup function for invalid channels
  },

  // Helper to remove all listeners
  removeAllListeners: () => {
    [...validChannels.receive].forEach(channel => {
      ipcRenderer.removeAllListeners(channel);
    });
    console.log('Removed all IPC listeners');
  }
});

console.log('Preload script loaded.');