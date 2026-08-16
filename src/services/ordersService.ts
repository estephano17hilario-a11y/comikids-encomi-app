import {
  Usuario,
  MetodoEnvio,
  Pedido,
  LogroUsuario,
  EstadoProduccion,
  EstadoEnvio,
  TallerConfig,
  Colaborador,
  CompanyAchievement,
  MotorizadoDistrictConfig,
  ShalomAgency
} from '../types/database.types';
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
  COLABORADORES: 'incomi_colaboradores_v2',
  MASTER_CODE: 'incomi_master_code_v2',
  CUSTOM_SHALOM_AGENCIES: 'incomi_custom_shalom_v2',
  MOTORIZADO_CONFIG: 'incomi_motorizado_districts_v2',
};

export const DEFAULT_EMPRESA_USER: Usuario = {
  id: 'empresa-master-comikids',
  dni: '061625',
  nombre_completo: 'Encomi Envíos',
  edad: 30,
  password_hash: '989834969MI',
  rol: 'empresa',
  avatar_url: 'https://api.dicebear.com/7.x/shapes/svg?seed=EncomiEnvios&backgroundColor=06b6d4,3b82f6',
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
  nombre_taller: 'Encomi Envíos',
  ruc_dni: '42020312ENCOMI',
  celular_taller: '+51 987 654 321',
  whatsapp_pedidos: '51987654321',
  direccion_taller: 'Av. Gamarra 1234, Oficina 402, La Victoria, Lima',
  ciudad_origen: 'LIMA',
  agencia_shalom_origen: 'CENTRAL',
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
      // Ensure master empresa account is always present with dni 061625
      const empresaIndex = users.findIndex(u => u.rol === 'empresa' || u.dni.toUpperCase() === '061625' || u.dni.toUpperCase() === '42020312COMIKIDS' || u.dni.toUpperCase() === '42020312ENCOMI');
      if (empresaIndex !== -1) {
        users[empresaIndex].dni = '061625';
        users[empresaIndex].rol = 'empresa';
        users[empresaIndex].nombre_completo = 'Encomi Envíos';
      } else {
        users.push(DEFAULT_EMPRESA_USER);
      }
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      return users;
    } catch {
      return [DEFAULT_EMPRESA_USER];
    }
  }

  private saveUsers(users: Usuario[]) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  async registerUser(nombreCompleto: string, dni: string, edad?: number, password?: string, telefono?: string): Promise<{ user: Usuario | null; error?: string }> {
    const cleanDni = dni.trim().toUpperCase();
    const cleanPhone = (telefono || '').trim().replace(/\D/g, '');
    const users = this.getUsers();
    const existingIdx = users.findIndex(u => u.dni.toUpperCase() === cleanDni);
    if (existingIdx !== -1) {
      // Si la clienta ya existe, actualizar su nombre y teléfono con los datos más recientes
      users[existingIdx] = {
        ...users[existingIdx],
        nombre_completo: nombreCompleto.trim() || users[existingIdx].nombre_completo,
        telefono_default: cleanPhone || users[existingIdx].telefono_default,
      };
      this.saveUsers(users);

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('usuarios').upsert(users[existingIdx]);
        } catch (err) {
          console.warn('Error actualizando usuario existente en Supabase:', err);
        }
      }
      return { user: users[existingIdx] };
    }

    const newUser: Usuario = {
      id: 'usr-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      dni: cleanDni,
      telefono_default: cleanPhone || (cleanDni.length === 9 && cleanDni.startsWith('9') ? cleanDni : undefined),
      nombre_completo: nombreCompleto.trim(),
      edad: edad ? Number(edad) : undefined,
      genero: undefined,
      motivo_compra: undefined,
      password_hash: password || '',
      rol: cleanDni === DEFAULT_EMPRESA_USER.dni ? 'empresa' : 'client',
      avatar_url: getRandomAvatar(nombreCompleto.trim()),
      puntos_xp: 0,
      nivel: 1,
      created_at: new Date().toISOString(),
    };

    users.push(newUser);
    this.saveUsers(users);

    // Save to Supabase if connected
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('usuarios').upsert(newUser);
      } catch (err) {
        console.warn('Error guardando usuario en Supabase:', err);
      }
    }

    return { user: newUser };
  }

  async loginUser(dni: string, password?: string): Promise<{ user: Usuario | null; error?: string }> {
    const cleanDni = dni.trim().toUpperCase();
    const cleanPass = (password || '').trim();
    const users = this.getUsers();

    // Check special empresa account: 061625
    if (cleanDni === '061625' || cleanDni === '42020312COMIKIDS') {
      const empresaUser = users.find(u => u.rol === 'empresa' || u.dni.toUpperCase() === '061625' || u.dni.toUpperCase() === '42020312COMIKIDS') || DEFAULT_EMPRESA_USER;
      return { user: empresaUser };
    }

    const user = users.find(u => u.dni.toUpperCase() === cleanDni);
    if (!user) {
      return { user: null, error: 'No se encontró ninguna cuenta con este DNI. Por favor regístrate.' };
    }

    if (cleanPass && user.password_hash && user.password_hash !== cleanPass) {
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

  async deleteUser(userId: string): Promise<boolean> {
    const users = this.getUsers();
    const filteredUsers = users.filter(u => u.id !== userId);
    this.saveUsers(filteredUsers);

    const orders = this.getLocalOrders();
    const filteredOrders = orders.filter((o: Pedido) => o.usuario_id !== userId);
    this.saveLocalOrders(filteredOrders);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('pedidos').delete().eq('usuario_id', userId);
        await supabase.from('usuarios').delete().eq('id', userId);
      } catch (e) {
        console.warn('Error deleting user in supabase', e);
      }
    }
    return true;
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
  private getDeletedOrderIds(): Set<string> {
    try {
      const raw = localStorage.getItem('incomi_deleted_order_ids_v1');
      if (!raw) return new Set();
      return new Set(JSON.parse(raw));
    } catch {
      return new Set();
    }
  }

  private addDeletedOrderIds(ids: string[]): void {
    try {
      const current = this.getDeletedOrderIds();
      ids.forEach(id => current.add(id));
      localStorage.setItem('incomi_deleted_order_ids_v1', JSON.stringify(Array.from(current)));
    } catch {}
  }

  private getLocalOrders(): Pedido[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (!raw) return [];
    try {
      const parsed: Pedido[] = JSON.parse(raw);
      const deletedIds = this.getDeletedOrderIds();
      return parsed.filter(o => !deletedIds.has(o.id));
    } catch {
      return [];
    }
  }

  private saveLocalOrders(orders: Pedido[]) {
    const deletedIds = this.getDeletedOrderIds();
    const clean = orders.filter(o => !deletedIds.has(o.id));
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(clean));
  }

  // Sincronizar usuarios locales a Supabase (los pedidos son administrados por Supabase como fuente única)
  async syncLocalDataToSupabase(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const localUsers = this.getUsers();
      for (const u of localUsers) {
        if (u.id && u.dni) {
          const cleanU = {
            id: u.id,
            dni: u.dni,
            nombre_completo: u.nombre_completo,
            edad: u.edad ? Number(u.edad) : null,
            genero: u.genero || null,
            motivo_compra: u.motivo_compra || null,
            password_hash: u.password_hash || 'incomi2026',
            rol: u.rol || 'client',
            avatar_url: u.avatar_url || '',
            puntos_xp: u.puntos_xp || 0,
            nivel: u.nivel || 1,
            telefono_default: u.telefono_default || null,
            created_at: u.created_at || new Date().toISOString()
          };
          await supabase.from('usuarios').upsert(cleanU);
        }
      }
    } catch (e) {
      console.warn('Sync local data to Supabase notice:', e);
    }
  }

  private sanitizePedidoForDb(pedido: Partial<Pedido>): Record<string, any> {
    const payload: Record<string, any> = {};
    if (pedido.id !== undefined) payload.id = pedido.id;
    if (pedido.codigo_seguimiento !== undefined) payload.codigo_seguimiento = pedido.codigo_seguimiento;
    if (pedido.usuario_id !== undefined) payload.usuario_id = pedido.usuario_id;
    if (pedido.detalles_bordado !== undefined) payload.detalles_bordado = pedido.detalles_bordado;
    if (pedido.foto_referencia_url !== undefined) payload.foto_referencia_url = pedido.foto_referencia_url || null;
    if (pedido.metodo_envio_codigo !== undefined) payload.metodo_envio_codigo = pedido.metodo_envio_codigo;
    if (pedido.metodo_envio_nombre !== undefined) {
      payload.metodo_envio_nombre = pedido.metodo_envio_nombre;
    } else if (pedido.metodo_envio_codigo) {
      payload.metodo_envio_nombre = pedido.metodo_envio_codigo === 'shalom' ? 'Agencia Shalom Nacional' : 'Motorizado Local Lima';
    }
    if (pedido.destino_detalle !== undefined) payload.destino_detalle = pedido.destino_detalle;
    if (pedido.latitud !== undefined) payload.latitud = pedido.latitud ?? null;
    if (pedido.longitud !== undefined) payload.longitud = pedido.longitud ?? null;
    if (pedido.estado_produccion !== undefined) payload.estado_produccion = pedido.estado_produccion;
    if (pedido.estado_envio !== undefined) payload.estado_envio = pedido.estado_envio;
    if (pedido.observaciones_cliente !== undefined) payload.observaciones_cliente = pedido.observaciones_cliente || null;
    if (pedido.fecha_limite !== undefined) payload.fecha_limite = pedido.fecha_limite || null;
    if (pedido.rotulado !== undefined) payload.rotulado = Boolean(pedido.rotulado);
    if (pedido.registrado_shalom !== undefined) payload.registrado_shalom = Boolean(pedido.registrado_shalom);
    if (pedido.created_at !== undefined) payload.created_at = pedido.created_at;
    if (pedido.updated_at !== undefined) payload.updated_at = pedido.updated_at;
    return payload;
  }

  async getPedidos(userId?: string): Promise<Pedido[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('pedidos').select('*').order('created_at', { ascending: false });
        if (userId) {
          query = query.eq('usuario_id', userId);
        }
        const { data: dbOrders, error: ordersError } = await query;
        
        // Sincronizar usuarios de Supabase en la memoria local
        const { data: dbUsers } = await supabase.from('usuarios').select('*');
        if (dbUsers && dbUsers.length > 0) {
          const localUsers = this.getUsers();
          const mergedMap = new Map<string, Usuario>();
          localUsers.forEach(u => mergedMap.set(u.id, u));
          dbUsers.forEach((u: any) => mergedMap.set(u.id, u));
          const mergedList = Array.from(mergedMap.values());
          this.saveUsers(mergedList);
        }

        if (!ordersError && dbOrders) {
          const deletedIds = this.getDeletedOrderIds();
          const currentUsers = this.getUsers();
          const syncedOrders: Pedido[] = dbOrders
            .filter((p: any) => !deletedIds.has(p.id))
            .map((p: any) => {
              let matchedUser = currentUsers.find(u => 
                u.id === p.usuario_id || 
                u.dni === p.usuario_id || 
                (u.telefono_default && u.telefono_default === p.usuario_id)
              ) || p.usuario;

              // Extraer el nombre real de la clienta si usuario_id era el admin o estaba vacío
              let clientName = matchedUser?.nombre_completo;
              if (!clientName || clientName === 'Encomi Envíos' || clientName === 'ComiKids' || clientName.trim() === '') {
                if (p.detalles_bordado && p.detalles_bordado.includes('Envío de Mercadería para ')) {
                  clientName = p.detalles_bordado.replace(/^Envío de Mercadería para\s+/i, '').trim();
                } else if (p.detalles_bordado && p.detalles_bordado.includes('Venta directa a ')) {
                  clientName = p.detalles_bordado.replace(/^Venta directa a\s+/i, '').trim();
                }
              }

              if (matchedUser) {
                matchedUser = {
                  ...matchedUser,
                  nombre_completo: clientName || matchedUser.nombre_completo || 'Cliente',
                };
              } else if (clientName) {
                matchedUser = {
                  id: p.usuario_id || 'usr-temp',
                  dni: p.usuario_id || '00000000',
                  nombre_completo: clientName,
                  rol: 'client',
                  created_at: p.created_at || new Date().toISOString()
                };
              }

              return {
                ...p,
                usuario: matchedUser || undefined
              };
            });
          
          if (!userId) {
            this.saveLocalOrders(syncedOrders);
          }
          return syncedOrders;
        }
      } catch (err) {
        console.warn('Usando pedidos locales por error de red:', err);
      }
    }
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
      metodo_envio_nombre: pedidoData.metodo_envio_nombre || (pedidoData.metodo_envio_codigo === 'shalom' ? 'Agencia Shalom Nacional' : 'Motorizado Local Lima'),
      estado_produccion: 'en_cola',
      estado_envio: 'pendiente',
      created_at: now,
      updated_at: now,
    };

    const orders = this.getLocalOrders();
    const updated = [newPedido, ...orders];
    this.saveLocalOrders(updated);

    // Contar pedidos previos del usuario para dar XP y logros correctos
    const allOrders = this.getLocalOrders();
    const userOrderCount = allOrders.filter(o => o.usuario_id === pedidoData.usuario_id).length + 1; // +1 por el nuevo

    // Dar XP base por el pedido
    await this.awardXp(pedidoData.usuario_id, 50);

    // Verificar logros basados en conteo
    const { ACHIEVEMENTS_CATALOG } = await import('../data/achievementsList');
    for (const ach of ACHIEVEMENTS_CATALOG) {
      if (ach.reqCount && userOrderCount >= ach.reqCount) {
        const existing = this.getLocalAchievements();
        if (!existing.some(a => a.usuario_id === pedidoData.usuario_id && a.codigo_logro === ach.codigo)) {
          await this.awardXp(pedidoData.usuario_id, ach.puntosXp, ach.codigo, ach.titulo, ach.descripcion);
        }
      }
    }

    if (isSupabaseConfigured && supabase) {
      try {
        // Asegurar que el usuario existe en Supabase antes de insertar el pedido
        if (pedidoData.usuario) {
          const cleanUser = {
            id: pedidoData.usuario.id,
            dni: pedidoData.usuario.dni,
            nombre_completo: pedidoData.usuario.nombre_completo,
            edad: pedidoData.usuario.edad ? Number(pedidoData.usuario.edad) : null,
            genero: pedidoData.usuario.genero || null,
            motivo_compra: pedidoData.usuario.motivo_compra || null,
            password_hash: pedidoData.usuario.password_hash || 'incomi2026',
            rol: pedidoData.usuario.rol || 'client',
            avatar_url: pedidoData.usuario.avatar_url || '',
            puntos_xp: pedidoData.usuario.puntos_xp || 0,
            nivel: pedidoData.usuario.nivel || 1,
            telefono_default: pedidoData.usuario.telefono_default || null,
            created_at: pedidoData.usuario.created_at || now,
          };
          await supabase.from('usuarios').upsert(cleanUser);
        }

        const dbPayload = this.sanitizePedidoForDb(newPedido);
        const { error: insError } = await supabase.from('pedidos').upsert(dbPayload);
        if (insError) {
          console.error('Error insertando pedido en Supabase:', insError);
        }
      } catch (err) {
        console.error('Error al guardar pedido en Supabase:', err);
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

  // --- LOGROS & GAMIFICACIÓN ---
  private getLocalAchievements(): LogroUsuario[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private saveLocalAchievements(achievements: LogroUsuario[]) {
    localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(achievements));
  }

  getAchievements(userId: string): LogroUsuario[] {
    const all = this.getLocalAchievements();
    return all.filter(a => a.usuario_id === userId);
  }

  async awardXp(userId: string, amount: number, unlockCode?: string, logroTitulo?: string, logroDesc?: string): Promise<void> {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return;

    user.puntos_xp = (user.puntos_xp || 0) + amount;
    const tierInfo = calculateLevel(user.puntos_xp);
    user.nivel = tierInfo.nivel;
    this.saveUsers(users);

    // Update active session
    const active = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (active) {
      try {
        const parsed = JSON.parse(active);
        if (parsed.id === userId) {
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify({ ...parsed, puntos_xp: user.puntos_xp, nivel: user.nivel }));
        }
      } catch {}
    }

    // Sync XP to Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('usuarios').update({ puntos_xp: user.puntos_xp, nivel: user.nivel }).eq('id', userId);
      } catch (e) {
        console.warn('XP Supabase sync failed:', e);
      }
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

  // --- ACCIONES MASIVAS Y EDICIÓN DE PEDIDOS ---
  async updatePedido(pedidoId: string, updates: Partial<Pedido>): Promise<Pedido | null> {
    const orders = this.getLocalOrders();
    const idx = orders.findIndex(o => o.id === pedidoId);
    if (idx === -1) return null;

    const oldOrder = orders[idx];
    const mergedUser = updates.usuario ? { ...oldOrder.usuario, ...updates.usuario } : oldOrder.usuario;

    orders[idx] = {
      ...oldOrder,
      ...updates,
      usuario: mergedUser,
      updated_at: new Date().toISOString(),
    };
    this.saveLocalOrders(orders);

    if (isSupabaseConfigured && supabase) {
      try {
        const dbUpdates = this.sanitizePedidoForDb(updates);
        delete dbUpdates.id; // Don't modify primary key
        await supabase.from('pedidos').update(dbUpdates).eq('id', pedidoId);

        // Si se actualizó el nombre o teléfono del usuario, actualizar en Supabase usuarios
        if (updates.usuario && (updates.usuario.id || oldOrder.usuario_id)) {
          const uId = updates.usuario.id || oldOrder.usuario_id;
          const userPayload: Record<string, any> = {};
          if (updates.usuario.nombre_completo) userPayload.nombre_completo = updates.usuario.nombre_completo.trim();
          if (updates.usuario.telefono_default) userPayload.telefono_default = updates.usuario.telefono_default.trim();
          if (Object.keys(userPayload).length > 0) {
            await supabase.from('usuarios').update(userPayload).eq('id', uId);
            // Actualizar también en la memoria de usuarios locales
            const allUsers = this.getUsers();
            const uIdx = allUsers.findIndex(u => u.id === uId || u.dni === uId);
            if (uIdx !== -1) {
              allUsers[uIdx] = { ...allUsers[uIdx], ...userPayload };
              this.saveUsers(allUsers);
            }
          }
        }
      } catch (e) {
        console.warn('Error actualizando pedido en Supabase:', e);
      }
    }

    return orders[idx];
  }

  async deletePedido(pedidoId: string): Promise<boolean> {
    this.addDeletedOrderIds([pedidoId]);
    const orders = this.getLocalOrders();
    const filtered = orders.filter(o => o.id !== pedidoId);
    this.saveLocalOrders(filtered);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('pedidos').delete().eq('id', pedidoId);
      } catch (e) {
        console.warn('Error eliminando pedido en Supabase:', e);
      }
    }

    return true;
  }

  async deleteMultiplePedidos(pedidoIds: string[]): Promise<boolean> {
    this.addDeletedOrderIds(pedidoIds);
    const setIds = new Set(pedidoIds);
    const orders = this.getLocalOrders();
    const filtered = orders.filter(o => !setIds.has(o.id));
    this.saveLocalOrders(filtered);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('pedidos').delete().in('id', pedidoIds);
      } catch (e) {
        console.warn('Error eliminando pedidos en Supabase:', e);
      }
    }

    return true;
  }

  async updateMultipleEstados(pedidoIds: string[], estadoEnvio: EstadoEnvio, estadoProduccion?: EstadoProduccion): Promise<void> {
    const setIds = new Set(pedidoIds);
    const orders = this.getLocalOrders();
    const updated = orders.map(order => {
      if (setIds.has(order.id)) {
        return {
          ...order,
          estado_envio: estadoEnvio,
          estado_produccion: estadoProduccion || order.estado_produccion,
          updated_at: new Date().toISOString(),
        };
      }
      return order;
    });

    this.saveLocalOrders(updated);

    if (isSupabaseConfigured && supabase) {
      try {
        const updatePayload: Record<string, any> = { estado_envio: estadoEnvio };
        if (estadoProduccion) updatePayload.estado_produccion = estadoProduccion;
        await supabase.from('pedidos').update(updatePayload).in('id', pedidoIds);
      } catch (e) {
        console.warn(e);
      }
    }
  }

  // --- COLABORADORES DE LA EMPRESA ---
  getColaboradores(): Colaborador[] {
    const raw = localStorage.getItem(STORAGE_KEYS.COLABORADORES);
    if (!raw) {
      const initial: Colaborador[] = [
        {
          id: 'colab-1',
          nombre: 'María Ramos (Taller Principal)',
          rol: 'administrador',
          telefono: '987 654 321',
          email: 'maria@comikids.pe',
          activo: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 'colab-2',
          nombre: 'Jorge Soto (Embalaje y Despacho)',
          rol: 'embalaje',
          telefono: '912 345 678',
          activo: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 'colab-3',
          nombre: 'Carlos Motorizado Lima',
          rol: 'motorizado',
          telefono: '998 776 554',
          activo: true,
          created_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEYS.COLABORADORES, JSON.stringify(initial));
      return initial;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  saveColaborador(colab: Omit<Colaborador, 'id' | 'created_at'> & { id?: string }): Colaborador {
    const current = this.getColaboradores();
    if (colab.id) {
      const idx = current.findIndex(c => c.id === colab.id);
      if (idx !== -1) {
        current[idx] = {
          ...current[idx],
          ...colab,
        };
        localStorage.setItem(STORAGE_KEYS.COLABORADORES, JSON.stringify(current));
        return current[idx];
      }
    }

    const newColab: Colaborador = {
      id: 'colab-' + Date.now().toString(36),
      nombre: colab.nombre.trim(),
      rol: colab.rol,
      telefono: colab.telefono?.trim(),
      email: colab.email?.trim(),
      activo: colab.activo !== undefined ? colab.activo : true,
      created_at: new Date().toISOString(),
    };

    const updated = [newColab, ...current];
    localStorage.setItem(STORAGE_KEYS.COLABORADORES, JSON.stringify(updated));
    return newColab;
  }

  deleteColaborador(id: string): boolean {
    const current = this.getColaboradores();
    const filtered = current.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.COLABORADORES, JSON.stringify(filtered));
    return true;
  }

  // --- CÓDIGO MAESTRO DE ACCESO EMPRESA ---
  getMasterCode(): string {
    return localStorage.getItem(STORAGE_KEYS.MASTER_CODE) || '061625';
  }

  setMasterCode(newCode: string): boolean {
    const clean = newCode.trim();
    if (!clean) return false;
    localStorage.setItem(STORAGE_KEYS.MASTER_CODE, clean);
    
    // Sincronizar en el usuario master
    const users = this.getUsers();
    const masterIdx = users.findIndex(u => u.rol === 'empresa');
    if (masterIdx !== -1) {
      users[masterIdx].dni = clean;
      this.saveUsers(users);
    }
    return true;
  }

  // --- LOGROS DE EMPRESA COMIKIDS (HASTA 10,000 PEDIDOS) ---
  getCompanyAchievements(deliveredOrdersCount: number): CompanyAchievement[] {
    const milestones: Array<{
      codigo: string;
      titulo: string;
      descripcion: string;
      meta_pedidos: number;
      icono: string;
      recompensa_xp: number;
    }> = [
      { codigo: 'emp_1', titulo: 'Primer Despacho 📦', descripcion: 'Realizaste el primer envío oficial de la marca.', meta_pedidos: 1, icono: 'Package', recompensa_xp: 100 },
      { codigo: 'emp_10', titulo: 'Taller en Marcha ⚡', descripcion: '10 paquetes enviados exitosamente.', meta_pedidos: 10, icono: 'Sparkles', recompensa_xp: 250 },
      { codigo: 'emp_50', titulo: 'Crecimiento Imparable 🚀', descripcion: '50 clientas felices recibiendo sus pedidos.', meta_pedidos: 50, icono: 'TrendingUp', recompensa_xp: 500 },
      { codigo: 'emp_100', titulo: 'Centenario de Estilo 👑', descripcion: '100 paquetes despachados con excelencia.', meta_pedidos: 100, icono: 'Crown', recompensa_xp: 1000 },
      { codigo: 'emp_250', titulo: 'Gran Proveedor Textil 🏆', descripcion: '250 despachos completados a nivel regional.', meta_pedidos: 250, icono: 'Award', recompensa_xp: 2000 },
      { codigo: 'emp_500', titulo: 'Líder en Confección 🌟', descripcion: '500 paquetes enviados por Shalom y Motorizado.', meta_pedidos: 500, icono: 'Star', recompensa_xp: 3500 },
      { codigo: 'emp_1000', titulo: 'Imperio ComiKids 💎', descripcion: '1,000 pedidos entregados en todo el Perú.', meta_pedidos: 1000, icono: 'Gem', recompensa_xp: 5000 },
      { codigo: 'emp_2500', titulo: 'Marca Mayorista VIP 🔥', descripcion: '2,500 despachos completados y clientes fieles.', meta_pedidos: 2500, icono: 'Flame', recompensa_xp: 10000 },
      { codigo: 'emp_5000', titulo: 'Titán de Envíos 🦁', descripcion: '5,000 pedidos completados. Gigante del sector.', meta_pedidos: 5000, icono: 'Shield', recompensa_xp: 20000 },
      { codigo: 'emp_10000', titulo: 'Leyenda Absoluta 10K 🏛️', descripcion: '10,000 pedidos. La cúspide de la logística textil.', meta_pedidos: 10000, icono: 'Trophy', recompensa_xp: 50000 },
    ];

    return milestones.map(m => ({
      id: 'com_ach_' + m.codigo,
      ...m,
      unlocked: deliveredOrdersCount >= m.meta_pedidos,
      unlocked_at: deliveredOrdersCount >= m.meta_pedidos ? new Date().toISOString() : undefined,
    }));
  }

  // --- GESTOR DE AGENCIAS PERSONALIZADAS Y MOTORIZADO ---
  getCustomShalomAgencies(): ShalomAgency[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_SHALOM_AGENCIES);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  saveCustomShalomAgency(agency: ShalomAgency): ShalomAgency {
    const list = this.getCustomShalomAgencies();
    const idx = list.findIndex(a => a.id === agency.id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...agency };
    } else {
      list.unshift(agency);
    }
    localStorage.setItem(STORAGE_KEYS.CUSTOM_SHALOM_AGENCIES, JSON.stringify(list));
    return agency;
  }

  deleteCustomShalomAgency(id: string | number): boolean {
    const list = this.getCustomShalomAgencies();
    const filtered = list.filter(a => a.id !== id);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_SHALOM_AGENCIES, JSON.stringify(filtered));
    return true;
  }

  getMotorizadoDistricts(): MotorizadoDistrictConfig[] {
    const raw = localStorage.getItem(STORAGE_KEYS.MOTORIZADO_CONFIG);
    if (!raw) {
      const defaultDistricts: MotorizadoDistrictConfig[] = [
        { id: 'mot-1', distrito: 'La Victoria', zona: 'lima_centro', tiempo_estimado_horas: 2, tarifa_sugerida: 10, activo: true },
        { id: 'mot-2', distrito: 'Miraflores', zona: 'lima_centro', tiempo_estimado_horas: 3, tarifa_sugerida: 15, activo: true },
        { id: 'mot-3', distrito: 'San Isidro', zona: 'lima_centro', tiempo_estimado_horas: 3, tarifa_sugerida: 15, activo: true },
        { id: 'mot-4', distrito: 'Surco', zona: 'lima_sur', tiempo_estimado_horas: 4, tarifa_sugerida: 18, activo: true },
        { id: 'mot-5', distrito: 'Los Olivos', zona: 'lima_norte', tiempo_estimado_horas: 4, tarifa_sugerida: 18, activo: true },
        { id: 'mot-6', distrito: 'San Juan de Lurigancho', zona: 'lima_este', tiempo_estimado_horas: 4, tarifa_sugerida: 18, activo: true },
        { id: 'mot-7', distrito: 'Callao', zona: 'callao', tiempo_estimado_horas: 5, tarifa_sugerida: 20, activo: true },
      ];
      localStorage.setItem(STORAGE_KEYS.MOTORIZADO_CONFIG, JSON.stringify(defaultDistricts));
      return defaultDistricts;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  saveMotorizadoDistrict(district: MotorizadoDistrictConfig): void {
    const list = this.getMotorizadoDistricts();
    const idx = list.findIndex(d => d.id === district.id);
    if (idx !== -1) {
      list[idx] = district;
    } else {
      list.push(district);
    }
    localStorage.setItem(STORAGE_KEYS.MOTORIZADO_CONFIG, JSON.stringify(list));
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
    const updated = { ...current, ...config, id: 'config-main' };
    localStorage.setItem(STORAGE_KEYS.TALLER_CONFIG, JSON.stringify(updated));

    if (isSupabaseConfigured && supabase) {
      try {
        supabase.from('taller_config').upsert(updated).then(({ error }) => {
          if (error) console.warn('Error sincronizando taller_config en Supabase:', error);
        });
      } catch (e) {
        console.warn(e);
      }
    }

    return updated;
  }
}

export const ordersService = new OrdersService();
