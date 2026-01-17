'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * NativeAppDetector
 * 
 * Detects if the app is running inside Capacitor (iOS/Android native app)
 * and adds a 'native-app' class to the body element.
 * 
 * This allows us to apply app-specific styles without affecting the web version.
 */
export default function NativeAppDetector() {
    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            // Running in native iOS/Android app
            document.body.classList.add('native-app');

            // Also add platform-specific class
            const platform = Capacitor.getPlatform();
            document.body.classList.add(`native-${platform}`); // native-ios or native-android

            // Log for debugging
            console.log(`[NativeAppDetector] Running on ${platform} native app`);
        } else {
            // Running in web browser
            document.body.classList.add('web-app');
        }
    }, []);

    return null;
}
