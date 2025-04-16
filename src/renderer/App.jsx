/**
 * Tello Drone Control Interface
 * This component handles the video streaming and control interface for the Tello drone.
 */
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setDroneConnection, setStreamEnabled, setRecordingStatus, setRecordingFiles, setError, setDroneState } from '@/store/slices/droneSlice';
import JSMpegVideoPlayer from '@/components/JSMpegVideoPlayer'
import DroneControl from '@/components/control/DroneControl'
import DroneStateDisplay from '@/components/DroneStateDisplay'

function App() {
  const dispatch = useDispatch();

  // Set up IPC listeners when the app starts
  useEffect(() => {
    // Connection status
    window.electronAPI.on('drone:connected', () => {
      console.log('Drone connected');
      dispatch(setDroneConnection(true));
    });

    window.electronAPI.on('drone:disconnected', () => {
      console.log('Drone disconnected');
      dispatch(setDroneConnection(false));
    });

    // Stream status
    window.electronAPI.on('drone:stream-status', (enabled) => {
      console.log('Stream status:', enabled);
      dispatch(setStreamEnabled(enabled));
    });

    // Recording status
    window.electronAPI.on('drone:recording-status', (recording) => {
      console.log('Recording status:', recording);
      dispatch(setRecordingStatus(recording));
    });

    window.electronAPI.on('drone:recording-stopped', (filename) => {
      console.log('Recording saved:', filename);
      dispatch(setRecordingFiles(filename));
    });

    // Error handling
    window.electronAPI.on('drone:error', (error) => {
      console.error('Drone error:', error);
      dispatch(setError(error));
    });

    // State updates
    window.electronAPI.on('drone:state-update', (state) => {
      dispatch(setDroneState(state));
    });

    // Cleanup function to remove listeners when component unmounts
    return () => {
      window.electronAPI.removeAllListeners();
    };
  }, [dispatch]);

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden">
      {/* JSMpegVideoPlayer - renders the video stream */}
      <JSMpegVideoPlayer />
      
      {/* Drone controls overlay */}
      <DroneControl />

      {/* Drone state display */}
      <DroneStateDisplay />
    </div>
  );
}

export default App;
