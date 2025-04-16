import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import fs from 'fs';
import { DRONE_CONFIG } from './config';
import path from 'path';

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
                console.log('[Video] Current stream status:', isStreamActive);
                
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
                console.log('[Video] Setting new stream state:', newStreamState);
                this.windowManager.sendToRenderer('drone:stream-status', newStreamState);
                console.log(`[Video] Stream ${newStreamState ? 'resumed' : 'paused'}`);
                
            } catch (error) {
                console.error('[Video] Stream toggle error:', error);
                this.windowManager.sendToRenderer('drone:error', `Failed to toggle video stream: ${error.message}`);
                // Ensure stream status is updated in case of error
                console.log('[Video] Setting stream state to false due to error');
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

        // Photo capture
        ipcMain.handle('photo:capture', async () => {
            try {
                if (!this.streamManager.ffmpegStreamProcess) {
                    throw new Error('Video stream must be active to capture photo');
                }

                const outputPath = this.mediaManager.generateMediaPath('photo', '.jpg');
                console.log('[Photo] Attempting to capture photo to:', outputPath);

                const photoPath = await this.streamManager.capturePhoto(outputPath);
                
                // Notify renderer about successful capture
                this.windowManager.sendToRenderer('drone:photo-captured', photoPath);
                
                return { success: true, data: photoPath };
            } catch (error) {
                console.error('[Photo] Error capturing photo:', error);
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
                    // Explicitly update the UI recording status
                    this.windowManager.sendToRenderer('drone:recording-status', true);
                    return { success: true, path: outputPath };
                }
                return { success: false, error: 'Failed to start recording' };
            } catch (error) {
                console.error('[Recording] Error starting recording:', error);
                // Ensure UI is updated on error
                this.windowManager.sendToRenderer('drone:recording-status', false);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('recording:stop', () => {
            try {
                const success = this.streamManager.stopRecording();
                if (success) {
                    const path = this.mediaManager.getCurrentRecordingPath();
                    this.mediaManager.clearCurrentRecordingPath();
                    // Explicitly update the UI recording status
                    this.windowManager.sendToRenderer('drone:recording-status', false);
                    return { success: true, path };
                }
                return { success: false, error: 'No active recording' };
            } catch (error) {
                console.error('[Recording] Error stopping recording:', error);
                // Ensure UI is updated on error
                this.windowManager.sendToRenderer('drone:recording-status', false);
                return { success: false, error: error.message };
            }
        });
    }

    cleanup() {
        // Remove all handlers
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