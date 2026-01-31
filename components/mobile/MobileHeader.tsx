'use client';

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import SettingsDrawer from './SettingsDrawer';

/**
 * Premium SVG Suit Icons for Android
 * Designed to match iOS emoji quality with smooth metallic gradients and inner glow
 */
const PremiumSpadeSVG = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" className="android-suit-svg">
        <defs>
            <linearGradient id="spadeGradPremium" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#d4d4d8" />
                <stop offset="25%" stopColor="#a1a1aa" />
                <stop offset="50%" stopColor="#71717a" />
                <stop offset="75%" stopColor="#52525b" />
                <stop offset="100%" stopColor="#3f3f46" />
            </linearGradient>
        </defs>
        <path fill="url(#spadeGradPremium)"
            d="M12 2C12 2 4 9 4 14c0 3 2.5 5 5 4.2L8 22h8l-1-3.8c2.5.8 5-1.2 5-4.2C20 9 12 2 12 2z" />
    </svg>
);

const PremiumHeartSVG = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" className="android-suit-svg">
        <defs>
            <linearGradient id="heartGradPremium" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fca5a5" />
                <stop offset="25%" stopColor="#f87171" />
                <stop offset="50%" stopColor="#ef4444" />
                <stop offset="75%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#b91c1c" />
            </linearGradient>
        </defs>
        <path fill="url(#heartGradPremium)"
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
);

const PremiumDiamondSVG = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" className="android-suit-svg">
        <defs>
            <linearGradient id="diamondGradPremium" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fca5a5" />
                <stop offset="25%" stopColor="#f87171" />
                <stop offset="50%" stopColor="#ef4444" />
                <stop offset="75%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#b91c1c" />
            </linearGradient>
        </defs>
        <path fill="url(#diamondGradPremium)"
            d="M12 2L3 12l9 10 9-10L12 2z" />
    </svg>
);

const PremiumClubSVG = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" className="android-suit-svg">
        <defs>
            <linearGradient id="clubGradPremium" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#d4d4d8" />
                <stop offset="25%" stopColor="#a1a1aa" />
                <stop offset="50%" stopColor="#71717a" />
                <stop offset="75%" stopColor="#52525b" />
                <stop offset="100%" stopColor="#3f3f46" />
            </linearGradient>
        </defs>
        <path fill="url(#clubGradPremium)"
            d="M12 2a4 4 0 0 0-4 4c0 1.1.45 2.1 1.17 2.83A4 4 0 0 0 6 13a4 4 0 0 0 4 4h.17L9 22h6l-1.17-5H14a4 4 0 0 0 4-4 4 4 0 0 0-3.17-3.92A4 4 0 0 0 16 6a4 4 0 0 0-4-4z" />
    </svg>
);

/**
 * MobileHeader - Fixed header for iOS/Android native app
 * 
 * Features:
 * - Fixed position at top with extra padding for notch (like Instagram)
 * - "ONLY POKER" title with animated shimmer gradient (same as web)
 * - Premium SVG suits on Android, emoji on iOS (unchanged)
 * - Glassmorphism background
 * - Settings gear button in bottom right
 */
export default function MobileHeader() {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [isAndroid, setIsAndroid] = useState(false);

    useEffect(() => {
        // Detect Android platform - iOS remains unchanged
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

                    {/* Premium SVG suits on Android ONLY, emoji on iOS (unchanged) */}
                    <div className={`suit-decoration mobile-suit-decoration ${isAndroid ? 'android-suits' : ''}`}>
                        {isAndroid ? (
                            <>
                                <PremiumSpadeSVG />
                                <PremiumHeartSVG />
                                <PremiumDiamondSVG />
                                <PremiumClubSVG />
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
