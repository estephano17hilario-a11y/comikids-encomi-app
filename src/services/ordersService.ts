import { Usuario, MetodoEnvio, Pedido, LogroUsuario, EstadoProduccion, EstadoEnvio, TallerConfig } from '../types/database.types';
import { getRandomAvatar } from '../data/avatarsData';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { generateOrderTrackingCode } from '../utils/formatters';
import { calculateLevel } from '../data/achievementsList';

const STORAGE_KEYS = {
  USERS: 'incomi_users_v2',
  SHIPPING_METHODS: 'incomi_shipping_methods_v2',
  ORDERS: 'incomi_orders_v2',
  ACHIEVEMENTS: 'incomi_achievements_v2',
  TALLER_CONFIG: 'incomi_taller_config_v2',
  CURRENT_USER: 'incomi_auth_user_v2',
};

export const DEFAULT_EMPRESA_USER: Usuario = {
  id: 'empresa-master-comikids',
  dni: '42020312COMIKIDS',
  nombre_completo: 'Comikids Bordados & Estilo',
  edad: 30,
  password_hash: '989834969MI',
  rol: 'empresa',
  avatar_url: 'https://api.dicebear.com/7.x/shapes/svg?seed=ComiKidsMaster&backgroundColor=06b6d4,3b82f6',
  puntos_xp: 5000,
  nivel: 10,
  created_at: new Date().toISOString()
};

export const DEFAULT_METODOS_ENVIO: MetodoEnvio[] = [
  {
    id: 'met-shalom',
    codigo: 'shalom',
    nombre: 'Agencia Shalom Nacional',
    descripcion: 'Envíos rápidos a agencias oficiales de todo el Perú',
    icono: 'Package',
    tipo_formulario: 'shalom',
    activo: true,
    orden: 1,
  },
  {
    id: 'met-motorizado',
    codigo: 'motorizado',
    nombre: 'Motorizado Local Lima',
    descripcion: 'Entrega directa a tu domicilio o trabajo con geolocalización',
    icono: 'Truck',
    tipo_formulario: 'mapa_direccion',
    activo: true,
    orden: 2,
  },
];

export const DEFAULT_TALLER_CONFIG: TallerConfig = {
  nombre_taller: 'Comikids - Taller de Bordados & Estilo',
  ruc_dni: '42020312COMIKIDS',
  celular_taller: '+51 987 654 321',
  whatsapp_pedidos: '51987654321',
  direccion_taller: 'Av. Gamarra 1234, Taller 402, La Victoria, Lima',
  ciudad_origen: 'Lima, Perú',
};

class OrdersService {
  // --- USERS & AUTH ---
  private getUsers(): Usuario[] {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!raw) {
      const initial = [DEFAULT_EMPRESA_USER];
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(initial));
      return initial;
    }
    try {
      const users: Usuario[] = JSON.parse(raw);
      // Ensure master empresa account is always present
      if (!users.some(u => u.dni.toUpperCase() === DEFAULT_EMPRESA_USER.dni.toUpperCase())) {
        users.push(DEFAULT_EMPRESA_USER);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      }
      return users;
    } catch {
      return [DEFAULT_EMPRESA_USER];
    }
  }

  private saveUsers(users: Usuario[]) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  async registerUser(nombreCompleto: string, dni: string, edad?: number, password?: string): Promise<{ user: Usuario | null; error?: string }> {
    const cleanDni = dni.trim().toUpperCase();
    const users = this.getUsers();

    if (users.some(u => u.dni.toUpperCase() === cleanDni)) {
      return { user: null, error: 'Ya existe una cuenta registrada con este DNI.' };
    }

    const newUser: Usuario = {
      id: 'usr-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      dni: cleanDni,
      nombre_completo: nombreCompleto.trim(),
      edad: edad || 20,
      password_hash: password || '',
      rol: cleanDni === DEFAULT_EMPRESA_USER.dni ? 'empresa' : 'client',
      avatar_url: getRandomAvatar(),
      puntos_xp: 0,
      nivel: 1,
      created_at: new Date().toISOString(),
    };

    users.push(newUser);
    this.saveUsers(users);

    // Save to Supabase if connected
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('usuarios').insert(newUser);
      } catch (err) {
        console.warn(err);
      }
    }

    return { user: newUser };
  }

  async loginUser(dni: string, password: string): Promise<{ user: Usuario | null; error?: string }> {
    const cleanDni = dni.trim().toUpperCase();
    const cleanPass = password.trim();
    const users = this.getUsers();

    // Check special empresa account
    if (cleanDni === DEFAULT_EMPRESA_USER.dni) {
      const empresaUser = users.find(u => u.dni.toUpperCase() === DEFAULT_EMPRESA_USER.dni) || DEFAULT_EMPRESA_USER;
      if (empresaUser.password_hash === cleanPass) {
        return { user: empresaUser };
      }
      return { user: null, error: 'Contraseña incorrecta para la cuenta Empresa.' };
    }

    const user = users.find(u => u.dni.toUpperCase() === cleanDni);
    if (!user) {
      return { user: null, error: 'No se encontró ninguna cuenta con este DNI. Por favor regístrate.' };
    }

    if (user.password_hash !== cleanPass) {
      return { user: null, error: 'Contraseña incorrecta.' };
    }

    return { user };
  }

  async changePassword(userId: string, newPassword: string): Promise<boolean> {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return false;

    users[index].password_hash = newPassword.trim();
    this.saveUsers(users);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('usuarios').update({ password_hash: newPassword.trim() }).eq('id', userId);
      } catch (e) {
        console.warn(e);
      }
    }
    return true;
  }

  async updateUserProfile(userId: string, updates: Partial<Usuario>): Promise<Usuario | null> {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return null;

    users[index] = { ...users[index], ...updates };
    this.saveUsers(users);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('usuarios').update(updates).eq('id', userId);
      } catch (e) {
        console.warn(e);
      }
    }
    return users[index];
  }

  // --- MÉTODOS DE ENVÍO / DESTINOS (Configurables por la empresa) ---
  getShippingMethods(): MetodoEnvio[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SHIPPING_METHODS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SHIPPING_METHODS, JSON.stringify(DEFAULT_METODOS_ENVIO));
      return DEFAULT_METODOS_ENVIO;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_METODOS_ENVIO;
    }
  }

  saveShippingMethods(methods: MetodoEnvio[]) {
    localStorage.setItem(STORAGE_KEYS.SHIPPING_METHODS, JSON.stringify(methods));
  }

  addShippingMethod(method: Omit<MetodoEnvio, 'id'>): MetodoEnvio {
    const methods = this.getShippingMethods();
    const newMethod: MetodoEnvio = {
      ...method,
      id: 'met-' + Date.now().toString(36),
    };
    methods.push(newMethod);
    this.saveShippingMethods(methods);
    return newMethod;
  }

  updateShippingMethod(id: string, updates: Partial<MetodoEnvio>): MetodoEnvio | null {
    const methods = this.getShippingMethods();
    const idx = methods.findIndex(m => m.id === id);
    if (idx === -1) return null;

    methods[idx] = { ...methods[idx], ...updates };
    this.saveShippingMethods(methods);
    return methods[idx];
  }

  deleteShippingMethod(id: string): boolean {
    let methods = this.getShippingMethods();
    methods = methods.filter(m => m.id !== id);
    this.saveShippingMethods(methods);
    return true;
  }

  // --- PEDIDOS ---
  private getLocalOrders(): Pedido[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private saveLocalOrders(orders: Pedido[]) {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }

  async getPedidos(userId?: string): Promise<Pedido[]> {
    const all = this.getLocalOrders();
    if (userId) {
      return all.filter(p => p.usuario_id === userId);
    }
    return all;
  }

  async createPedido(pedidoData: Omit<Pedido, 'id' | 'codigo_seguimiento' | 'created_at' | 'estado_produccion' | 'estado_envio'>): Promise<Pedido> {
    const trackingCode = generateOrderTrackingCode();
    const newId = 'ped-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const now = new Date().toISOString();

    const newPedido: Pedido = {
      ...pedidoData,
      id: newId,
      codigo_seguimiento: trackingCode,
      estado_produccion: 'en_cola',
      estado_envio: 'pendiente',
      created_at: now,
      updated_at: now,
    };

    const orders = this.getLocalOrders();
    const updated = [newPedido, ...orders];
    this.saveLocalOrders(updated);

    // Sumar +50 XP al usuario
    await this.awardXp(pedidoData.usuario_id, 50, 'primer_bordado', 'Primer Bordado ✨', 'Creaste tu primer pedido personalizado.');

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('pedidos').insert(newPedido);
      } catch (err) {
        console.warn(err);
      }
    }

    return newPedido;
  }

  async updateEstadoProduccion(pedidoId: string, nuevoEstado: EstadoProduccion): Promise<Pedido | null> {
    const orders = this.getLocalOrders();
    const idx = orders.findIndex(o => o.id === pedidoId);
    if (idx === -1) return null;

    orders[idx].estado_produccion = nuevoEstado;
    orders[idx].updated_at = new Date().toISOString();
    this.saveLocalOrders(orders);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('pedidos').update({ estado_produccion: nuevoEstado }).eq('id', pedidoId);
      } catch (e) {
        console.warn(e);
      }
    }

    return orders[idx];
  }

  async updateEstadoEnvio(pedidoId: string, nuevoEstado: EstadoEnvio): Promise<Pedido | null> {
    const orders = this.getLocalOrders();
    const idx = orders.findIndex(o => o.id === pedidoId);
    if (idx === -1) return null;

    const previous = orders[idx].estado_envio;
    orders[idx].estado_envio = nuevoEstado;
    orders[idx].updated_at = new Date().toISOString();
    this.saveLocalOrders(orders);

    if (nuevoEstado === 'entregado' && previous !== 'entregado') {
      await this.awardXp(orders[idx].usuario_id, 100);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('pedidos').update({ estado_envio: nuevoEstado }).eq('id', pedidoId);
      } catch (e) {
        console.warn(e);
      }
    }

    return orders[idx];
  }

  // --- GAMIFICACIÓN & LOGROS ---
  private getLocalAchievements(): LogroUsuario[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private saveLocalAchievements(achs: LogroUsuario[]) {
    localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(achs));
  }

  async getAchievementsByUser(userId: string): Promise<LogroUsuario[]> {
    const all = this.getLocalAchievements();
    return all.filter(a => a.usuario_id === userId);
  }

  async awardXp(userId: string, amount: number, unlockCode?: string, logroTitulo?: string, logroDesc?: string) {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return;

    user.puntos_xp = (user.puntos_xp || 0) + amount;
    const tierInfo = calculateLevel(user.puntos_xp);
    user.nivel = tierInfo.nivel;
    this.saveUsers(users);

    // Save session if active
    const active = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (active) {
      try {
        const parsed = JSON.parse(active);
        if (parsed.id === userId) {
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
        }
      } catch {}
    }

    if (unlockCode && logroTitulo) {
      const achievements = this.getLocalAchievements();
      if (!achievements.some(a => a.usuario_id === userId && a.codigo_logro === unlockCode)) {
        const newAch: LogroUsuario = {
          id: 'log-' + Date.now().toString(36),
          usuario_id: userId,
          codigo_logro: unlockCode,
          titulo: logroTitulo,
          descripcion: logroDesc || 'Logro desbloqueado.',
          icono: 'Sparkles',
          puntos_xp_ganados: amount,
          unlocked_at: new Date().toISOString(),
        };
        achievements.push(newAch);
        this.saveLocalAchievements(achievements);
      }
    }
  }

  // --- TALLER CONFIG ---
  getTallerConfig(): TallerConfig {
    const raw = localStorage.getItem(STORAGE_KEYS.TALLER_CONFIG);
    if (!raw) return DEFAULT_TALLER_CONFIG;
    try {
      return { ...DEFAULT_TALLER_CONFIG, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_TALLER_CONFIG;
    }
  }

  saveTallerConfig(config: Partial<TallerConfig>): TallerConfig {
    const current = this.getTallerConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(STORAGE_KEYS.TALLER_CONFIG, JSON.stringify(updated));
    return updated;
  }
}

export const ordersService = new OrdersService();
