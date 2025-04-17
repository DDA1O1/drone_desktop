import { app } from 'electron';
import started from 'electron-squirrel-startup';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';


import DroneStateManager from './droneState';
import DroneCommandManager from './droneCommands';
import MediaManager from './mediaManager';
import StreamManager from './streamManager';
import WindowManager from './windowManager';
import IPCHandlerManager from './ipcHandlers';


updateElectronApp({
  updateSource: {
    type: UpdateSourceType.ElectronPublicUpdateService,
    repo: 'DDA1O1/drone_desktop'
  }}); // additional configuration options available

// // Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

class Application {
    constructor() {
        this.windowManager = new WindowManager();
        this.mediaManager = new MediaManager();
        this.streamManager = new StreamManager();
        this.droneStateManager = new DroneStateManager((state) => {
            this.windowManager.sendToRenderer('drone:state-update', state);
        });
        this.droneCommandManager = new DroneCommandManager();
        this.ipcHandlerManager = new IPCHandlerManager(
            this.droneCommandManager,
            this.streamManager,
            this.mediaManager,
            this.windowManager
        );
    }

    async initialize() {
        try {
            // Initialize media folders
            await this.mediaManager.initialize();

            // Initialize drone communication
            await this.droneCommandManager.initialize((stateString) => {
                this.droneStateManager.parseStateString(stateString);
            });

            // Initialize WebSocket server for video streaming
            await this.streamManager.initializeWebSocketServer();

            // Setup IPC handlers
            this.ipcHandlerManager.setupHandlers();

            // Create the main window
            this.windowManager.createWindow();

            return true;
        } catch (error) {
            console.error('Application initialization failed:', error);
            return false;
        }
    }

    async cleanup() {
        console.log('Performing cleanup...');
        
        try {
            // Stop all active processes
            this.streamManager.cleanup();
            this.droneCommandManager.cleanup();
            this.ipcHandlerManager.cleanup();
            this.windowManager.cleanup();
            
            console.log('Cleanup completed successfully');
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
}

// Create application instance
const application = new Application();

// App event handlers
app.on('ready', async () => {
    const success = await application.initialize();
    if (!success) {
        console.error('Failed to initialize application');
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (application.windowManager.getWindow() === null) {
        application.windowManager.createWindow();
    }
});

app.on('before-quit', async (event) => {
    event.preventDefault();
    await application.cleanup();
    app.exit();
});
