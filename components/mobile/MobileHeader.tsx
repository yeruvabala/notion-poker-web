'use client';

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import SettingsDrawer from './SettingsDrawer';

/**
 * Premium SVG Suit Icons for Android
 * These look premium with gradients and glows, unlike basic Android emoji
 */
const SpadeSVG = () => (
    <svg width="16" height="16" viewBox="0 0 100 100" className="android-suit-svg spade">
        <defs>
            <linearGradient id="spadeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#e8e8e8" />
                <stop offset="50%" stopColor="#a0a0a0" />
                <stop offset="100%" stopColor="#606060" />
            </linearGradient>
            <filter id="spadeGlow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
        <path fill="url(#spadeGrad)" filter="url(#spadeGlow)" d="M50 10 C50 10 10 45 10 65 C10 80 25 90 40 80 L35 95 L65 95 L60 80 C75 90 90 80 90 65 C90 45 50 10 50 10 Z" />
    </svg>
);

const HeartSVG = () => (
    <svg width="16" height="16" viewBox="0 0 100 100" className="android-suit-svg heart">
        <defs>
            <linearGradient id="heartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ff6b6b" />
                <stop offset="50%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>
            <filter id="heartGlow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
        <path fill="url(#heartGrad)" filter="url(#heartGlow)" d="M50 88 C20 60 5 40 15 25 C25 10 45 15 50 30 C55 15 75 10 85 25 C95 40 80 60 50 88 Z" />
    </svg>
);

const DiamondSVG = () => (
    <svg width="16" height="16" viewBox="0 0 100 100" className="android-suit-svg diamond">
        <defs>
            <linearGradient id="diamondGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ff6b6b" />
                <stop offset="50%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>
            <filter id="diamondGlow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
        <polygon fill="url(#diamondGrad)" filter="url(#diamondGlow)" points="50,5 90,50 50,95 10,50" />
    </svg>
);

const ClubSVG = () => (
    <svg width="16" height="16" viewBox="0 0 100 100" className="android-suit-svg club">
        <defs>
            <linearGradient id="clubGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#e8e8e8" />
                <stop offset="50%" stopColor="#a0a0a0" />
                <stop offset="100%" stopColor="#606060" />
            </linearGradient>
            <filter id="clubGlow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
        <circle fill="url(#clubGrad)" filter="url(#clubGlow)" cx="50" cy="30" r="20" />
        <circle fill="url(#clubGrad)" filter="url(#clubGlow)" cx="30" cy="55" r="20" />
        <circle fill="url(#clubGrad)" filter="url(#clubGlow)" cx="70" cy="55" r="20" />
        <polygon fill="url(#clubGrad)" points="45,55 55,55 55,95 45,95" />
    </svg>
);

/**
 * MobileHeader - Fixed header for iOS/Android native app
 * 
 * Features:
 * - Fixed position at top with extra padding for notch (like Instagram)
 * - "ONLY POKER" title with animated shimmer gradient (same as web)
 * - Premium SVG suits on Android, emoji on iOS
 * - Glassmorphism background
 * - Settings gear button in bottom right
 */
export default function MobileHeader() {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [isAndroid, setIsAndroid] = useState(false);

    useEffect(() => {
        // Detect Android platform
        setIsAndroid(Capacitor.getPlatform() === 'android');
    }, []);

    const haptic = () => {
        if (Capacitor.isNativePlatform()) {
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
        }
    };

    return (
        <>
            <header className="mobile-header">
                <div className="mobile-header-content">
                    {/* Using same class as web for animations */}
                    <h1 className="homepage-title mobile-homepage-title">ONLY POKER</h1>

                    {/* Premium SVG suits on Android, emoji on iOS */}
                    <div className={`suit-decoration mobile-suit-decoration ${isAndroid ? 'android-suits' : ''}`}>
                        {isAndroid ? (
                            <>
                                <SpadeSVG />
                                <HeartSVG />
                                <DiamondSVG />
                                <ClubSVG />
                            </>
                        ) : (
                            <>
                                <span>♠</span>
                                <span>♥</span>
                                <span>♦</span>
                                <span>♣</span>
                            </>
                        )}
                    </div>

                    {/* Settings Button */}
                    <button
                        className="settings-avatar-button"
                        onClick={() => { haptic(); setSettingsOpen(true); }}
                        aria-label="Open settings"
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                        >
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Settings Drawer */}
            <SettingsDrawer
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
            />
        </>
    );
}

