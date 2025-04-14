import React, { useEffect, useRef } from 'react';
import JSMpeg from '@cycjimmy/jsmpeg-player';

const JSMpegVideoPlayer = ({ url, options = {} }) => {
    const canvasRef = useRef(null);
    const playerRef = useRef(null);

    useEffect(() => {
        if (canvasRef.current && !playerRef.current) {
            const defaultOptions = {
                audio: false,
                video: true,
                pauseWhenHidden: false,
                disableWebAssembly: true,
                preserveDrawingBuffer: true
            };

            playerRef.current = new JSMpeg.Player(url, {
                ...defaultOptions,
                ...options,
                canvas: canvasRef.current
            });
        }

        return () => {
            if (playerRef.current) {
                playerRef.current.destroy();
                playerRef.current = null;
            }
        };
    }, [url, options]);

    return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
};

export default JSMpegVideoPlayer;