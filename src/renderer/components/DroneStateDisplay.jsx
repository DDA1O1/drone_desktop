// src/renderer/components/DroneStateDisplay.jsx
import React from 'react';
import { useSelector } from 'react-redux';
// No longer need useDroneStateEventSource here, listeners are global via useDroneIPCListeners in App.jsx
// import { useDroneStateEventSource } from '@hooks/useDroneStateEventSource';

const DroneStateDisplay = () => {
  // // Initialization moved to App.jsx
  // useDroneStateEventSource();

  // Get drone state from Redux store (updated via IPC listeners)
  const droneState = useSelector((state) => state.drone.droneState);
  const droneConnected = useSelector((state) => state.drone.droneConnected); // Get connection status

  // Helper to format time, handles null/undefined
  const formatTime = (timeValue) => {
    if (timeValue === null || timeValue === undefined || timeValue === '') {
      return '--';
    }
    // Convert seconds to a more readable format
    const seconds = parseInt(timeValue, 10);
    if (isNaN(seconds)) return '--';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 
      ? `${minutes}m ${remainingSeconds}s`
      : `${remainingSeconds}s`;
  };

  // Helper to format battery, handles null/undefined
  const formatBattery = (batteryValue) => {
    // Use bat from drone state as it's the actual battery value from Tello
    if (batteryValue === null || batteryValue === undefined) {
      return '--';
    }
    return `${batteryValue}%`;
  };

  // Helper to format last update time
  const formatLastUpdate = (timestamp) => {
    if (!timestamp) return '--';
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  // Get the battery value from the correct field (bat)
  const batteryValue = droneState.bat || droneState.battery;

  // Only render if connected? Or show default/empty values? Let's show placeholders.
  // if (!droneConnected) {
  //   // Optional: Render nothing or a "waiting for connection" message
  //   return null;
  // }

  return (
    <div className="flex items-center justify-center w-full min-h-[200px]">
      <div className="absolute top-5.5 left-50 z-30">
        {/* Battery Status */}
        <div className="bg-transparent backdrop-blur-sm rounded-lg p-2 transition-all duration-200 group">
          <div className="flex items-center gap-0.5">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-15 text-green-400/90" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M3 7h14a2 2 0 012 2v6a2 2 0 01-2 2H3a2 2 0 01-2-2V9a2 2 0 012-2zm14 1h2v6h-2V8z"
              />
            </svg>
            <div className="text-center bg-black/20 rounded-md px-2 py-1 w-full group-hover:bg-black/30 transition-all duration-200">
              <span className={`text-sm font-mono font-semibold ${
                !batteryValue ? 'text-gray-500' :
                batteryValue < 20 ? 'text-red-400/90' : 
                batteryValue < 50 ? 'text-yellow-400/90' : 
                'text-green-400/90'
              }`}>
                {formatBattery(batteryValue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Flight Time */}
      <div className="absolute top-20 right-10 z-30">
        <div className="bg-transparent backdrop-blur-sm rounded-lg p-2 bg-purple-500/10 hover:bg-purple-500/10 transition-all duration-200 group">
          <div className="flex items-center gap-1">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-15 text-purple-400/90" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="text-center bg-black/20 rounded-md px-2 py-1 w-full group-hover:bg-black/30 transition-all duration-200">
              <span className="text-sm font-mono font-semibold text-purple-400/90">
                {formatTime(droneState.time)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Last Update */}
      <div className="absolute top-30 right-10 z-30">
        <div className="bg-transparent backdrop-blur-sm rounded-lg p-2 bg-amber-500/10 hover:bg-amber-500/10 transition-all duration-200 group">
          <div className="flex items-center gap-1">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-15 text-amber-400/90" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <div className="text-center bg-black/20 rounded-md px-2 py-1 w-full group-hover:bg-black/30 transition-all duration-200">
              <span className="text-sm font-mono font-semibold text-amber-400/90">
                {formatLastUpdate(droneState.lastUpdate)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DroneStateDisplay;