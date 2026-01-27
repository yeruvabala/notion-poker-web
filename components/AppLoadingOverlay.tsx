'use client';

import { useState, useEffect } from 'react';

/**
 * AppLoadingOverlay - Simple dark overlay that fades out when app is ready
 * 
 * Flow:
 * 1. Native splash shows for 2.5s
 * 2. This dark overlay shows immediately (seamless handoff - same color)
 * 3. Waits for page to be ready, then fades out
 * 
 * Simple, reliable, works every time.
 */
export default function AppLoadingOverlay() {
    const [isVisible, setIsVisible] = useState(true);
    const [isFadingOut, setIsFadingOut] = useState(false);

    useEffect(() => {
        // Wait for document to be fully loaded, then fade out
        const handleReady = () => {
            // Small delay to ensure content is painted
            setTimeout(() => {
                setIsFadingOut(true);
                setTimeout(() => setIsVisible(false), 400);
            }, 100);
        };

        // Check if already loaded
        if (document.readyState === 'complete') {
            handleReady();
        } else {
            window.addEventListener('load', handleReady);
        }

        // Fallback: max 2 seconds overlay
        const fallback = setTimeout(() => {
            setIsFadingOut(true);
            setTimeout(() => setIsVisible(false), 400);
        }, 2000);

        return () => {
            window.removeEventListener('load', handleReady);
            clearTimeout(fallback);
        };
    }, []);

    if (!isVisible) return null;

    return (
        <>
            <div className={`app-loading-overlay ${isFadingOut ? 'fade-out' : ''}`} />

            <style jsx global>{`
                .app-loading-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    background: #0a0a0f;
                    transition: opacity 0.4s ease-out;
                }

                .app-loading-overlay.fade-out {
                    opacity: 0;
                    pointer-events: none;
                }
            `}</style>
        </>
    );
}
