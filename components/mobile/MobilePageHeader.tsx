'use client';

import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import SettingsDrawer from './SettingsDrawer';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';

/**
 * MobilePageHeader - Reusable page header with premium styling
 * 
 * Features:
 * - "ONLY POKER" style title with metallic gradient animation
 * - Card suit symbols with shimmer effect
 * - Settings avatar button in top-right
 * - Glassmorphism background
 * 
 * Used on: Home, My Hands, Ranges, Study, Stats pages
 */

interface MobilePageHeaderProps {
    title: string;
    showSettings?: boolean;
}

export default function MobilePageHeader({ title, showSettings = true }: MobilePageHeaderProps) {
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Enable Safari-style edge swipe navigation
    useSwipeNavigation();

    const haptic = () => {
        if (Capacitor.isNativePlatform()) {
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
        }
    };

    return (
        <>
            <header className="mobile-header">
                <div className="mobile-header-content">
                    {/* Premium metallic gradient title with shimmer animation */}
                    <h1 className="homepage-title mobile-homepage-title">{title}</h1>

                    {/* Suit symbols with staggered shimmer effect */}
                    <div className="suit-decoration mobile-suit-decoration">
                        <span>♠</span>
                        <span>♥</span>
                        <span>♦</span>
                        <span>♣</span>
                    </div>

                    {/* Settings Avatar Button - top right */}
                    {showSettings && (
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
                    )}
                </div>
            </header>

            {/* Settings Drawer */}
            {showSettings && (
                <SettingsDrawer
                    isOpen={settingsOpen}
                    onClose={() => setSettingsOpen(false)}
                />
            )}
        </>
    );
}
