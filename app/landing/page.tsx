'use client';

import { useEffect, useRef, useState } from 'react';
import './landing-styles.css';

export default function LandingPage() {
    const [isVisible, setIsVisible] = useState<Record<string, boolean>>({});
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setIsVisible((prev) => ({ ...prev, [entry.target.id]: true }));
                    }
                });
            },
            { threshold: 0.1 }
        );

        document.querySelectorAll('.animate-on-scroll').forEach((el) => {
            observerRef.current?.observe(el);
        });

        return () => observerRef.current?.disconnect();
    }, []);

    const lifeLesson = [
        {
            icon: '🎯',
            title: 'Make decisions with incomplete information',
            quote: "In poker, you never see all the cards. You don't know what's coming but you still have to decide.",
            insight: "You're always operating with 40% of the information and trying to make the best call."
        },
        {
            icon: '🧠',
            title: 'Control your emotions',
            quote: "Someone just beat you with a lucky card and you're angry. That's called 'tilt' in poker. And it will destroy you.",
            insight: "Poker players know that emotions cost money. Real money. So you learn to spot when you're compromised and step away."
        },
        {
            icon: '📖',
            title: 'Read people, not words',
            quote: "In poker, everyone's lying. It's part of the game. So you stop listening to words. You watch actions.",
            insight: "Poker teaches you to ignore words and watch behavior. You're just separating signal from noise."
        },
        {
            icon: '🏃',
            title: 'Know when to walk away',
            quote: "Good poker players fold 70% of their hands. They're comfortable saying 'I don't have an edge here' and walking away.",
            insight: "Poker teaches you sunk costs fallacy. The only question is what's the right move now?"
        },
        {
            icon: '🃏',
            title: 'Turn bad hands into winners',
            quote: "You'll get some good cards and bad cards. And you have to make the most of it.",
            insight: "The reason why Poker makes it all the more interesting is that even if you get dealt a bad hand you can still convert that to a winner."
        }
    ];

    const features = [
        {
            icon: '🤖',
            title: 'AI-Powered GTO Analysis',
            description: 'Get instant Game Theory Optimal strategy analysis for every hand you play.'
        },
        {
            icon: '📊',
            title: 'Exploitative Play Insights',
            description: 'Learn when to deviate from GTO and exploit your opponents\' tendencies.'
        },
        {
            icon: '📝',
            title: 'Session Hand Tracking',
            description: 'Record your sessions and review hands with detailed action breakdowns.'
        },
        {
            icon: '🎯',
            title: 'Personalized Coaching',
            description: 'AI coach that adapts to your playing style and helps you improve weak spots.'
        }
    ];

    return (
        <div className="landing-page">
            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-video-container">
                    <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="hero-video"
                    >
                        <source src="/static/spade-rotation.mp4" type="video/mp4" />
                    </video>
                    <div className="hero-video-overlay" />
                </div>

                <div className="hero-content">
                    <div className="brand-container">
                        {/* Animated title - letters fly in from different directions */}
                        <h1 className="brand-title-animated">
                            <span className="letter letter-1">O</span>
                            <span className="letter letter-2">N</span>
                            <span className="letter letter-3">L</span>
                            <span className="letter letter-4">Y</span>
                            <span className="letter-space"> </span>
                            <span className="letter letter-5">P</span>
                            <span className="letter letter-6">O</span>
                            <span className="letter letter-7">K</span>
                            <span className="letter letter-8">E</span>
                            <span className="letter letter-9">R</span>
                        </h1>

                        {/* Flying suits - animate up from below and fade out */}
                        <div className="suits-flying">
                            <span className="flying-suit flying-1">♠</span>
                            <span className="flying-suit flying-2 red">♥</span>
                            <span className="flying-suit flying-3 red">♦</span>
                            <span className="flying-suit flying-4">♣</span>
                        </div>

                        {/* Static suits - appear after flying ones disappear */}
                        <div className="suits-row-static">
                            <div className="line-left"></div>
                            <div className="suits-static">
                                <span className="static-suit">♠</span>
                                <span className="static-suit red">♥</span>
                                <span className="static-suit red">♦</span>
                                <span className="static-suit">♣</span>
                            </div>
                            <div className="line-right"></div>
                        </div>
                    </div>

                    <p className="hero-tagline">Master the Game. Master Yourself.</p>

                    <p className="hero-subtitle">
                        AI-powered poker analysis that helps you play smarter,
                        control your emotions, and make better decisions at the table.
                    </p>

                    <div className="hero-cta-group">
                        <a href="#download" className="btn-platinum-cta">
                            <span className="cta-icon">📱</span>
                            Download Now
                        </a>
                        <a href="/login" className="btn-secondary-cta">
                            <span className="cta-icon">🌐</span>
                            Try Web App
                        </a>
                    </div>

                    <div className="platform-badges">
                        <span className="badge">iOS</span>
                        <span className="badge">Android</span>
                        <span className="badge">Web</span>
                    </div>
                </div>

                <div className="scroll-indicator">
                    <span>Scroll to discover</span>
                    <div className="scroll-arrow">↓</div>
                </div>
            </section>

            {/* Philosophy Section */}
            <section className="philosophy-section" id="philosophy">
                <div className="container">
                    <div className="section-header animate-on-scroll" id="philosophy-header">
                        <h2 className={`section-title ${isVisible['philosophy-header'] ? 'visible' : ''}`}>
                            Poker Teaches Life
                        </h2>
                        <p className={`section-subtitle ${isVisible['philosophy-header'] ? 'visible' : ''}`}>
                            It's not gambling. It's a masterclass in decision-making.
                        </p>
                    </div>

                    <div className="life-lessons-grid">
                        {lifeLesson.map((lesson, index) => (
                            <div
                                key={index}
                                id={`lesson-${index}`}
                                className={`life-lesson-card animate-on-scroll ${isVisible[`lesson-${index}`] ? 'visible' : ''}`}
                                style={{ animationDelay: `${index * 0.15}s` }}
                            >
                                <div className="lesson-icon">{lesson.icon}</div>
                                <h3 className="lesson-title">{lesson.title}</h3>
                                <blockquote className="lesson-quote">"{lesson.quote}"</blockquote>
                                <p className="lesson-insight">{lesson.insight}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Feature Quote Bridge */}
            <section className="quote-bridge">
                <div className="container">
                    <blockquote className="bridge-quote">
                        <span className="quote-mark">"</span>
                        The best poker players never get attached to the hand they're dealt.
                        <br />
                        <strong>Only Poker helps you focus on the right move, right now.</strong>
                        <span className="quote-mark">"</span>
                    </blockquote>
                </div>
            </section>

            {/* Features Section */}
            <section className="features-section" id="features">
                <div className="container">
                    <div className="section-header animate-on-scroll" id="features-header">
                        <h2 className={`section-title ${isVisible['features-header'] ? 'visible' : ''}`}>
                            Your AI Poker Coach
                        </h2>
                        <p className={`section-subtitle ${isVisible['features-header'] ? 'visible' : ''}`}>
                            Powerful tools to elevate your game
                        </p>
                    </div>

                    <div className="features-grid">
                        {features.map((feature, index) => (
                            <div
                                key={index}
                                id={`feature-${index}`}
                                className={`feature-card animate-on-scroll ${isVisible[`feature-${index}`] ? 'visible' : ''}`}
                                style={{ animationDelay: `${index * 0.1}s` }}
                            >
                                <div className="feature-icon">{feature.icon}</div>
                                <h3 className="feature-title">{feature.title}</h3>
                                <p className="feature-description">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Download Section */}
            <section className="download-section" id="download">
                <div className="container">
                    <div className="download-content">
                        <h2 className="download-title">Ready to Level Up?</h2>
                        <p className="download-subtitle">
                            Join thousands of players improving their game with Only Poker
                        </p>

                        <div className="download-buttons">
                            <a href="#" className="download-btn ios">
                                <div className="btn-icon">🍎</div>
                                <div className="btn-text">
                                    <span className="btn-label">Download on the</span>
                                    <span className="btn-store">App Store</span>
                                </div>
                            </a>

                            <a href="#" className="download-btn android">
                                <div className="btn-icon">🤖</div>
                                <div className="btn-text">
                                    <span className="btn-label">Get it on</span>
                                    <span className="btn-store">Google Play</span>
                                </div>
                            </a>

                            <a href="https://onlypoker.ai" className="download-btn web">
                                <div className="btn-icon">🌐</div>
                                <div className="btn-text">
                                    <span className="btn-label">Open</span>
                                    <span className="btn-store">Web App</span>
                                </div>
                            </a>
                        </div>

                        <p className="coming-soon-note">
                            <span className="pulse-dot"></span>
                            iOS & Android apps coming soon
                        </p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="container">
                    <div className="footer-content">
                        <div className="footer-brand">
                            <svg className="footer-icon-svg" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <linearGradient id="footerSpadeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#c0c0c0" />
                                        <stop offset="50%" stopColor="#888888" />
                                        <stop offset="100%" stopColor="#a0a0a0" />
                                    </linearGradient>
                                </defs>
                                <path
                                    d="M50 5 C50 5 15 35 15 60 C15 80 30 90 45 85 C40 95 35 105 30 115 L70 115 C65 105 60 95 55 85 C70 90 85 80 85 60 C85 35 50 5 50 5 Z"
                                    fill="url(#footerSpadeGradient)"
                                />
                            </svg>
                            <span className="footer-brand-text">ONLY POKER</span>
                        </div>

                        <nav className="footer-links">
                            <a href="/privacy">Privacy Policy</a>
                            <a href="/delete-account">Delete Account</a>
                        </nav>

                        <p className="footer-copyright">
                            © 2026 Only Poker. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
