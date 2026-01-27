'use client';

import { useState, useEffect } from 'react';

/**
 * AppLoadingOverlay - Immersive loading experience
 * 
 * Features:
 * - Floating poker symbols in background (suits + AKQJ)
 * - Four suits animate in and settle
 * - Wave shimmer effect (more noticeable)
 * - Fades out to reveal app
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

    // Floating background symbols
    const floatingSymbols = ['♠', '♥', '♦', '♣', 'A', 'K', 'Q', 'J', '♠', '♥', '♦', '♣'];

    return (
        <>
            <div className={`app-loading-overlay ${isFadingOut ? 'fade-out' : ''}`}>
                {/* Floating background symbols */}
                <div className="floating-bg">
                    {floatingSymbols.map((symbol, i) => (
                        <span
                            key={i}
                            className={`floating-symbol fs-${i + 1}`}
                            style={{
                                left: `${5 + (i * 8)}%`,
                                animationDelay: `${i * 0.2}s`,
                            }}
                        >
                            {symbol}
                        </span>
                    ))}
                </div>

                {/* Main suits animation */}
                <div className={`suits-container ${isMounted ? 'animate' : ''}`}>
                    <span className="suit suit-1">♠</span>
                    <span className="suit suit-2">♥</span>
                    <span className="suit suit-3">♦</span>
                    <span className="suit suit-4">♣</span>
                </div>
            </div>

            <style jsx global>{`
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
                    overflow: hidden;
                }

                .app-loading-overlay.fade-out {
                    opacity: 0;
                    pointer-events: none;
                }

                /* Floating background */
                .floating-bg {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                }

                .floating-symbol {
                    position: absolute;
                    font-size: 24px;
                    opacity: 0;
                    color: #333;
                    animation: floatUp 4s ease-in-out infinite;
                }

                /* Stagger positions */
                .fs-1, .fs-5, .fs-9 { top: 90%; }
                .fs-2, .fs-6, .fs-10 { top: 85%; }
                .fs-3, .fs-7, .fs-11 { top: 95%; }
                .fs-4, .fs-8, .fs-12 { top: 88%; }

                @keyframes floatUp {
                    0% {
                        opacity: 0;
                        transform: translateY(0) rotate(0deg);
                    }
                    10% {
                        opacity: 0.15;
                    }
                    90% {
                        opacity: 0.15;
                    }
                    100% {
                        opacity: 0;
                        transform: translateY(-100vh) rotate(360deg);
                    }
                }

                /* Main suits */
                .suits-container {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: center;
                    gap: 24px;
                    font-size: 40px;
                    z-index: 2;
                }

                .suit {
                    opacity: 0;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                }

                /* Float in animations */
                .suits-container.animate .suit-1 {
                    color: #b0b0b0;
                    animation: 
                        floatIn1 0.8s ease-out 0.2s forwards,
                        shimmerBig 0.8s ease-in-out 2.2s forwards;
                }

                .suits-container.animate .suit-2 {
                    color: #ef4444;
                    animation: 
                        floatIn2 0.8s ease-out 0.5s forwards,
                        shimmerBig 0.8s ease-in-out 2.4s forwards;
                }

                .suits-container.animate .suit-3 {
                    color: #ef4444;
                    animation: 
                        floatIn3 0.8s ease-out 0.8s forwards,
                        shimmerBig 0.8s ease-in-out 2.6s forwards;
                }

                .suits-container.animate .suit-4 {
                    color: #b0b0b0;
                    animation: 
                        floatIn4 0.8s ease-out 1.1s forwards,
                        shimmerBig 0.8s ease-in-out 2.8s forwards;
                }

                @keyframes floatIn1 {
                    0% { opacity: 0; transform: translateY(-100px) rotate(-25deg) scale(0.5); }
                    100% { opacity: 0.8; transform: translateY(0) rotate(0deg) scale(1); }
                }

                @keyframes floatIn2 {
                    0% { opacity: 0; transform: translateX(-100px) rotate(20deg) scale(0.5); }
                    100% { opacity: 0.8; transform: translateX(0) rotate(0deg) scale(1); }
                }

                @keyframes floatIn3 {
                    0% { opacity: 0; transform: translateX(100px) rotate(-20deg) scale(0.5); }
                    100% { opacity: 0.8; transform: translateX(0) rotate(0deg) scale(1); }
                }

                @keyframes floatIn4 {
                    0% { opacity: 0; transform: translateY(100px) rotate(25deg) scale(0.5); }
                    100% { opacity: 0.8; transform: translateY(0) rotate(0deg) scale(1); }
                }

                /* BIG shimmer effect - very noticeable */
                @keyframes shimmerBig {
                    0% {
                        opacity: 0.8;
                        transform: scale(1);
                        text-shadow: none;
                    }
                    50% {
                        opacity: 1;
                        transform: scale(1.15);
                        text-shadow: 
                            0 0 20px currentColor,
                            0 0 40px currentColor,
                            0 0 60px currentColor,
                            0 0 80px currentColor;
                    }
                    100% {
                        opacity: 0.9;
                        transform: scale(1);
                        text-shadow: 0 0 10px currentColor;
                    }
                }
            `}</style>
        </>
    );
}
