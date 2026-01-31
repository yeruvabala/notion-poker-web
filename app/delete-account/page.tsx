// app/delete-account/page.tsx
// Account deletion request page for Play Store requirements
'use client';

import { useEffect } from 'react';

export default function DeleteAccountPage() {
    // Override body scroll lock for this page
    useEffect(() => {
        document.body.style.overflow = 'auto';
        document.body.style.position = 'static';
        document.body.style.height = 'auto';
        document.documentElement.style.overflow = 'auto';

        return () => {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.height = '';
            document.documentElement.style.overflow = '';
        };
    }, []);

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#1c1c1c',
            color: '#E2E8F0',
            padding: '40px 20px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{
                maxWidth: '600px',
                margin: '0 auto'
            }}>
                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    marginBottom: '8px',
                    background: 'linear-gradient(135deg, #e5e7eb 0%, #9ca3af 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    Delete Your Account
                </h1>

                <p style={{ color: '#9ca3af', marginBottom: '32px' }}>
                    OnlyPoker - Account Deletion Request
                </p>

                <section style={{ marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
                        How to Delete Your Account
                    </h2>
                    <p style={{ lineHeight: '1.7', color: '#d1d5db', marginBottom: '16px' }}>
                        To request deletion of your OnlyPoker account and all associated data, please send an email to:
                    </p>
                    <a
                        href="mailto:ybar243@gmail.com?subject=Delete%20My%20OnlyPoker%20Account"
                        style={{
                            display: 'inline-block',
                            padding: '12px 24px',
                            backgroundColor: '#dc2626',
                            color: '#fff',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            fontWeight: '600',
                            marginBottom: '16px'
                        }}
                    >
                        Request Account Deletion
                    </a>
                    <p style={{ lineHeight: '1.7', color: '#9ca3af', fontSize: '0.9rem' }}>
                        Or email directly: <a href="mailto:ybar243@gmail.com" style={{ color: '#60a5fa' }}>ybar243@gmail.com</a>
                    </p>
                </section>

                <section style={{ marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
                        What Gets Deleted
                    </h2>
                    <ul style={{ lineHeight: '1.7', color: '#d1d5db', paddingLeft: '20px' }}>
                        <li style={{ marginBottom: '8px' }}>Your account profile and email</li>
                        <li style={{ marginBottom: '8px' }}>All uploaded poker hand histories</li>
                        <li style={{ marginBottom: '8px' }}>Hand analysis and coach feedback</li>
                        <li style={{ marginBottom: '8px' }}>Session history and statistics</li>
                        <li style={{ marginBottom: '8px' }}>All personal data associated with your account</li>
                    </ul>
                </section>

                <section style={{ marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
                        Timeframe
                    </h2>
                    <p style={{ lineHeight: '1.7', color: '#d1d5db' }}>
                        Account deletion requests are processed within <strong style={{ color: '#fff' }}>7 business days</strong>.
                        You will receive a confirmation email once your data has been permanently deleted.
                    </p>
                </section>

                <section style={{ marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
                        Data Retention
                    </h2>
                    <p style={{ lineHeight: '1.7', color: '#d1d5db' }}>
                        Once deleted, your data cannot be recovered. We do not retain any personal data
                        after account deletion, except as required by law.
                    </p>
                </section>

                <footer style={{
                    marginTop: '48px',
                    paddingTop: '24px',
                    borderTop: '1px solid #374151',
                    textAlign: 'center',
                    color: '#6b7280'
                }}>
                    <p>© 2026 OnlyPoker. All rights reserved.</p>
                    <p style={{ marginTop: '8px' }}>
                        <a href="/privacy" style={{ color: '#60a5fa' }}>Privacy Policy</a>
                    </p>
                </footer>
            </div>
        </div>
    );
}
