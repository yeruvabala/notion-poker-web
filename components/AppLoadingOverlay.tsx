'use client';

import { useState, useEffect, useMemo } from 'react';

/**
 * AppLoadingOverlay - Immersive loading experience
 * 
 * Features:
 * - Random floating poker symbols in background
 * - Four suits animate in and settle
 * - Wave shimmer effect
 * - Fades out to reveal app
 */
export default function AppLoadingOverlay() {
    const [isVisible, setIsVisible] = useState(true);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    // Generate random positions for floating symbols
    // All 13 ranks + 4 suits = 17 symbols
    const floatingSymbols = useMemo(() => {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
        const symbols = [...suits, ...ranks];

        return symbols.map((symbol, i) => ({
            symbol,
            left: Math.random() * 85 + 5, // 5% to 90%
            startTop: Math.random() * 30 + 70, // Start from 70-100% (bottom area)
            duration: 3 + Math.random() * 2, // 3-5 seconds
            delay: Math.random() * 2.5, // 0-2.5 second delay
            size: 16 + Math.random() * 14, // 16-30px
            rotation: Math.random() * 360, // Random initial rotation
            isRed: symbol === '♥' || symbol === '♦',
        }));
    }, []);

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
                {/* Random floating background symbols */}
                <div className="floating-bg">
                    {floatingSymbols.map((item, i) => (
                        <span
                            key={i}
                            className="floating-symbol"
                            style={{
                                left: `${item.left}%`,
                                top: `${item.startTop}%`,
                                fontSize: `${item.size}px`,
                                color: item.isRed ? '#4a2020' : '#2a2a2a',
                                animationDuration: `${item.duration}s`,
                                animationDelay: `${item.delay}s`,
                                '--rotation': `${item.rotation}deg`,
                            } as React.CSSProperties}
                        >
                            {item.symbol}
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
                    opacity: 0;
                    animation: floatRandom 4s ease-in-out forwards;
                }

                @keyframes floatRandom {
                    0% {
                        opacity: 0;
                        transform: translateY(0) rotate(var(--rotation, 0deg));
                    }
                    15% {
                        opacity: 0.2;
                    }
                    85% {
                        opacity: 0.2;
                    }
                    100% {
                        opacity: 0;
                        transform: translateY(-120vh) rotate(calc(var(--rotation, 0deg) + 360deg));
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

                /* BIG shimmer effect */
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
