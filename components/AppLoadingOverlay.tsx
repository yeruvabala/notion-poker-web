'use client';

import { useState, useEffect } from 'react';

/**
 * AppLoadingOverlay - Seamless transition from native splash to app
 * 
 * Flow:
 * 1. Native splash shows spade logo (1.5s)
 * 2. This overlay shows immediately with same spade (seamless handoff)
 * 3. Logo pulses with glow, then zooms out
 * 4. Overlay fades to reveal actual app content
 */
export default function AppLoadingOverlay() {
    const [isVisible, setIsVisible] = useState(true);
    const [isAnimatingOut, setIsAnimatingOut] = useState(false);

    useEffect(() => {
        // Start zoom-out animation after a brief moment
        const animationTimer = setTimeout(() => {
            setIsAnimatingOut(true);
        }, 400); // Brief pause to let content load

        // Remove overlay completely after animation
        const hideTimer = setTimeout(() => {
            setIsVisible(false);
        }, 1000); // Total: 400ms wait + 600ms animation

        return () => {
            clearTimeout(animationTimer);
            clearTimeout(hideTimer);
        };
    }, []);

    if (!isVisible) return null;

    return (
        <>
            <div className={`app-loading-overlay ${isAnimatingOut ? 'fade-out' : ''}`}>
                <div className={`app-loading-logo ${isAnimatingOut ? 'zoom-out' : ''}`}>
                    {/* 3D Spade Logo - matching native splash */}
                    <svg
                        viewBox="0 0 100 120"
                        className="spade-logo"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <defs>
                            {/* Metallic gradient */}
                            <linearGradient id="metallic" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#8a8a8a" />
                                <stop offset="25%" stopColor="#d0d0d0" />
                                <stop offset="50%" stopColor="#e8e8e8" />
                                <stop offset="75%" stopColor="#c0c0c0" />
                                <stop offset="100%" stopColor="#7a7a7a" />
                            </linearGradient>
                            {/* Glow filter */}
                            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="4" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        {/* Spade shape */}
                        <path
                            d="M50 5 C50 5 10 40 10 65 C10 85 25 95 40 90 C35 100 30 110 25 115 L75 115 C70 110 65 100 60 90 C75 95 90 85 90 65 C90 40 50 5 50 5 Z"
                            fill="url(#metallic)"
                            filter="url(#glow)"
                        />
                    </svg>
                </div>

                {/* Subtle glow behind logo */}
                <div className={`app-loading-glow ${isAnimatingOut ? 'glow-fade' : ''}`}></div>
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

                .app-loading-logo {
                    position: relative;
                    z-index: 2;
                    width: 80px;
                    height: 96px;
                    transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease-out;
                }

                .app-loading-logo.zoom-out {
                    transform: scale(1.5);
                    opacity: 0;
                }

                .spade-logo {
                    width: 100%;
                    height: 100%;
                    filter: drop-shadow(0 0 20px rgba(200, 200, 200, 0.3));
                }

                /* Pulsing glow behind logo */
                .app-loading-glow {
                    position: absolute;
                    width: 200px;
                    height: 200px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(180, 180, 190, 0.15) 0%, transparent 70%);
                    animation: glow-pulse 1.5s ease-in-out infinite;
                    z-index: 1;
                }

                .app-loading-glow.glow-fade {
                    animation: none;
                    opacity: 0;
                    transition: opacity 0.4s ease-out;
                }

                @keyframes glow-pulse {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 0.5;
                    }
                    50% {
                        transform: scale(1.1);
                        opacity: 0.8;
                    }
                }
            `}</style>
        </>
    );
}
