'use client';

import { useState, useEffect } from 'react';
import { getPatternSymbols } from '@/lib/loadingSymbols';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

// Extend Window interface for pattern index and debug logs
declare global {
    interface Window {
        __PATTERN_INDEX__?: number;
        __APP_DEBUG_LOGS__?: string[];
    }
}

// Debug logging helper - stores logs for display if loading fails
function debugLog(message: string) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const logMessage = `[${timestamp}] ${message}`;
    console.log(`[AppLoadingOverlay] ${logMessage}`);

    if (typeof window !== 'undefined') {
        if (!window.__APP_DEBUG_LOGS__) {
            window.__APP_DEBUG_LOGS__ = [];
        }
        window.__APP_DEBUG_LOGS__.push(logMessage);
    }
}

/**
 * AppLoadingOverlay - Immersive loading with random scatter patterns
 * 
 * Flow:
 * 1. Server picks random pattern (0-16)
 * 2. Dark HTML shows scattered symbols in that pattern
 * 3. React reads same pattern index from window.__PATTERN_INDEX__
 * 4. Seamless takeover - symbols at same positions
 * 5. Symbols float UP, main suits shimmer, then settle
 * 
 * Debug: Has a 15-second failsafe that shows debug info if loading gets stuck
 */
export default function AppLoadingOverlay() {
    const [isVisible, setIsVisible] = useState(true);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [suitsFloatingUp, setSuitsFloatingUp] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [patternIndex, setPatternIndex] = useState(0);
    const [loadingTimeout, setLoadingTimeout] = useState(false);
    const [debugLogs, setDebugLogs] = useState<string[]>([]);

    useEffect(() => {
        debugLog('useEffect started - React component mounted');
        debugLog(`Platform: ${Capacitor.getPlatform()}, Native: ${Capacitor.isNativePlatform()}`);

        // Read pattern index from server (set in layout.tsx)
        const serverPatternIndex = typeof window !== 'undefined'
            ? (window.__PATTERN_INDEX__ ?? 0)
            : 0;
        setPatternIndex(serverPatternIndex);
        debugLog(`Pattern index set: ${serverPatternIndex}`);

        // Remove the instant overlay now that React is ready
        const instantOverlay = document.getElementById('__instant-overlay');
        if (instantOverlay) {
            instantOverlay.remove();
            debugLog('Instant overlay removed');
        }

        // Hide the JS-failed overlay since JS is clearly working
        const jsFailedOverlay = document.getElementById('__js-failed-overlay');
        if (jsFailedOverlay) {
            jsFailedOverlay.classList.add('hidden');
            debugLog('JS-failed overlay hidden');
        }

        // NOW hide the native splash - dark background + symbols are ready!
        if (Capacitor.isNativePlatform()) {
            debugLog('Hiding native splash screen...');
            SplashScreen.hide({ fadeOutDuration: 300 })
                .then(() => debugLog('Splash screen hidden successfully'))
                .catch((err) => debugLog(`Splash screen hide error: ${err}`));
        }

        // Quick sync check for auth
        debugLog('Checking auth status...');
        const checkAuthSync = () => {
            try {
                const key = 'sb-dkkozaccpdsmbbhkhdvs-auth-token';
                const sessionData = localStorage.getItem(key);
                if (sessionData) {
                    const parsed = JSON.parse(sessionData);
                    const hasToken = !!(parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token);
                    debugLog(`Auth check: found session data, hasToken=${hasToken}`);
                    return hasToken;
                }
                const storageKeys = Object.keys(localStorage);
                for (const k of storageKeys) {
                    if (k.includes('supabase') || k.includes('sb-')) {
                        const data = localStorage.getItem(k);
                        if (data && data.includes('access_token')) {
                            debugLog(`Auth check: found token in key ${k}`);
                            return true;
                        }
                    }
                }
                debugLog('Auth check: no token found');
                return false;
            } catch (err) {
                debugLog(`Auth check error: ${err}`);
                return false;
            }
        };

        const loggedIn = checkAuthSync();
        setIsLoggedIn(loggedIn);
        setIsMounted(true);
        debugLog(`Auth result: isLoggedIn=${loggedIn}, isMounted=true`);

        // Timeline
        debugLog('Starting animation timeline...');
        const floatUpTimer = setTimeout(() => {
            debugLog('Float up animation triggered');
            setSuitsFloatingUp(true);
        }, 3500);
        const fadeTimer = setTimeout(() => {
            debugLog('Fade out animation triggered');
            setIsFadingOut(true);
        }, 4000);
        const hideTimer = setTimeout(() => {
            debugLog('Overlay hidden - loading complete!');
            setIsVisible(false);
        }, 4500);

        // FAILSAFE: If loading takes more than 15 seconds, show debug UI
        const failsafeTimer = setTimeout(() => {
            debugLog('FAILSAFE TRIGGERED - loading timeout after 15 seconds');
            // Force hide splash screen in case it's stuck
            if (Capacitor.isNativePlatform()) {
                SplashScreen.hide({ fadeOutDuration: 0 }).catch(() => { });
            }
            setDebugLogs(window.__APP_DEBUG_LOGS__ || []);
            setLoadingTimeout(true);
        }, 15000);

        return () => {
            clearTimeout(floatUpTimer);
            clearTimeout(fadeTimer);
            clearTimeout(hideTimer);
            clearTimeout(failsafeTimer);
        };
    }, []);

    if (!isVisible) return null;

    // Show debug UI if loading took too long
    if (loadingTimeout) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: '#1c1c1c',
                color: '#f59e0b',
                padding: '20px',
                paddingTop: 'max(60px, env(safe-area-inset-top))',
                overflowY: 'auto',
                fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                zIndex: 999999,
            }}>
                <h1 style={{ fontSize: '20px', marginBottom: '12px', color: '#f59e0b' }}>
                    ⏱️ Loading Timeout
                </h1>

                <p style={{ color: '#9ca3af', marginBottom: '16px', fontSize: '14px' }}>
                    App loading took longer than 15 seconds. Debug logs:
                </p>

                <div style={{
                    background: '#2a2a2a',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '16px',
                }}>
                    <h2 style={{ fontSize: '12px', color: '#3b82f6', marginBottom: '8px' }}>
                        Platform Info:
                    </h2>
                    <pre style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>
                        Platform: {Capacitor.getPlatform()}{'\n'}
                        Native: {Capacitor.isNativePlatform() ? 'Yes' : 'No'}{'\n'}
                        URL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}
                    </pre>
                </div>

                <div style={{
                    background: '#2a2a2a',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '16px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                }}>
                    <h2 style={{ fontSize: '12px', color: '#3b82f6', marginBottom: '8px' }}>
                        Debug Logs ({debugLogs.length} entries):
                    </h2>
                    {debugLogs.length === 0 ? (
                        <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>
                            No logs captured - React may not have mounted properly
                        </p>
                    ) : (
                        debugLogs.map((log, i) => (
                            <div key={i} style={{
                                fontSize: '10px',
                                color: '#9ca3af',
                                padding: '2px 0',
                                borderBottom: '1px solid #333',
                            }}>
                                {log}
                            </div>
                        ))
                    )}
                </div>

                <button
                    onClick={() => window.location.reload()}
                    style={{
                        width: '100%',
                        padding: '14px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        marginBottom: '12px',
                    }}
                >
                    Reload App
                </button>

                <button
                    onClick={() => {
                        setLoadingTimeout(false);
                        setIsVisible(false);
                    }}
                    style={{
                        width: '100%',
                        padding: '14px',
                        background: '#374151',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: 'pointer',
                    }}
                >
                    Continue Anyway
                </button>
            </div>
        );
    }

    // Get the same symbols as dark HTML (matching positions!)
    const symbols = getPatternSymbols(patternIndex);

    const floatTargetClass = suitsFloatingUp
        ? (isLoggedIn ? 'float-to-home' : 'float-to-login')
        : '';

    return (
        <>
            <div className={`app-loading-overlay ${isFadingOut ? 'fade-out' : ''}`}>
                {/* Background symbols - same positions as dark HTML, then float up */}
                <div className="floating-bg">
                    {symbols.map((item, i) => (
                        <span
                            key={i}
                            className={`bg-symbol ${isMounted ? 'float-up' : ''}`}
                            style={{
                                left: `${item.left}%`,
                                top: `${item.top}%`,
                                fontSize: `${item.size}px`,
                                color: item.isRed ? '#4a2020' : '#2a2a2a',
                                animationDelay: `${i * 0.05}s`,
                            }}
                        >
                            {item.symbol}
                        </span>
                    ))}
                </div>

                {/* Main suits - float in, shimmer, then settle */}
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
                    background: #1c1c1c;
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

                /* Background symbols */
                .floating-bg {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                }

                .bg-symbol {
                    position: absolute;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    opacity: 0;
                    transition: none;
                }

                /* Fade in animation */
                .bg-symbol.float-up {
                    animation: symbolFadeInThenUp 4s ease-out forwards;
                }

                @keyframes symbolFadeInThenUp {
                    0% {
                        opacity: 0;
                        transform: translateY(0) scale(0.8);
                    }
                    25% {
                        opacity: 0.25;
                        transform: translateY(0) scale(1);
                    }
                    100% {
                        opacity: 0;
                        transform: translateY(-120vh) scale(1);
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
                    transform: translateY(-37.55vh) scale(0.45);
                }

                /* Android: Float 15px higher (total: -37.55vh - 15px) */
                body.native-android .suits-container.float-to-home {
                    transform: translateY(calc(-37.55vh - 15px)) scale(0.45);
                }

                /* LOGGED OUT: Float to LOGIN PAGE suits position */
                /* Using fixed px instead of vh for consistent position on all screen sizes */
                /* (Login content is centered, so offset from center is constant) */
                .suits-container.float-to-login {
                    transform: translateY(-211.5px) scale(0.5);
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
