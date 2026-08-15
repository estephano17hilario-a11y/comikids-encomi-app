import { LocalNotifications } from '@capacitor/local-notifications';

export class NativeNotificationService {
  static async requestPermissions(): Promise<boolean> {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        return req.display === 'granted';
      }
      return true;
    } catch {
      return false;
    }
  }

  static async notifyNewOrder(orderCode: string, clientName: string, destination: string): Promise<void> {
    try {
      const granted = await this.requestPermissions();
      if (!granted) return;

      const notifId = Math.floor(Math.random() * 100000);
      await LocalNotifications.schedule({
        notifications: [
          {
            title: `📦 ¡Nuevo Pedido #${orderCode}!`,
            body: `${clientName} registró un nuevo envío para: ${destination}`,
            id: notifId,
            schedule: { at: new Date(Date.now() + 500) },
            sound: 'beep.wav',
            smallIcon: 'ic_stat_icon_config_sample',
            extra: {
              orderCode,
            }
          }
        ]
      });
    } catch (err) {
      console.warn('Error scheduling local notification:', err);
    }
  }
}
