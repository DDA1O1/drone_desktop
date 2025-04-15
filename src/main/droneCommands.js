import dgram from 'dgram';
import { DRONE_CONFIG, COMMAND_CONFIG } from './config';

class DroneCommandManager {
    constructor() {
        this.droneClient = null;
        this.droneStateClient = null;
        this.stateCallback = null;
    }

    initialize(stateCallback) {
        this.stateCallback = stateCallback;
        return new Promise((resolve, reject) => {
            try {
                // Initialize main command client
                this.droneClient = dgram.createSocket('udp4');
                this.droneClient.bind(() => {
                    console.log('Command client ready');
                });

                // Initialize state client
                this.droneStateClient = dgram.createSocket('udp4');
                this.droneStateClient.bind(DRONE_CONFIG.TELLO_STATE_PORT, () => {
                    console.log('State client ready');
                });

                this.droneStateClient.on('message', (msg) => {
                    if (this.stateCallback) {
                        this.stateCallback(msg.toString());
                    }
                });

                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    sendCommand(command) {
        return new Promise((resolve, reject) => {
            if (!this.droneClient) {
                return reject(new Error('Drone UDP client not initialized'));
            }

            let retryCount = 0;

            const attemptCommand = () => {
                console.log(`Sending command: ${command} (attempt ${retryCount + 1}/${COMMAND_CONFIG.MAX_RETRIES})`);
                
                const messageHandler = (msg) => {
                    try {
                        const response = msg.toString('utf8').trim().replace(/\0/g, '');
                        console.log(`Raw drone response to '${command}': ${JSON.stringify(response)}`);

                        if (!response) {
                            throw new Error('Empty response');
                        }

                        this.droneClient.removeListener('message', messageHandler);
                        clearTimeout(timeout);

                        if (response === 'ok' || (command === 'command' && response === 'ok')) {
                            resolve(response);
                        } else if (response.toLowerCase().includes('error')) {
                            throw new Error(`Drone error: ${response}`);
                        } else if (/^[-0-9]+$/.test(response)) {
                            resolve(response);
                        } else if (retryCount < COMMAND_CONFIG.MAX_RETRIES - 1) {
                            console.warn(`Invalid response: ${JSON.stringify(response)}, retrying...`);
                            setTimeout(attemptCommand, COMMAND_CONFIG.RETRY_DELAY);
                            retryCount++;
                        } else {
                            throw new Error(`Invalid response after ${COMMAND_CONFIG.MAX_RETRIES} attempts: ${JSON.stringify(response)}`);
                        }
                    } catch (error) {
                        if (retryCount < COMMAND_CONFIG.MAX_RETRIES - 1) {
                            console.warn(`Error processing response: ${error.message}, retrying...`);
                            setTimeout(attemptCommand, COMMAND_CONFIG.RETRY_DELAY);
                            retryCount++;
                        } else {
                            reject(error);
                        }
                    }
                };

                const timeout = setTimeout(() => {
                    this.droneClient.removeListener('message', messageHandler);
                    if (retryCount < COMMAND_CONFIG.MAX_RETRIES - 1) {
                        console.warn('Command timeout, retrying...');
                        setTimeout(attemptCommand, COMMAND_CONFIG.RETRY_DELAY);
                        retryCount++;
                    } else {
                        reject(new Error(`Timeout waiting for response to command: ${command}`));
                    }
                }, COMMAND_CONFIG.COMMAND_TIMEOUT);

                this.droneClient.once('message', messageHandler);
                this.droneClient.send(command, 0, command.length, DRONE_CONFIG.TELLO_PORT, DRONE_CONFIG.TELLO_IP, (err) => {
                    if (err) {
                        this.droneClient.removeListener('message', messageHandler);
                        clearTimeout(timeout);
                        if (retryCount < COMMAND_CONFIG.MAX_RETRIES - 1) {
                            console.warn('UDP error, retrying...');
                            setTimeout(attemptCommand, COMMAND_CONFIG.RETRY_DELAY);
                            retryCount++;
                        } else {
                            reject(err);
                        }
                    }
                });
            };

            attemptCommand();
        });
    }

    cleanup() {
        if (this.droneClient) {
            this.droneClient.close();
        }
        if (this.droneStateClient) {
            this.droneStateClient.close();
        }
    }
}

export default DroneCommandManager; 