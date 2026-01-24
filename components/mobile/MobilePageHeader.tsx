'use client';

/**
 * MobilePageHeader - Reusable page header with premium styling
 * 
 * Features:
 * - "ONLY POKER" style title with metallic gradient animation
 * - Card suit symbols with shimmer effect
 * - Glassmorphism background
 * 
 * Used on: Home, My Hands, Ranges, Study, Stats pages
 */

interface MobilePageHeaderProps {
    title: string;
}

export default function MobilePageHeader({ title }: MobilePageHeaderProps) {
    return (
        <header className="mobile-header">
            <div className="mobile-header-content">
                {/* Premium metallic gradient title with shimmer animation */}
                <h1 className="homepage-title mobile-homepage-title">{title}</h1>

                {/* Suit symbols with staggered shimmer effect */}
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
