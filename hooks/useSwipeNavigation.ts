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
    minDistance: number;      // Minimum swipe distance (px)
    maxVerticalRatio: number; // Max vertical/horizontal ratio to count as horizontal swipe
    velocityThreshold: number; // Minimum velocity (px/ms) for quick swipes
}

const DEFAULT_CONFIG: SwipeConfig = {
    minDistance: 50,
    maxVerticalRatio: 0.5,  // Swipe must be more horizontal than vertical
    velocityThreshold: 0.3,
};

/**
 * useSwipeNavigation - Instagram-style swipe between pages
 * 
 * Features:
 * - Swipe left → next page, swipe right → previous page
 * - Haptic feedback on successful navigation
 * - Edge bounce when at first/last page
 * - Velocity detection for quick swipes
 * - Ignores vertical scrolls
 */
export function useSwipeNavigation(config: Partial<SwipeConfig> = {}) {
    const router = useRouter();
    const pathname = usePathname();
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const { minDistance, maxVerticalRatio, velocityThreshold } = { ...DEFAULT_CONFIG, ...config };

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
    const navigateToPage = useCallback((direction: 'left' | 'right') => {
        const currentIndex = getCurrentIndex();

        if (direction === 'left') {
            // Swipe left = go to next page
            if (currentIndex < NAV_ORDER.length - 1) {
                hapticNavigate();
                router.push(NAV_ORDER[currentIndex + 1]);
            } else {
                // At last page - edge bounce
                hapticEdge();
            }
        } else {
            // Swipe right = go to previous page
            if (currentIndex > 0) {
                hapticNavigate();
                router.push(NAV_ORDER[currentIndex - 1]);
            } else {
                // At first page - edge bounce
                hapticEdge();
            }
        }
    }, [getCurrentIndex, hapticNavigate, hapticEdge, router]);

    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            const touch = e.touches[0];
            touchStartRef.current = {
                x: touch.clientX,
                y: touch.clientY,
                time: Date.now(),
            };
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (!touchStartRef.current) return;

            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - touchStartRef.current.x;
            const deltaY = touch.clientY - touchStartRef.current.y;
            const deltaTime = Date.now() - touchStartRef.current.time;

            // Calculate swipe metrics
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);
            const velocity = absX / deltaTime;

            // Check if this is a valid horizontal swipe
            const isHorizontal = absY / absX < maxVerticalRatio;
            const hasSufficientDistance = absX >= minDistance;
            const hasSufficientVelocity = velocity >= velocityThreshold;

            // Valid swipe: horizontal + (sufficient distance OR fast velocity)
            if (isHorizontal && (hasSufficientDistance || hasSufficientVelocity)) {
                if (deltaX < 0) {
                    // Swipe left (finger moved left = go right/next page)
                    navigateToPage('left');
                } else {
                    // Swipe right (finger moved right = go left/previous page)
                    navigateToPage('right');
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
    }, [minDistance, maxVerticalRatio, velocityThreshold, navigateToPage]);

    return {
        currentIndex: getCurrentIndex(),
        totalPages: NAV_ORDER.length,
    };
}

export default useSwipeNavigation;
