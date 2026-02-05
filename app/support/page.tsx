'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * Support Page - Required for Apple App Store compliance (Guideline 1.5)
 * 
 * This page provides users with information on how to get help and contact support.
 */
export default function SupportPage() {
    const router = useRouter();
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
            // Complete the navigation
            router.push('/');
        }
        // Reset
        touchStartX.current = null;
        touchStartY.current = null;
        isSwipeGesture.current = false;
        setSwipeProgress(0);
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(180deg, #0a0a0a 0%, #111111 100%)',
                color: '#f3f4f6',
                overflowY: 'scroll',
                WebkitOverflowScrolling: 'touch',
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
                maxWidth: '600px',
                margin: '0 auto',
                padding: '40px 20px',
                paddingBottom: '100px',
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h1 style={{
                        fontSize: '32px',
                        fontWeight: 700,
                        marginBottom: '8px',
                        background: 'linear-gradient(135deg, #f3f4f6 0%, #9ca3af 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        Support
                    </h1>
                    <p style={{ color: '#9ca3af', fontSize: '16px' }}>
                        We&apos;re here to help
                    </p>
                </div>

                {/* Contact Section */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    padding: '24px',
                    marginBottom: '24px',
                }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
                        📧 Contact Us
                    </h2>
                    <p style={{ color: '#9ca3af', fontSize: '14px', lineHeight: 1.6, marginBottom: '16px' }}>
                        Have a question, feedback, or need assistance? Reach out to us and we&apos;ll get back to you as soon as possible.
                    </p>
                    <a
                        href="mailto:support@onlypoker.ai"
                        style={{
                            display: 'inline-block',
                            padding: '12px 24px',
                            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                            color: '#fff',
                            borderRadius: '10px',
                            textDecoration: 'none',
                            fontWeight: 600,
                            fontSize: '14px',
                        }}
                    >
                        support@onlypoker.ai
                    </a>
                </div>

                {/* FAQ Section */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    padding: '24px',
                    marginBottom: '24px',
                }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
                        ❓ Frequently Asked Questions
                    </h2>

                    <div style={{ marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: '#f3f4f6' }}>
                            How do I analyze a hand?
                        </h3>
                        <p style={{ color: '#9ca3af', fontSize: '14px', lineHeight: 1.5 }}>
                            Enter your position, villain&apos;s position, your hole cards, and your preflop action. Then tap &quot;Analyze&quot; to get GTO recommendations.
                        </p>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: '#f3f4f6' }}>
                            How do I delete my account?
                        </h3>
                        <p style={{ color: '#9ca3af', fontSize: '14px', lineHeight: 1.5 }}>
                            Go to Settings, scroll down to the Account section, and tap &quot;Delete Account&quot;. This will permanently remove all your data.
                        </p>
                    </div>

                    <div>
                        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: '#f3f4f6' }}>
                            What data do you collect?
                        </h3>
                        <p style={{ color: '#9ca3af', fontSize: '14px', lineHeight: 1.5 }}>
                            We only collect the poker hands you analyze and your account information. See our{' '}
                            <Link href="/privacy" style={{ color: '#22c55e', textDecoration: 'underline' }}>
                                Privacy Policy
                            </Link>{' '}
                            for more details.
                        </p>
                    </div>
                </div>

                {/* App Info */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    padding: '24px',
                    marginBottom: '24px',
                }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
                        📱 App Information
                    </h2>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#9ca3af', fontSize: '14px' }}>App Version</span>
                        <span style={{ color: '#f3f4f6', fontSize: '14px' }}>1.0.0</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#9ca3af', fontSize: '14px' }}>Developer</span>
                        <span style={{ color: '#f3f4f6', fontSize: '14px' }}>Only Poker</span>
                    </div>
                </div>

                {/* Footer Links */}
                <div style={{ textAlign: 'center', paddingTop: '20px' }}>
                    <Link
                        href="/privacy"
                        style={{ color: '#9ca3af', fontSize: '14px', textDecoration: 'none' }}
                    >
                        Privacy Policy
                    </Link>
                </div>

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

