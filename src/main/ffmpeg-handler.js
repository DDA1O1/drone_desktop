import { spawn } from 'child_process';
import { ipcMain } from 'electron';

class FFmpegHandler {
    constructor() {
        this.ffmpegProcess = null;
        this.setupIPC();
    }

    setupIPC() {
        ipcMain.on('start-stream', (event, options = {}) => {
            this.startStream(options);
        });

        ipcMain.on('stop-stream', () => {
            this.stopStream();
        });
    }

    startStream({ port = 11111, host = '0.0.0.0', wsPort = 8082 } = {}) {
        if (this.ffmpegProcess) {
            console.log('Stream already running');
            return;
        }

        // FFmpeg command to receive UDP stream and convert it to WebSocket-compatible format
        const ffmpegArgs = [
            '-i', `udp://${host}:${port}`,
            '-f', 'mpegts',
            '-codec:v', 'mpeg1video',
            '-s', '640x480',
            '-b:v', '800k',
            '-r', '30',
            '-bf', '0',
            `http://localhost:${wsPort}/stream`
        ];

        try {
            this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
                detached: false,
                shell: true
            });

            this.ffmpegProcess.stderr.on('data', (data) => {
                console.log('FFmpeg:', data.toString());
            });

            this.ffmpegProcess.on('error', (error) => {
                console.error('FFmpeg error:', error);
            });

            this.ffmpegProcess.on('close', (code) => {
                console.log('FFmpeg process closed with code:', code);
                this.ffmpegProcess = null;
            });

        } catch (error) {
            console.error('Failed to start FFmpeg:', error);
        }
    }

    stopStream() {
        if (this.ffmpegProcess) {
            this.ffmpegProcess.kill();
            this.ffmpegProcess = null;
        }
    }
}

export const ffmpegHandler = new FFmpegHandler();
export default ffmpegHandler;