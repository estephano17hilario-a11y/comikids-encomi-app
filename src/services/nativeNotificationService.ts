import { LocalNotifications } from '@capacitor/local-notifications';
import { WidgetService } from './widgetService';

const CHANNEL_ID = 'comikids_orders_high_priority';

export class NativeNotificationService {
  private static channelCreated = false;

  static async initChannel(): Promise<void> {
    if (this.channelCreated) return;
    try {
      await LocalNotifications.createChannel({
        id: CHANNEL_ID,
        name: 'Alertas de Nuevos Pedidos ComiKids',
        description: 'Notificaciones instantáneas de pedidos creados',
        importance: 5, // MAX importance for heads-up alert
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#06B6D4',
        sound: 'beep.wav'
      });
      this.channelCreated = true;
    } catch (e) {
      console.warn('Channel creation notice:', e);
    }
  }

  static async requestPermissions(): Promise<boolean> {
    try {
      await this.initChannel();

      // Solicitar permiso en Capacitor
      const status = await LocalNotifications.checkPermissions();
      let granted = status.display === 'granted';
      if (!granted) {
        const req = await LocalNotifications.requestPermissions();
        granted = req.display === 'granted';
      }

      // Solicitar permiso en Web Notification API si está disponible
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }

      return granted;
    } catch {
      return false;
    }
  }

  static async notifyNewOrder(orderCode: string, clientName: string, destination: string): Promise<void> {
    const title = `📦 ¡Nuevo Pedido #${orderCode}!`;
    const body = `${clientName} registró un nuevo envío para: ${destination}`;

    try {
      // 1. Notificación Nativa Directa vía Android NotificationManager
      const directSuccess = await WidgetService.showNativeAlert(title, body, orderCode);

      // 2. Notificación vía Capacitor LocalNotifications
      if (!directSuccess) {
        await this.initChannel();
        const granted = await this.requestPermissions();

        const notifId = Math.floor(Math.random() * 900000) + 100000;

        if (granted) {
          await LocalNotifications.schedule({
            notifications: [
              {
                title,
                body,
                id: notifId,
                schedule: { at: new Date(Date.now() + 100), allowWhileIdle: true },
                channelId: CHANNEL_ID,
                actionTypeId: 'OPEN_ORDER',
                extra: {
                  orderCode,
                  destination,
                  clientName
                }
              }
            ]
          });
        }
      }

      // 3. Fallback a Notification de navegador Web/PWA
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: '/Comikids.png',
            badge: '/Comikids.png',
            vibrate: [200, 100, 200]
          } as any);
        } catch {}
      }
    } catch (err) {
      console.warn('Error scheduling local notification:', err);
    }
  }
}

