'use client';

/**
 * MobileHeader - Fixed header for iOS/Android native app
 * 
 * Features:
 * - Fixed position at top with extra padding for notch (like Instagram)
 * - "ONLY POKER" title with animated shimmer gradient (same as web)
 * - Suit symbols with staggered shimmer animation (same as web)
 * - Glassmorphism background
 */
export default function MobileHeader() {
    return (
        <header className="mobile-header">
            <div className="mobile-header-content">
                {/* Using same class as web for animations */}
                <h1 className="homepage-title mobile-homepage-title">ONLY POKER</h1>

                {/* Using suit-decoration class from web for shimmer effect */}
                <div className="suit-decoration mobile-suit-decoration">
                    <span>♠</span>
                    <span>♥</span>
                    <span>♦</span>
                    <span>♣</span>
                </div>
            </div>
        </header>
    );
}
