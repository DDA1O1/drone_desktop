import fs from 'fs';
import path from 'node:path';
import { MEDIA_CONFIG } from './config';

class MediaManager {
    constructor() {
        this.currentRecordingPath = null;
    }

    initialize() {
        try {
            [MEDIA_CONFIG.MEDIA_FOLDER, MEDIA_CONFIG.PHOTOS_DIR, MEDIA_CONFIG.MP4_DIR].forEach(dir => {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
                    console.log(`Created directory: ${dir}`);
                }
            });

            // Test write permissions
            const testFile = path.join(MEDIA_CONFIG.PHOTOS_DIR, '.testwrite');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            console.log(`Media folders ready at: ${MEDIA_CONFIG.MEDIA_FOLDER}`);
            return true;
        } catch (error) {
            console.error('FATAL: Error creating/verifying media folders:', error);
            throw new Error(`Media folder error: ${error.message}. Check permissions for ${MEDIA_CONFIG.MEDIA_FOLDER}`);
        }
    }

    generateMediaPath(type, extension) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseDir = type === 'photo' ? MEDIA_CONFIG.PHOTOS_DIR : MEDIA_CONFIG.MP4_DIR;
        return path.join(baseDir, `tello_${type}_${timestamp}${extension}`);
    }

    setCurrentRecordingPath(path) {
        this.currentRecordingPath = path;
    }

    getCurrentRecordingPath() {
        return this.currentRecordingPath;
    }

    clearCurrentRecordingPath() {
        this.currentRecordingPath = null;
    }
}

export default MediaManager; 