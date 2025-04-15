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
  const connectToDrone = async () => {
    // Check if already connected (optional UI feedback)
    if (droneConnected) {
      console.log('Already connected.');
      return;
    }
    console.log('Requesting drone connection via IPC...');
    try {
      // Use invoke instead of send to get connection result
      await window.electronAPI.invoke('drone:connect');
    } catch (error) {
      dispatch(setError(`Connection failed: ${error.message}`));
    }
  };

  // Basic command sender (NOW uses IPC)
  const sendCommand = async (command) => {
    // Check connection status from Redux state
    if (!droneConnected) {
      // Dispatch error directly or rely on main process feedback
      dispatch(setError('Drone not connected. Cannot send command.'));
      console.warn('Attempted to send command while disconnected:', command);
      return;
    }
    console.log(`Sending command via IPC: drone:command, payload: ${command}`);
    try {
      await window.electronAPI.invoke('drone:command', command);
    } catch (error) {
      dispatch(setError(`Command failed: ${error.message}`));
    }
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
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${droneConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
        {!droneConnected && (
          <button 
            onClick={/* enterSDKMode */ connectToDrone} // Use the new connection function
            className="px-3 py-1.5 bg-white/10 backdrop-blur-sm text-white text-sm font-medium rounded-full 
                     hover:bg-white/20 transition-all duration-200 flex items-center gap-2 group"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-4 w-4 transition-transform group-hover:rotate-180" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Connect
          </button>
        )}

        {/* Video status and control - right side */}
        <div className="ml-8 flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${streamEnabled ? 'bg-sky-500' : 'bg-red-500'} animate-pulse`} />
          {droneConnected && (
            <button 
              onClick={toggleVideoStream}
              className="px-3 py-1.5 bg-white/10 backdrop-blur-sm text-white text-sm font-medium rounded-full 
                       hover:bg-white/20 transition-all duration-200 flex items-center gap-2 group"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                {streamEnabled ? (
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M10 9v6m4-6v6" 
                  />
                ) : (
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" 
                  />
                )}
              </svg>
              {streamEnabled ? 'Stop Video' : 'Start Video'}
            </button>
          )}
        </div>
      </div>

      {/* Media Controls - Top Right */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-3">
        {/* Capture Photo Button */}
        <button 
          onClick={capturePhoto}
          disabled={!streamEnabled}
          className={`group relative px-3 py-1.5 rounded-full flex items-center gap-2 ${
            streamEnabled 
              ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50' 
              : 'bg-gray-500/20 border border-gray-500/30 cursor-not-allowed'
          } backdrop-blur-sm transition-all duration-200`}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-4 w-4 ${streamEnabled ? 'text-emerald-400' : 'text-gray-400'}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="text-sm font-medium text-white">Capture</span>
        </button>

        {/* Record Button
        // First check: Controls button functionality
        // If no stream is active (streamEnabled = false), button cannot be clicked */}
        <button 
          onClick={toggleRecording}
          disabled={!streamEnabled}
          className={`group relative px-3 py-1.5 rounded-full flex items-center gap-2 ${
            streamEnabled
              ? isRecording 
                ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/50' // Red when recording
                : 'bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/50' // Blue when ready to record
              : 'bg-gray-500/20 border border-gray-500/30 cursor-not-allowed' // Gray when disabled (no stream)
          } backdrop-blur-sm transition-all duration-200`}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-4 w-4 ${
              streamEnabled 
                ? isRecording ? 'text-red-400' : 'text-sky-400'
                : 'text-gray-400'
            }`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            {isRecording ? (
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M10 9v6m4-6v6"
              />
            ) : (
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            )}
          </svg>
          <span className="text-sm font-medium text-white">
            {isRecording ? 'Stop' : 'Record'}
          </span>
        </button>
      </div>

      {/* Takeoff/Land Controls - Top Left */}
      <div className="absolute top-5 left-8 z-30 flex gap-3">
        {/* Takeoff button */}
        <button
          onClick={handleTakeoff}
          disabled={!droneConnected}
          className={`group relative p-2.5 rounded-lg ${
            droneConnected 
              ? 'bg-transparent hover:bg-emerald-500/30 border border-emerald-500/50' 
              : 'bg-transparent border border-gray-500/30 cursor-not-allowed'
          } backdrop-blur-sm transition-all duration-200 hover:scale-105`}
          title="Takeoff"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-5 w-5 ${droneConnected ? 'text-emerald-400' : 'text-gray-400'}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M5 10l7-7m0 0l7 7m-7-7v18" 
            />
          </svg>
          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Takeoff (T)
          </span>
        </button>

        {/* Land button */}
        <button
          onClick={handleLand}
          disabled={!droneConnected}
          className={`group relative p-2.5 rounded-lg ${
            droneConnected 
              ? 'bg-transparent hover:bg-sky-500/30 border border-sky-500/50' 
              : 'bg-transparent border border-gray-500/30 cursor-not-allowed'
          } backdrop-blur-sm transition-all duration-200 hover:scale-105`}
          title="Land"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-5 w-5 ${droneConnected ? 'text-sky-400' : 'text-gray-400'}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M19 14l-7 7m0 0l-7-7m7 7V3" 
            />
          </svg>
          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Land (L)
          </span>
        </button>

        {/* Emergency button */}
        <button
          onClick={handleEmergency}
          disabled={!droneConnected}
          className={`group relative p-2.5 rounded-lg ${
            droneConnected 
              ? 'bg-transparent hover:bg-red-500/30 border border-red-500/50 animate-pulse' 
              : 'bg-transparent border border-gray-500/30 cursor-not-allowed'
          } backdrop-blur-sm transition-all duration-200 hover:scale-105`}
          title="Emergency Stop"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-5 w-5 ${droneConnected ? 'text-red-400' : 'text-gray-400'}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2.5} 
              d="M6 18L18 6M6 6l12 12" 
            />
          </svg>
          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Emergency Stop (ESC)
          </span>
        </button>
      </div>

      {/* Add ESC key indicator with conditional rendering */}
      {droneConnected && (
        <div className="absolute top-28 left-8 z-30">
          <div className="flex items-center gap-2 bg-transparent px-3 py-2 rounded-lg
                        transition-all duration-300 ease-in-out opacity-40 hover:opacity-80">
            <kbd className={`px-2 py-1 text-xs font-semibold text-gray-800 bg-white/80 rounded-md shadow-sm 
                          ${activeKeys.has('Escape') ? 'bg-red-100/80' : ''}`}>ESC</kbd>
            <span className="text-white/60 text-sm">to quit</span>
          </div>
        </div>
      )}

      {/* Left corner - WASD Movement Controls */}
      <div className="absolute bottom-8 left-8 z-30">
        <div className="bg-transparent bg-opacity-70 p-6 rounded-lg text-white">
          
          {/* WASD keys */}
          <div className="grid grid-cols-3 gap-2 w-40 mx-auto">
            <div></div>
            <div className={`border-2 ${activeKeys.has('w') ? 'bg-blue-500 border-blue-300' : 'border-gray-600'} rounded-md p-3 text-center font-bold`}>W</div>
            <div></div>
            <div className={`border-2 ${activeKeys.has('a') ? 'bg-blue-500 border-blue-300' : 'border-gray-600'} rounded-md p-3 text-center font-bold`}>A</div>
            <div className={`border-2 ${activeKeys.has('s') ? 'bg-blue-500 border-blue-300' : 'border-gray-600'} rounded-md p-3 text-center font-bold`}>S</div>
            <div className={`border-2 ${activeKeys.has('d') ? 'bg-blue-500 border-blue-300' : 'border-gray-600'} rounded-md p-3 text-center font-bold`}>D</div>
          </div>
          
          <div className="mt-4 text-center text-sm text-gray-400">
            <p>Forward / Backward</p>
            <p>Left / Right</p>
          </div>
        </div>
      </div>
      
      {/* Right corner - Arrow keys for Altitude & Rotation */}
      <div className="absolute bottom-8 right-8 z-30">
        <div className="bg-transparent bg-opacity-70 p-6 rounded-lg text-white">
          
          {/* Arrow keys */}
          <div className="grid grid-cols-3 gap-2 w-40 mx-auto">
            <div></div>
            <div className={`border-2 ${activeKeys.has('ArrowUp') ? 'bg-blue-500 border-blue-300' : 'border-gray-600'} rounded-md p-3 text-center font-bold`}>↑</div>
            <div></div>
            <div className={`border-2 ${activeKeys.has('ArrowLeft') ? 'bg-blue-500 border-blue-300' : 'border-gray-600'} rounded-md p-3 text-center font-bold`}>←</div>
            <div className={`border-2 ${activeKeys.has('ArrowDown') ? 'bg-blue-500 border-blue-300' : 'border-gray-600'} rounded-md p-3 text-center font-bold`}>↓</div>
            <div className={`border-2 ${activeKeys.has('ArrowRight') ? 'bg-blue-500 border-blue-300' : 'border-gray-600'} rounded-md p-3 text-center font-bold`}>→</div>
          </div>
          
          <div className="mt-4 text-center text-sm text-gray-400">
            <p>Up / Down</p>
            <p>Rotate Left / Right</p>
          </div>
        </div>
      </div>

      {/* Connection status and media controls */}
      <div className="absolute top-0 right-0 m-4 z-30">
        <div className="space-y-4">
          {/* Error display - bottom center */}
          {error && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
              <div className="p-4 bg-red-500/70 text-white rounded-lg shadow-lg backdrop-blur-sm
                            transition-all duration-300 ease-out
                            translate-y-0 opacity-100 scale-100
                            motion-safe:animate-bounce">
                {error}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default DroneControl;