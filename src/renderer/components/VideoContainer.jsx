import React from 'react';
import JSMpegVideoPlayer from './JSMpegVideoPlayer';

const VideoContainer = () => {
    const wsUrl = 'ws://localhost:8082/stream';

    return (
        <div className="w-full h-full bg-gray-900 rounded-lg overflow-hidden">
            <JSMpegVideoPlayer url={wsUrl} />
        </div>
    );
};

export default VideoContainer;