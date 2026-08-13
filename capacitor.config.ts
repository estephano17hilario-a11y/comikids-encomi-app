import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.incomi.app',
  appName: 'Incomi Admin',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#EC4899',
      sound: 'beep.wav',
    },
    Haptics: {
      enabled: true
    }
  }
};

export default config;
