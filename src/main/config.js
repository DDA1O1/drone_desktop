import { app } from 'electron';
import path from 'node:path';

export const DRONE_CONFIG = {
    TELLO_IP: '192.168.10.1',
    TELLO_PORT: 8889,
    TELLO_STATE_PORT: 8890,
    TELLO_VIDEO_PORT: 11111,
    LOCAL_WEBSOCKET_STREAM_PORT: 3001,
};

export const MEDIA_CONFIG = {
    MEDIA_FOLDER: path.join(app.getPath('videos'), 'TelloMedia'),
    get PHOTOS_DIR() { return path.join(this.MEDIA_FOLDER, 'photos'); },
    get MP4_DIR() { return path.join(this.MEDIA_FOLDER, 'recordings'); },
};

export const STATE_UPDATE_INTERVAL = 100; // Update UI at most every 100ms

export const COMMAND_CONFIG = {
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    COMMAND_TIMEOUT: 5000,
};

export const WINDOW_CONFIG = {
    DEFAULT_WIDTH: 1200,
    DEFAULT_HEIGHT: 800,
    MIN_WIDTH: 800,
    MIN_HEIGHT: 600,
    BACKGROUND_COLOR: '#2e2c29',
}; 