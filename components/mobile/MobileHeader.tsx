'use client';

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import SettingsDrawer from './SettingsDrawer';

/**
 * MobileHeader - Fixed header for iOS/Android native app
 * 
 * Features:
 * - Fixed position at top with extra padding for notch (like Instagram)
 * - "ONLY POKER" title with animated shimmer gradient (same as web)
 * - Uses Noto Color Emoji on Android for premium emoji rendering
 * - Glassmorphism background
 * - Settings gear button in bottom right
 * 
 * IMPORTANT: iOS remains completely unchanged - uses native Apple emoji
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

                    {/* Suit decoration - Android uses special styling for premium look */}
                    <div className={`suit-decoration mobile-suit-decoration ${isAndroid ? 'android-suits' : ''}`}>
                        <span className="suit-spade">♠</span>
                        <span className="suit-heart">♥</span>
                        <span className="suit-diamond">♦</span>
                        <span className="suit-club">♣</span>
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
