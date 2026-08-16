import { registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { ordersService } from './ordersService';
import { Usuario } from '../types/database.types';

export interface YapeTransaction {
  id: string;
  sender: string;
  amount: number;
  timestamp: number;
  rawText?: string;
  isLive?: boolean;
  sessionId?: number | null;
}

export interface YapeReaderPlugin {
  requestNotificationAccess(): Promise<void>;
  isNotificationAccessGranted(): Promise<{ granted: boolean }>;
  setLiveMode(options: { isLive: boolean }): Promise<{ isLive: boolean }>;
  getCapturedYapes(): Promise<{ yapes: YapeTransaction[] }>;
  clearCapturedYapes(): Promise<void>;
  addListener(
    eventName: 'onYapeReceived',
    listenerFunc: (data: YapeTransaction) => void
  ): Promise<PluginListenerHandle>;
}

export const YapeReader = registerPlugin<YapeReaderPlugin>('YapeReader');

const YAPES_STORAGE_KEY = 'incomi_yape_transactions_v1';

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
  },

  async setLiveMode(isLive: boolean): Promise<void> {
    try {
      await YapeReader.setLiveMode({ isLive });
    } catch (e) {
      console.warn('No se pudo establecer modo live nativo:', e);
    }
  },

  getLocalYapes(): YapeTransaction[] {
    try {
      const raw = localStorage.getItem(YAPES_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Error al leer yapes locales:', e);
    }
    return [];
  },

  saveLocalYapes(yapes: YapeTransaction[]): void {
    try {
      localStorage.setItem(YAPES_STORAGE_KEY, JSON.stringify(yapes));
      window.dispatchEvent(new CustomEvent('yapes_updated', { detail: yapes }));
    } catch (e) {
      console.error('Error al guardar yapes locales:', e);
    }
  },

  addTransaction(yape: YapeTransaction): void {
    const current = this.getLocalYapes();
    // Evitar duplicados por ID o sender+amount+timestamp cercano
    const exists = current.some(
      (y) => y.id === yape.id || (y.sender === yape.sender && y.amount === yape.amount && Math.abs(y.timestamp - yape.timestamp) < 5000)
    );
    if (!exists) {
      const updated = [yape, ...current];
      this.saveLocalYapes(updated);
      this.registerClientFromYape(yape.sender);
    }
  },

  // Sincroniza yapes capturados en segundo plano desde Java/Android al sistema web
  async syncNativeYapes(): Promise<YapeTransaction[]> {
    try {
      const res = await YapeReader.getCapturedYapes();
      if (res && res.yapes && res.yapes.length > 0) {
        const local = this.getLocalYapes();
        const combined = [...local];
        let hasNew = false;

        for (const ny of res.yapes) {
          const exists = combined.some(
            (l) => l.id === ny.id || (l.sender === ny.sender && l.amount === ny.amount && Math.abs(l.timestamp - ny.timestamp) < 5000)
          );
          if (!exists) {
            combined.unshift(ny);
            hasNew = true;
            this.registerClientFromYape(ny.sender);
          }
        }

        if (hasNew) {
          this.saveLocalYapes(combined);
        }
        return combined;
      }
    } catch (e) {
      // Ignorar en navegador web puro
    }
    return this.getLocalYapes();
  },

  // Registra automáticamente al cliente en la agenda/directorio si no existe aún
  registerClientFromYape(senderName: string): void {
    if (!senderName || senderName === 'Alguien' || senderName.trim() === '') return;
    try {
      const users: Usuario[] = ordersService.getLocalUsers();
      const cleanName = senderName.trim();
      const existing = users.find(
        (u: Usuario) => u.nombre_completo.toLowerCase() === cleanName.toLowerCase()
      );

      if (!existing) {
        const cleanDni = 'YAPE' + Math.floor(100000 + Math.random() * 900000);
        const newUser: Usuario = {
          id: 'user_yape_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          dni: cleanDni,
          nombre_completo: cleanName,
          password_hash: 'yape_client',
          telefono_default: '',
          direccion_default: '',
          rol: 'client',
          avatar_url: 'https://api.dicebear.com/7.x/shapes/svg?seed=' + encodeURIComponent(cleanName),
          puntos_xp: 10,
          nivel: 1,
          created_at: new Date().toISOString()
        };
        const updatedUsers = [...users, newUser];
        ordersService.saveLocalUsers(updatedUsers);
      }
    } catch (e) {
      console.warn('Error al auto-registrar cliente de yape:', e);
    }
  },

  listenNativeEvents(onReceived: (data: YapeTransaction) => void): () => void {
    let handle: PluginListenerHandle | null = null;
    YapeReader.addListener('onYapeReceived', (data) => {
      this.addTransaction(data);
      onReceived(data);
    }).then((h) => {
      handle = h;
    }).catch(() => {});

    // Polling de respaldo cada 5 segundos
    const interval = setInterval(() => {
      this.syncNativeYapes();
    }, 5000);

    return () => {
      if (handle) handle.remove();
      clearInterval(interval);
    };
  }
};
