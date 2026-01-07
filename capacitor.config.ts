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
  }
};

export default config;
