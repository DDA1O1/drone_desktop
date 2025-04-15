

import { contextBridge, ipcRenderer } from 'electron';

/**
 * IPC Channel Definitions
 * 
 * Defines all valid channels for communication between main and renderer processes.
 * Channels are categorized by their communication pattern.
 */
const IPC_CHANNELS = {
    // Bi-directional communication channels (renderer -> main -> renderer)
    INVOKE: {
        DRONE: {
            CONNECT: 'drone:connect',      // Initialize drone connection
            COMMAND: 'drone:command'       // Send command to drone
        }
    },

    // One-way communication channels (renderer -> main)
    SEND: {
        DRONE: {
            STREAM_TOGGLE: 'drone:stream-toggle',       // Toggle video stream
            CAPTURE_PHOTO: 'drone:capture-photo',       // Take a photo
            RECORDING_TOGGLE: 'drone:recording-toggle', // Toggle video recording
            SHUTDOWN: 'drone:shutdown'                  // Shutdown drone connection
        }
    },

    // Event channels (main -> renderer)
    RECEIVE: {
        DRONE: {
            STATE_UPDATE: 'drone:state-update',         // Drone state updates
            ERROR: 'drone:error',                       // Error notifications
            CONNECTED: 'drone:connected',               // Connection established
            DISCONNECTED: 'drone:disconnected',         // Connection lost
            STREAM_STATUS: 'drone:stream-status',       // Stream state changes
            RECORDING_STATUS: 'drone:recording-status', // Recording state changes
            PHOTO_CAPTURED: 'drone:photo-captured',     // Photo taken
            RECORDING_STOPPED: 'drone:recording-stopped' // Recording completed
        }
    }
};

/**
 * Flatten channel objects into arrays for validation
 */
const validChannels = {
    invoke: Object.values(IPC_CHANNELS.INVOKE.DRONE),
    send: Object.values(IPC_CHANNELS.SEND.DRONE),
    receive: Object.values(IPC_CHANNELS.RECEIVE.DRONE)
};

/**
 * API exposed to renderer process
 * 
 * These methods provide a secure way for the renderer process to communicate
 * with the main process through IPC channels.
 */
const electronAPI = {
    /**
     * Invoke a command and wait for response
     * @param {string} channel - The IPC channel to use
     * @param {any} data - Data to send with the command
     * @returns {Promise<any>} Response from the main process
     */
    invoke: async (channel, data) => {
        if (validChannels.invoke.includes(channel)) {
            return await ipcRenderer.invoke(channel, data);
        }
        console.warn(`Invalid invoke channel: ${channel}`);
        return null;
    },

    /**
     * Send a one-way message to main process
     * @param {string} channel - The IPC channel to use
     * @param {any} data - Data to send
     */
    send: (channel, data) => {
        if (validChannels.send.includes(channel)) {
            ipcRenderer.send(channel, data);
        } else {
            console.warn(`Invalid send channel: ${channel}`);
        }
    },

    /**
     * Subscribe to events from main process
     * @param {string} channel - The IPC channel to listen on
     * @param {Function} callback - Event handler function
     * @returns {Function} Cleanup function to remove the listener
     */
    on: (channel, callback) => {
        if (validChannels.receive.includes(channel)) {
            // Wrap callback to prevent event object exposure to renderer
            const subscription = (_event, ...args) => callback(...args);
            ipcRenderer.on(channel, subscription);
            
            // Return cleanup function
            return () => {
                ipcRenderer.removeListener(channel, subscription);
            };
        }
        console.warn(`Invalid receive channel: ${channel}`);
        return () => {}; // Return no-op cleanup function
    },

    /**
     * Remove all event listeners
     * Useful for cleanup when unmounting components
     */
    removeAllListeners: () => {
        validChannels.receive.forEach(channel => {
            ipcRenderer.removeAllListeners(channel);
        });
        console.log('Removed all IPC listeners');
    }
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

console.log('Preload script loaded successfully.');