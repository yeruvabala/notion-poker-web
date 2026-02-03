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
 * - Account deletion for Apple compliance
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
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

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

    const handleDeleteAccount = async () => {
        if (!sb) return;

        if (Capacitor.isNativePlatform()) {
            Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => { });
        }

        try {
            setDeleting(true);
            setDeleteError(null);

            const response = await fetch('/api/account/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete account');
            }

            await sb.auth.signOut();
            window.location.href = '/login?deleted=true';
        } catch (e: any) {
            console.error('Delete account error:', e);
            setDeleteError(e.message || 'Failed to delete account. Please try again.');
            setDeleting(false);
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
                            <span className="settings-drawer-item-label">Version</span>
                            <span className="settings-drawer-item-value">1.0.0</span>
                        </div>
                        <div className="settings-drawer-item">
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
                            <span className="settings-drawer-logout-text">
                                {loading ? 'Signing out...' : 'Sign Out'}
                            </span>
                        </button>

                        {/* Delete Account Button */}
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={deleting}
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                marginTop: '12px',
                                background: 'transparent',
                                border: '1px solid #dc2626',
                                borderRadius: '12px',
                                color: '#dc2626',
                                fontSize: '16px',
                                fontWeight: 600,
                                cursor: deleting ? 'not-allowed' : 'pointer',
                                opacity: deleting ? 0.5 : 1,
                            }}
                        >
                            {deleting ? 'Deleting...' : 'Delete Account'}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="settings-drawer-footer">
                    <span>Made with ♠️ by Only Poker</span>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div
                    onClick={() => !deleting && setShowDeleteConfirm(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '20px',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: '#1a1a1a',
                            border: '1px solid #333',
                            borderRadius: '16px',
                            padding: '24px',
                            maxWidth: '380px',
                            width: '100%',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <span style={{ fontSize: '28px' }}>⚠️</span>
                            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f3f4f6', margin: 0 }}>
                                Delete Account?
                            </h2>
                        </div>
                        <p style={{ color: '#9ca3af', fontSize: '14px', lineHeight: 1.5, marginBottom: '12px' }}>
                            This will permanently delete your account and all your data including:
                        </p>
                        <ul style={{ color: '#9ca3af', fontSize: '14px', paddingLeft: '20px', marginBottom: '16px' }}>
                            <li>All analyzed hands</li>
                            <li>Session history</li>
                            <li>Analytics data</li>
                            <li>Study progress</li>
                        </ul>
                        <p style={{ color: '#dc2626', fontSize: '14px', fontWeight: 600, marginBottom: '20px' }}>
                            This action cannot be undone.
                        </p>

                        {deleteError && (
                            <div style={{
                                background: 'rgba(220, 38, 38, 0.1)',
                                border: '1px solid #dc2626',
                                borderRadius: '8px',
                                padding: '12px',
                                color: '#dc2626',
                                fontSize: '14px',
                                marginBottom: '16px',
                            }}>
                                {deleteError}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deleting}
                                style={{
                                    flex: 1,
                                    padding: '12px 16px',
                                    background: '#333',
                                    border: 'none',
                                    borderRadius: '10px',
                                    color: '#f3f4f6',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: deleting ? 'not-allowed' : 'pointer',
                                    opacity: deleting ? 0.5 : 1,
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={deleting}
                                style={{
                                    flex: 1,
                                    padding: '12px 16px',
                                    background: '#dc2626',
                                    border: 'none',
                                    borderRadius: '10px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: deleting ? 'not-allowed' : 'pointer',
                                    opacity: deleting ? 0.5 : 1,
                                }}
                            >
                                {deleting ? 'Deleting...' : 'Delete Forever'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
