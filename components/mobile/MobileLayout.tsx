'use client';

import MobileHeader from './MobileHeader';
import MobileBottomNav from './MobileBottomNav';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { useRoutePrefetch } from '@/hooks/useRoutePrefetch';

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
 * - Safari-style edge swipe navigation
 * - Background route prefetching for instant navigation
 * - Haptic feedback on navigation
 */
export default function MobileLayout({ children }: MobileLayoutProps) {
    // Enable swipe navigation between pages
    useSwipeNavigation();

    // Prefetch all main routes for instant navigation
    useRoutePrefetch();

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
