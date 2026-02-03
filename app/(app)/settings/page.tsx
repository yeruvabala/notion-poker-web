'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import MobilePageHeader from '@/components/mobile/MobilePageHeader';

export default function SettingsPage() {
  const router = useRouter();
  const sb = createClient();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function handleDeleteAccount() {
    if (!sb) return;

    // Haptic feedback
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => { });
    }

    try {
      setDeleting(true);
      setDeleteError(null);

      // Call our API to delete the account and all user data
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete account');
      }

      // Sign out after successful deletion
      await sb.auth.signOut();

      // Redirect to login with success message
      window.location.href = '/login?deleted=true';
    } catch (e: any) {
      console.error('Delete account error:', e);
      setDeleteError(e.message || 'Failed to delete account. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <div className="settings-page">
      {/* Premium Page Header */}
      <MobilePageHeader title="SETTINGS" />

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

          {/* Delete Account Button */}
          <button
            className="settings-delete-button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
          >
            <span className="delete-text">
              {deleting ? 'Deleting...' : 'Delete Account'}
            </span>
          </button>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="delete-modal-overlay" onClick={() => !deleting && setShowDeleteConfirm(false)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <span className="delete-modal-icon">⚠️</span>
              <h2 className="delete-modal-title">Delete Account?</h2>
            </div>
            <p className="delete-modal-text">
              This will permanently delete your account and all your data including:
            </p>
            <ul className="delete-modal-list">
              <li>All analyzed hands</li>
              <li>Session history</li>
              <li>Analytics data</li>
              <li>Study progress</li>
            </ul>
            <p className="delete-modal-warning">
              This action cannot be undone.
            </p>

            {deleteError && (
              <div className="delete-modal-error">{deleteError}</div>
            )}

            <div className="delete-modal-buttons">
              <button
                className="delete-modal-cancel"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="delete-modal-confirm"
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <MobileBottomNav />

      <style jsx>{`
        .settings-delete-button {
          width: 100%;
          padding: 14px 16px;
          margin-top: 12px;
          background: transparent;
          border: 1px solid #dc2626;
          border-radius: 12px;
          color: #dc2626;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .settings-delete-button:hover {
          background: rgba(220, 38, 38, 0.1);
        }
        
        .settings-delete-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .delete-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
        }

        .delete-modal {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 16px;
          padding: 24px;
          max-width: 380px;
          width: 100%;
        }

        .delete-modal-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .delete-modal-icon {
          font-size: 28px;
        }

        .delete-modal-title {
          font-size: 20px;
          font-weight: 700;
          color: #f3f4f6;
          margin: 0;
        }

        .delete-modal-text {
          color: #9ca3af;
          font-size: 14px;
          line-height: 1.5;
          margin-bottom: 12px;
        }

        .delete-modal-list {
          color: #9ca3af;
          font-size: 14px;
          padding-left: 20px;
          margin-bottom: 16px;
        }

        .delete-modal-list li {
          margin-bottom: 4px;
        }

        .delete-modal-warning {
          color: #dc2626;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 20px;
        }

        .delete-modal-error {
          background: rgba(220, 38, 38, 0.1);
          border: 1px solid #dc2626;
          border-radius: 8px;
          padding: 12px;
          color: #dc2626;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .delete-modal-buttons {
          display: flex;
          gap: 12px;
        }

        .delete-modal-cancel {
          flex: 1;
          padding: 12px 16px;
          background: #333;
          border: none;
          border-radius: 10px;
          color: #f3f4f6;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .delete-modal-cancel:hover {
          background: #444;
        }

        .delete-modal-confirm {
          flex: 1;
          padding: 12px 16px;
          background: #dc2626;
          border: none;
          border-radius: 10px;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .delete-modal-confirm:hover {
          background: #b91c1c;
        }

        .delete-modal-confirm:disabled,
        .delete-modal-cancel:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
