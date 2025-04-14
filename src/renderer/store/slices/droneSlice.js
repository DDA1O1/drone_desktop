import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const sendCommand = createAsyncThunk(
    'drone/sendCommand',
    async (command) => {
        try {
            await window.electron.sendDroneCommand(command);
            return command;
        } catch (error) {
            throw new Error(`Failed to send command: ${error.message}`);
        }
    }
);

const initialState = {
    battery: 0,
    flying: false,
    speed: {
        x: 0,
        y: 0,
        z: 0
    },
    temperature: 0,
    height: 0,
    lastCommand: null,
    error: null,
    connected: false
};

const droneSlice = createSlice({
    name: 'drone',
    initialState,
    reducers: {
        updateState(state, action) {
            return { ...state, ...action.payload };
        },
        setError(state, action) {
            state.error = action.payload;
        },
        setConnected(state, action) {
            state.connected = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(sendCommand.pending, (state) => {
                state.error = null;
            })
            .addCase(sendCommand.fulfilled, (state, action) => {
                state.lastCommand = action.payload;
            })
            .addCase(sendCommand.rejected, (state, action) => {
                state.error = action.error.message;
            });
    }
});

export const { updateState, setError, setConnected } = droneSlice.actions;
export default droneSlice.reducer;