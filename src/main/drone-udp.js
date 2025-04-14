import dgram from 'dgram';
import { droneState } from './drone-state';

class DroneUDP {
    constructor() {
        this.socket = dgram.createSocket('udp4');
        this.droneAddress = '192.168.10.1';
        this.dronePort = 8889;
        this.statePort = 8890;

        this.setupSocket();
        this.setupStateListener();
    }

    setupSocket() {
        this.socket.on('error', (err) => {
            console.error('UDP socket error:', err);
        });

        this.socket.bind(this.dronePort);
    }

    setupStateListener() {
        const stateSocket = dgram.createSocket('udp4');
        
        stateSocket.on('message', (msg) => {
            const state = this.parseState(msg.toString());
            droneState.updateState(state);
        });

        stateSocket.bind(this.statePort);
    }

    sendCommand(command) {
        return new Promise((resolve, reject) => {
            this.socket.send(command, this.dronePort, this.droneAddress, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    parseState(stateString) {
        const pairs = stateString.split(';');
        const state = {};
        
        pairs.forEach(pair => {
            const [key, value] = pair.split(':');
            if (key && value) {
                state[key.trim()] = value.trim();
            }
        });

        return state;
    }

    async connect() {
        try {
            await this.sendCommand('command');
            return true;
        } catch (error) {
            console.error('Failed to connect to drone:', error);
            return false;
        }
    }

    async disconnect() {
        this.socket.close();
    }
}

export const droneUDP = new DroneUDP();
export default droneUDP;