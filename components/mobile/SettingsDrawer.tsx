'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * SettingsDrawer - Premium slide-in settings panel
 * 
 * Features:
 * - Glassmorphism background with blur
 * - Smooth slide-in animation from right
 * - Profile info at top
 * - Settings options with platinum styling
 * - Logout with confirmation haptic
 */

interface SettingsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsDrawer({ isOpen, onClose }: SettingsDrawerProps) {
    const router = useRouter();
    const sb = createClient();
    const [loading, setLoading] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    useEffect(() => {
        const getUser = async () => {
            if (sb) {
                const { data: { user } } = await sb.auth.getUser();
                setUserEmail(user?.email || null);
            }
        };
        if (isOpen) {
            getUser();
        }
    }, [isOpen, sb]);

    const haptic = () => {
        if (Capacitor.isNativePlatform()) {
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
        }
    };

    const handleSignOut = async () => {
        if (Capacitor.isNativePlatform()) {
            Haptics.impact({ style: ImpactStyle.Medium }).catch(() => { });
        }

        if (!sb) {
            router.replace('/login');
            return;
        }

        try {
            setLoading(true);
            await sb.auth.signOut();
            router.replace('/login');
        } catch (e) {
            console.error('signOut error', e);
            router.replace('/login');
        } finally {
            setLoading(false);
        }
    };

    // Prevent body scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    return (
        <>
            {/* Backdrop */}
            <div
                className={`settings-drawer-backdrop ${isOpen ? 'open' : ''}`}
                onClick={onClose}
            />

            {/* Drawer */}
            <div className={`settings-drawer ${isOpen ? 'open' : ''}`}>
                {/* Header */}
                <div className="settings-drawer-header">
                    <button className="settings-drawer-close" onClick={() => { haptic(); onClose(); }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                    <h2 className="settings-drawer-title">Settings</h2>
                </div>

                {/* Profile Section */}
                <div className="settings-drawer-profile">
                    <div className="settings-profile-avatar">
                        <span className="settings-profile-initial">
                            {userEmail ? userEmail[0].toUpperCase() : '?'}
                        </span>
                    </div>
                    <div className="settings-profile-info">
                        <span className="settings-profile-email">{userEmail || 'Loading...'}</span>
                        <span className="settings-profile-plan">Pro Player</span>
                    </div>
                </div>

                {/* Settings Options */}
                <div className="settings-drawer-options">
                    {/* About Section */}
                    <div className="settings-drawer-section">
                        <div className="settings-drawer-section-title">About</div>
                        <div className="settings-drawer-item">
                            <span className="settings-drawer-item-icon">📱</span>
                            <span className="settings-drawer-item-label">Version</span>
                            <span className="settings-drawer-item-value">1.0.0</span>
                        </div>
                        <div className="settings-drawer-item">
                            <span className="settings-drawer-item-icon">⚡</span>
                            <span className="settings-drawer-item-label">Build</span>
                            <span className="settings-drawer-item-value">Production</span>
                        </div>
                    </div>

                    {/* Account Section */}
                    <div className="settings-drawer-section">
                        <div className="settings-drawer-section-title">Account</div>
                        <button
                            className="settings-drawer-logout"
                            onClick={handleSignOut}
                            disabled={loading}
                        >
                            <span className="settings-drawer-logout-icon">🚪</span>
                            <span className="settings-drawer-logout-text">
                                {loading ? 'Signing out...' : 'Sign Out'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="settings-drawer-footer">
                    <span>Made with ♠️ by Only Poker</span>
                </div>
            </div>
        </>
    );
}
