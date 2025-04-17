import { WebSocketServer } from 'ws';
import { spawn, exec } from 'child_process';
import { DRONE_CONFIG } from './config';
import dgram from 'dgram';
import path from 'path';
import fs from 'fs';
import { MEDIA_CONFIG } from './config';
import ffmpegPath from 'ffmpeg-static';

class StreamManager {
    constructor(windowManager) {
        this.wss = null;
        this.httpServer = null;
        this.ffmpegStreamProcess = null;
        this.ffmpegRecordProcess = null;
        this.udpSocket = null;
        this.processMonitorInterval = null;
        this.lastKnownPid = null;
        this.videoStream = null;
        this.clients = new Set();
        this.windowManager = windowManager;
        this.photoDir = MEDIA_CONFIG.PHOTOS_DIR;
    }

    async findFFmpegProcess() {
        return new Promise((resolve) => {
            // Check for FFmpeg processes using our video port
            exec(`netstat -ano | findstr "${DRONE_CONFIG.TELLO_VIDEO_PORT}"`, (error, stdout) => {
                if (error || !stdout) {
                    resolve(null);
                    return;
                }

                const lines = stdout.split('\n');
                for (const line of lines) {
                    if (line.includes('UDP') && line.includes(`0.0.0.0:${DRONE_CONFIG.TELLO_VIDEO_PORT}`)) {
                        const pid = line.trim().split(/\s+/).pop();
                        exec(`tasklist | findstr "${pid}"`, (err, output) => {
                            if (!err && output && output.toLowerCase().includes('ffmpeg')) {
                                resolve({ pid: parseInt(pid), command: 'ffmpeg' });
                            } else {
                                resolve(null);
                            }
                        });
                        return;
                    }
                }
                resolve(null);
            });
        });
    }

    async killStaleProcess(pid) {
        return new Promise((resolve) => {
            exec(`taskkill /F /PID ${pid}`, (error) => {
                if (error) {
                    console.error(`[Process] Failed to kill process ${pid}:`, error);
                    resolve(false);
                } else {
                    console.log(`[Process] Successfully killed stale process ${pid}`);
                    resolve(true);
                }
            });
        });
    }

    startProcessMonitor() {
        // Clear any existing monitor
        if (this.processMonitorInterval) {
            clearInterval(this.processMonitorInterval);
        }

        // Start monitoring every 5 seconds
        this.processMonitorInterval = setInterval(async () => {
            const process = await this.findFFmpegProcess();
            
            // If we find a process and it's not our current one, it's stale
            if (process && (!this.ffmpegStreamProcess || process.pid !== this.lastKnownPid)) {
                console.log(`[Monitor] Found stale FFmpeg process (PID: ${process.pid})`);
                await this.killStaleProcess(process.pid);
            }
        }, 5000);
    }

    async checkPortAvailable(port) {
        return new Promise((resolve, reject) => {
            const socket = dgram.createSocket('udp4');
            
            socket.on('error', (err) => {
                socket.close();
                if (err.code === 'EADDRINUSE') {
                    resolve(false);
                } else {
                    reject(err);
                }
            });

            socket.bind(port, '0.0.0.0', () => {
                socket.close();
                resolve(true);
            });
        });
    }

    async ensurePortAvailable(port, maxAttempts = 3) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`[Port] Checking availability of port ${port} (attempt ${attempt}/${maxAttempts})`);
            
            const isAvailable = await this.checkPortAvailable(port);
            if (isAvailable) {
                return true;
            }

            // If port is not available, try to find and kill the process using it
            const process = await this.findFFmpegProcess();
            if (process) {
                console.log(`[Port] Found process ${process.pid} using port ${port}, attempting to kill...`);
                await this.killStaleProcess(process.pid);
                // Wait a bit for the port to be released
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                console.log(`[Port] No FFmpeg process found using port ${port}`);
                // Wait longer if we couldn't find a process to kill
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        return false;
    }

    async initializeWebSocketServer() {
        return new Promise((resolve, reject) => {
            try {
                // Create WebSocket server directly (like reference implementation)
                this.wss = new WebSocketServer({ 
                    port: 8082,
                    perMessageDeflate: false
                });

                this.wss.on('connection', (ws) => {
                    console.log('[WebSocket] Client connected');
                    this.clients.add(ws);
                    
                    ws.on('error', (error) => {
                        console.error('[WebSocket] Client error:', error);
                    });

                    ws.on('close', () => {
                        console.log('[WebSocket] Client disconnected');
                        this.clients.delete(ws);
                    });
                });

                this.wss.on('error', (error) => {
                    console.error('[WebSocket] Server error:', error);
                    reject(error);
                });

                this.wss.on('listening', () => {
                    console.log('[WebSocket] Server started on port 8082');
                    resolve();
                });

            } catch (error) {
                console.error('[WebSocket] Failed to start server:', error);
                reject(error);
            }
        });
    }

    async startFFmpegStream() {
        if (this.ffmpegStreamProcess) {
            console.log('[Video] FFmpeg stream already running');
            return;
        }

        console.log('[Video] Starting FFmpeg stream process...');
        
        try {
            // Create UDP socket to receive video stream
            this.udpSocket = dgram.createSocket({
                type: 'udp4',
                reuseAddr: true,
                recvBufferSize: 1024 * 1024 // 1MB buffer for better frame capture
            });
            
            this.udpSocket.on('error', (err) => {
                console.error('[UDP] Socket error:', err);
            });

            // Create a dedicated message handler for the main video stream
            const streamMessageHandler = (msg) => {
                if (this.ffmpegStreamProcess && !this.ffmpegStreamProcess.killed) {
                    try {
                        this.ffmpegStreamProcess.stdin.write(msg);
                    } catch (error) {
                        console.error('[UDP] Error writing to FFmpeg process:', error);
                    }
                }
            };

            // Add the stream message handler to UDP socket
            this.udpSocket.on('message', streamMessageHandler);

            // Store the handler reference for cleanup
            this.streamMessageHandler = streamMessageHandler;

            await new Promise((resolve, reject) => {
                this.udpSocket.bind(DRONE_CONFIG.TELLO_VIDEO_PORT, () => {
                    console.log(`[UDP] Socket bound to port ${DRONE_CONFIG.TELLO_VIDEO_PORT}`);
                    // Set buffer sizes after binding
                    this.udpSocket.setRecvBufferSize(1024 * 1024);
                    this.udpSocket.setSendBufferSize(1024 * 1024);
                    resolve();
                });

                // Add timeout for bind operation
                setTimeout(() => {
                    reject(new Error('UDP socket bind timeout'));
                }, 5000);
            });

            // Ensure the photos directory exists
            if (!fs.existsSync(this.photoDir)) {
                fs.mkdirSync(this.photoDir, { recursive: true });
            }

            const currentFramePath = path.join(this.photoDir, 'current_frame.jpg');
            
            // Delete existing current frame file if it exists
            if (fs.existsSync(currentFramePath)) {
                try {
                    fs.unlinkSync(currentFramePath);
                } catch (error) {
                    console.warn('[Video] Failed to delete existing current frame file:', error);
                }
            }

            const args = [
                '-hide_banner',           // Hide FFmpeg compilation info
                '-loglevel', 'error',     // Only show errors in logs
                '-f', 'h264',            // Specify input format as H.264
                '-i', 'pipe:0',          // Input from stdin
                '-fflags', '+genpts',    // Generate presentation timestamps

                // First output: MPEG1 video for streaming
                '-map', '0:v:0',         // Map video stream
                '-c:v', 'mpeg1video',    // Video codec
                '-s', '960x720',         // Video size
                '-b:v', '1000k',         // Video bitrate
                '-r', '30',              // Frame rate
                '-bf', '0',              // No B-frames
                '-vf', 'format=yuv420p', // Ensure compatible pixel format
                '-tune', 'zerolatency',  // Optimize for low latency
                '-preset', 'ultrafast',   // Fastest encoding speed
                '-f', 'mpegts',          // Output format
                'pipe:1',                // Output to stdout for streaming

                // Second output: JPEG frames for photo capture
                '-map', '0:v:0',         // Map video stream again
                '-c:v', 'mjpeg',         // JPEG codec for stills
                '-q:v', '2',             // High quality for stills
                '-vf', 'fps=2',          // 2 frames per second is enough for stills
                '-update', '1',          // Update the same file
                '-f', 'image2',          // Output format for stills
                currentFramePath         // Current frame file
            ];

            this.ffmpegStreamProcess = spawn(ffmpegPath, args);

            this.ffmpegStreamProcess.stdout.on('data', (data) => {
                // Broadcast converted video data to all connected clients
                this.clients.forEach(client => {
                    if (client.readyState === 1) { // If client is connected
                        client.send(data);
                    }
                });
            });

            this.ffmpegStreamProcess.stderr.on('data', (data) => {
                const msg = data.toString().trim();
                if (!msg.includes('Last message repeated')) {
                    console.log(`[FFmpeg] ${msg}`);
                }
            });

            this.ffmpegStreamProcess.on('error', (error) => {
                console.error('[FFmpeg] Process error:', error);
                this.cleanup();
            });

            console.log('[Video] FFmpeg process started successfully');

        } catch (error) {
            console.error('[Video] Failed to start stream:', error);
            this.cleanup();
            throw error;
        }
    }

    restartStream() {
        if (this.ffmpegStreamProcess) {
            this.ffmpegStreamProcess.kill('SIGTERM');
            this.ffmpegStreamProcess = null;
        }
        // Wait a second before restarting
        setTimeout(() => {
            this.startFFmpegStream();
        }, 1000);
    }

    startRecording(outputPath) {
        if (!this.ffmpegStreamProcess) {
            console.error('[Recording] Cannot start recording: Video stream is not active');
            return false;
        }

        if (this.ffmpegRecordProcess) {
            console.log('[Recording] Recording already in progress');
            return false;
        }

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            try {
                fs.mkdirSync(outputDir, { recursive: true });
            } catch (error) {
                console.error('[Recording] Failed to create output directory:', error);
                return false;
            }
        }

        // Test write permissions
        try {
            fs.accessSync(outputDir, fs.constants.W_OK);
        } catch (error) {
            console.error('[Recording] No write permission for output directory:', error);
            return false;
        }

        const args = [
            '-hide_banner',
            '-loglevel', 'error',
            '-f', 'h264',            // Input format is H.264
            '-i', 'pipe:0',          // Read from stdin
            '-c:v', 'libx264',       // Use H.264 codec
            '-preset', 'ultrafast',   // Fastest encoding for minimal latency
            '-tune', 'zerolatency',  // Optimize for zero latency
            '-crf', '23',            // Constant Rate Factor (23 is a good balance of quality/size)
            '-profile:v', 'high',    // High profile for better quality
            '-level', '4.1',         // Compatibility level
            '-movflags', '+faststart', // Enable streaming playback before download completes
            '-maxrate', '2500k',     // Maximum bitrate
            '-bufsize', '5000k',     // Buffer size (2x maxrate)
            '-pix_fmt', 'yuv420p',   // Widely compatible pixel format
            '-y',                    // Overwrite output file if exists
            outputPath
        ];

        try {
            this.ffmpegRecordProcess = spawn(ffmpegPath, args);

            // Create a message handler for recording
            const recordingMessageHandler = (msg) => {
                if (this.ffmpegRecordProcess && !this.ffmpegRecordProcess.killed) {
                    try {
                        this.ffmpegRecordProcess.stdin.write(msg);
                    } catch (error) {
                        console.error('[Recording] Error writing to FFmpeg process:', error);
                    }
                }
            };

            // Add the recording message handler to UDP socket
            this.udpSocket.on('message', recordingMessageHandler);

            // Store the handler reference for cleanup
            this.ffmpegRecordProcess.messageHandler = recordingMessageHandler;

            this.ffmpegRecordProcess.stderr.on('data', (data) => {
                const msg = data.toString().trim();
                if (!msg.includes('frame=')) { // Don't log frame progress
                    console.log(`[Recording] FFmpeg: ${msg}`);
                }
            });

            this.ffmpegRecordProcess.on('error', (error) => {
                console.error('[Recording] FFmpeg process error:', error);
                // Remove the message handler on error
                if (this.udpSocket && this.ffmpegRecordProcess.messageHandler) {
                    this.udpSocket.removeListener('message', this.ffmpegRecordProcess.messageHandler);
                }
                this.ffmpegRecordProcess = null;
                // Notify about recording failure
                if (this.windowManager) {
                    this.windowManager.sendToRenderer('drone:recording-status', false);
                }
            });

            this.ffmpegRecordProcess.on('exit', (code, signal) => {
                const wasSuccessful = code === 0;
                console.log(`[Recording] FFmpeg process ${wasSuccessful ? 'completed successfully' : 'failed'}`);
                
                // Remove the message handler on exit
                if (this.udpSocket && this.ffmpegRecordProcess.messageHandler) {
                    this.udpSocket.removeListener('message', this.ffmpegRecordProcess.messageHandler);
                }
                this.ffmpegRecordProcess = null;
                
                // Notify about recording status
                if (this.windowManager) {
                    this.windowManager.sendToRenderer('drone:recording-status', false);
                    if (wasSuccessful) {
                        this.windowManager.sendToRenderer('drone:recording-stopped', outputPath);
                    }
                }
            });

            // Notify that recording has started
            if (this.windowManager) {
                this.windowManager.sendToRenderer('drone:recording-status', true);
            }

            return true;
        } catch (error) {
            console.error('[Recording] Failed to start FFmpeg recording process:', error);
            this.ffmpegRecordProcess = null;
            // Notify about recording failure
            if (this.windowManager) {
                this.windowManager.sendToRenderer('drone:recording-status', false);
            }
            return false;
        }
    }

    stopFFmpegStream() {
        if (this.ffmpegStreamProcess) {
            console.log('[Video] Stopping FFmpeg stream...');
            try {
                // Remove the stream message handler
                if (this.udpSocket && this.streamMessageHandler) {
                    this.udpSocket.removeListener('message', this.streamMessageHandler);
                }
                
                // Remove all listeners before killing the process
                this.ffmpegStreamProcess.stdout.removeAllListeners('data');
                this.ffmpegStreamProcess.stderr.removeAllListeners('data');
                this.ffmpegStreamProcess.removeAllListeners('error');
                this.ffmpegStreamProcess.removeAllListeners('exit');
                
                this.ffmpegStreamProcess.kill('SIGTERM');
            } catch (error) {
                console.error('[Video] Error stopping FFmpeg process:', error);
            }
            this.ffmpegStreamProcess = null;
        }
        
        if (this.udpSocket) {
            try {
                this.udpSocket.close();
            } catch (error) {
                console.error('[UDP] Error closing socket:', error);
            }
            this.udpSocket = null;
        }
    }

    stopRecording() {
        if (this.ffmpegRecordProcess) {
            console.log('[Recording] Stopping recording...');
            try {
                // Remove the specific message handler for this recording process
                if (this.udpSocket && this.ffmpegRecordProcess.messageHandler) {
                    this.udpSocket.removeListener('message', this.ffmpegRecordProcess.messageHandler);
                }

                // Send SIGINT for graceful shutdown to ensure proper file finalization
                this.ffmpegRecordProcess.kill('SIGINT');

                // Notify about recording status
                if (this.windowManager) {
                    this.windowManager.sendToRenderer('drone:recording-status', false);
                }
                return true;
            } catch (error) {
                console.error('[Recording] Error stopping recording:', error);
                this.ffmpegRecordProcess = null;
                // Notify about recording status
                if (this.windowManager) {
                    this.windowManager.sendToRenderer('drone:recording-status', false);
                }
                return false;
            }
        }
        return false;
    }

    async capturePhoto(outputPath) {
        if (!this.ffmpegStreamProcess) {
            throw new Error('Video stream must be active to capture photo');
        }

        const currentFramePath = path.join(this.photoDir, 'current_frame.jpg');
        
        // Wait for the current frame file to exist and be non-empty
        let retries = 10;
        while (retries > 0) {
            try {
                const stats = fs.statSync(currentFramePath);
                if (stats.size > 0) {
                    break;
                }
            } catch (error) {
                // File doesn't exist yet
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            retries--;
        }

        if (retries === 0) {
            throw new Error('Timeout waiting for current frame');
        }

        // Copy the current frame to the destination path
        try {
            fs.copyFileSync(currentFramePath, outputPath);
            console.log(`[Photo] Captured successfully: ${outputPath}`);
            return outputPath;
        } catch (error) {
            console.error('[Photo] Error copying current frame:', error);
            throw new Error(`Failed to capture photo: ${error.message}`);
        }
    }

    cleanup() {
        // Stop the process monitor
        if (this.processMonitorInterval) {
            clearInterval(this.processMonitorInterval);
            this.processMonitorInterval = null;
        }

        // Clean up video stream
        if (this.videoStream) {
            this.videoStream.destroy();
            this.videoStream = null;
        }

        this.stopFFmpegStream();
        this.stopRecording();
        
        if (this.udpSocket) {
            try {
                this.udpSocket.removeAllListeners('error');
                this.udpSocket.removeAllListeners('message');
                this.udpSocket.close();
            } catch (error) {
                console.error('[UDP] Error closing socket:', error);
            }
            this.udpSocket = null;
        }
        
        if (this.wss) {
            try {
                // Properly close all WebSocket client connections
                this.clients.forEach(client => {
                    try {
                        if (client.readyState === 1) { // If client is connected
                            client.close();
                        }
                    } catch (err) {
                        console.error('[WebSocket] Error closing client connection:', err);
                    }
                });
                
                // Remove all server listeners
                this.wss.removeAllListeners('connection');
                this.wss.removeAllListeners('error');
                
                this.wss.close(() => {
                    console.log('[WebSocket] Server closed');
                });
            } catch (error) {
                console.error('[WebSocket] Error closing server:', error);
            }
            this.wss = null;
        }

        // Clear the clients set after closing all connections
        this.clients.clear();

        if (this.httpServer) {
            try {
                this.httpServer.removeAllListeners();
                this.httpServer.close(() => {
                    console.log('[HTTP] Server closed');
                });
            } catch (error) {
                console.error('[HTTP] Error closing server:', error);
            }
            this.httpServer = null;
        }

        // Final check for any stale processes
        this.findFFmpegProcess().then(async (process) => {
            if (process) {
                await this.killStaleProcess(process.pid);
            }
        });
    }
}

export default StreamManager; 