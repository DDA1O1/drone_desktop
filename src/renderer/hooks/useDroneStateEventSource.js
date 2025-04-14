import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { updateState, setConnected } from '../store/slices/droneSlice';

const useDroneStateEventSource = () => {
    const dispatch = useDispatch();

    useEffect(() => {
        const handleDroneState = (state) => {
            dispatch(updateState(state));
        };

        const handleConnectionState = (connected) => {
            dispatch(setConnected(connected));
        };

        // Set up event listeners for drone state updates
        window.electron.onDroneState(handleDroneState);
        window.electron.onConnectionState(handleConnectionState);

        return () => {
            // Clean up event listeners
            window.electron.removeListener('droneState', handleDroneState);
            window.electron.removeListener('connectionState', handleConnectionState);
        };
    }, [dispatch]);
};

export default useDroneStateEventSource;