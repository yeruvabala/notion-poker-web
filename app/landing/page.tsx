'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import './landing-styles.css';

// Floating suit/letter type
interface FloatingElement {
    char: string;
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
    fontSize: string;
    color: string;
    animationDuration: string;
    animationDelay: string;
    isSlow: boolean;
    fontWeight?: number;
}

export default function LandingPage() {
    const [isVisible, setIsVisible] = useState<Record<string, boolean>>({});
    const [navVisible, setNavVisible] = useState(false);
    const [floatingElements, setFloatingElements] = useState<FloatingElement[]>([]);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Generate random floating elements on mount (client-side only)
    useEffect(() => {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['A', 'K', 'Q', 'J'];
        const elements: FloatingElement[] = [];

        // Generate 8 random suit positions
        for (let i = 0; i < 8; i++) {
            const suit = suits[i % 4];
            const isRed = suit === '♥' || suit === '♦';
            const isTop = i < 4;

            elements.push({
                char: suit,
                ...(isTop
                    ? { top: `${5 + Math.random() * 25}%` }
                    : { bottom: `${5 + Math.random() * 25}%` }),
                ...(Math.random() > 0.5
                    ? { left: `${3 + Math.random() * 40}%` }
                    : { right: `${3 + Math.random() * 40}%` }),
                fontSize: `${1.8 + Math.random() * 1.2}rem`,
                color: isRed ? 'rgba(239,68,68,0.2)' : 'rgba(180,180,180,0.2)',
                animationDuration: `${8 + Math.random() * 6}s`,
                animationDelay: `${Math.random() * 5}s`,
                isSlow: i >= 4,
            });
        }

        // Generate 4 random rank positions (A, K, Q, J)
        for (let i = 0; i < 4; i++) {
            const isTop = i < 2;
            elements.push({
                char: ranks[i],
                ...(isTop
                    ? { top: `${15 + Math.random() * 15}%` }
                    : { bottom: `${15 + Math.random() * 15}%` }),
                ...(i % 2 === 0
                    ? { left: `${2 + Math.random() * 8}%` }
                    : { right: `${2 + Math.random() * 8}%` }),
                fontSize: `${2.8 + Math.random() * 1}rem`,
                color: 'rgba(200,200,200,0.07)',
                animationDuration: `${14 + Math.random() * 6}s`,
                animationDelay: `${Math.random() * 8}s`,
                isSlow: true,
                fontWeight: 700,
            });
        }

        setFloatingElements(elements);
    }, []);

    // Scroll detection for smart sticky nav
    useEffect(() => {
        const handleScroll = () => {
            // Show nav when scrolled past hero section (approx 80% of viewport height)
            const scrollThreshold = window.innerHeight * 0.8;
            setNavVisible(window.scrollY > scrollThreshold);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

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

    // Premium SVG Icons - monochrome, sophisticated
    const TargetIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
        </svg>
    );

    const BrainIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4C8 4 5 6 5 9c0 1.5 0.5 2.5 1.5 3.5C5.5 13.5 5 15 5 16.5c0 2 1.5 3.5 4 3.5h6c2.5 0 4-1.5 4-3.5 0-1.5-0.5-3-1.5-4 1-1 1.5-2 1.5-3.5 0-3-3-5-7-5z" />
            <path d="M12 4v16" strokeDasharray="2 2" opacity="0.5" />
        </svg>
    );

    const EyeIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );

    const ExitIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    );

    const SpadeIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C7 8 4 11 4 14c0 3 2.5 4.5 4.5 4.5 1.5 0 2.5-.5 3.5-1.5v3h-2v2h4v-2h-2v-3c1 1 2 1.5 3.5 1.5 2 0 4.5-1.5 4.5-4.5 0-3-3-6-8-12z" />
        </svg>
    );

    const ChipStackIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="6" rx="8" ry="3" />
            <path d="M4 6v4c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
            <path d="M4 10v4c0 1.66 3.58 3 8 3s8-1.34 8-3v-4" />
            <path d="M4 14v4c0 1.66 3.58 3 8 3s8-1.34 8-3v-4" />
        </svg>
    );

    const ChartIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
            <line x1="2" y1="20" x2="22" y2="20" />
        </svg>
    );

    const ClipboardIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            <line x1="8" y1="10" x2="16" y2="10" />
            <line x1="8" y1="14" x2="16" y2="14" />
        </svg>
    );

    const UserIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    );

    const lifeLesson = [
        {
            icon: <TargetIcon />,
            title: 'Make decisions with incomplete information',
            quote: "In poker, you never see all the cards. You don't know what's coming but you still have to decide.",
            insight: "You're always operating with 40% of the information and trying to make the best call."
        },
        {
            icon: <BrainIcon />,
            title: 'Control your emotions',
            quote: "Someone just beat you with a lucky card and you're angry. That's called 'tilt' in poker. And it will destroy you.",
            insight: "Poker players know that emotions cost money. Real money. So you learn to spot when you're compromised and step away."
        },
        {
            icon: <EyeIcon />,
            title: 'Read people, not words',
            quote: "In poker, everyone's lying. It's part of the game. So you stop listening to words. You watch actions.",
            insight: "Poker teaches you to ignore words and watch behavior. You're just separating signal from noise."
        },
        {
            icon: <ExitIcon />,
            title: 'Know when to walk away',
            quote: "Good poker players fold 70% of their hands. They're comfortable saying 'I don't have an edge here' and walking away.",
            insight: "Poker teaches you sunk costs fallacy. The only question is what's the right move now?"
        },
        {
            icon: <SpadeIcon />,
            title: 'Turn bad hands into winners',
            quote: "You'll get some good cards and bad cards. And you have to make the most of it.",
            insight: "The reason why Poker makes it all the more interesting is that even if you get dealt a bad hand you can still convert that to a winner."
        }
    ];

    const features = [
        {
            icon: <ChipStackIcon />,
            title: 'AI-Powered GTO Analysis',
            description: 'Get instant Game Theory Optimal strategy analysis for every hand you play.'
        },
        {
            icon: <ChartIcon />,
            title: 'Exploitative Play Insights',
            description: 'Learn when to deviate from GTO and exploit your opponents\' tendencies.'
        },
        {
            icon: <ClipboardIcon />,
            title: 'Session Hand Tracking',
            description: 'Record your sessions and review hands with detailed action breakdowns.'
        },
        {
            icon: <UserIcon />,
            title: 'Personalized Coaching',
            description: 'AI coach that adapts to your playing style and helps you improve weak spots.'
        }
    ];

    return (
        <div className="landing-page">
            {/* Smart Sticky Navigation - shows only when scrolled past hero */}
            <header className={`landing-nav ${navVisible ? 'nav-visible' : 'nav-hidden'}`}>
                <div className="nav-container">
                    <a href="#" className="nav-brand">
                        <span className="nav-brand-text">ONLY POKER</span>
                        <span className="nav-suits">♠♥♦♣</span>
                    </a>
                    <nav className="nav-links">
                        <a href="/login" className="nav-cta">Login</a>
                    </nav>
                </div>
            </header>

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

                {/* Floating Card Suits Animation - random positions each load */}
                <div className="landing-floating-bg">
                    {floatingElements.map((el, index) => (
                        <span
                            key={index}
                            className={`landing-float-suit-dynamic ${el.isSlow ? 'slow' : ''}`}
                            style={{
                                top: el.top,
                                bottom: el.bottom,
                                left: el.left,
                                right: el.right,
                                fontSize: el.fontSize,
                                color: el.color,
                                animationDuration: el.animationDuration,
                                animationDelay: el.animationDelay,
                                fontWeight: el.fontWeight,
                            }}
                        >
                            {el.char}
                        </span>
                    ))}
                </div>

                <div className="hero-content">
                    <div className="brand-container">
                        {/* Static title with shimmer effect */}
                        <h1 className="brand-title">ONLY POKER</h1>

                        {/* Static suits with decorative lines */}
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
                        <a href="#download" className="btn-premium-dark">
                            <svg className="cta-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download App
                        </a>
                        <a href="/login" className="btn-premium-outline">
                            <svg className="cta-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M2 12h20" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
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

            {/* Founder's Philosophy - Be Like Water */}
            <section className="founder-quote-section">
                <div className="container">
                    <blockquote className="founder-quote">
                        <p className="quote-text">
                            <em>Be like water.</em> Learn GTO to understand the perfect game.
                            <br />
                            Then adapt to the real table, <strong>become what it demands.</strong>
                        </p>
                    </blockquote>
                    <p className="quote-attribution">— Founder's Philosophy, inspired by Bruce Lee's quote</p>
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
                        The best poker players never get attached to the hand they're dealt.
                        <br />
                        <strong>Only Poker helps you focus on the right move, right now.</strong>
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
                                <div className="btn-icon">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                                    </svg>
                                </div>
                                <div className="btn-text">
                                    <span className="btn-label">Download on the</span>
                                    <span className="btn-store">App Store</span>
                                </div>
                            </a>

                            <a href="#" className="download-btn android">
                                <div className="btn-icon">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M3 20.5v-17c0-.83.52-1.28 1.09-1.28.22 0 .45.06.68.2L20 12l-15.23 9.58c-.23.14-.46.2-.68.2-.57 0-1.09-.45-1.09-1.28z" />
                                    </svg>
                                </div>
                                <div className="btn-text">
                                    <span className="btn-label">Get it on</span>
                                    <span className="btn-store">Google Play</span>
                                </div>
                            </a>

                            <a href="/login" className="download-btn web">
                                <div className="btn-icon">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M2 12h20" />
                                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                    </svg>
                                </div>
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
                            <span className="footer-brand-text">ONLY POKER</span>
                            <span className="footer-suits">♠ ♥ ♦ ♣</span>
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
