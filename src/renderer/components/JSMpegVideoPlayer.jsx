// src/renderer/components/JSMpegVideoPlayer.jsx
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import JSMpeg from '@cycjimmy/jsmpeg-player';
import { setStreamEnabled, setError } from '@/store/slices/droneSlice'; // Adjust path as needed
import VideoContainer from '@/components/VideoContainer'; // Adjust path as needed

// Define the WebSocket port used by the main process (must match main.js)
const LOCAL_WEBSOCKET_STREAM_PORT = 3001;

const JSMpegVideoPlayer = () => {
  // Refs to manage video element, player instance, and initialization state
  const videoRef = useRef(null); // Ref for the div where the canvas will be placed
  const playerRef = useRef(null); // Ref for the JSMpeg player instance
  const isInitializedRef = useRef(false); // Flag to prevent multiple initializations

  // Get stream status from Redux (updated via IPC listeners)
  const { streamEnabled } = useSelector(state => state.drone);
  const dispatch = useDispatch();

  // Cleanup effect: Destroy player and reset state on unmount
  useEffect(() => {
    const currentPlayer = playerRef.current; // Capture current ref for cleanup function
    return () => {
      if (currentPlayer) {
        try {
          console.log('Destroying JSMpeg player instance...');
          currentPlayer.destroy();
        } catch (e) {
          console.error("Error destroying JSMpeg player:", e);
        }
      }
      playerRef.current = null;
      isInitializedRef.current = false;
      // Optionally ensure stream state is false in Redux on cleanup,
      // though IPC should handle the authoritative state.
      // dispatch(setStreamEnabled(false));
    };
  }, []); // Empty dependency array runs cleanup only on unmount

  // Effect to handle player initialization, play, and pause based on Redux state
  useEffect(() => {
    if (streamEnabled) {
      // --- Stream should be ON ---
      if (!playerRef.current && !isInitializedRef.current) {
        // If enabled and player doesn't exist and not already initializing: Initialize
        initializePlayer();
      } else if (playerRef.current && playerRef.current.playing === false) {
         // If player exists but is paused: Play
         console.log("JSMpeg: Resuming playback...");
         playerRef.current.play();
      }
    } else {
      // --- Stream should be OFF ---
      if (playerRef.current && playerRef.current.playing === true) {
        // If player exists and is playing: Pause
        console.log("JSMpeg: Pausing playback...");
        playerRef.current.pause();
      }
       // If player exists but initialization is still ongoing or failed, destroy it.
       // Also handles the case where stream is toggled off quickly after on.
      if (isInitializedRef.current && !playerRef.current) {
           console.log("JSMpeg: Stream disabled during/after failed initialization, ensuring cleanup.");
           isInitializedRef.current = false; // Reset flag
       } else if (playerRef.current && !streamEnabled) {
           // If stream is off, we might want to destroy the player entirely
           // to free resources, instead of just pausing. Re-evaluate if needed.
           // For now, pause is sufficient. If WebSocket disconnects, error handlers should clear refs.
       }
    }
  }, [streamEnabled]); // Re-run whenever streamEnabled changes

  // Function to initialize the JSMpeg player
  const initializePlayer = () => {
    // Double-check to prevent race conditions
    if (playerRef.current || !videoRef.current || !streamEnabled || isInitializedRef.current) {
        console.log('Skipping player initialization:', { hasPlayer: !!playerRef.current, hasVideoRef: !!videoRef.current, streamEnabled, isInitialized: isInitializedRef.current });
        return;
    }

    // Mark that we are attempting initialization
    isInitializedRef.current = true;
    console.log('Attempting to initialize JSMpeg player...');

    try {
      // --- THE KEY CHANGE: WebSocket URL points to localhost ---
      const url = `ws://localhost:${LOCAL_WEBSOCKET_STREAM_PORT}`;
      console.log(`Connecting JSMpeg to WebSocket: ${url}`);

      // Create the JSMpeg player instance
      // JSMpeg.VideoElement attaches the player to a given DOM element container (videoRef.current)
      const jsmpegPlayer = new JSMpeg.VideoElement(
        videoRef.current, // The div container
        url,
        {
          videoWidth: 640, // Should match FFmpeg output size in main.js
          videoHeight: 480,
          autoplay: true, // Automatically start playing when WebSocket connects and data arrives
          videoBufferSize: 512 * 1024, // Default buffer size
          // JSMpeg hooks provide insight into the player's state
          hooks: {
            play: () => {
              console.log('JSMpeg Hook: Video playback started.');
              // Dispatching here gives immediate UI feedback, complementing the IPC update
              dispatch(setStreamEnabled(true));
            },
            pause: () => {
               console.log('JSMpeg Hook: Video playback paused.');
               // Avoid dispatching false here, let IPC 'drone:stream-status' be the authority for turning off
            },
            stop: () => {
               console.log('JSMpeg Hook: Video playback stopped.');
               // Avoid dispatching false here, let IPC 'drone:stream-status' be the authority
            },
            error: (error) => {
              console.error('JSMpeg Player Error Hook:', error);
              dispatch(setError('JSMpeg Player Error: ' + (error?.message || error)));
              // Force Redux state off on player error
              dispatch(setStreamEnabled(false));
              // Clean up refs on fatal player error
              playerRef.current = null;
              isInitializedRef.current = false;
            }
          }
        }
      );

      // Store the core player control object
      playerRef.current = jsmpegPlayer.player;

      // Add direct WebSocket event listeners for more robust error handling
      if (playerRef.current?.source?.socket) {
        const socket = playerRef.current.source.socket;

        socket.addEventListener('error', (event) => {
          console.error('JSMpeg WebSocket Error Event:', event);
          // Check if the error wasn't already handled by the JSMpeg hook
          if (isInitializedRef.current) { // Only dispatch if we expected it to be working
             dispatch(setError('Video WebSocket connection error. Is the main process stream running?'));
             dispatch(setStreamEnabled(false)); // Force Redux state off
             playerRef.current = null;
             isInitializedRef.current = false;
          }
        });

        socket.addEventListener('close', (event) => {
          console.warn(`JSMpeg WebSocket Closed: Code=${event.code}, Reason='${event.reason}' Clean=${event.wasClean}`);
          // If the socket closes unexpectedly while we think the stream should be on
          if (streamEnabled && isInitializedRef.current) {
            dispatch(setError('Video WebSocket closed unexpectedly.'));
            dispatch(setStreamEnabled(false)); // Force Redux state off
          }
           // Always clean up refs when socket closes, regardless of reason
           playerRef.current = null;
           isInitializedRef.current = false;
        });

        socket.addEventListener('open', () => {
            console.log("JSMpeg WebSocket Opened successfully.");
        });

      } else {
        console.warn("Could not attach direct WebSocket event listeners.");
      }

    } catch (err) {
      console.error('Failed to initialize JSMpeg player:', err);
      dispatch(setError('Failed to initialize video player: ' + err.message));
      isInitializedRef.current = false; // Reset initialization flag on failure
    }
  };

  // Render the container component, passing the ref for JSMpeg to attach to
  return <VideoContainer ref={videoRef} />;
};

export default JSMpegVideoPlayer;