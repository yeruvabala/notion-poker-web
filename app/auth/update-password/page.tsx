'use client';

import React, { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';

export default function UpdatePasswordPage() {
  const supabase = createBrowserClient();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setErr('Passwords do not match');
      return;
    }

    // Validate minimum length
    if (password.length < 6) {
      setErr('Password must be at least 6 characters');
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMsg('Password updated successfully! Redirecting to login…');
      setTimeout(() => router.replace('/login'), 2000);
    } catch (e: any) {
      setErr(e?.message || 'Could not update password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="pw-page">
      <div className="pw-card">
        <h1 className="pw-title">Set New Password</h1>
        <p className="pw-subtitle">Choose a strong password for your account</p>

        <form onSubmit={submit}>
          <label className="pw-label">New Password</label>
          <input
            className="pw-input"
            type="password"
            required
            minLength={6}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <label className="pw-label">Confirm Password</label>
          <input
            className="pw-input"
            type="password"
            required
            minLength={6}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <button className="pw-submit" disabled={busy}>
            {busy ? 'Updating…' : 'Update Password'}
          </button>
        </form>

        {err && <div className="pw-error">{err}</div>}
        {msg && <div className="pw-success">✓ {msg}</div>}
      </div>

      <style jsx>{`
        .pw-page {
          min-height: 100dvh;
          display: grid;
          place-items: center;
          padding: 28px;
          background: #1c1c1c;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        }

        .pw-card {
          width: 100%;
          max-width: 420px;
          padding: 40px 36px;
          background: #1e1e1e;
          border-radius: 16px;
          border: 1.5px solid rgba(180, 180, 180, 0.3);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .pw-title {
          margin: 0 0 8px;
          font-size: 28px;
          font-weight: 800;
          text-align: center;
          text-transform: uppercase;
          background: linear-gradient(90deg, #888888 0%, #c0c0c0 25%, #ffffff 50%, #c0c0c0 75%, #888888 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
        }

        .pw-subtitle {
          margin: 0 0 28px;
          font-size: 14px;
          text-align: center;
          color: #9ca3af;
        }

        .pw-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 6px;
          background: linear-gradient(to right, #6b7280 0%, #ffffff 50%, #6b7280 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
        }

        .pw-input {
          width: 100%;
          padding: 14px 16px;
          margin-bottom: 16px;
          font-size: 15px;
          background: #1a1a1a;
          color: #E2E8F0;
          border: 1px solid rgba(100, 100, 100, 0.3);
          border-radius: 10px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .pw-input:focus {
          border-color: rgba(180, 180, 180, 0.5);
          box-shadow: 0 0 0 1.5px rgba(180, 180, 180, 0.25), 0 0 15px rgba(160, 160, 160, 0.1);
        }

        .pw-submit {
          width: 100%;
          padding: 16px;
          margin-top: 8px;
          border: none;
          border-radius: 14px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          background: linear-gradient(180deg, #f5f5f5 0%, #e8e8e8 20%, #d4d4d4 50%, #c0c0c0 80%, #a8a8a8 100%);
          color: #1a1a1a;
          box-shadow: 0 4px 20px rgba(200, 200, 200, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.6);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .pw-submit:hover:not([disabled]) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(200, 200, 200, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        .pw-submit[disabled] {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .pw-error {
          margin-top: 16px;
          padding: 12px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 10px;
          color: #ef4444;
          font-size: 14px;
          text-align: center;
        }

        .pw-success {
          margin-top: 16px;
          padding: 14px;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 10px;
          color: #22c55e;
          font-size: 14px;
          text-align: center;
        }
      `}</style>
    </main>
  );
}
