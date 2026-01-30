// app/privacy/page.tsx
// Privacy Policy page for App Store requirements

export default function PrivacyPolicyPage() {
    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#1c1c1c',
            color: '#E2E8F0',
            padding: '40px 20px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{
                maxWidth: '800px',
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
                        You can delete your account and all associated data by contacting us at support@onlypoker.ai.
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
                        <a href="mailto:support@onlypoker.ai" style={{ color: '#60a5fa' }}>support@onlypoker.ai</a>
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
            </div>
        </div>
    );
}
