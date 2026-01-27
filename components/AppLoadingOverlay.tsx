'use client';

import { useState, useEffect, useMemo } from 'react';

/**
 * AppLoadingOverlay - Immersive loading with auth-aware positioning
 * 
 * Detects if user is logged in and positions suits accordingly:
 * - Logged IN: Suits float to HOME PAGE header
 * - Logged OUT: Suits float to LOGIN PAGE center
 */
export default function AppLoadingOverlay() {
    const [isVisible, setIsVisible] = useState(true);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [suitsFloatingUp, setSuitsFloatingUp] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

    // Generate random positions for floating symbols
    const floatingSymbols = useMemo(() => {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
        const symbols = [...suits, ...ranks];

        return symbols.map((symbol, i) => ({
            symbol,
            left: Math.random() * 85 + 5,
            startTop: Math.random() * 30 + 70,
            duration: 3 + Math.random() * 2,
            delay: Math.random() * 2.5,
            size: 16 + Math.random() * 14,
            rotation: Math.random() * 360,
            isRed: symbol === '♥' || symbol === '♦',
        }));
    }, []);

    useEffect(() => {
        const instantOverlay = document.getElementById('__instant-overlay');
        if (instantOverlay) {
            instantOverlay.remove();
        }

        // Quick sync check: look for Supabase session in localStorage
        // Supabase uses key: sb-{projectRef}-auth-token
        const checkAuthSync = () => {
            try {
                // Try the exact key pattern Supabase uses
                const key = 'sb-dkkozaccpdsmbbhkhdvs-auth-token';
                const sessionData = localStorage.getItem(key);

                if (sessionData) {
                    const parsed = JSON.parse(sessionData);
                    // Check for access_token in various possible locations
                    const hasToken = !!(
                        parsed?.access_token ||
                        parsed?.currentSession?.access_token ||
                        parsed?.session?.access_token
                    );
                    console.log('[Loading] Auth check:', hasToken ? 'LOGGED IN' : 'LOGGED OUT');
                    return hasToken;
                }

                // Fallback: search all keys
                const storageKeys = Object.keys(localStorage);
                for (const k of storageKeys) {
                    if (k.includes('supabase') || k.includes('sb-')) {
                        const data = localStorage.getItem(k);
                        if (data && data.includes('access_token')) {
                            console.log('[Loading] Found auth in key:', k);
                            return true;
                        }
                    }
                }

                console.log('[Loading] No auth found');
                return false;
            } catch (e) {
                console.log('[Loading] Auth check error:', e);
                return false;
            }
        };

        // Check auth immediately (synchronously)
        const loggedIn = checkAuthSync();
        setIsLoggedIn(loggedIn);
        setIsMounted(true);

        // Timeline
        const floatUpTimer = setTimeout(() => {
            setSuitsFloatingUp(true);
        }, 3500);

        const fadeTimer = setTimeout(() => {
            setIsFadingOut(true);
        }, 4000);

        const hideTimer = setTimeout(() => {
            setIsVisible(false);
        }, 4500);

        return () => {
            clearTimeout(floatUpTimer);
            clearTimeout(fadeTimer);
            clearTimeout(hideTimer);
        };
    }, []);

    if (!isVisible) return null;

    // Determine float target class based on login state
    const floatTargetClass = suitsFloatingUp
        ? (isLoggedIn ? 'float-to-home' : 'float-to-login')
        : '';

    return (
        <>
            <div className={`app-loading-overlay ${isFadingOut ? 'fade-out' : ''}`}>
                {/* Floating background symbols */}
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

                {/* Main suits - will float to appropriate position */}
                <div className={`suits-container ${isMounted ? 'animate' : ''} ${floatTargetClass}`}>
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
                    15% { opacity: 0.2; }
                    85% { opacity: 0.2; }
                    100% {
                        opacity: 0;
                        transform: translateY(-120vh) rotate(calc(var(--rotation, 0deg) + 360deg));
                    }
                }

                /* Main suits container */
                .suits-container {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    font-size: 24px;
                    z-index: 2;
                    transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
                }

                /* LOGGED IN: Float to HOME PAGE header position */
                .suits-container.float-to-home {
                    transform: translateY(-39vh) scale(0.45);
                }

                /* LOGGED OUT: Float to LOGIN PAGE suits position */
                .suits-container.float-to-login {
                    transform: translateY(-26vh) scale(0.5);
                }

                .suit {
                    opacity: 0;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                }

                /* Float in animations */
                .suits-container.animate .suit-1 {
                    color: #9ca3af;
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
                    color: #9ca3af;
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
