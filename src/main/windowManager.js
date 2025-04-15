import { BrowserWindow } from 'electron';
import path from 'node:path';
import { WINDOW_CONFIG } from './config';

class WindowManager {
    constructor() {
        this.mainWindow = null;
    }

    createWindow() {
        this.mainWindow = new BrowserWindow({
            width: WINDOW_CONFIG.DEFAULT_WIDTH,
            height: WINDOW_CONFIG.DEFAULT_HEIGHT,
            minWidth: WINDOW_CONFIG.MIN_WIDTH,
            minHeight: WINDOW_CONFIG.MIN_HEIGHT,
            frame: true,
            show: false,
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

        // Load the app
        if (process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL) {
            this.mainWindow.loadURL(process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL);
        } else {
            this.mainWindow.loadFile(path.join(__dirname, `../renderer/${process.env.MAIN_WINDOW_VITE_NAME}/index.html`));
        }

        return this.mainWindow;
    }

    getWindow() {
        return this.mainWindow;
    }

    sendToRenderer(channel, data) {
        if (this.mainWindow && this.mainWindow.webContents) {
            this.mainWindow.webContents.send(channel, data);
        } else {
            console.warn(`Tried to send IPC message to non-existent window: ${channel}`);
        }
    }

    cleanup() {
        if (this.mainWindow) {
            this.mainWindow.close();
            this.mainWindow = null;
        }
    }
}

export default WindowManager; 