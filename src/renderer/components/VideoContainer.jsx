import { forwardRef } from 'react';

{/* VideoContainer is a simple presentational component that creates a full-screen black container
It uses forwardRef to pass a ref down to its inner div
It's purely responsible for layout and styling
Acts as a wrapper/container where video content can be rendered */}
const VideoContainer = forwardRef((_, ref) => {
  return (
    <div className="fixed inset-0 w-screen h-screen bg-black flex items-center justify-center">
      <div 
        className="relative w-full h-full flex items-center justify-center"
        style={{
          aspectRatio: '4/3', // Tello's native aspect ratio (960x720)
          maxWidth: '100%',
          maxHeight: '100%',
          margin: 'auto',
          overflow: 'hidden'
        }}
      >
        <canvas
          ref={ref}
          width="960"
          height="720"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
      </div>
    </div>
  );
});

VideoContainer.displayName = 'VideoContainer';

export default VideoContainer; 