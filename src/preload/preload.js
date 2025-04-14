// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
// src/main/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// List of channels we trust to use ipcRenderer.send/invoke
// We could be more specific and expose functions instead of raw send/invoke
const sendChannels = [
  'drone:connect', // Replaces GET /drone/command
  'drone:command', // Replaces GET /drone/:command (for takeoff, land, etc.)
  'drone:stream-toggle', // Replaces GET /drone/streamon, /drone/streamoff
  'drone:capture-photo', // Replaces POST /capture-photo
  'drone:recording-toggle', // Replaces POST /start-recording, /stop-recording
  'drone:shutdown', // Replaces POST /drone/shutdown
];
const invokeChannels = []; // For two-way communication where main returns a value
const receiveChannels = [
  'drone:state-update', // Replaces SSE /drone-state-stream
  'drone:error', // For sending errors from main to renderer
  'drone:connected', // Signal connection success
  'drone:disconnected', // Signal disconnection
  'drone:stream-status', // Explicit stream status update
  'drone:recording-status', // Explicit recording status update
  'drone:photo-captured', // Confirmation photo saved
  'drone:recording-stopped', // Confirmation recording saved + filename
];

contextBridge.exposeInMainWorld('electronAPI', {
  // One-way from Renderer to Main
  send: (channel, data) => {
    if (sendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.warn(`Blocked attempt to send to untrusted channel: ${channel}`);
    }
  },
  // Two-way Renderer <-> Main
  invoke: async (channel, data) => {
    if (invokeChannels.includes(channel)) { // If we add invoke channels later
      return await ipcRenderer.invoke(channel, data);
    } else {
      console.warn(`Blocked attempt to invoke untrusted channel: ${channel}`);
      return null; // Or throw error
    }
  },
  // One-way from Main to Renderer - Use explicit functions for safety
  onDroneStateUpdate: (callback) => {
    const listener = (event, state) => callback(state);
    ipcRenderer.on('drone:state-update', listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener('drone:state-update', listener);
  },
  onDroneError: (callback) => {
    const listener = (event, errorMsg) => callback(errorMsg);
    ipcRenderer.on('drone:error', listener);
    return () => ipcRenderer.removeListener('drone:error', listener);
  },
  onDroneConnected: (callback) => {
    const listener = (event) => callback();
    ipcRenderer.on('drone:connected', listener);
    return () => ipcRenderer.removeListener('drone:connected', listener);
  },
  onDroneDisconnected: (callback) => {
    const listener = (event) => callback();
    ipcRenderer.on('drone:disconnected', listener);
    return () => ipcRenderer.removeListener('drone:disconnected', listener);
  },
  onStreamStatus: (callback) => {
    const listener = (event, status) => callback(status);
    ipcRenderer.on('drone:stream-status', listener);
    return () => ipcRenderer.removeListener('drone:stream-status', listener);
  },
  onRecordingStatus: (callback) => {
    const listener = (event, status) => callback(status);
    ipcRenderer.on('drone:recording-status', listener);
    return () => ipcRenderer.removeListener('drone:recording-status', listener);
  },
  onPhotoCaptured: (callback) => {
    const listener = (event, fileName) => callback(fileName);
    ipcRenderer.on('drone:photo-captured', listener);
    return () => ipcRenderer.removeListener('drone:photo-captured', listener);
  },
  onRecordingStopped: (callback) => {
    const listener = (event, fileName) => callback(fileName);
    ipcRenderer.on('drone:recording-stopped', listener);
    return () => ipcRenderer.removeListener('drone:recording-stopped', listener);
  },

  // Function to remove all listeners (optional but good practice)
  removeAllListeners: () => {
    receiveChannels.forEach(channel => ipcRenderer.removeAllListeners(channel));
    console.log('Removed all IPC listeners via preload.');
  }
});

console.log('Preload script loaded.');