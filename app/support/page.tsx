'use client';

import Link from 'next/link';

/**
 * Support Page - Required for Apple App Store compliance (Guideline 1.5)
 * 
 * This page provides users with information on how to get help and contact support.
 */
export default function SupportPage() {
    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(180deg, #0a0a0a 0%, #111111 100%)',
            color: '#f3f4f6',
            padding: '40px 20px',
        }}>
            <div style={{
                maxWidth: '600px',
                margin: '0 auto',
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
                        style={{ color: '#9ca3af', fontSize: '14px', marginRight: '24px', textDecoration: 'none' }}
                    >
                        Privacy Policy
                    </Link>
                    <Link
                        href="/terms"
                        style={{ color: '#9ca3af', fontSize: '14px', textDecoration: 'none' }}
                    >
                        Terms of Service
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
