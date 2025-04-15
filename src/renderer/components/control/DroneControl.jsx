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

  // State for keyboard and button controls UI feedback
  const [activeKeys, setActiveKeys] = useState(new Set());
  const [activeButtons, setActiveButtons] = useState(new Set());

  // Movement constants
  const MOVEMENT_CONSTANTS = {
    DISTANCE: 20,  // cm for forward/back/left/right/up/down
    ROTATION: 45,  // degrees for rotation
  };

  // ==== COMMAND HANDLERS ====
  const sendCommand = async (command) => {
    if (!droneConnected) {
      dispatch(setError('Drone not connected. Cannot send command.'));
      console.warn('Attempted to send command while disconnected:', command);
      return;
    }
    try {
      await window.electronAPI.invoke('drone:command', command);
    } catch (error) {
      dispatch(setError(`Command failed: ${error.message}`));
    }
  };

  // ==== MOVEMENT COMMANDS ====
  const movementCommands = {
    w: () => sendCommand(`forward ${MOVEMENT_CONSTANTS.DISTANCE}`),
    s: () => sendCommand(`back ${MOVEMENT_CONSTANTS.DISTANCE}`),
    a: () => sendCommand(`left ${MOVEMENT_CONSTANTS.DISTANCE}`),
    d: () => sendCommand(`right ${MOVEMENT_CONSTANTS.DISTANCE}`),
    ArrowUp: () => sendCommand(`up ${MOVEMENT_CONSTANTS.DISTANCE}`),
    ArrowDown: () => sendCommand(`down ${MOVEMENT_CONSTANTS.DISTANCE}`),
    ArrowLeft: () => sendCommand(`ccw ${MOVEMENT_CONSTANTS.ROTATION}`),
    ArrowRight: () => sendCommand(`cw ${MOVEMENT_CONSTANTS.ROTATION}`),
  };

  // ==== BUTTON HANDLERS ====
  const handleButtonPress = (key) => {
    setActiveButtons(prev => new Set([...prev, key]));
    if (droneConnected && movementCommands[key]) {
      movementCommands[key]();
    }
  };

  const handleButtonRelease = (key) => {
    setActiveButtons(prev => {
      const updated = new Set(prev);
      updated.delete(key);
      return updated;
    });
  };

  // ==== KEYBOARD CONTROLS ====
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key in movementCommands || ['t', 'l', 'escape'].includes(key)) {
        e.preventDefault();
        setActiveKeys(prev => new Set([...prev, key]));
        
        if (droneConnected) {
          switch (key) {
            case 't': handleTakeoff(); break;
            case 'l': handleLand(); break;
            case 'escape': handleGracefulShutdown(); break;
            default:
              if (movementCommands[e.key]) movementCommands[e.key]();
          }
        } else if (key === 'escape') {
          handleGracefulShutdown();
        }
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (key in movementCommands || ['t', 'l', 'escape'].includes(key)) {
        e.preventDefault();
        setActiveKeys(prev => {
          const updated = new Set(prev);
          updated.delete(key);
          return updated;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [droneConnected]);

  // ==== CONNECTION MANAGEMENT ====
  const connectToDrone = async () => {
    if (droneConnected) {
      console.log('Already connected.');
      return;
    }
    try {
      await window.electronAPI.invoke('drone:connect');
    } catch (error) {
      dispatch(setError(`Connection failed: ${error.message}`));
    }
  };

  // ==== FLIGHT CONTROLS ====
  const handleTakeoff = () => sendCommand('takeoff');
  const handleLand = () => sendCommand('land');
  
  const handleGracefulShutdown = () => {
    console.log('Requesting graceful shutdown...');
    window.electronAPI.send('drone:shutdown');
  };

  // ==== MEDIA CONTROLS ====
  const toggleVideoStream = () => {
    if (!droneConnected) {
      dispatch(setError('Drone not connected. Cannot toggle video.'));
      return;
    }
    window.electronAPI.send('drone:stream-toggle');
  };

  const capturePhoto = () => {
    if (!streamEnabled) {
      dispatch(setError('Video stream must be active to capture photo.'));
      return;
    }
    window.electronAPI.send('drone:capture-photo');
  };

  const toggleRecording = () => {
    if (!streamEnabled) {
      dispatch(setError('Video stream must be active to record.'));
      return;
    }
    window.electronAPI.send('drone:recording-toggle');
  };

  // Clear error after 5 seconds
  useEffect(() => {
    let timer;
    if (error) {
      timer = setTimeout(() => {
        dispatch(setError(null));
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [error, dispatch]);

  // Helper function to get button class based on active state
  const getButtonClass = (key, isActive) => `
    border-2 ${isActive ? 'bg-blue-500 border-blue-300' : 'border-gray-600'} 
    rounded-md p-3 text-center font-bold
    hover:bg-blue-500/50 hover:border-blue-300/50
    cursor-pointer transition-all duration-200
  `;

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
          onClick={handleGracefulShutdown}
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

      {/* WASD Movement Controls */}
      <div className="absolute bottom-8 left-8 z-30">
        <div className="bg-transparent bg-opacity-70 p-6 rounded-lg text-white">
          <div className="grid grid-cols-3 gap-2 w-40 mx-auto">
            <div></div>
            <div 
              className={getButtonClass('w', activeKeys.has('w') || activeButtons.has('w'))}
              onMouseDown={() => handleButtonPress('w')}
              onMouseUp={() => handleButtonRelease('w')}
              onMouseLeave={() => handleButtonRelease('w')}
            >W</div>
            <div></div>
            <div 
              className={getButtonClass('a', activeKeys.has('a') || activeButtons.has('a'))}
              onMouseDown={() => handleButtonPress('a')}
              onMouseUp={() => handleButtonRelease('a')}
              onMouseLeave={() => handleButtonRelease('a')}
            >A</div>
            <div 
              className={getButtonClass('s', activeKeys.has('s') || activeButtons.has('s'))}
              onMouseDown={() => handleButtonPress('s')}
              onMouseUp={() => handleButtonRelease('s')}
              onMouseLeave={() => handleButtonRelease('s')}
            >S</div>
            <div 
              className={getButtonClass('d', activeKeys.has('d') || activeButtons.has('d'))}
              onMouseDown={() => handleButtonPress('d')}
              onMouseUp={() => handleButtonRelease('d')}
              onMouseLeave={() => handleButtonRelease('d')}
            >D</div>
          </div>
          <div className="mt-4 text-center text-sm text-gray-400">
            <p>Forward / Backward</p>
            <p>Left / Right</p>
          </div>
        </div>
      </div>
      
      {/* Arrow Keys Controls */}
      <div className="absolute bottom-8 right-8 z-30">
        <div className="bg-transparent bg-opacity-70 p-6 rounded-lg text-white">
          <div className="grid grid-cols-3 gap-2 w-40 mx-auto">
            <div></div>
            <div 
              className={getButtonClass('ArrowUp', activeKeys.has('arrowup') || activeButtons.has('ArrowUp'))}
              onMouseDown={() => handleButtonPress('ArrowUp')}
              onMouseUp={() => handleButtonRelease('ArrowUp')}
              onMouseLeave={() => handleButtonRelease('ArrowUp')}
            >↑</div>
            <div></div>
            <div 
              className={getButtonClass('ArrowLeft', activeKeys.has('arrowleft') || activeButtons.has('ArrowLeft'))}
              onMouseDown={() => handleButtonPress('ArrowLeft')}
              onMouseUp={() => handleButtonRelease('ArrowLeft')}
              onMouseLeave={() => handleButtonRelease('ArrowLeft')}
            >←</div>
            <div 
              className={getButtonClass('ArrowDown', activeKeys.has('arrowdown') || activeButtons.has('ArrowDown'))}
              onMouseDown={() => handleButtonPress('ArrowDown')}
              onMouseUp={() => handleButtonRelease('ArrowDown')}
              onMouseLeave={() => handleButtonRelease('ArrowDown')}
            >↓</div>
            <div 
              className={getButtonClass('ArrowRight', activeKeys.has('arrowright') || activeButtons.has('ArrowRight'))}
              onMouseDown={() => handleButtonPress('ArrowRight')}
              onMouseUp={() => handleButtonRelease('ArrowRight')}
              onMouseLeave={() => handleButtonRelease('ArrowRight')}
            >→</div>
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