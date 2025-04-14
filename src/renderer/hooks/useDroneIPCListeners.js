// src/renderer/hooks/useDroneIPCListeners.js
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
  setDroneConnection,
  setDroneState,
  setError,
  setStreamEnabled, // For stream status updates
  setRecordingStatus, // For recording status updates
  setRecordingFiles, // For recording stopped updates
  // Import other actions as needed based on preload.js receiveChannels
} from '@/store/slices/droneSlice'; // Adjust path as needed

export function useDroneIPCListeners() {
  const dispatch = useDispatch();

  useEffect(() => {
    console.log('Setting up IPC listeners...');

    // --- Connection Status ---
    const removeConnectedListener = window.electronAPI.onDroneConnected(() => {
      console.log('IPC Received: drone:connected');
      dispatch(setDroneConnection(true));
      dispatch(setError(null)); // Clear previous errors on successful connect
    });

    const removeDisconnectedListener = window.electronAPI.onDroneDisconnected(() => {
      console.log('IPC Received: drone:disconnected');
      dispatch(setDroneConnection(false));
      // Optionally dispatch an error or message indicating disconnection
      // dispatch(setError('Drone disconnected unexpectedly'));
    });

    // --- State Updates ---
    const removeStateListener = window.electronAPI.onDroneStateUpdate((state) => {
       // console.log('IPC Received: drone:state-update', state); // Can be noisy
       // We need to adapt the state structure slightly from the main process one
       // to match the Redux slice structure
        const adaptedState = {
            battery: state.bat, // map 'bat' from main to 'battery' in redux
            time: state.time ? `${state.time}s` : null, // Add 's' suffix if needed by UI
            // Map other fields if your DroneStateDisplay uses them
            speed: `${state.vgx}x ${state.vgy}y ${state.vgz}z`, // Example combined speed
            lastUpdate: state.lastUpdate,
        };
       dispatch(setDroneState(adaptedState));
    });

    // --- Errors ---
    const removeErrorListener = window.electronAPI.onDroneError((errorMsg) => {
      console.log('IPC Received: drone:error', errorMsg);
      dispatch(setError(errorMsg));
    });

    // --- Stream Status ---
    const removeStreamStatusListener = window.electronAPI.onStreamStatus((status) => {
      console.log('IPC Received: drone:stream-status', status);
      dispatch(setStreamEnabled(status));
    });

     // --- Recording Status ---
     const removeRecordingStatusListener = window.electronAPI.onRecordingStatus((status) => {
        console.log('IPC Received: drone:recording-status', status);
        dispatch(setRecordingStatus(status));
        if (status) { // Clear file list when starting recording
            dispatch(setRecordingFiles(null));
        }
     });

     // --- Photo Captured ---
     const removePhotoCapturedListener = window.electronAPI.onPhotoCaptured((fileName) => {
        console.log('IPC Received: drone:photo-captured', fileName);
        // Optionally show a success message, maybe using setError temporarily or a dedicated notification system
        dispatch(setError(`Photo saved: ${fileName}`)); // Example temporary feedback
     });

      // --- Recording Stopped ---
     const removeRecordingStoppedListener = window.electronAPI.onRecordingStopped((fileName) => {
        console.log('IPC Received: drone:recording-stopped', fileName);
        dispatch(setRecordingStatus(false)); // Ensure status is false
        dispatch(setRecordingFiles(fileName ? [fileName] : null)); // Update with the saved file name
        dispatch(setError(`Recording saved: ${fileName}`)); // Example temporary feedback
     });


    // --- Cleanup ---
    // This function runs when the component using the hook unmounts
    return () => {
      console.log('Removing IPC listeners...');
      removeConnectedListener();
      removeDisconnectedListener();
      removeStateListener();
      removeErrorListener();
      removeStreamStatusListener();
      removeRecordingStatusListener();
      removePhotoCapturedListener();
      removeRecordingStoppedListener();
      // Or use the combined cleanup function if you implemented it:
      // window.electronAPI.removeAllListeners();
    };

    // Empty dependency array ensures this effect runs only once on mount and cleans up on unmount
  }, [dispatch]); // Include dispatch in dependency array as per ESLint rules for hooks
}