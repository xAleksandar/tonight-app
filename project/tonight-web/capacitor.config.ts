import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourcompany.tonight',
  appName: 'tonight-web',
  webDir: 'out',
  server: {
    // For development on physical device, use your computer's local IP
    // For emulator, use 10.0.2.2
    // For production, remove this server section
    url: 'http://192.168.6.212:3000',
    cleartext: true
  }
};

export default config;
