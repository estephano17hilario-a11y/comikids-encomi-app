import { registerPlugin } from '@capacitor/core';

export interface YapeReaderPlugin {
  requestNotificationAccess(): Promise<void>;
  isNotificationAccessGranted(): Promise<{ granted: boolean }>;
}

export const YapeReader = registerPlugin<YapeReaderPlugin>('YapeReader');

export const yapeReaderService = {
  async requestPermission(): Promise<void> {
    try {
      await YapeReader.requestNotificationAccess();
    } catch (e) {
      console.warn('YapeReader plugin no disponible en web:', e);
    }
  },

  async isGranted(): Promise<boolean> {
    try {
      const res = await YapeReader.isNotificationAccessGranted();
      return Boolean(res?.granted);
    } catch {
      return false;
    }
  }
};
