import { registerPlugin } from '@capacitor/core';

interface WidgetBridgePlugin {
  updateWidgetCounts(options: { almacen: number; alistando: number; ruta: number }): Promise<void>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

export class WidgetService {
  static async updateCounts(almacen: number, alistando: number, ruta: number): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
        await WidgetBridge.updateWidgetCounts({ almacen, alistando, ruta });
      }
    } catch (e) {
      console.warn('Widget update notice (non-fatal):', e);
    }
  }
}
