import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.onlypoker.app',
  appName: 'OnlyPoker',
  webDir: 'out',
  server: {
    // Use your live Vercel deployment URL
    // This allows the mobile app to use all Next.js features
    url: 'https://notion-poker-web.vercel.app',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,              // Don't auto-hide based on duration
      launchAutoHide: false,              // We'll hide manually from JS when ready
      backgroundColor: '#1c1c1c',         // Match home page background
      showSpinner: false,                 // No spinner needed
      splashFullScreen: true,             // Full screen splash
      splashImmersive: true,              // Immersive mode on Android
      launchFadeOutDuration: 300          // Smooth fade out when we do hide
    }
  },
  ios: {
    backgroundColor: '#1c1c1c',           // Match home page background
    contentInset: 'automatic'
  },
  android: {
    backgroundColor: '#1c1c1c'            // Match home page background
  }
};

export default config;
