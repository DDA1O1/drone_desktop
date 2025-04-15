import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';
import dgram from 'dgram'; // Node's UDP module
import { WebSocketServer } from 'ws'; // WebSocket server
import { spawn } from 'child_process'; // For FFmpeg
import fs from 'fs';

// --- Configuration ---
const TELLO_IP = '192.168.10.1';
const TELLO_PORT = 8889;
const TELLO_STATE_PORT = 8890;  // Port for receiving state updates (if needed)
const TELLO_VIDEO_PORT = 11111;
const LOCAL_WEBSOCKET_STREAM_PORT = 3001; // Port for JSMpeg to connect to locally
const MEDIA_FOLDER = path.join(app.getPath('videos'), 'TelloMedia'); // Save media in user's Videos folder
const PHOTOS_DIR = path.join(MEDIA_FOLDER, 'photos');
const MP4_DIR = path.join(MEDIA_FOLDER, 'recordings');

// --- Global State (Simplified - you might create a state class/object later) ---
let mainWindow = null;
let droneClient = null; // UDP client
let droneStateClient = null; // UDP client for receiving state updates (if needed)
let wss = null; // WebSocket Server
let ffmpegStreamProcess = null;
let ffmpegRecordProcess = null;
let droneState = {
  connected: false,
  streamEnabled: false,
  isRecording: false,
  battery: null,
  time: null,
  h: 0, // Height (cm)
  bat: 0, // Battery percentage
  baro: 0.0, // Barometer measurement (cm)
  time: 0, // Motor on time
  lastUpdate: null,
};

let currentRecordingPath = null;

// Function to parse the state string from the drone
function parseStateString(stateString) {
  if (!stateString || typeof stateString !== 'string') return;
  // Example state: pitch:0;roll:0;yaw:0;vgx:0;vgy:0;vgz:0;templ:85;temph:87;tof:10;h:0;bat:85;baro:166.07;time:0;agx:6.00;agy:-6.00;agz:-999.00;\r\n
  const parts = stateString.trim().split(';');
  const newState = { ...droneState }; // Copy current state
  let updated = false;

  parts.forEach(part => {
      const kv = part.split(':');
      if (kv.length === 2 && kv[0] !== '') {
          const key = kv[0];
          const value = kv[1];
          if (key in newState) { // Only update keys we are tracking
              // Basic type conversion (can be more robust)
              if (!isNaN(value)) {
                  newState[key] = Number(value);
              } else {
                  newState[key] = value; // Keep as string if not a number
              }
              updated = true;
          }
      }
  });

  if (updated) {
      newState.lastUpdate = Date.now();
      Object.assign(droneState, newState); // Update the global state object
  }
}

// --- Helper Functions ---
function sendToRenderer(channel, data) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, data);
  } else {
    console.warn(`Tried to send IPC message to non-existent window: ${channel}`);
  }
}

function sendDroneCommand(command) {
  return new Promise((resolve, reject) => {
    if (!droneClient) {
      return reject(new Error('Drone UDP client not initialized'));
    }
    console.log(`Sending command: ${command}`);
    // Simple handler for 'ok' or error responses
    const messageHandler = (msg) => {
      const response = msg.toString().trim();
      console.log(`Drone response to '${command}': ${response}`);
      droneClient.removeListener('message', messageHandler); // Clean up listener
      clearTimeout(timeout);
      if (response === 'ok' || (command === 'command' && response === 'ok')) { // SDK connect is just 'ok'
        resolve(response);
      } else if (response.toLowerCase().includes('error')) {
        reject(new Error(`Drone error: ${response}`));
      } else {
        resolve(response); // Resolve with non-'ok'/'error' response (like battery %)
      }
    };

    const errorHandler = (err) => {
      console.error(`UDP send error for command '${command}':`, err);
      droneClient.removeListener('message', messageHandler);
      clearTimeout(timeout);
      reject(err);
    };

    const timeout = setTimeout(() => {
      droneClient.removeListener('message', messageHandler);
      reject(new Error(`Timeout waiting for response to command: ${command}`));
    }, 5000); // 5 second timeout

    droneClient.once('message', messageHandler); // Use 'once' for command responses
    droneClient.send(command, 0, command.length, TELLO_PORT, TELLO_IP, (err) => {
      if (err) {
        errorHandler(err);
      }
    });
  });
}


function createMediaFolders() {
  try {
    [MEDIA_FOLDER, PHOTOS_DIR, MP4_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
        console.log(`Created directory: ${dir}`);
      }
    });
    // Test write permissions (optional but good)
    const testFile = path.join(PHOTOS_DIR, '.testwrite');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log(`Media folders ready at: ${MEDIA_FOLDER}`);
    return true;
  } catch (error) {
    console.error('FATAL: Error creating/verifying media folders:', error);
    sendToRenderer('drone:error', `Media folder error: ${error.message}. Check permissions for ${MEDIA_FOLDER}`);
    // Consider preventing app start or disabling media features
    return false;
  }
}

updateElectronApp({
  updateSource: {
    type: UpdateSourceType.ElectronPublicUpdateService,
    repo: 'DDA1O1/electron-vite'
  }}); // additional configuration options available

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200, // Increased width
    height: 800, // Increased height
    minWidth: 800, // Prevent window from becoming too small
    minHeight: 600,
    frame: true,
    show: false, // Don't show until ready
    backgroundColor: '#2e2c29', // Dark background color
    titleBarStyle: 'default', // Default title bar style
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // Keep true for security
      nodeIntegration: false, // Keep false for security
    },
    // centre the window on the screen
    center: true,
  });

  // Gracefully show window when ready to prevent flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Optional: Focus the window
    mainWindow.focus();
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
   mainWindow.webContents.openDevTools();
};

function initializeUDP() {
  if (droneClient) {
    console.log('Drone UDP client already initialized.');
    return;
  }

  droneClient = dgram.createSocket('udp4');
  droneClient.bind(); // Bind to a random available port for receiving responses

  droneClient.on('listening', () => {
    if (!droneClient) return; // Safety check

    try {
      const address = droneClient.address();
      console.log(`UDP client listening ${address.address}:${address.port}`);
    } catch (err) {
      // Catch potential EBADF or other errors if the socket state is bad
      console.error(`Error getting address in command client 'listening' handler: ${e.message}`);
      // Attempt cleanup if an error occurs here
      if (droneClient) {
        droneClient.close();
        droneClient = null;
      }
      // Optionally notify renderer
             sendToRenderer('drone:error', `UDP Command Socket Error on Listening: ${e.message}`);
    }
    
    
  });

  droneClient.on('error', (err) => {
    console.error(`UDP Command client error:\n${err.stack}`);
    sendToRenderer('drone:error', `UDP Command Error: ${err.message}`);
    // Ensure close is only called if client exists
    const clientToClose = droneClient; // Capture ref before nulling
    droneClient = null; // Nullify the reference *before* closing async might be safer
    if (clientToClose) {
         clientToClose.close();
    }
    if (droneState.connected) { // Only reset if was connected
        droneState.connected = false;
        sendToRenderer('drone:disconnected');
    }
  });

  // General message listener (mainly for state updates if not using command-response)
  // droneClient.on('message', (msg, rinfo) => {
  //   console.log(`UDP Message from ${rinfo.address}:${rinfo.port}: ${msg}`);
  //   // Handle async messages if needed (e.g., Tello EDU state stream)
  // });
}

function initializeWebSocketServer() {
    if (wss) {
        console.log('WebSocket server already initialized.');
        return;
    }
    wss = new WebSocketServer({ port: LOCAL_WEBSOCKET_STREAM_PORT });

    wss.on('listening', () => {
        console.log(`WebSocket server for video stream listening on ws://localhost:${LOCAL_WEBSOCKET_STREAM_PORT}`);
    });

    wss.on('connection', (ws) => {
        console.log(`WebSocket client connected (${wss.clients.size} total)`);
        ws.on('close', () => {
            console.log(`WebSocket client disconnected (${wss.clients.size} total)`);
        });
        ws.on('error', (error) => {
            console.error('WebSocket client error:', error);
        });
    });

    wss.on('error', (error) => {
        console.error('WebSocket server error:', error);
        sendToRenderer('drone:error', `Video Stream Server Error: ${error.message}`);
        wss = null; // Allow re-initialization
    });
}

function startFFmpegStream() {
  if (ffmpegStreamProcess) {
    console.log('FFmpeg stream process already running.');
    return;
  }
  console.log('Starting FFmpeg stream process...');
  initializeWebSocketServer(); // Ensure WSS is running

  // --- FFmpeg Command (Adapt path if needed) ---
  // Option 1: Assume ffmpeg is in PATH
  const ffmpegExecutable = 'ffmpeg';
  // Option 2: Bundle ffmpeg (more complex setup with forge config)
  // const ffmpegExecutable = path.join(app.getAppPath(), 'path/to/bundled/ffmpeg');
  // Option 3: Require user installation and check path

  const ffmpegArgs = [
    '-hide_banner',
    '-loglevel', 'error', // Change to 'info' or 'debug' for more logs
    '-protocol_whitelist', 'file,udp,rtp', // Ensure UDP is allowed
    '-i', `udp://0.0.0.0:${TELLO_VIDEO_PORT}?overrun_nonfatal=1&fifo_size=500000`, // Listen for Tello stream
    // Output options for JSMpeg (MPEG1)
    '-f', 'mpegts',           // Output format: MPEG Transport Stream
    '-codec:v', 'mpeg1video', // Codec for JSMpeg
    '-s', '640x480',          // Output size
    '-b:v', '800k',           // Video bitrate (adjust as needed)
    '-r', '30',               // Frame rate
    '-bf', '0',               // Needed for MPEG1? Maybe not.
    '-q:v', '5',              // Quality (lower is better)
    '-muxdelay', '0.1',       // Reduce muxing delay
    // Output to pipe:1 (stdout)
    'pipe:1'
  ];

  try {
    ffmpegStreamProcess = spawn(ffmpegExecutable, ffmpegArgs);
    console.log(`Spawned FFmpeg stream process (PID: ${ffmpegStreamProcess.pid})`);

    ffmpegStreamProcess.stdout.on('data', (data) => {
      if (wss) {
        wss.clients.forEach((client) => {
          if (client.readyState === 1) { // WebSocket.OPEN
            client.send(data);
          }
        });
      }
      // Also pipe to recording process if active
      if (droneState.isRecording && ffmpegRecordProcess && ffmpegRecordProcess.stdin.writable) {
          ffmpegRecordProcess.stdin.write(data);
      }
    });

    ffmpegStreamProcess.stderr.on('data', (data) => {
      console.error(`FFmpeg Stream STDERR: ${data}`);
      // Maybe send specific errors to renderer?
    });

    ffmpegStreamProcess.on('error', (err) => {
        console.error('Failed to start FFmpeg stream process:', err);
        sendToRenderer('drone:error', `FFmpeg start failed: ${err.message}`);
        ffmpegStreamProcess = null;
        // If stream was intended to be on, signal failure
        if(droneState.streamEnabled) {
            droneState.streamEnabled = false;
            sendToRenderer('drone:stream-status', false);
        }
    });

    ffmpegStreamProcess.on('close', (code) => {
      console.log(`FFmpeg stream process exited with code ${code}`);
      ffmpegStreamProcess = null;
      // If the stream was supposed to be on, signal it stopped unexpectedly
      if(droneState.streamEnabled) {
          console.warn('FFmpeg stream process stopped unexpectedly.');
          droneState.streamEnabled = false;
          sendToRenderer('drone:stream-status', false);
          sendToRenderer('drone:error', 'Video stream process stopped unexpectedly.');
          // Optionally try to restart? Be careful of loops.
      }
       // If we were recording, stop it cleanly
      if (droneState.isRecording) {
        stopRecordingLogic();
      }
    });

  } catch (error) {
    console.error('Error spawning FFmpeg stream:', error);
    sendToRenderer('drone:error', `Error spawning FFmpeg: ${error.message}`);
    ffmpegStreamProcess = null;
  }
}

function stopFFmpegStream() {
  if (ffmpegStreamProcess) {
    console.log('Stopping FFmpeg stream process...');
    ffmpegStreamProcess.kill('SIGTERM'); // Send termination signal
    // Give it a moment to exit gracefully before forcing
    setTimeout(() => {
        if (ffmpegStreamProcess) {
            console.warn('FFmpeg stream process did not exit gracefully, sending SIGKILL.');
            ffmpegStreamProcess.kill('SIGKILL');
        }
    }, 2000);
    ffmpegStreamProcess = null;
  } else {
    console.log('FFmpeg stream process not running.');
  }
   // Close WebSocket server if no stream is running
  if (wss) {
    wss.close(() => console.log('WebSocket server closed.'));
    wss = null;
  }
}

// --- IPC Handlers ---
function setupIPCHandlers() {
  // Connect to Drone SDK
  ipcMain.on('drone:connect', async (event) => {
    if (droneState.connected) {
      console.log('Drone already connected.');
      return;
    }
    try {
      await sendDroneCommand('command');
      droneState.connected = true;
      sendToRenderer('drone:connected');
      sendToRenderer('drone:state-update', droneState); // Send initial state
    
    } catch (error) {
      console.error('Failed to connect to drone SDK:', error);
      droneState.connected = false;
      sendToRenderer('drone:disconnected');
      sendToRenderer('drone:error', `Connection failed: ${error.message}`);
    }
  });

  // Send Generic Command
  ipcMain.on('drone:command', async (event, command) => {
    if (!droneState.connected) {
      sendToRenderer('drone:error', 'Drone not connected.');
      return;
    }
    try {
      const response = await sendDroneCommand(command);
      console.log(`Command '${command}' successful, response: ${response}`);
      // Maybe send specific confirmations to renderer if needed
    } catch (error) {
      console.error(`Failed to send command '${command}':`, error);
      sendToRenderer('drone:error', `Command '${command}' failed: ${error.message}`);
    }
  });

  // Toggle Video Stream
  ipcMain.on('drone:stream-toggle', async (event) => {
    if (!droneState.connected) {
        sendToRenderer('drone:error', 'Drone not connected.');
        return;
    }

    const command = droneState.streamEnabled ? 'streamoff' : 'streamon';
    try {
        await sendDroneCommand(command);
        if (command === 'streamon') {
            // Start FFmpeg *after* drone confirms streamon
            startFFmpegStream();
            droneState.streamEnabled = true;
        } else {
            stopFFmpegStream(); // Stop FFmpeg *after* drone confirms streamoff
             // Stop recording if it was active
            if (droneState.isRecording) {
                stopRecordingLogic(); // Implement this function
            }
            droneState.streamEnabled = false;
        }
        sendToRenderer('drone:stream-status', droneState.streamEnabled);
    } catch (error) {
        console.error(`Failed to toggle stream (${command}):`, error);
        sendToRenderer('drone:error', `Stream ${command} failed: ${error.message}`);
        // Revert state if command failed
         if (command === 'streamon') {
            droneState.streamEnabled = false;
         } else {
            // If streamoff failed, stream might still be considered on?
            // Maybe try stopping ffmpeg anyway? Or leave state as is?
            droneState.streamEnabled = true; // Assume it didn't stop
         }
         sendToRenderer('drone:stream-status', droneState.streamEnabled);
    }
});

  // Capture Photo (Requires FFmpeg running and outputting stills)
  ipcMain.on('drone:capture-photo', async (event) => {
      // This requires FFmpeg to be configured to output still frames constantly
      // Let's implement the simpler approach from your server.js first:
      // Copy the latest frame ffmpeg is writing.
      if (!droneState.streamEnabled || !ffmpegStreamProcess) {
          sendToRenderer('drone:error', 'Video stream must be active to capture photo.');
          return;
      }

      // This assumes FFmpeg is configured with a second output like:
      // '-map', '0:v:0', '-vf', 'fps=1', '-update', '1', join(PHOTOS_DIR, 'current_frame.jpg')
      // We haven't added this to startFFmpegStream yet. Needs adaptation.

      // *** Placeholder: Simulate photo capture ***
      console.warn("Photo capture logic needs FFmpeg adaptation.");
      sendToRenderer('drone:error', 'Photo capture not fully implemented yet.');
      // *** End Placeholder ***

      // --- Actual Logic (requires FFmpeg adaptation) ---
      /*
      const currentFramePath = path.join(PHOTOS_DIR, 'current_frame.jpg');
      if (!fs.existsSync(currentFramePath)) {
          sendToRenderer('drone:error', 'Current frame file not found. Is FFmpeg running correctly?');
          return;
      }

      const timestamp = Date.now();
      const finalPhotoPath = path.join(PHOTOS_DIR, `photo_${timestamp}.jpg`);

      try {
          await fs.promises.copyFile(currentFramePath, finalPhotoPath);
          const fileName = path.basename(finalPhotoPath);
          console.log(`Photo captured: ${fileName}`);
          sendToRenderer('drone:photo-captured', fileName);
      } catch (error) {
          console.error('Failed to copy current frame for photo capture:', error);
          sendToRenderer('drone:error', `Failed to save photo: ${error.message}`);
      }
      */
  });

  // Toggle Recording (Requires piping stream data)
  ipcMain.on('drone:recording-toggle', (event) => {
      // This requires piping ffmpegStreamProcess.stdout to another ffmpeg process
      // that saves to MP4.
      if (!droneState.streamEnabled || !ffmpegStreamProcess) {
          sendToRenderer('drone:error', 'Video stream must be active to record.');
          return;
      }

       // *** Placeholder: Simulate recording toggle ***
      console.warn("Recording logic needs implementation.");
      droneState.isRecording = !droneState.isRecording; // Toggle mock state
      sendToRenderer('drone:recording-status', droneState.isRecording);
      if (!droneState.isRecording) {
          sendToRenderer('drone:recording-stopped', 'simulated_video.mp4');
      }
       // *** End Placeholder ***

      // --- Actual Logic ---
      /*
      if (droneState.isRecording) {
          // Stop recording
          stopRecordingLogic(); // Implement this
      } else {
          // Start recording
          startRecordingLogic(); // Implement this
      }
      */
  });

  // Graceful Shutdown
  ipcMain.on('drone:shutdown', async (event) => {
      console.log('Shutdown requested by renderer.');
      await performGracefulShutdown();
      // Optionally close the app window or the entire app
      if (mainWindow) {
          mainWindow.close();
      }
      // or app.quit();
  });
}

async function performGracefulShutdown() {
  console.log('Performing graceful shutdown...');
  sendToRenderer('drone:error', 'Shutdown initiated...'); // Inform UI

  stopFFmpegStream(); // Will also attempt to stop recording if active

   if (droneState.isRecording && ffmpegRecordProcess) {
        console.log('Stopping recording process during shutdown...');
        // Attempt to end stdin gracefully first
        if (ffmpegRecordProcess.stdin && ffmpegRecordProcess.stdin.writable) {
             ffmpegRecordProcess.stdin.end();
        }
       // Give it a moment before killing
       await new Promise(resolve => setTimeout(resolve, 500));
       if (ffmpegRecordProcess) {
           ffmpegRecordProcess.kill('SIGTERM');
       }
       ffmpegRecordProcess = null;
       droneState.isRecording = false;
       currentRecordingPath = null;
       // Don't send recording stopped message here, as shutdown is happening
   }

  if (droneState.connected && droneClient) {
    try {
      console.log('Sending land command...');
      await sendDroneCommand('land'); // Attempt to land
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a sec
    } catch (error) {
      console.warn('Failed to send land command during shutdown:', error.message);
      try {
         console.log('Sending emergency command as fallback...');
         // Emergency might be needed if land fails or drone is unresponsive
         await sendDroneCommand('emergency');
      } catch (emergError) {
          console.error('Failed to send emergency command during shutdown:', emergError.message);
      }
    } finally {
        droneState.connected = false;
        sendToRenderer('drone:disconnected');
    }
  }

  if (droneClient) {
    droneClient.close(() => {
      console.log('UDP client closed.');
      droneClient = null;
    });
  }

   if (wss) {
        wss.close(() => {
            console.log('WebSocket server closed.');
            wss = null;
        });
        // Force close connections
        wss.clients.forEach(client => client.terminate());
   }


  console.log('Graceful shutdown sequence completed.');
  // Don't call app.quit() here if triggered by window close or IPC,
  // let the natural app lifecycle handle it unless explicitly needed.
}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// --- App Lifecycle ---
app.whenReady().then(() => {
  if (!createMediaFolders()) {
       // Handle the case where media folders couldn't be created (e.g., show error dialog)
        console.error("Exiting due to media folder creation failure.");
        // You might want to show an Electron dialog here
        // dialog.showErrorBox('Initialization Error', `Failed to create media folders in ${MEDIA_FOLDER}. Please check permissions and restart.`);
        app.quit();
        return;
    }
  initializeUDP();
  setupIPCHandlers(); // Setup listeners before window opens
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    performGracefulShutdown().then(() => {
        app.quit();
    });
  }
});

// Handle termination signals for graceful shutdown
['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, async () => {
        console.log(`Received ${signal}, shutting down...`);
        await performGracefulShutdown();
        process.exit(0); // Force exit after cleanup
    });
});
