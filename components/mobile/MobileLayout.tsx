'use client';

import MobileHeader from './MobileHeader';
import MobileBottomNav from './MobileBottomNav';

interface MobileLayoutProps {
    children: React.ReactNode;
}

/**
 * MobileLayout - Main wrapper for mobile native app
 * 
 * Structure:
 * ┌─────────────────────────────┐
 * │     MobileHeader (fixed)    │
 * ├─────────────────────────────┤
 * │                             │
 * │    children (scrollable)    │
 * │                             │
 * ├─────────────────────────────┤
 * │   MobileBottomNav (fixed)   │
 * └─────────────────────────────┘
 */
export default function MobileLayout({ children }: MobileLayoutProps) {
    return (
        <div className="mobile-app-container">
            <MobileHeader />
            <main className="mobile-main-content">
                {children}
            </main>
            <MobileBottomNav />
        </div>
    );
}
