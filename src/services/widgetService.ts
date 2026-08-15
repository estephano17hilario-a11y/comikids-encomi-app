import { registerPlugin } from '@capacitor/core';

export interface WidgetOrderItem {
  codigo: string;
  nombre: string;
  telefono: string;
  destino: string;
  estado: string;
}

interface WidgetBridgePlugin {
  updateWidgetCounts(options: {
    almacen: number;
    alistando: number;
    ruta: number;
    ordersJson: string;
  }): Promise<void>;
  showNativeNotification(options: {
    title: string;
    body: string;
    orderCode?: string;
  }): Promise<void>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

export class WidgetService {
  static async updateCounts(
    almacen: number,
    alistando: number,
    ruta: number,
    orders: WidgetOrderItem[] = []
  ): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
        const ordersJson = JSON.stringify(orders.slice(0, 5));
        await WidgetBridge.updateWidgetCounts({ almacen, alistando, ruta, ordersJson });
      }
    } catch (e) {
      console.warn('Widget update notice (non-fatal):', e);
    }
  }

  static async showNativeAlert(title: string, body: string, orderCode?: string): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
        await WidgetBridge.showNativeNotification({ title, body, orderCode });
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Direct native notification notice:', e);
      return false;
    }
  }
}

