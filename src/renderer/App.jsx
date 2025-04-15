/**
 * Tello Drone Control Interface
 * This component handles the video streaming and control interface for the Tello drone.
 */
import JSMpegVideoPlayer from '@/components/JSMpegVideoPlayer'
import DroneControl from '@/components/control/DroneControl'
import DroneStateDisplay from '@/components/DroneStateDisplay'

function App() {
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
