'use client';

import { useEffect, useRef } from 'react';
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
    const mainRef = useRef<HTMLElement>(null);

    // Enable swipe navigation between pages
    useSwipeNavigation();

    // Prefetch all main routes for instant navigation
    useRoutePrefetch();

    // Scroll to top on mount to ensure correct initial position
    useEffect(() => {
        if (mainRef.current) {
            mainRef.current.scrollTop = 0;
        }
        // Also reset window scroll as a fallback
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="mobile-app-container">
            <MobileHeader />
            <main ref={mainRef} className="mobile-main-content">
                {children}
            </main>
            <MobileBottomNav />
        </div>
    );
}
