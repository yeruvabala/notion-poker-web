'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * Navigation order matching the bottom nav tabs
 */
const NAV_ORDER = ['/', '/history', '/ranges', '/study', '/analytics'];

interface SwipeConfig {
    edgeWidth: number;        // Width of edge zone (px from screen edge)
    minDistance: number;      // Minimum swipe distance (px)
    maxVerticalRatio: number; // Max vertical/horizontal ratio to count as horizontal swipe
    velocityThreshold: number; // Minimum velocity (px/ms) for quick swipes
}

const DEFAULT_CONFIG: SwipeConfig = {
    edgeWidth: 40,            // 40px from edge (slightly wider for easier detection)
    minDistance: 35,          // 35px minimum swipe (more sensitive)
    maxVerticalRatio: 0.5,
    velocityThreshold: 0.2,   // Lower threshold for quicker light swipes
};

/**
 * useSwipeNavigation - Safari-style edge swipe between pages
 * 
 * Features:
 * - Swipe from LEFT edge → go to previous page
 * - Swipe from RIGHT edge → go to next page
 * - Middle of screen is ignored (no interference with scrolling)
 * - Haptic feedback on successful navigation
 * - Edge bounce when at first/last page
 */
export function useSwipeNavigation(config: Partial<SwipeConfig> = {}) {
    const router = useRouter();
    const pathname = usePathname();
    const touchStartRef = useRef<{ x: number; y: number; time: number; edge: 'left' | 'right' | null } | null>(null);
    const { edgeWidth, minDistance, maxVerticalRatio, velocityThreshold } = { ...DEFAULT_CONFIG, ...config };

    // Haptic feedback for navigation
    const hapticNavigate = useCallback(() => {
        if (Capacitor.isNativePlatform()) {
            Haptics.impact({ style: ImpactStyle.Medium }).catch(() => { });
        }
    }, []);

    // Haptic for edge bounce (lighter)
    const hapticEdge = useCallback(() => {
        if (Capacitor.isNativePlatform()) {
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
        }
    }, []);

    // Get current page index
    const getCurrentIndex = useCallback(() => {
        const index = NAV_ORDER.findIndex(path =>
            path === pathname || (path !== '/' && pathname?.startsWith(path))
        );
        return index >= 0 ? index : 0;
    }, [pathname]);

    // Navigate to adjacent page
    const navigateToPage = useCallback((direction: 'next' | 'prev') => {
        const currentIndex = getCurrentIndex();

        if (direction === 'next') {
            if (currentIndex < NAV_ORDER.length - 1) {
                hapticNavigate();
                router.push(NAV_ORDER[currentIndex + 1]);
            } else {
                hapticEdge();
            }
        } else {
            if (currentIndex > 0) {
                hapticNavigate();
                router.push(NAV_ORDER[currentIndex - 1]);
            } else {
                hapticEdge();
            }
        }
    }, [getCurrentIndex, hapticNavigate, hapticEdge, router]);

    useEffect(() => {
        const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 375;

        const handleTouchStart = (e: TouchEvent) => {
            const touch = e.touches[0];
            const x = touch.clientX;

            // Determine if touch started from an edge
            let edge: 'left' | 'right' | null = null;
            if (x <= edgeWidth) {
                edge = 'left';
            } else if (x >= screenWidth - edgeWidth) {
                edge = 'right';
            }

            touchStartRef.current = {
                x,
                y: touch.clientY,
                time: Date.now(),
                edge,
            };
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (!touchStartRef.current || !touchStartRef.current.edge) {
                // Not an edge swipe - ignore
                touchStartRef.current = null;
                return;
            }

            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - touchStartRef.current.x;
            const deltaY = touch.clientY - touchStartRef.current.y;
            const deltaTime = Date.now() - touchStartRef.current.time;
            const startEdge = touchStartRef.current.edge;

            // Calculate swipe metrics
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);
            const velocity = absX / deltaTime;

            // Check if this is a valid horizontal swipe
            const isHorizontal = absY / absX < maxVerticalRatio;
            const hasSufficientDistance = absX >= minDistance;
            const hasSufficientVelocity = velocity >= velocityThreshold;

            // Valid swipe from edge
            if (isHorizontal && (hasSufficientDistance || hasSufficientVelocity)) {
                if (startEdge === 'left' && deltaX > 0) {
                    // Swipe from left edge toward right = go to PREVIOUS page
                    navigateToPage('prev');
                } else if (startEdge === 'right' && deltaX < 0) {
                    // Swipe from right edge toward left = go to NEXT page
                    navigateToPage('next');
                }
            }

            touchStartRef.current = null;
        };

        const handleTouchCancel = () => {
            touchStartRef.current = null;
        };

        // Add listeners
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });
        document.addEventListener('touchcancel', handleTouchCancel, { passive: true });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchend', handleTouchEnd);
            document.removeEventListener('touchcancel', handleTouchCancel);
        };
    }, [edgeWidth, minDistance, maxVerticalRatio, velocityThreshold, navigateToPage]);

    return {
        currentIndex: getCurrentIndex(),
        totalPages: NAV_ORDER.length,
    };
}

export default useSwipeNavigation;
