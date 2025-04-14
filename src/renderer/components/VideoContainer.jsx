// src/renderer/components/VideoContainer.jsx
import React, { forwardRef } from 'react'; // Import React if not implicitly handled by build setup

/**
 * VideoContainer Component
 *
 * A simple presentational component that creates a full-screen black container.
 * It uses forwardRef to allow its parent component to get a reference to the inner div,
 * which is typically used as the mounting point for a video player library like JSMpeg.
 *
 * Responsibilities:
 * - Provides layout and styling for the video area (fixed position, full screen, black background).
 * - Accepts and forwards a ref to its primary div element.
 */
const VideoContainer = forwardRef((props, ref) => {
  // props are passed down but not used directly in this simple version
  // '_' is often used if props are received but intentionally ignored

  return (
    // Fixed position container covering the entire screen
    <div className="fixed inset-0 w-screen h-screen bg-black flex items-center justify-center overflow-hidden">
        {/*
          The inner div receives the ref.
          JSMpeg (or another player) will likely attach its canvas or video element inside this div.
          'object-contain' helps if the video aspect ratio doesn't match the screen,
          though JSMpeg might control sizing via its canvas directly.
          Ensure width and height are 100% to fill the container.
         */}
      <div
        ref={ref}
        className="w-full h-full object-contain"
        // Optional: Add an ID if needed for direct DOM manipulation (less common in React)
        // id="video-player-mount-point"
      >
        {/* Content (like the JSMpeg canvas) will be inserted here by the library */}
      </div>
    </div>
  );
});

// Setting displayName is helpful for debugging in React DevTools
VideoContainer.displayName = 'VideoContainer';

export default VideoContainer;