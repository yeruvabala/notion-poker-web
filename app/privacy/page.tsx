// app/privacy/page.tsx
// Privacy Policy page for App Store requirements
'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
    const [swipeProgress, setSwipeProgress] = useState(0);
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const isSwipeGesture = useRef(false);

    // Swipe-from-left gesture to go back
    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        // Only track swipes starting from left edge (first 40px)
        if (touch.clientX < 40) {
            touchStartX.current = touch.clientX;
            touchStartY.current = touch.clientY;
            isSwipeGesture.current = true;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isSwipeGesture.current || touchStartX.current === null || touchStartY.current === null) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartX.current;
        const deltaY = Math.abs(touch.clientY - touchStartY.current);

        // If vertical movement is greater, it's a scroll, not a swipe
        if (deltaY > 50) {
            isSwipeGesture.current = false;
            setSwipeProgress(0);
            return;
        }

        // Calculate swipe progress (0-100), threshold is 120px
        if (deltaX > 0) {
            const progress = Math.min((deltaX / 120) * 100, 100);
            setSwipeProgress(progress);
        }
    };

    const handleTouchEnd = () => {
        if (swipeProgress >= 100) {
            // Use window.location for navigation to avoid Mobile Safari parallelRoutes error
            window.location.href = '/';
        }
        // Reset
        touchStartX.current = null;
        touchStartY.current = null;
        isSwipeGesture.current = false;
        setSwipeProgress(0);
    };

    // Override body scroll lock for this page
    useEffect(() => {
        // Save original styles
        const originalOverflow = document.body.style.overflow;
        const originalPosition = document.body.style.position;
        const originalHeight = document.body.style.height;
        const originalWidth = document.body.style.width;

        // Apply scroll-enabling styles
        document.body.style.overflow = 'auto';
        document.body.style.position = 'static';
        document.body.style.height = 'auto';
        document.body.style.width = 'auto';
        document.documentElement.style.overflow = 'auto';

        // Cleanup: restore original styles on unmount
        return () => {
            document.body.style.overflow = originalOverflow;
            document.body.style.position = originalPosition;
            document.body.style.height = originalHeight;
            document.body.style.width = originalWidth;
            document.documentElement.style.overflow = '';
        };
    }, []);

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#1c1c1c',
                color: '#E2E8F0',
                overflowY: 'scroll',
                WebkitOverflowScrolling: 'touch',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                zIndex: 9999,
                animation: 'none',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Swipe indicator - shows when swiping from left */}
            {swipeProgress > 0 && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: '60px',
                    background: `linear-gradient(90deg, rgba(34, 197, 94, ${swipeProgress / 100 * 0.4}) 0%, transparent 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                    pointerEvents: 'none',
                }}>
                    <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: `rgba(34, 197, 94, ${swipeProgress / 100})`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: `scale(${0.5 + swipeProgress / 200})`,
                        opacity: swipeProgress / 100,
                        boxShadow: swipeProgress >= 100 ? '0 0 20px rgba(34, 197, 94, 0.8)' : 'none',
                    }}>
                        <span style={{
                            color: '#fff',
                            fontSize: '20px',
                            fontWeight: 'bold',
                        }}>
                            ←
                        </span>
                    </div>
                </div>
            )}
            <div style={{
                maxWidth: '800px',
                margin: '0 auto',
                padding: '40px 20px',
                paddingBottom: '100px',
            }}>
                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    marginBottom: '8px',
                    background: 'linear-gradient(135deg, #e5e7eb 0%, #9ca3af 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    Privacy Policy
                </h1>

                <p style={{ color: '#9ca3af', marginBottom: '32px' }}>
                    Last updated: January 30, 2026
                </p>

                <section style={{ marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
                        Introduction
                    </h2>
                    <p style={{ lineHeight: '1.7', color: '#d1d5db' }}>
                        OnlyPoker ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy
                        explains how we collect, use, and safeguard your information when you use our mobile application
                        and website (collectively, the "Service").
                    </p>
                </section>

                <section style={{ marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
                        Information We Collect
                    </h2>
                    <p style={{ lineHeight: '1.7', color: '#d1d5db', marginBottom: '12px' }}>
                        <strong style={{ color: '#fff' }}>Account Information:</strong> When you sign in with Google,
                        we receive your email address and basic profile information to create and manage your account.
                    </p>
                    <p style={{ lineHeight: '1.7', color: '#d1d5db', marginBottom: '12px' }}>
                        <strong style={{ color: '#fff' }}>Poker Hand Data:</strong> We store poker hand histories
                        that you upload for analysis. This data is used solely to provide you with strategy feedback
                        and performance analytics.
                    </p>
                    <p style={{ lineHeight: '1.7', color: '#d1d5db' }}>
                        <strong style={{ color: '#fff' }}>Usage Data:</strong> We collect anonymous usage statistics
                        to improve our service, including which features you use and how often.
                    </p>
                </section>

                <section style={{ marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
                        How We Use Your Information
                    </h2>
                    <ul style={{ lineHeight: '1.7', color: '#d1d5db', paddingLeft: '20px' }}>
                        <li style={{ marginBottom: '8px' }}>To provide and improve our poker analysis services</li>
                        <li style={{ marginBottom: '8px' }}>To personalize your experience and recommendations</li>
                        <li style={{ marginBottom: '8px' }}>To communicate with you about your account and updates</li>
                        <li style={{ marginBottom: '8px' }}>To analyze usage patterns and improve our app</li>
                    </ul>
                </section>

                <section style={{ marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
                        Data Security
                    </h2>
                    <p style={{ lineHeight: '1.7', color: '#d1d5db' }}>
                        We implement industry-standard security measures to protect your data. All data transmission
                        is encrypted using HTTPS. Your poker hand data is stored securely and is only accessible
                        to you through your authenticated account.
                    </p>
                </section>

                <section style={{ marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
                        Data Sharing
                    </h2>
                    <p style={{ lineHeight: '1.7', color: '#d1d5db' }}>
                        We do not sell, trade, or rent your personal information to third parties. We may share
                        anonymized, aggregate data for analytical purposes. Your poker hand data is never shared
                        with other users or external parties.
                    </p>
                </section>

                <section style={{ marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
                        Your Rights
                    </h2>
                    <p style={{ lineHeight: '1.7', color: '#d1d5db' }}>
                        You have the right to access, update, or delete your personal data at any time.
                        You can delete your account and all associated data by contacting us at ybar243@gmail.com.
                    </p>
                </section>

                <section style={{ marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
                        Third-Party Services
                    </h2>
                    <p style={{ lineHeight: '1.7', color: '#d1d5db' }}>
                        We use the following third-party services:
                    </p>
                    <ul style={{ lineHeight: '1.7', color: '#d1d5db', paddingLeft: '20px', marginTop: '8px' }}>
                        <li style={{ marginBottom: '8px' }}>Google Sign-In for authentication</li>
                        <li style={{ marginBottom: '8px' }}>Supabase for secure data storage</li>
                        <li style={{ marginBottom: '8px' }}>OpenAI for AI-powered hand analysis</li>
                    </ul>
                </section>

                <section style={{ marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
                        Changes to This Policy
                    </h2>
                    <p style={{ lineHeight: '1.7', color: '#d1d5db' }}>
                        We may update this Privacy Policy from time to time. We will notify you of any changes
                        by posting the new Privacy Policy on this page and updating the "Last updated" date.
                    </p>
                </section>

                <section style={{ marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '12px', color: '#fff' }}>
                        Contact Us
                    </h2>
                    <p style={{ lineHeight: '1.7', color: '#d1d5db' }}>
                        If you have any questions about this Privacy Policy, please contact us at:
                        <br />
                        <a href="mailto:ybar243@gmail.com" style={{ color: '#60a5fa' }}>ybar243@gmail.com</a>
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
                </footer>

                {/* Back to App */}
                <div style={{ textAlign: 'center', marginTop: '40px' }}>
                    <Link
                        href="/"
                        style={{
                            display: 'inline-block',
                            padding: '12px 24px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: '#f3f4f6',
                            borderRadius: '10px',
                            textDecoration: 'none',
                            fontWeight: 600,
                            fontSize: '14px',
                        }}
                    >
                        ← Back to App
                    </Link>
                </div>
            </div>
        </div>
    );
}
