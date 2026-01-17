'use client';

/**
 * MobileHeader - Fixed header for iOS/Android native app
 * 
 * Features:
 * - Fixed position at top
 * - Safe area padding for notched iPhones
 * - "ONLY POKER" title with platinum gradient
 * - Suit symbols
 * - Glassmorphism background
 */
export default function MobileHeader() {
    return (
        <header className="mobile-header">
            <div className="mobile-header-content">
                <h1 className="mobile-title">ONLY POKER</h1>
                <div className="mobile-suits">
                    <span className="suit spade">♠</span>
                    <span className="suit heart">♥</span>
                    <span className="suit diamond">♦</span>
                    <span className="suit club">♣</span>
                </div>
            </div>
        </header>
    );
}
