import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import JSMpeg from '@cycjimmy/jsmpeg-player';
import { setStreamEnabled, setError } from '@/store/slices/droneSlice';
import VideoContainer from '@/components/VideoContainer';

const JSMpegVideoPlayer = () => {
  // Refs to manage video element, player instance, and initialization state
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const isInitializedRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 2000; // 2 seconds
  
  const {
    streamEnabled
  } = useSelector(state => state.drone);
  const dispatch = useDispatch();

  // Cleanup effect: Destroy player and reset state on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      dispatch(setStreamEnabled(false));
      isInitializedRef.current = false;
      reconnectAttemptsRef.current = 0;
    };
  }, []);

  // Handle video stream state changes
  useEffect(() => {
    // Initialize player on first stream enable
    if (!playerRef.current) {
      if (streamEnabled && !isInitializedRef.current) {
        initializePlayer();
      }
      return;
    }
    
    // Use player's built-in methods for subsequent play/pause
    if (streamEnabled) {
      playerRef.current.play();
    } else {
      playerRef.current.pause();
      // Reset reconnection state when stream is intentionally disabled
      reconnectAttemptsRef.current = 0;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    }
  }, [streamEnabled]);

  const handleReconnect = () => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      dispatch(setError('Failed to reconnect to video stream after multiple attempts'));
      dispatch(setStreamEnabled(false));
      reconnectAttemptsRef.current = 0;
      return;
    }

    reconnectAttemptsRef.current++;
    console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (streamEnabled) {
        // Cleanup existing player
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }
        // Attempt to reinitialize
        initializePlayer();
      }
    }, RECONNECT_DELAY);
  };

  // Initialize JSMpeg video player with WebSocket stream
  const initializePlayer = () => {
    if (playerRef.current || !streamEnabled) return;
    
    try {
      const url = `ws://${window.location.hostname}:3001`;
      // Create new JSMpeg player instance with configuration
      const player = new JSMpeg.VideoElement(videoRef.current, url, {
        videoWidth: 640,
        videoHeight: 480,
        videoBufferSize: 512 * 1024,
        streaming: true,
        decodeFirstFrame: true,
        chunkSize: 4096,
        disableGl: false,
        progressive: true,
        throttled: false,
        
        // Event hooks for player state management
        hooks: {
          play: () => {
            console.log('Video playback started');
            dispatch(setStreamEnabled(true));
            // Reset reconnection attempts on successful connection
            reconnectAttemptsRef.current = 0;
          },
          pause: () => dispatch(setStreamEnabled(false)),
          stop: () => dispatch(setStreamEnabled(false)),
          error: (error) => {
            console.error('JSMpeg error:', error);
            dispatch(setError('Video playback error: ' + error.message));
            if (streamEnabled) {
              handleReconnect();
            }
          }
        }
      });
      
      // Store player reference and mark as initialized
      playerRef.current = player.player;
      isInitializedRef.current = true;

      // Add WebSocket error handler
      if (playerRef.current?.source?.socket) {
        playerRef.current.source.socket.addEventListener('error', (error) => {
          console.error('WebSocket error:', error);
          dispatch(setError('WebSocket connection error: ' + error.message));
          if (streamEnabled) {
            handleReconnect();
          }
        });

        playerRef.current.source.socket.addEventListener('close', () => {
          console.log('WebSocket connection closed');
          if (streamEnabled) {
            handleReconnect();
          }
        });
      }

    } catch (err) {
      console.error('Failed to initialize video:', err);
      dispatch(setError('Failed to initialize video: ' + err.message));
      if (streamEnabled) {
        handleReconnect();
      }
    }
  };

  return <VideoContainer ref={videoRef} />;
};

export default JSMpegVideoPlayer; 