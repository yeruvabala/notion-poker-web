'use client';

import { useState, useEffect } from 'react';

/**
 * AppLoadingOverlay - Animated suits loading experience
 * 
 * Flow:
 * 1. Dark background appears
 * 2. Four suits (♠ ♥ ♦ ♣) float in from random directions
 * 3. They settle into position (row formation)
 * 4. Wave shimmer animation plays
 * 5. Fade out to reveal app
 */
export default function AppLoadingOverlay() {
    const [isVisible, setIsVisible] = useState(true);
    const [isFadingOut, setIsFadingOut] = useState(false);

    useEffect(() => {
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
                <div className="suits-container">
                    <span className="suit suit-1">♠</span>
                    <span className="suit suit-2">♥</span>
                    <span className="suit suit-3">♦</span>
                    <span className="suit suit-4">♣</span>
                </div>
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
                    transition: opacity 0.5s ease-out;
                }

                .app-loading-overlay.fade-out {
                    opacity: 0;
                    pointer-events: none;
                }

                .suits-container {
                    display: flex;
                    gap: 16px;
                    font-size: 28px;
                }

                .suit {
                    opacity: 0;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                }

                /* Spade - floats in from top */
                .suit-1 {
                    color: #a0a0a0;
                    animation: 
                        floatIn1 0.8s ease-out 0.2s forwards,
                        shimmer 0.6s ease-in-out 2.5s forwards;
                }

                /* Heart - floats in from left */
                .suit-2 {
                    color: #dc2626;
                    animation: 
                        floatIn2 0.8s ease-out 0.5s forwards,
                        shimmer 0.6s ease-in-out 2.7s forwards;
                }

                /* Diamond - floats in from right */
                .suit-3 {
                    color: #dc2626;
                    animation: 
                        floatIn3 0.8s ease-out 0.8s forwards,
                        shimmer 0.6s ease-in-out 2.9s forwards;
                }

                /* Club - floats in from bottom */
                .suit-4 {
                    color: #a0a0a0;
                    animation: 
                        floatIn4 0.8s ease-out 1.1s forwards,
                        shimmer 0.6s ease-in-out 3.1s forwards;
                }

                /* Float in from top */
                @keyframes floatIn1 {
                    0% {
                        opacity: 0;
                        transform: translateY(-100px) rotate(-20deg);
                    }
                    100% {
                        opacity: 0.6;
                        transform: translateY(0) rotate(0deg);
                    }
                }

                /* Float in from left */
                @keyframes floatIn2 {
                    0% {
                        opacity: 0;
                        transform: translateX(-100px) rotate(15deg);
                    }
                    100% {
                        opacity: 0.6;
                        transform: translateX(0) rotate(0deg);
                    }
                }

                /* Float in from right */
                @keyframes floatIn3 {
                    0% {
                        opacity: 0;
                        transform: translateX(100px) rotate(-15deg);
                    }
                    100% {
                        opacity: 0.6;
                        transform: translateX(0) rotate(0deg);
                    }
                }

                /* Float in from bottom */
                @keyframes floatIn4 {
                    0% {
                        opacity: 0;
                        transform: translateY(100px) rotate(20deg);
                    }
                    100% {
                        opacity: 0.6;
                        transform: translateY(0) rotate(0deg);
                    }
                }

                /* Shimmer wave effect */
                @keyframes shimmer {
                    0% {
                        opacity: 0.6;
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
