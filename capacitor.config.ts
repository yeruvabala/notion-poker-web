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
      launchShowDuration: 2500,           // Show for 2.5 seconds
      launchAutoHide: true,               // Auto hide after duration
      backgroundColor: '#0a0a0f',         // Match our dark theme
      showSpinner: false,                 // No spinner needed
      splashFullScreen: true,             // Full screen splash
      splashImmersive: true,              // Immersive mode on Android
      launchFadeOutDuration: 300          // Smooth fade out
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
