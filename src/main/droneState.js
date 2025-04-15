import { STATE_UPDATE_INTERVAL } from './config';

class DroneStateManager {
    constructor(onStateUpdate) {
        this.state = {
            connected: false,
            streamEnabled: false,
            isRecording: false,
            battery: null,
            time: null,
            h: 0,
            bat: 0,
            baro: 0.0,
            time: 0,
            pitch: 0,
            roll: 0,
            yaw: 0,
            vgx: 0,
            vgy: 0,
            vgz: 0,
            templ: 0,
            temph: 0,
            tof: 0,
            agx: 0,
            agy: 0,
            agz: 0,
            lastUpdate: null,
        };
        this.lastStateUpdateTime = 0;
        this.onStateUpdate = onStateUpdate;
    }

    parseStateString(stateString) {
        if (!stateString || typeof stateString !== 'string') return;

        const now = Date.now();
        if (now - this.lastStateUpdateTime < STATE_UPDATE_INTERVAL) {
            return;
        }

        try {
            const parts = stateString.trim().split(';');
            const newState = { ...this.state };
            let updated = false;

            parts.forEach(part => {
                const kv = part.split(':');
                if (kv.length === 2 && kv[0] !== '') {
                    const key = kv[0].trim();
                    const value = kv[1].trim();
                    
                    switch(key) {
                        case 'bat':
                            newState.bat = parseInt(value, 10);
                            updated = true;
                            break;
                        case 'time':
                            newState.time = parseInt(value, 10);
                            updated = true;
                            break;
                        case 'h':
                            newState.h = parseInt(value, 10);
                            updated = true;
                            break;
                        case 'baro':
                            newState.baro = parseFloat(value);
                            updated = true;
                            break;
                        default:
                            if (key in newState) {
                                newState[key] = !isNaN(value) ? parseFloat(value) : value;
                                updated = true;
                            }
                    }
                }
            });

            if (updated) {
                newState.lastUpdate = now;
                this.state = newState;
                this.lastStateUpdateTime = now;
                if (this.onStateUpdate) {
                    this.onStateUpdate(this.state);
                }
            }
        } catch (error) {
            console.error('Error parsing drone state:', error);
            console.error('Raw state string:', stateString);
        }
    }

    updateState(updates) {
        this.state = {
            ...this.state,
            ...updates,
        };
        if (this.onStateUpdate) {
            this.onStateUpdate(this.state);
        }
    }

    getState() {
        return { ...this.state };
    }
}

export default DroneStateManager;