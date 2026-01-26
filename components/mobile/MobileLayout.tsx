'use client';

import MobileHeader from './MobileHeader';
import MobileBottomNav from './MobileBottomNav';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';

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
 * 
 * Features:
 * - Instagram-style horizontal swipe navigation
 * - Swipe left → next page, swipe right → previous page
 * - Haptic feedback on navigation
 */
export default function MobileLayout({ children }: MobileLayoutProps) {
    // Enable swipe navigation between pages
    useSwipeNavigation();

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
