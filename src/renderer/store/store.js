import { configureStore } from '@reduxjs/toolkit';
import droneReducer from './slices/droneSlice';

const store = configureStore({
    reducer: {
        drone: droneReducer
    }
});

export default store;