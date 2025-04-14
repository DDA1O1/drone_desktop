// src/renderer/App.jsx
import React from 'react'; // Import React if not already present
import JSMpegVideoPlayer from '@/components/JSMpegVideoPlayer';
import DroneControl from '@/components/control/DroneControl';
import DroneStateDisplay from '@/components/DroneStateDisplay';
import { useDroneIPCListeners } from '@/hooks/useDroneIPCListeners'; // Import the new hook

function App() {
  // Initialize IPC listeners for the entire app
  useDroneIPCListeners();

  return (
    // Your existing layout
    <div className="relative h-screen bg-gray-900"> {/* Added a background color */}
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