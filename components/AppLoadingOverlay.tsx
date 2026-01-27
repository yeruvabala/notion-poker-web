'use client';

import { useState, useEffect } from 'react';

/**
 * AppLoadingOverlay - Animated suits loading experience
 * 
 * CRITICAL: Shows immediately on mount to prevent any flash of content
 */
export default function AppLoadingOverlay() {
    const [isVisible, setIsVisible] = useState(true);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        // Remove the instant blocking overlay now that React is ready
        const instantOverlay = document.getElementById('__instant-overlay');
        if (instantOverlay) {
            instantOverlay.remove();
        }

        // Mark as mounted to start animations
        setIsMounted(true);

        // Total animation: 4 seconds, then fade out
        const timer = setTimeout(() => {
            setIsFadingOut(true);
            setTimeout(() => setIsVisible(false), 500);
        }, 4000);

        return () => clearTimeout(timer);
    }, []);

    if (!isVisible) return null;

    return (
        <>
            <div className={`app-loading-overlay ${isFadingOut ? 'fade-out' : ''}`}>
                <div className={`suits-container ${isMounted ? 'animate' : ''}`}>
                    <span className="suit suit-1">♠</span>
                    <span className="suit suit-2">♥</span>
                    <span className="suit suit-3">♦</span>
                    <span className="suit suit-4">♣</span>
                </div>
            </div>

            <style jsx global>{`
                /* CRITICAL: Overlay must cover everything immediately */
                .app-loading-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 999999;
                    background: #0a0a0f;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: opacity 0.5s ease-out;
                }

                .app-loading-overlay.fade-out {
                    opacity: 0;
                    pointer-events: none;
                }

                /* CENTERED suits container */
                .suits-container {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: center;
                    gap: 20px;
                    font-size: 32px;
                }

                .suit {
                    opacity: 0;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                }

                /* Animations only start when mounted */
                .suits-container.animate .suit-1 {
                    color: #a0a0a0;
                    animation: 
                        floatIn1 0.8s ease-out 0.2s forwards,
                        shimmer 0.6s ease-in-out 2.5s forwards;
                }

                .suits-container.animate .suit-2 {
                    color: #dc2626;
                    animation: 
                        floatIn2 0.8s ease-out 0.5s forwards,
                        shimmer 0.6s ease-in-out 2.7s forwards;
                }

                .suits-container.animate .suit-3 {
                    color: #dc2626;
                    animation: 
                        floatIn3 0.8s ease-out 0.8s forwards,
                        shimmer 0.6s ease-in-out 2.9s forwards;
                }

                .suits-container.animate .suit-4 {
                    color: #a0a0a0;
                    animation: 
                        floatIn4 0.8s ease-out 1.1s forwards,
                        shimmer 0.6s ease-in-out 3.1s forwards;
                }

                /* Float in from top */
                @keyframes floatIn1 {
                    0% {
                        opacity: 0;
                        transform: translateY(-80px) rotate(-20deg);
                    }
                    100% {
                        opacity: 0.7;
                        transform: translateY(0) rotate(0deg);
                    }
                }

                /* Float in from left */
                @keyframes floatIn2 {
                    0% {
                        opacity: 0;
                        transform: translateX(-80px) rotate(15deg);
                    }
                    100% {
                        opacity: 0.7;
                        transform: translateX(0) rotate(0deg);
                    }
                }

                /* Float in from right */
                @keyframes floatIn3 {
                    0% {
                        opacity: 0;
                        transform: translateX(80px) rotate(-15deg);
                    }
                    100% {
                        opacity: 0.7;
                        transform: translateX(0) rotate(0deg);
                    }
                }

                /* Float in from bottom */
                @keyframes floatIn4 {
                    0% {
                        opacity: 0;
                        transform: translateY(80px) rotate(20deg);
                    }
                    100% {
                        opacity: 0.7;
                        transform: translateY(0) rotate(0deg);
                    }
                }

                /* Shimmer wave effect */
                @keyframes shimmer {
                    0% {
                        opacity: 0.7;
                        text-shadow: none;
                    }
                    50% {
                        opacity: 1;
                        text-shadow: 
                            0 0 10px currentColor,
                            0 0 20px currentColor,
                            0 0 30px currentColor;
                    }
                    100% {
                        opacity: 0.8;
                        text-shadow: 0 0 5px currentColor;
                    }
                }
            `}</style>
        </>
    );
}
