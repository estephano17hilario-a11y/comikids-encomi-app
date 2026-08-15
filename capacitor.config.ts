import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.incomi.app',
  appName: 'Encomi',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_launcher',
      iconColor: '#06B6D4',
    },
    Haptics: {
      enabled: true
    }
  }
};

export default config;
