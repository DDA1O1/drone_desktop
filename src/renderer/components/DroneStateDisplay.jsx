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
         return '--'; // Display placeholder if no time value
     }
     // Assuming timeValue is already like "10s" or similar from the adapter
     return timeValue;
  };

   // Helper to format battery, handles null/undefined
   const formatBattery = (batteryValue) => {
    if (batteryValue === null || batteryValue === undefined) {
        return '--'; // Placeholder
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
   }


  // Only render if connected? Or show default/empty values? Let's show placeholders.
  // if (!droneConnected) {
  //   // Optional: Render nothing or a "waiting for connection" message
  //   return null;
  // }

  return (
    <> {/* Use Fragment or adjust container */}
       {/* Battery Status - Top Left */}
       <div className="absolute top-20 left-8 z-30"> {/* Positioned near takeoff/land */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 transition-all duration-200 group shadow-md">
          <div className="flex items-center gap-1.5"> {/* Increased gap slightly */}
            <svg /* Battery Icon */ className={`h-5 w-5 ${
              !droneState.battery ? 'text-gray-400' : 
              droneState.battery < 20 ? 'text-red-400' :
              droneState.battery < 50 ? 'text-yellow-400' :
              'text-green-400'
            }`} > ... </svg>
            <div className="text-center bg-black/20 rounded-md px-2.5 py-1 min-w-[50px] group-hover:bg-black/30 transition-all duration-200">
              <span className={`text-sm font-mono font-semibold ${
                !droneState.battery ? 'text-gray-400' : // Use gray for placeholder too
                droneState.battery < 20 ? 'text-red-400' :
                droneState.battery < 50 ? 'text-yellow-400' :
                'text-green-400'
              }`}>
                {/* Use formatter */}
                {formatBattery(droneState.battery)}
              </span>
            </div>
          </div>
        </div>
      </div>


      {/* Flight Time - Top Right Area */}
      <div className="absolute top-20 right-4 z-30"> {/* Positioned near media controls */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 shadow-md group">
          <div className="flex items-center gap-1.5">
            <svg /* Clock Icon */ className="h-5 w-5 text-purple-400/90" > ... </svg>
            <div className="text-center bg-black/20 rounded-md px-2.5 py-1 min-w-[50px] group-hover:bg-black/30 transition-all duration-200">
              {/* Display '--' if time is null/undefined */}
              <span className={`text-sm font-mono font-semibold ${droneState.time ? 'text-purple-400/90' : 'text-gray-400'}`}>
                 {formatTime(droneState.time)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Last Update - Below Flight Time */}
      <div className="absolute top-[95px] right-4 z-30"> {/* Positioned below time */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 shadow-md group">
          <div className="flex items-center gap-1.5">
             <svg /* Refresh/Sync Icon */ className="h-5 w-5 text-amber-400/90" > ... </svg>
            <div className="text-center bg-black/20 rounded-md px-2.5 py-1 min-w-[80px] group-hover:bg-black/30 transition-all duration-200">
              {/* Display '--' if lastUpdate is null */}
              <span className={`text-xs font-mono font-semibold ${droneState.lastUpdate ? 'text-amber-400/90' : 'text-gray-400'}`}>
                {formatLastUpdate(droneState.lastUpdate)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DroneStateDisplay;