'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Routes to prefetch for instant navigation
 */
const ROUTES_TO_PREFETCH = [
    '/',
    '/history',
    '/ranges',
    '/study',
    '/analytics',
];

/**
 * useRoutePrefetch - Preload all main routes in background
 * 
 * Call this hook on your main layout or home page.
 * It will silently prefetch all main routes so navigation is instant.
 * 
 * Features:
 * - Only runs once on mount (not on every render)
 * - Staggered prefetch to avoid network congestion
 * - Silent failures (doesn't interrupt user)
 */
export function useRoutePrefetch(options?: { delay?: number; staggerMs?: number }) {
    const router = useRouter();
    const hasPrefetched = useRef(false);
    const { delay = 500, staggerMs = 100 } = options || {};

    useEffect(() => {
        // Only prefetch once
        if (hasPrefetched.current) return;
        hasPrefetched.current = true;

        // Start prefetching after a short delay (let main content load first)
        const timeoutId = setTimeout(() => {
            ROUTES_TO_PREFETCH.forEach((route, index) => {
                // Stagger prefetch requests to avoid congestion
                setTimeout(() => {
                    try {
                        router.prefetch(route);
                        if (process.env.NODE_ENV === 'development') {
                            console.log(`[Prefetch] ${route}`);
                        }
                    } catch {
                        // Silent fail - prefetch is optional optimization
                    }
                }, index * staggerMs);
            });
        }, delay);

        return () => clearTimeout(timeoutId);
    }, [router, delay, staggerMs]);
}

export default useRoutePrefetch;
