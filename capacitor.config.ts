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
      backgroundColor: '#0a0a0f',         // Match our dark theme
      showSpinner: false,                 // No spinner needed
      splashFullScreen: true,             // Full screen splash
      splashImmersive: true,              // Immersive mode on Android
      launchFadeOutDuration: 300          // Smooth fade out when we do hide
    }
  },
  ios: {
    backgroundColor: '#0a0a0f',           // Dark background for WebView
    contentInset: 'automatic'
  },
  android: {
    backgroundColor: '#0a0a0f'            // Dark background for WebView
  }
};

export default config;
