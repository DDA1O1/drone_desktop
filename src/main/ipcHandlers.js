import { ipcMain } from 'electron';

class IPCHandlerManager {
    constructor(droneCommandManager, streamManager, mediaManager, windowManager) {
        this.droneCommandManager = droneCommandManager;
        this.streamManager = streamManager;
        this.mediaManager = mediaManager;
        this.windowManager = windowManager;
    }

    setupHandlers() {
        // Drone connection
        ipcMain.handle('drone:connect', async () => {
            try {
                // Send the initial 'command' to enter SDK mode
                const response = await this.droneCommandManager.sendCommand('command');
                if (response === 'ok') {
                    this.windowManager.sendToRenderer('drone:connected');
                    return { success: true };
                }
                throw new Error('Failed to enter SDK mode');
            } catch (error) {
                console.error('Error connecting to drone:', error);
                this.windowManager.sendToRenderer('drone:error', error.message);
                return { success: false, error: error.message };
            }
        });

        // Video stream toggle
        ipcMain.on('drone:stream-toggle', async () => {
            console.log('[Video] Received stream toggle request');
            try {
                const isStreamActive = this.streamManager.ffmpegStreamProcess !== null;
                
                if (!isStreamActive) {
                    // First time starting the stream
                    console.log('[Video] Starting video stream...');
                    await this.droneCommandManager.sendCommand('streamon');
                    console.log('[Video] Stream command sent to drone');
                    
                    // Add a delay to allow the drone to start streaming
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    await this.streamManager.startFFmpegStream();
                    console.log('[Video] FFmpeg stream started');
                }
                
                // Just toggle the stream status in the UI - actual pause/play is handled by JSMpeg
                const newStreamState = !this.windowManager.getStreamState();
                this.windowManager.sendToRenderer('drone:stream-status', newStreamState);
                console.log(`[Video] Stream ${newStreamState ? 'resumed' : 'paused'}`);
                
            } catch (error) {
                console.error('[Video] Stream toggle error:', error);
                this.windowManager.sendToRenderer('drone:error', `Failed to toggle video stream: ${error.message}`);
                // Ensure stream status is updated in case of error
                this.windowManager.sendToRenderer('drone:stream-status', false);
                // Only cleanup if we failed to start
                if (!this.streamManager.ffmpegStreamProcess) {
                    this.streamManager.cleanup();
                }
            }
        });

        // Drone commands
        ipcMain.handle('drone:command', async (_, command) => {
            try {
                const response = await this.droneCommandManager.sendCommand(command);
                return { success: true, data: response };
            } catch (error) {
                console.error('Error executing drone command:', error);
                return { success: false, error: error.message };
            }
        });

        // Stream control
        ipcMain.handle('stream:start', async () => {
            try {
                await this.streamManager.startFFmpegStream();
                return { success: true };
            } catch (error) {
                console.error('Error starting stream:', error);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('stream:stop', () => {
            try {
                this.streamManager.stopFFmpegStream();
                return { success: true };
            } catch (error) {
                console.error('Error stopping stream:', error);
                return { success: false, error: error.message };
            }
        });

        // Recording control
        ipcMain.handle('recording:start', async () => {
            try {
                const outputPath = this.mediaManager.generateMediaPath('video', '.mp4');
                const success = await this.streamManager.startRecording(outputPath);
                if (success) {
                    this.mediaManager.setCurrentRecordingPath(outputPath);
                    return { success: true, path: outputPath };
                }
                return { success: false, error: 'Failed to start recording' };
            } catch (error) {
                console.error('Error starting recording:', error);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('recording:stop', () => {
            try {
                const success = this.streamManager.stopRecording();
                if (success) {
                    const path = this.mediaManager.getCurrentRecordingPath();
                    this.mediaManager.clearCurrentRecordingPath();
                    return { success: true, path };
                }
                return { success: false, error: 'No active recording' };
            } catch (error) {
                console.error('Error stopping recording:', error);
                return { success: false, error: error.message };
            }
        });

        // Photo capture
        ipcMain.handle('photo:capture', async () => {
            try {
                const outputPath = this.mediaManager.generateMediaPath('photo', '.jpg');
                // Implement photo capture logic here
                return { success: true, path: outputPath };
            } catch (error) {
                console.error('Error capturing photo:', error);
                return { success: false, error: error.message };
            }
        });
    }

    cleanup() {
        // Remove all listeners
        ipcMain.removeHandler('drone:connect');
        ipcMain.removeHandler('drone:command');
        ipcMain.removeHandler('stream:start');
        ipcMain.removeHandler('stream:stop');
        ipcMain.removeHandler('recording:start');
        ipcMain.removeHandler('recording:stop');
        ipcMain.removeHandler('photo:capture');
    }
}

export default IPCHandlerManager; 