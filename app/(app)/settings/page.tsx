'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';

export default function SettingsPage() {
  const router = useRouter();
  const sb = createClient();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    // Haptic feedback on logout tap
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
  }

  return (
    <div className="settings-page">
      {/* Header */}
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
      </div>

      {/* Settings Content */}
      <div className="settings-content">
        {/* App Info Section */}
        <div className="settings-section">
          <div className="settings-section-title">About</div>
          <div className="settings-item">
            <span className="settings-item-label">Version</span>
            <span className="settings-item-value">1.0.0</span>
          </div>
          <div className="settings-item">
            <span className="settings-item-label">Build</span>
            <span className="settings-item-value">Production</span>
          </div>
        </div>

        {/* Spacer */}
        <div className="settings-spacer" />

        {/* Account Section */}
        <div className="settings-section">
          <div className="settings-section-title">Account</div>

          {/* Logout Button */}
          <button
            className="settings-logout-button"
            onClick={handleSignOut}
            disabled={loading}
          >
            <span className="logout-text">
              {loading ? 'Signing out...' : 'Sign Out'}
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
