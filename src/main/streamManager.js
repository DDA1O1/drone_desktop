import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import { DRONE_CONFIG } from './config';

class StreamManager {
    constructor() {
        this.wss = null;
        this.ffmpegStreamProcess = null;
        this.ffmpegRecordProcess = null;
    }

    initializeWebSocketServer() {
        return new Promise((resolve, reject) => {
            try {
                this.wss = new WebSocketServer({ port: DRONE_CONFIG.LOCAL_WEBSOCKET_STREAM_PORT });
                console.log(`WebSocket server started on port ${DRONE_CONFIG.LOCAL_WEBSOCKET_STREAM_PORT}`);

                this.wss.on('connection', (ws) => {
                    console.log('New WebSocket client connected');
                    ws.on('error', console.error);
                });

                this.wss.on('error', (error) => {
                    console.error('WebSocket server error:', error);
                    reject(error);
                });

                resolve();
            } catch (error) {
                console.error('Failed to start WebSocket server:', error);
                reject(error);
            }
        });
    }

    startFFmpegStream() {
        if (this.ffmpegStreamProcess) {
            console.log('FFmpeg stream process already running');
            return;
        }

        const args = [
            '-i', `udp://0.0.0.0:${DRONE_CONFIG.TELLO_VIDEO_PORT}`,
            '-f', 'mpegts',
            '-codec:v', 'mpeg1video',
            '-s', '960x720',
            '-b:v', '800k',
            '-r', '30',
            '-bf', '0',
            `http://127.0.0.1:${DRONE_CONFIG.LOCAL_WEBSOCKET_STREAM_PORT}/stream`
        ];

        try {
            this.ffmpegStreamProcess = spawn('ffmpeg', args, {
                detached: false,
                stdio: 'pipe'
            });

            this.ffmpegStreamProcess.stderr.on('data', (data) => {
                console.log(`FFmpeg: ${data.toString()}`);
            });

            this.ffmpegStreamProcess.on('error', (error) => {
                console.error('FFmpeg process error:', error);
            });

            this.ffmpegStreamProcess.on('exit', (code, signal) => {
                if (code !== null) {
                    console.log(`FFmpeg process exited with code ${code}`);
                } else if (signal !== null) {
                    console.log(`FFmpeg process was killed with signal ${signal}`);
                }
                this.ffmpegStreamProcess = null;
            });

        } catch (error) {
            console.error('Failed to start FFmpeg process:', error);
            this.ffmpegStreamProcess = null;
            throw error;
        }
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
            this.ffmpegStreamProcess.kill('SIGINT');
            this.ffmpegStreamProcess = null;
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
        this.stopFFmpegStream();
        this.stopRecording();
        if (this.wss) {
            this.wss.close(() => {
                console.log('WebSocket server closed');
            });
        }
    }
}

export default StreamManager; 