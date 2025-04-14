import { ipcMain } from 'electron';
import { EventEmitter } from 'events';

class DroneState extends EventEmitter {
    constructor() {
        super();
        this.state = {
            battery: 0,
            flying: false,
            speed: {
                x: 0,
                y: 0,
                z: 0
            },
            temperature: 0,
            height: 0,
            connected: false
        };

        this.setupIPC();
    }

    setupIPC() {
        // Listen for state requests from renderer
        ipcMain.handle('get-drone-state', () => {
            return this.state;
        });

        // Listen for connection state requests
        ipcMain.handle('get-connection-state', () => {
            return this.state.connected;
        });
    }

    updateState(newState) {
        this.state = {
            ...this.state,
            ...newState
        };

        // Emit state change event that will be picked up by the renderer process
        this.emit('stateChange', this.state);
    }

    setConnected(connected) {
        this.state.connected = connected;
        this.emit('connectionChange', connected);
    }

    getState() {
        return this.state;
    }
}

export const droneState = new DroneState();
export default droneState;