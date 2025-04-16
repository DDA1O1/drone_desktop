import { WebSocketServer } from 'ws';
import { spawn, exec } from 'child_process';
import { DRONE_CONFIG } from './config';
import dgram from 'dgram';
import http from 'http';
import { Readable } from 'stream';

class StreamManager {
    constructor() {
        this.wss = null;
        this.httpServer = null;
        this.ffmpegStreamProcess = null;
        this.ffmpegRecordProcess = null;
        this.udpSocket = null;
        this.processMonitorInterval = null;
        this.lastKnownPid = null;
        this.videoStream = null;
        this.clients = new Set();
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
                reuseAddr: true
            });
            
            this.udpSocket.on('error', (err) => {
                console.error('[UDP] Socket error:', err);
            });

            this.udpSocket.on('message', (msg) => {
                if (this.ffmpegStreamProcess) {
                    this.ffmpegStreamProcess.stdin.write(msg);
                }
            });

            await new Promise((resolve, reject) => {
                this.udpSocket.bind(DRONE_CONFIG.TELLO_VIDEO_PORT, () => {
                    console.log(`[UDP] Socket bound to port ${DRONE_CONFIG.TELLO_VIDEO_PORT}`);
                    resolve();
                });
            });

            const args = [
                '-i', 'pipe:0',          // Input from stdin
                '-f', 'mpegts',          // Output format
                '-codec:v', 'mpeg1video', // Video codec
                '-s', '960x720',         // Native Tello resolution
                '-b:v', '1000k',         // Video bitrate
                '-r', '30',              // Frame rate
                '-bf', '0',              // No B-frames
                '-codec:a', 'mp2',       // Audio codec
                '-ar', '44100',          // Audio sample rate
                '-ac', '1',              // Audio channels
                '-b:a', '64k',           // Audio bitrate
                '-f', 'mpegts',          // Output format
                'pipe:1'                 // Output to stdout
            ];

            this.ffmpegStreamProcess = spawn('ffmpeg', args);

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
        if (this.ffmpegRecordProcess) {
            console.log('Recording already in progress');
            return false;
        }

        const args = [
            '-i', `udp://0.0.0.0:${DRONE_CONFIG.TELLO_VIDEO_PORT}`,
            '-f', 'mp4',
            '-codec:v', 'copy',
            outputPath
        ];

        try {
            this.ffmpegRecordProcess = spawn('ffmpeg', args, {
                detached: false,
                stdio: 'pipe'
            });

            this.ffmpegRecordProcess.stderr.on('data', (data) => {
                console.log(`FFmpeg Recording: ${data.toString()}`);
            });

            this.ffmpegRecordProcess.on('error', (error) => {
                console.error('FFmpeg recording process error:', error);
            });

            this.ffmpegRecordProcess.on('exit', (code, signal) => {
                if (code !== null) {
                    console.log(`FFmpeg recording process exited with code ${code}`);
                } else if (signal !== null) {
                    console.log(`FFmpeg recording process was killed with signal ${signal}`);
                }
                this.ffmpegRecordProcess = null;
            });

            return true;
        } catch (error) {
            console.error('Failed to start FFmpeg recording process:', error);
            this.ffmpegRecordProcess = null;
            return false;
        }
    }

    stopFFmpegStream() {
        if (this.ffmpegStreamProcess) {
            console.log('[Video] Stopping FFmpeg stream...');
            try {
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
            this.ffmpegRecordProcess.kill('SIGINT');
            this.ffmpegRecordProcess = null;
            return true;
        }
        return false;
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
                this.udpSocket.close();
            } catch (error) {
                console.error('[UDP] Error closing socket:', error);
            }
            this.udpSocket = null;
        }
        
        if (this.wss) {
            try {
                this.wss.close(() => {
                    console.log('[WebSocket] Server closed');
                });
            } catch (error) {
                console.error('[WebSocket] Error closing server:', error);
            }
            this.wss = null;
        }

        if (this.httpServer) {
            try {
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

        this.clients.clear();
    }
}

export default StreamManager; 