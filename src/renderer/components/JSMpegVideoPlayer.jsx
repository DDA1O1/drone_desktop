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
      console.log('[Video] Stream enabled, resuming playback...');
      playerRef.current.play();
    } else {
      console.log('[Video] Stream disabled, pausing playback...');
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
      const hostname = window.location.hostname || 'localhost';
      const url = `ws://${hostname}:8082`;
      console.log('[Video] Initializing JSMpeg player with WebSocket URL:', url);
      
      const player = new JSMpeg.Player(url, {
        canvas: videoRef.current,
        audio: false,
        streaming: true,
        pauseWhenHidden: false,         // Continue playing even when tab is not active
        disableGl: false,               // Enable WebGL for better performance
        disableWebAssembly: false,      // Enable WebAssembly for better performance
        preserveDrawingBuffer: false,    // Better performance
        progressive: true,               // Enable progressive loading
        throttled: true,                // Enable frame throttling for performance
        chunkSize: 65536,               // Optimal chunk size for streaming
        maxAudioLag: 0,                 // No audio, so set to 0
        videoBufferSize: 512 * 1024,    // 512KB video buffer
        onPlay: () => {
          console.log('[Video] Playback started');
          dispatch(setStreamEnabled(true));
          reconnectAttemptsRef.current = 0;
        },
        onPause: () => {
          console.log('[Video] Playback paused');
          if (streamEnabled) handleReconnect();
        },
        onEnded: () => {
          console.log('[Video] Playback ended');
          if (streamEnabled) handleReconnect();
        },
        onStalled: () => {
          console.log('[Video] Playback stalled');
          if (streamEnabled) handleReconnect();
        }
      });
      
      console.log('[Video] JSMpeg player instance created');
      playerRef.current = player;
      isInitializedRef.current = true;

      // Setup WebSocket event listeners
      if (player.source && player.source.socket) {
        console.log('[Video] Setting up WebSocket event listeners');
        
        player.source.socket.addEventListener('error', (error) => {
          console.error('[Video] WebSocket connection error:', error);
          dispatch(setError('WebSocket connection error: ' + error.message));
          if (streamEnabled) handleReconnect();
        });

        player.source.socket.addEventListener('close', () => {
          console.log('[Video] WebSocket connection closed');
          if (streamEnabled) handleReconnect();
        });

        player.source.socket.addEventListener('open', () => {
          console.log('[Video] WebSocket connection established successfully');
        });
      }

    } catch (err) {
      console.error('[Video] Failed to initialize JSMpeg player:', err);
      dispatch(setError('Failed to initialize video: ' + err.message));
      if (streamEnabled) handleReconnect();
    }
  };

  return <VideoContainer ref={videoRef} />;
};

export default JSMpegVideoPlayer; 