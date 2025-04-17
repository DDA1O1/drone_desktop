import { BrowserWindow } from 'electron';
import path from 'node:path';
import { WINDOW_CONFIG } from './config';

class WindowManager {
    constructor() {
        this.mainWindow = null;
        this.streamEnabled = false;
    }

    createWindow() {
        this.mainWindow = new BrowserWindow({
            width: WINDOW_CONFIG.DEFAULT_WIDTH,
            height: WINDOW_CONFIG.DEFAULT_HEIGHT,
            minWidth: WINDOW_CONFIG.MIN_WIDTH,
            minHeight: WINDOW_CONFIG.MIN_HEIGHT,
            frame: true,
            show: false,
            icon: path.join(__dirname, '../../assets/icons/Drone.png'),
            backgroundColor: WINDOW_CONFIG.BACKGROUND_COLOR,
            titleBarStyle: 'default',
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
            },
            center: true,
        });

        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
            this.mainWindow.focus();
        });

        if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
            this.mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
        } else {
            const prodPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
            this.mainWindow.loadFile(prodPath);
        }

        // DevTools can still be opened manually with Ctrl+Shift+I
        if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
            this.mainWindow.webContents.openDevTools();
        }

        return this.mainWindow;
    }

    getWindow() {
        return this.mainWindow;
    }

    sendToRenderer(channel, data) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, data);
            if (channel === 'drone:stream-status') {
                this.streamEnabled = data;
            }
        } else {
            console.warn(`Tried to send IPC message to non-existent window: ${channel}`);
        }
    }

    getStreamState() {
        return this.streamEnabled;
    }

    cleanup() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            try {
                this.mainWindow.close();
            } catch (error) {
                console.warn('Error during window cleanup:', error);
            } finally {
                this.mainWindow = null;
            }
        }
    }
}

export default WindowManager; 