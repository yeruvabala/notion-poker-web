'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Hook to detect if user should see mobile UI
 * Returns true for:
 * - Native iOS/Android apps (Capacitor)
 * - Mobile web browsers (screen width < 768px)
 * 
 * Returns false for desktop web browsers
 */
export function useMobileDetection() {
    const [isMobile, setIsMobile] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);

        // Check if native platform (iOS/Android app)
        const isNative = Capacitor.isNativePlatform();

        // Check if mobile browser (width < 768px)
        const isMobileBrowser = typeof window !== 'undefined' && window.innerWidth < 768;

        setIsMobile(isNative || isMobileBrowser);

        // Optional: Listen for resize events to handle orientation changes
        const handleResize = () => {
            const isNativeNow = Capacitor.isNativePlatform();
            const isMobileBrowserNow = typeof window !== 'undefined' && window.innerWidth < 768;
            setIsMobile(isNativeNow || isMobileBrowserNow);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return { isMobile, mounted };
}
