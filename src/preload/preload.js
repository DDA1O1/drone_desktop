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
            COMMAND: 'drone:command',      // Send command to drone
            PHOTO_CAPTURE: 'photo:capture',  // Take a photo
            RECORDING_START: 'recording:start', // Start recording
            RECORDING_STOP: 'recording:stop'   // Stop recording
        }
    },

    // One-way communication channels (renderer -> main)
    SEND: {
        DRONE: {
            STREAM_TOGGLE: 'drone:stream-toggle',       // Toggle video stream
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

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'electronAPI',
    {
        invoke: (channel, ...args) => {
            if (validChannels.invoke.includes(channel)) {
                return ipcRenderer.invoke(channel, ...args);
            }
            throw new Error(`Invalid invoke channel: ${channel}`);
        },
        send: (channel, ...args) => {
            if (validChannels.send.includes(channel)) {
                ipcRenderer.send(channel, ...args);
            } else {
                throw new Error(`Invalid send channel: ${channel}`);
            }
        },
        on: (channel, callback) => {
            if (validChannels.receive.includes(channel)) {
                // Deliberately strip event as it includes `sender` 
                const subscription = (event, ...args) => callback(...args);
                ipcRenderer.on(channel, subscription);
                
                // Return a function to remove the event listener
                return () => {
                    ipcRenderer.removeListener(channel, subscription);
                };
            }
            throw new Error(`Invalid receive channel: ${channel}`);
        },
        removeAllListeners: () => {
            // Remove all listeners for valid channels
            [...validChannels.receive].forEach(channel => {
                ipcRenderer.removeAllListeners(channel);
            });
        }
    }
);

console.log('Preload script loaded successfully.');