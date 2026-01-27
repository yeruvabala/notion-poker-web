'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * AppLoadingOverlay - Seamless transition from native splash to app
 * 
 * Flow:
 * 1. Native splash shows static spade logo (1.5s)
 * 2. This overlay plays the 3D rotating spade video (seamless handoff)
 * 3. After video plays, fade out to reveal actual app content
 */
export default function AppLoadingOverlay() {
    const [isVisible, setIsVisible] = useState(true);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // When video ends, start fade out
        const handleVideoEnd = () => {
            setIsFadingOut(true);
            setTimeout(() => {
                setIsVisible(false);
            }, 400); // Fade duration
        };

        // Fallback: if video doesn't load or takes too long, hide after 3s
        const fallbackTimer = setTimeout(() => {
            setIsFadingOut(true);
            setTimeout(() => setIsVisible(false), 400);
        }, 3000);

        video.addEventListener('ended', handleVideoEnd);

        // Try to play video
        video.play().catch(() => {
            // If autoplay fails, just fade out
            setTimeout(() => {
                setIsFadingOut(true);
                setTimeout(() => setIsVisible(false), 400);
            }, 500);
        });

        return () => {
            video.removeEventListener('ended', handleVideoEnd);
            clearTimeout(fallbackTimer);
        };
    }, []);

    if (!isVisible) return null;

    return (
        <>
            <div className={`app-loading-overlay ${isFadingOut ? 'fade-out' : ''}`}>
                <video
                    ref={videoRef}
                    className="loading-video"
                    src="/static/spade-rotation.mp4"
                    muted
                    playsInline
                    preload="auto"
                />
            </div>

            <style jsx global>{`
                .app-loading-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    background: #0a0a0f;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: opacity 0.4s ease-out;
                }

                .app-loading-overlay.fade-out {
                    opacity: 0;
                    pointer-events: none;
                }

                .loading-video {
                    width: 150px;
                    height: auto;
                    object-fit: contain;
                }
            `}</style>
        </>
    );
}
