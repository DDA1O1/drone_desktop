// src/renderer/components/control/DroneControl.jsx
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setError,
  // No longer need to dispatch connection/state changes from here
  // setDroneConnection,
  // setStreamEnabled,
  // setRecordingStatus,
  // setRecordingFiles,
  // No longer need retry logic here
  // incrementRetryAttempts,
  // resetRetryAttempts
} from '@/store/slices/droneSlice'; // Adjust path

const DroneControl = () => {
  // Dispatch is still needed for clearing errors manually if desired,
  // but not for connection/state triggered by IPC listeners.
  const dispatch = useDispatch();

  // Select state from Redux, updated by the IPC listeners
  const {
    droneConnected,
    streamEnabled,
    isRecording,
    recordingFiles, // Keep this if you display saved file names
    error,
    // retryAttempts // No longer needed from Redux state here
  } = useSelector(state => state.drone);

  // State for keyboard controls UI feedback
  const [activeKeys, setActiveKeys] = useState(new Set());

  // Remove MAX_SDK_RETRY_ATTEMPTS and related logic

  // ==== LIFE CYCLE MANAGEMENT ====
  const connectToDrone = () => {
    // Check if already connected (optional UI feedback)
    if (droneConnected) {
      console.log('Already connected.');
      return;
    }
    console.log('Requesting drone connection via IPC...');
    // Simply send the request to the main process
    window.electronAPI.send('drone:connect');
    // No need for async/await or try/catch here.
    // Success/failure will be handled by the IPC listeners
    // which update the Redux state (droneConnected, error).
  };

  // Basic command sender (NOW uses IPC)
  const sendCommand = (command) => {
    // Check connection status from Redux state
    if (!droneConnected) {
      // Dispatch error directly or rely on main process feedback
      dispatch(setError('Drone not connected. Cannot send command.'));
      console.warn('Attempted to send command while disconnected:', command);
      return;
    }
    console.log(`Sending command via IPC: drone:command, payload: ${command}`);
    window.electronAPI.send('drone:command', command);
    // No try/catch or response handling needed here.
    // Errors/confirmations are handled via IPC listeners if the main process sends them back.
  };

  // ==== VIDEO CONTROLS (NOW uses IPC) ====
  const toggleVideoStream = () => {
    if (!droneConnected) {
        dispatch(setError('Drone not connected. Cannot toggle video.'));
        return;
    }
    console.log('Sending command via IPC: drone:stream-toggle');
    // Send a single message, main process determines 'streamon'/'streamoff'
    window.electronAPI.send('drone:stream-toggle');
    // The Redux state (streamEnabled) will be updated by the 'drone:stream-status' IPC message listener
  };

  // ==== PHOTO CAPTURE (NOW uses IPC) ====
   const capturePhoto = () => {
    if (!streamEnabled) { // Check stream status from Redux
      dispatch(setError('Video stream must be active to capture photo.'));
      return;
    }
     console.log('Sending command via IPC: drone:capture-photo');
     window.electronAPI.send('drone:capture-photo');
     // Confirmation/error handled by 'drone:photo-captured' or 'drone:error' listeners
   };

   // ==== RECORDING (NOW uses IPC) ====
  const toggleRecording = () => {
    if (!streamEnabled) { // Check stream status from Redux
       dispatch(setError('Video stream must be active to record.'));
       return;
    }
    console.log('Sending command via IPC: drone:recording-toggle');
    // Send a single message, main process determines start/stop
    window.electronAPI.send('drone:recording-toggle');
    // Status/file name handled by 'drone:recording-status' / 'drone:recording-stopped' listeners
  };


  // ==== KEYBOARD CONTROLS ====
  useEffect(() => {
    const handleKeyDown = (e) => {
      const validKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', /* 'q', 'e', */ 'Escape', 't', 'l']; // Added T and L
      if (validKeys.includes(e.key.toLowerCase()) && droneConnected) { // Check droneConnected here
        e.preventDefault();
        setActiveKeys(prev => {
          const updated = new Set(prev);
          updated.add(e.key.toLowerCase()); // Use lowercase for consistency
          return updated;
        });

        // Map keys to drone commands
        switch (e.key.toLowerCase()) { // Use lowercase
          case 'w': sendCommand(`forward ${20}`); break;
          case 's': sendCommand(`back ${20}`); break;
          case 'a': sendCommand(`left ${20}`); break;
          case 'd': sendCommand(`right ${20}`); break;
          case 'arrowup': sendCommand(`up ${20}`); break;
          case 'arrowdown': sendCommand(`down ${20}`); break;
          case 'arrowleft': sendCommand(`ccw ${45}`); break;
          case 'arrowright': sendCommand(`cw ${45}`); break;
          case 't': handleTakeoff(); break; // Added takeoff
          case 'l': handleLand(); break; // Added land
          case 'escape': handleGracefulShutdown(); break; // Changed from emergency
        }
      } else if (e.key === 'Escape') { // Allow Escape even if not connected for shutdown
          e.preventDefault();
          handleGracefulShutdown();
      }
    };

    const handleKeyUp = (e) => {
      const validKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', /* 'q', 'e', */ 'Escape', 't', 'l'];
      const lowerKey = e.key.toLowerCase();
      if (validKeys.includes(lowerKey)) {
        e.preventDefault();
        setActiveKeys(prev => {
          const updated = new Set(prev);
          updated.delete(lowerKey);
          return updated;
        });
         // Send stop command on key up for continuous movement (optional but common)
         // This requires the main process to handle 'stop' or rely on Tello's auto-stop
         // For simplicity, we can omit sending 'stop' here, Tello usually stops after a short delay.
         // If you need immediate stop on keyup, you'd send `sendCommand('stop')` or `sendCommand('rc 0 0 0 0')`
         // depending on how you implement movement control (SDK commands vs RC command).
         // Let's stick to the simple SDK commands for now.
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
    // Re-run if droneConnected changes (to enable/disable listeners implicitly via the check inside handleKeyDown)
    // Also include sendCommand if its definition could change (unlikely here, but good practice)
  }, [droneConnected /*, sendCommand */]); // Added droneConnected dependency

  // Basic flight controls (use sendCommand)
  const handleTakeoff = () => sendCommand('takeoff');
  const handleLand = () => sendCommand('land');
  // Emergency is usually direct, not via generic sendCommand if main process has specific handling
  // const handleEmergency = () => sendCommand('emergency');
   // For emergency, maybe use a dedicated IPC channel if needed, or just rely on ESC->shutdown
  const handleEmergency = () => {
      console.warn('Emergency stop triggered!');
      // Option 1: Send specific emergency command if main process handles it separately
      // window.electronAPI.send('drone:emergency');
      // Option 2: Rely on graceful shutdown via Escape key for now
      handleGracefulShutdown();
  };

  // Clear error after 5 seconds (Keep this UI feature)
  useEffect(() => {
    let timer;
    if (error) {
      timer = setTimeout(() => {
        dispatch(setError(null));
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [error, dispatch]);

  // Graceful shutdown handler (NOW uses IPC)
  const handleGracefulShutdown = () => {
    console.log('Requesting graceful shutdown via IPC...');
    window.electronAPI.send('drone:shutdown');
    // The main process will handle landing, disconnecting, etc.
    // UI state (droneConnected = false) will update via IPC listener.
  };

  return (
    <>
      {/* Connection status and connect button - centered top */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4"> {/* Increased gap */}
        {/* Connection Indicator */}
        <div className="flex items-center gap-2">
            <div title={droneConnected ? 'Drone Connected' : 'Drone Disconnected'} className={`h-3 w-3 rounded-full ${droneConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'} transition-colors duration-300`} />
            <span className={`text-xs font-medium ${droneConnected ? 'text-green-300' : 'text-red-300'}`}>
                {droneConnected ? 'Connected' : 'Disconnected'}
            </span>
        </div>

        {/* Connect Button */}
        {!droneConnected && (
          <button
            onClick={connectToDrone} // Use the new function
            className="px-3 py-1.5 bg-blue-500/80 backdrop-blur-sm text-white text-sm font-medium rounded-full
                     hover:bg-blue-600/90 transition-all duration-200 flex items-center gap-2 group shadow-md"
          >
            <svg /* Connection Icon */ > ... </svg>
            Connect Drone
          </button>
        )}

        {/* --- Video/Media buttons remain similar, but onClick uses IPC --- */}

         {/* Video status and control - moved slightly right */}
         <div className="flex items-center gap-2">
            <div title={streamEnabled ? 'Video Stream Active' : 'Video Stream Inactive'} className={`h-3 w-3 rounded-full ${streamEnabled ? 'bg-sky-500 animate-pulse' : 'bg-gray-500'} transition-colors duration-300`} />
            {droneConnected && ( // Only show button if drone is connected
                <button
                onClick={toggleVideoStream} // Uses IPC now
                className={`px-3 py-1.5 backdrop-blur-sm text-white text-sm font-medium rounded-full hover:bg-white/20 transition-all duration-200 flex items-center gap-2 group shadow-md ${streamEnabled ? 'bg-red-500/80 hover:bg-red-600/90' : 'bg-green-500/80 hover:bg-green-600/90'}`}
                >
                <svg /* Video Icon */ > {streamEnabled ? <path d="M..." /> /* Pause Icon */ : <path d="M..." /> /* Play Icon */} </svg>
                {streamEnabled ? 'Stop Video' : 'Start Video'}
                </button>
            )}
        </div>
      </div>

      {/* Media Controls - Top Right (onClick uses IPC now) */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-3">
         <button
            onClick={capturePhoto}
            disabled={!streamEnabled || !droneConnected} // Also disable if not connected
             className={`... ${streamEnabled && droneConnected ? '...' : 'bg-gray-500/20 ... cursor-not-allowed'}`}
         > ... Capture ... </button>
         <button
            onClick={toggleRecording}
            disabled={!streamEnabled || !droneConnected} // Also disable if not connected
            className={`... ${streamEnabled && droneConnected ? (isRecording ? 'bg-red-...' : 'bg-sky-...') : 'bg-gray-...'}`}
         > ... {isRecording ? 'Stop' : 'Record'} ... </button>
      </div>

      {/* Takeoff/Land Controls - Top Left (onClick uses sendCommand which uses IPC) */}
       <div className="absolute top-5 left-8 z-30 flex gap-3">
           <button
                onClick={handleTakeoff}
                disabled={!droneConnected}
                className={`group relative p-2.5 rounded-lg ${droneConnected ? 'bg-emerald-500/30 ... hover:bg-emerald-500/50' : 'bg-transparent border border-gray-500/30 cursor-not-allowed'} ...`}
                title="Takeoff (T)"
           > {/* Takeoff SVG */} <span className="...">Takeoff (T)</span> </button>
            <button
                onClick={handleLand}
                disabled={!droneConnected}
                className={`group relative p-2.5 rounded-lg ${droneConnected ? 'bg-sky-500/30 ... hover:bg-sky-500/50' : 'bg-transparent border border-gray-500/30 cursor-not-allowed'} ...`}
                title="Land (L)"
            > {/* Land SVG */} <span className="...">Land (L)</span> </button>
             <button
                onClick={handleEmergency} // Now calls graceful shutdown
                disabled={!droneConnected} // Can maybe be enabled always? Or rely on ESC key? Let's keep disabled for button.
                className={`group relative p-2.5 rounded-lg ${droneConnected ? 'bg-red-500/30 ... hover:bg-red-500/50 animate-pulse' : 'bg-transparent border border-gray-500/30 cursor-not-allowed'} ...`}
                title="Emergency Stop / Shutdown (ESC)"
             > {/* Emergency SVG */} <span className="...">Shutdown (ESC)</span> </button>
       </div>


      {/* ESC key indicator */}
      <div className="absolute top-20 left-8 z-30"> {/* Adjusted position slightly */}
          <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-3 py-2 rounded-lg transition-all duration-300 ease-in-out opacity-60 hover:opacity-90">
            <kbd className={`px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded-md shadow-sm ${activeKeys.has('escape') ? 'bg-red-200 border-red-400' : ''}`}>ESC</kbd>
            <span className="text-white/80 text-sm">to Shutdown</span>
          </div>
        </div>

      {/* Keyboard UI remains the same, driven by activeKeys state */}
      <div className="absolute bottom-8 left-8 z-30"> ... WASD UI ... </div>
      <div className="absolute bottom-8 right-8 z-30"> ... Arrow Keys UI ... </div>


      {/* Error display - bottom center (Keep as is, driven by Redux error state) */}
      {error && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
          <div className="p-4 bg-red-600/80 text-white rounded-lg shadow-lg backdrop-blur-md ... ">
             {/* Error Icon (optional) */}
            {error}
          </div>
        </div>
      )}
    </>
  );
};

export default DroneControl;