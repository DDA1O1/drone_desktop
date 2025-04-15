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

        const parts = stateString.trim().split(';');
        const newState = { ...this.state };
        let updated = false;

        parts.forEach(part => {
            const kv = part.split(':');
            if (kv.length === 2 && kv[0] !== '') {
                const key = kv[0];
                const value = kv[1];
                if (key in newState) {
                    if (!isNaN(value)) {
                        newState[key] = Number(value);
                    } else {
                        newState[key] = value;
                    }
                    updated = true;
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