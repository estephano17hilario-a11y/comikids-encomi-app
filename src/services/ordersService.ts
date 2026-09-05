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
  ShalomAgency,
  EmpresaAccount,
  AccesoHistorialItem,
  EmpresaConfig,
  EmpresaSeccionesActivas
} from '../types/database.types';
import { getRandomAvatar } from '../data/avatarsData';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { generateOrderTrackingCode } from '../utils/formatters';
import { calculateLevel } from '../data/achievementsList';

export const STORAGE_KEYS = {
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
  EMPRESAS: 'incomi_empresas_accounts_v1',
};

export const DEFAULT_EMPRESA_CONFIG: EmpresaConfig = {
  shalom_modo: 'api',
  vps_whatsapp_entregado: true,
  secciones_activas: {
    pedidos: true,
    agendas: true,
    estadisticas: true,
    inventario: true,
    encomi_ai: true,
    hitos: true,
    ajustes: true,
  },
  shalom_email: 'milagrosjanetamis@gmail.com',
  shalom_password: '986398Mi$',
  vps_server_url: '',
  vps_instance_name: 'tenant_Comikids',
};

export const MATRIX_MASTER_USER: Usuario = {
  id: 'usr-matrix-master',
  dni: '963097777',
  nombre_completo: 'Control Central Matrix',
  password_hash: 'matrix4012',
  rol: 'matrix',
  avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=MatrixMaster&backgroundColor=10b981,059669',
  puntos_xp: 99999,
  nivel: 99,
  created_at: new Date().toISOString()
};

export const DEFAULT_EMPRESA_ACCOUNT: EmpresaAccount = {
  id: 'empresa-master-comikids',
  nombre: 'ComiKids',
  numero_entrada: '061625',
  password_hash: '989834969MI',
  activo: true,
  telefono_contacto: '51963097546',
  sub_instance: 'tenant_Comikids',
  created_at: '2026-01-01T00:00:00.000Z',
  ultimo_acceso: new Date().toISOString(),
  total_ingresos: 1,
  historial_accesos: [
    {
      id: 'acc-init-1',
      fecha: new Date().toISOString(),
      userAgent: 'Sistema Inicial ComiKids',
      exitoso: true
    }
  ],
  config: { ...DEFAULT_EMPRESA_CONFIG }
};

export const DEFAULT_EMPRESA_USER: Usuario = {
  id: 'empresa-master-comikids',
  dni: '061625',
  nombre_completo: 'Encomi Envíos',
  // sin edad ni motivo_compra → no contamina métricas demográficas
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
    foto_url: '/Shalom-Courier-Logo.webp',
    tipo_formulario: 'shalom',
    activo: true,
    orden: 1,
    es_sistema: true,
    campos_personalizados: [
      {
        id: 'c-shalom-dni',
        label: 'DNI / CE de quien recibe',
        placeholder: '8 dígitos numéricos',
        tipo: 'numero',
        requerido: true,
        mostrar_en_rotulado: true,
        mostrar_en_comprobante: true,
        sistema: true,
      }
    ],
    config_rotulado: {
      incluir_campos_personalizados: true,
      campos_visibles: ['c-shalom-dni'],
      incluir_remitente: true,
      mostrar_remitente_nombre: true,
      mostrar_remitente_ruc_dni: true,
      mostrar_remitente_telefono: true,
      mostrar_remitente_origen: true,
      incluir_destinatario: true,
      mostrar_cliente_nombre: true,
      mostrar_cliente_dni: true,
      mostrar_cliente_telefono: false,
      mostrar_cliente_destino: true,
      mostrar_observaciones: true,
      mostrar_barcode: true,
      mostrar_fecha_sello: true,
    }
  },
  {
    id: 'met-motorizado',
    codigo: 'motorizado',
    nombre: 'Motorizado Local Lima',
    descripcion: 'Entrega directa a tu domicilio o trabajo con geolocalización',
    icono: 'Truck',
    foto_url: '',
    tipo_formulario: 'mapa_direccion',
    activo: true,
    orden: 2,
    es_sistema: false,
    campos_personalizados: [
      {
        id: 'c-mot-nombre',
        label: 'Nombres y Apellidos de quien recibe',
        placeholder: 'Ej: María López',
        tipo: 'texto',
        requerido: true,
        mostrar_en_rotulado: true,
        mostrar_en_comprobante: true,
        sistema: false,
      },
      {
        id: 'c-mot-tel',
        label: 'Número de Teléfono / WhatsApp',
        placeholder: 'Ej: 987654321',
        tipo: 'telefono',
        requerido: true,
        mostrar_en_rotulado: true,
        mostrar_en_comprobante: true,
        sistema: false,
      },
      {
        id: 'c-mot-ref',
        label: 'Referencia de la Ubicación',
        placeholder: 'Ej: Frente al parque, reja negra',
        tipo: 'texto',
        requerido: false,
        mostrar_en_rotulado: true,
        mostrar_en_comprobante: true,
        sistema: false,
      },
      {
        id: 'c-mot-tiktok',
        label: 'Usuario de TikTok (Opcional)',
        placeholder: 'Ej: @marialopez',
        tipo: 'texto',
        requerido: false,
        mostrar_en_rotulado: true,
        mostrar_en_comprobante: true,
        sistema: false,
      }
    ],
    config_rotulado: {
      incluir_campos_personalizados: true,
      campos_visibles: ['c-mot-nombre', 'c-mot-tel', 'c-mot-ref', 'c-mot-tiktok'],
      incluir_remitente: true,
      mostrar_remitente_nombre: true,
      mostrar_remitente_ruc_dni: true,
      mostrar_remitente_telefono: true,
      mostrar_remitente_origen: true,
      incluir_destinatario: true,
      mostrar_cliente_nombre: true,
      mostrar_cliente_dni: true,
      mostrar_cliente_telefono: true,
      mostrar_cliente_destino: true,
      mostrar_observaciones: true,
      mostrar_barcode: true,
      mostrar_fecha_sello: true,
    }
  },
  {
    id: 'met-olva',
    codigo: 'olva',
    nombre: 'Olva Courier Nacional',
    descripcion: 'Envíos a domicilio y agencias Olva en todo el Perú',
    icono: 'Truck',
    foto_url: '/Olva-Courier-Logo.svg',
    tipo_formulario: 'olva',
    activo: true,
    orden: 3,
    es_sistema: true,
    campos_personalizados: [
      {
        id: 'c-olva-dni',
        label: 'DNI / CE',
        placeholder: '8 dígitos',
        tipo: 'numero',
        requerido: true,
        mostrar_en_rotulado: true,
        mostrar_en_comprobante: true,
        sistema: true,
      },
      {
        id: 'c-olva-dir',
        label: 'Dirección o Agencia Olva',
        placeholder: 'Dirección completa',
        tipo: 'texto',
        requerido: true,
        mostrar_en_rotulado: true,
        mostrar_en_comprobante: true,
        sistema: true,
      }
    ],
    config_rotulado: {
      incluir_campos_personalizados: true,
      campos_visibles: ['c-olva-dni', 'c-olva-dir'],
      incluir_remitente: true,
      mostrar_remitente_nombre: true,
      mostrar_remitente_ruc_dni: true,
      mostrar_remitente_telefono: true,
      mostrar_remitente_origen: true,
      incluir_destinatario: true,
      mostrar_cliente_nombre: true,
      mostrar_cliente_dni: true,
      mostrar_cliente_telefono: true,
      mostrar_cliente_destino: true,
      mostrar_observaciones: true,
      mostrar_barcode: true,
      mostrar_fecha_sello: true,
    }
  },
];

export const DEFAULT_TALLER_CONFIG: TallerConfig = {
  nombre_taller: 'Comikids Envíos',
  ruc_dni: '42020312ENCOMI',
  remitente_dni: '42020312',
  remitente_email: 'comikidsperu@gmail.com',
  remitente_celular: '927781412',
  celular_taller: '+51 927781412',
  whatsapp_pedidos: '51927781412',
  direccion_taller: 'Av. Gamarra 1234, Oficina 402, La Victoria, Lima',
  ciudad_origen: 'LIMA',
  agencia_shalom_origen: 'AV MEXICO CO',
  shalom_email: 'milagrosjanetamis@gmail.com',
  shalom_password: '986398Mi$',
  copilot_password: '989834969MI',
  copilot_sub_instance: 'tenant_Comikids',
  copilot_owner_phone: '51927781412',
  hora_corte_envio_hoy: '18:00',
  dias_despacho_activos: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
  despacho_domingo_habilitado: false,
  mensaje_corte_personalizado: '',
  logo_url: '/Comikids.png',
  tema_fondo: 'vision-obsidian',
  estilo_rotulo_default: 'estandar_oficial',
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

  public getLocalUsers(): Usuario[] {
    return this.getUsers();
  }

  public saveLocalUsers(users: Usuario[]) {
    this.saveUsers(users);
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
        Promise.race([
          supabase.from('usuarios').upsert(users[existingIdx]),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout upsert usuario')), 2500))
        ]).catch(err => console.warn('Supabase upsert existing usuario warn:', err));
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

    // Save to Supabase if connected with 2.5s timeout
    if (isSupabaseConfigured && supabase) {
      Promise.race([
        supabase.from('usuarios').upsert(newUser),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout upsert usuario')), 2500))
      ]).catch(err => console.warn('Supabase upsert new usuario warn:', err));
    }

    return { user: newUser };
  }

  // --- GESTIÓN DE EMPRESAS (MATRIX MASTER CONTROL) ---
  getEmpresas(): EmpresaAccount[] {
    const raw = localStorage.getItem(STORAGE_KEYS.EMPRESAS);
    if (!raw) {
      const initial = [DEFAULT_EMPRESA_ACCOUNT];
      localStorage.setItem(STORAGE_KEYS.EMPRESAS, JSON.stringify(initial));
      return initial;
    }
    try {
      let parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return [DEFAULT_EMPRESA_ACCOUNT];
      }
      // Garantizar que la cuenta histórica de ComiKids siempre esté presente
      if (!parsed.some((e: any) => e.id === 'empresa-master-comikids' || e.numero_entrada === '061625')) {
        parsed.unshift(DEFAULT_EMPRESA_ACCOUNT);
      }
      // Normalizar configs para todas las cuentas
      const normalized = parsed.map((e: EmpresaAccount) => ({
        ...e,
        config: {
          ...DEFAULT_EMPRESA_CONFIG,
          ...(e.config || {}),
          secciones_activas: {
            ...DEFAULT_EMPRESA_CONFIG.secciones_activas,
            ...(e.config?.secciones_activas || {})
          }
        }
      }));
      return normalized;
    } catch {
      return [DEFAULT_EMPRESA_ACCOUNT];
    }
  }

  saveEmpresas(empresas: EmpresaAccount[]): void {
    localStorage.setItem(STORAGE_KEYS.EMPRESAS, JSON.stringify(empresas));
  }

  getEmpresaById(id: string): EmpresaAccount | null {
    const empresas = this.getEmpresas();
    return empresas.find(e => e.id === id) || null;
  }

  getEmpresaByNumero(numero: string): EmpresaAccount | null {
    const clean = numero.trim().toUpperCase().replace(/\s+/g, '');
    const empresas = this.getEmpresas();
    return empresas.find(e => 
      e.numero_entrada.toUpperCase() === clean || 
      (clean === '061625' && e.id === 'empresa-master-comikids') ||
      (clean === '42020312COMIKIDS' && e.id === 'empresa-master-comikids')
    ) || null;
  }

  createEmpresa(data: {
    nombre: string;
    numero_entrada: string;
    password_hash: string;
    telefono_contacto?: string;
    sub_instance?: string;
    activo?: boolean;
    config?: Partial<EmpresaConfig>;
  }): EmpresaAccount {
    const empresas = this.getEmpresas();
    const cleanNum = data.numero_entrada.trim().replace(/\s+/g, '');
    const cleanPass = data.password_hash.trim();
    const cleanNombre = data.nombre.trim();

    if (!cleanNombre) {
      throw new Error('El nombre de la empresa es obligatorio.');
    }
    if (!cleanNum) {
      throw new Error('El número o usuario de entrada es obligatorio.');
    }
    if (!cleanPass) {
      throw new Error('La contraseña es obligatoria.');
    }
    if (cleanNum === '963097777') {
      throw new Error('El número 963097777 está reservado exclusivamente para la Cuenta Principal Matrix.');
    }
    if (empresas.some(e => e.numero_entrada.toUpperCase() === cleanNum.toUpperCase())) {
      throw new Error(`Ya existe una empresa registrada con el número de entrada ${cleanNum}.`);
    }

    const mergedConfig: EmpresaConfig = {
      ...DEFAULT_EMPRESA_CONFIG,
      ...(data.config || {}),
      secciones_activas: {
        ...DEFAULT_EMPRESA_CONFIG.secciones_activas,
        ...(data.config?.secciones_activas || {})
      }
    };

    const newEmpresa: EmpresaAccount = {
      id: 'emp-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      nombre: cleanNombre,
      numero_entrada: cleanNum,
      password_hash: cleanPass,
      activo: data.activo !== false,
      telefono_contacto: data.telefono_contacto?.trim() || undefined,
      sub_instance: data.sub_instance?.trim() || `tenant_${cleanNombre.replace(/\s+/g, '')}`,
      created_at: new Date().toISOString(),
      total_ingresos: 0,
      historial_accesos: [],
      config: mergedConfig
    };

    empresas.push(newEmpresa);
    this.saveEmpresas(empresas);

    // Guardar también en la lista de usuarios para compatibilidad total
    const users = this.getUsers();
    if (!users.some(u => u.dni.toUpperCase() === cleanNum.toUpperCase())) {
      const uEmp: Usuario = {
        id: newEmpresa.id,
        dni: newEmpresa.numero_entrada,
        nombre_completo: newEmpresa.nombre,
        password_hash: newEmpresa.password_hash,
        rol: 'empresa',
        avatar_url: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(newEmpresa.nombre)}&backgroundColor=06b6d4,3b82f6`,
        puntos_xp: 5000,
        nivel: 10,
        created_at: newEmpresa.created_at
      };
      users.push(uEmp);
      this.saveUsers(users);

      if (isSupabaseConfigured && supabase) {
        (async () => {
          try {
            await supabase.from('usuarios').upsert(uEmp);
          } catch (e) {
            console.warn(e);
          }
        })();
      }
    }

    return newEmpresa;
  }

  updateEmpresaConfig(id: string, configUpdates: Partial<EmpresaConfig>): EmpresaAccount | null {
    const empresas = this.getEmpresas();
    const idx = empresas.findIndex(e => e.id === id);
    if (idx === -1) return null;

    const currentConfig = empresas[idx].config || { ...DEFAULT_EMPRESA_CONFIG };
    const updatedConfig: EmpresaConfig = {
      ...currentConfig,
      ...configUpdates,
      secciones_activas: {
        ...currentConfig.secciones_activas,
        ...(configUpdates.secciones_activas || {})
      }
    };

    empresas[idx].config = updatedConfig;
    this.saveEmpresas(empresas);
    return empresas[idx];
  }

  updateEmpresa(id: string, updates: Partial<EmpresaAccount>): EmpresaAccount | null {
    const empresas = this.getEmpresas();
    const idx = empresas.findIndex(e => e.id === id);
    if (idx === -1) return null;

    empresas[idx] = { ...empresas[idx], ...updates };
    this.saveEmpresas(empresas);

    // Sincronizar en users list si cambió contraseña, nombre o número de entrada
    const users = this.getUsers();
    const uIdx = users.findIndex(u => u.id === id || u.dni === empresas[idx].numero_entrada);
    if (uIdx !== -1) {
      users[uIdx] = {
        ...users[uIdx],
        nombre_completo: empresas[idx].nombre,
        password_hash: empresas[idx].password_hash,
        dni: empresas[idx].numero_entrada
      };
      this.saveUsers(users);

      if (isSupabaseConfigured && supabase) {
        (async () => {
          try {
            await supabase.from('usuarios').update({
              nombre_completo: empresas[idx].nombre,
              password_hash: empresas[idx].password_hash,
              dni: empresas[idx].numero_entrada
            }).eq('id', users[uIdx].id);
          } catch (e) {
            console.warn(e);
          }
        })();
      }
    }

    return empresas[idx];
  }

  deleteEmpresa(id: string): boolean {
    if (id === 'empresa-master-comikids') {
      throw new Error('No se puede eliminar la cuenta base de ComiKids.');
    }
    const empresas = this.getEmpresas();
    const filtered = empresas.filter(e => e.id !== id);
    if (filtered.length === empresas.length) return false;
    this.saveEmpresas(filtered);
    return true;
  }

  async loginUser(dni: string, password?: string): Promise<{ user: Usuario | null; error?: string }> {
    const cleanDni = dni.trim().toUpperCase().replace(/\s+/g, '');
    const cleanPass = (password || '').trim();
    const nowIso = new Date().toISOString();
    const clientUserAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Navegador Web';

    // 1. Verificación de Cuenta Principal Matrix (963097777 / matrix4012)
    if (cleanDni === '963097777') {
      if (!cleanPass) {
        return { user: null, error: 'Por favor ingresa la contraseña de Matrix.' };
      }
      if (cleanPass !== 'matrix4012') {
        return { user: null, error: 'Contraseña Matrix incorrecta. Acceso denegado.' };
      }
      return { user: MATRIX_MASTER_USER };
    }

    // 2. Verificación de Cuentas de Empresas (ComiKids y empresas registradas en Matrix)
    const empresas = this.getEmpresas();
    const matchedEmpresa = empresas.find(e => 
      e.numero_entrada.toUpperCase() === cleanDni || 
      (cleanDni === '061625' && e.numero_entrada === '061625') ||
      (cleanDni === '42020312COMIKIDS' && e.numero_entrada === '061625') ||
      (cleanDni === 'ADMIN' && e.id === 'empresa-master-comikids')
    );

    if (matchedEmpresa) {
      if (!matchedEmpresa.activo) {
        return { user: null, error: `La cuenta de empresa "${matchedEmpresa.nombre}" se encuentra inactiva. Contacta al administrador Matrix.` };
      }

      // Validar contraseña de la empresa
      if (matchedEmpresa.password_hash) {
        if (!cleanPass) {
          return { user: null, error: `Ingresa la contraseña para acceder a ${matchedEmpresa.nombre}.` };
        }
        if (cleanPass !== matchedEmpresa.password_hash) {
          // Registrar intento fallido
          matchedEmpresa.historial_accesos = matchedEmpresa.historial_accesos || [];
          matchedEmpresa.historial_accesos.unshift({
            id: 'acc-' + Date.now().toString(36),
            fecha: nowIso,
            userAgent: clientUserAgent,
            exitoso: false
          });
          if (matchedEmpresa.historial_accesos.length > 50) matchedEmpresa.historial_accesos = matchedEmpresa.historial_accesos.slice(0, 50);
          this.saveEmpresas(empresas);
          return { user: null, error: `Contraseña incorrecta para ${matchedEmpresa.nombre}.` };
        }
      }

      // Registrar acceso exitoso (Auditoría: cuándo se entra)
      matchedEmpresa.ultimo_acceso = nowIso;
      matchedEmpresa.total_ingresos = (matchedEmpresa.total_ingresos || 0) + 1;
      matchedEmpresa.historial_accesos = matchedEmpresa.historial_accesos || [];
      matchedEmpresa.historial_accesos.unshift({
        id: 'acc-' + Date.now().toString(36),
        fecha: nowIso,
        userAgent: clientUserAgent,
        exitoso: true
      });
      if (matchedEmpresa.historial_accesos.length > 50) matchedEmpresa.historial_accesos = matchedEmpresa.historial_accesos.slice(0, 50);
      this.saveEmpresas(empresas);

      const empresaUser: Usuario = {
        id: matchedEmpresa.id,
        dni: matchedEmpresa.numero_entrada,
        nombre_completo: matchedEmpresa.nombre,
        password_hash: matchedEmpresa.password_hash,
        rol: 'empresa',
        avatar_url: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(matchedEmpresa.nombre)}&backgroundColor=06b6d4,3b82f6`,
        puntos_xp: 5000,
        nivel: 10,
        created_at: matchedEmpresa.created_at,
      };

      return { user: empresaUser };
    }

    // 3. Clientes y usuarios regulares
    const users = this.getUsers();
    const user = users.find(u => u.dni.toUpperCase() === cleanDni);
    if (!user) {
      return { user: null, error: 'No se encontró ninguna cuenta con este número o DNI.' };
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
      Promise.race([
        supabase.from('usuarios').update(updates).eq('id', userId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout update usuario')), 2500))
      ]).catch(e => console.warn('Supabase update usuario warn:', e));
    }
    return users[index];
  }

  async deleteUser(userId: string): Promise<boolean> {
    const users = this.getUsers();
    const filteredUsers = users.filter(u => u.id !== userId);
    this.saveUsers(filteredUsers);

    const orders = this.getLocalOrders();
    const userOrderIds = orders.filter((o: Pedido) => o.usuario_id === userId).map((o: Pedido) => o.id);
    const filteredOrders = orders.filter((o: Pedido) => o.usuario_id !== userId);
    this.saveLocalOrders(filteredOrders);

    if (isSupabaseConfigured && supabase) {
      try {
        if (userOrderIds.length > 0) {
          await supabase.from('comprobantes_pago').delete().in('pedido_id', userOrderIds);
        }
        await supabase.from('comprobantes_pago').delete().eq('usuario_id', userId);
        await supabase.from('logros_usuario').delete().eq('usuario_id', userId);
        await supabase.from('pedidos').delete().eq('usuario_id', userId);
        const { error: userDelError } = await supabase.from('usuarios').delete().eq('id', userId);
        if (userDelError) {
          console.warn('[DELETE USER SUPABASE ERROR]', userDelError);
        }
      } catch (e) {
        console.warn('Error deleting user in supabase', e);
      }
    }
    return true;
  }


  // --- MÉTODOS DE ENVÍO / DESTINOS (Configurables por la empresa) ---
  getShippingMethods(): MetodoEnvio[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SHIPPING_METHODS);
    let list: MetodoEnvio[];
    if (!raw) {
      list = JSON.parse(JSON.stringify(DEFAULT_METODOS_ENVIO));
      localStorage.setItem(STORAGE_KEYS.SHIPPING_METHODS, JSON.stringify(list));
      return list;
    }
    try {
      list = JSON.parse(raw);
    } catch {
      list = JSON.parse(JSON.stringify(DEFAULT_METODOS_ENVIO));
    }

    let modified = false;

    // 1. REQUERIMIENTO: Asegurar que Shalom exista y tenga sus campos base obligatorios inexpugnables
    const shalomIndex = list.findIndex(m => m.codigo === 'shalom' || m.tipo_formulario === 'shalom' || m.id === 'met-shalom');
    const defaultShalom = DEFAULT_METODOS_ENVIO.find(m => m.codigo === 'shalom')!;
    if (shalomIndex === -1) {
      list.unshift(JSON.parse(JSON.stringify(defaultShalom)));
      modified = true;
    } else {
      const shalom = list[shalomIndex];
      shalom.es_sistema = true;
      shalom.codigo = 'shalom';
      shalom.tipo_formulario = 'shalom';
      if (!shalom.foto_url) shalom.foto_url = '/Shalom-Courier-Logo.webp';
      
      // Garantizar campos base obligatorios para Shalom
      const currentFields = shalom.campos_personalizados || [];
      // Eliminar c-shalom-tel si existe (ya no es campo del sistema)
      const cleanedFields = currentFields.filter(c => c.id !== 'c-shalom-tel');
      const hasDni = cleanedFields.some(c => c.id === 'c-shalom-dni' || c.label.toLowerCase().includes('dni'));

      const mergedFields = [...cleanedFields];
      if (!hasDni) {
        mergedFields.unshift({
          id: 'c-shalom-dni',
          label: 'DNI / CE de quien recibe',
          placeholder: '8 dígitos numéricos',
          tipo: 'numero',
          requerido: true,
          mostrar_en_rotulado: true,
          mostrar_en_comprobante: true,
          sistema: true,
        });
        modified = true;
      } else {
        mergedFields.forEach(c => {
          if (c.id === 'c-shalom-dni' || c.label.toLowerCase().includes('dni')) {
            c.sistema = true;
            c.requerido = true;
          }
        });
      }

      shalom.campos_personalizados = mergedFields;
    }

    // 2. REQUERIMIENTO: Asegurar que Olva Courier exista y tenga sus campos base obligatorios inexpugnables
    const olvaIndex = list.findIndex(m => m.codigo === 'olva' || m.tipo_formulario === 'olva' || m.id === 'met-olva');
    const defaultOlva = DEFAULT_METODOS_ENVIO.find(m => m.codigo === 'olva')!;
    if (olvaIndex === -1) {
      list.push(JSON.parse(JSON.stringify(defaultOlva)));
      modified = true;
    } else {
      const olva = list[olvaIndex];
      olva.es_sistema = true;
      olva.codigo = 'olva';
      olva.tipo_formulario = 'olva';
      if (!olva.foto_url) olva.foto_url = '/Olva-Courier-Logo.svg';

      // Garantizar campos base obligatorios para Olva
      const currentFields = olva.campos_personalizados || [];
      // Eliminar c-olva-tel si existe (ya no es campo del sistema)
      const cleanedFields = currentFields.filter(c => c.id !== 'c-olva-tel');
      const hasDni = cleanedFields.some(c => c.id === 'c-olva-dni' || c.label.toLowerCase().includes('dni'));
      const hasDir = cleanedFields.some(c => c.id === 'c-olva-dir' || c.label.toLowerCase().includes('direcc') || c.label.toLowerCase().includes('agencia'));

      const mergedFields = [...cleanedFields];
      if (!hasDni) {
        mergedFields.unshift({
          id: 'c-olva-dni',
          label: 'DNI / CE',
          placeholder: '8 dígitos',
          tipo: 'numero',
          requerido: true,
          mostrar_en_rotulado: true,
          mostrar_en_comprobante: true,
          sistema: true,
        });
        modified = true;
      } else {
        mergedFields.forEach(c => {
          if (c.id === 'c-olva-dni' || c.label.toLowerCase().includes('dni')) {
            c.sistema = true;
            c.requerido = true;
          }
        });
      }

      if (!hasDir) {
        mergedFields.push({
          id: 'c-olva-dir',
          label: 'Dirección o Agencia Olva',
          placeholder: 'Dirección completa',
          tipo: 'texto',
          requerido: true,
          mostrar_en_rotulado: true,
          mostrar_en_comprobante: true,
          sistema: true,
        });
        modified = true;
      } else {
        mergedFields.forEach(c => {
          if (c.id === 'c-olva-dir' || c.label.toLowerCase().includes('direcc') || c.label.toLowerCase().includes('agencia')) {
            c.sistema = true;
            c.requerido = true;
          }
        });
      }

      olva.campos_personalizados = mergedFields;
    }

    if (modified) {
      this.saveShippingMethods(list);
    }
    return list;
  }

  saveShippingMethods(methods: MetodoEnvio[]) {
    localStorage.setItem(STORAGE_KEYS.SHIPPING_METHODS, JSON.stringify(methods));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('incomi_shipping_methods_updated', { detail: methods }));
    }
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

    const existing = methods[idx];
    // Protección estricta de Shalom y Olva: No se puede cambiar su código base, tipo de formulario ni eliminar sus campos base
    if (existing.es_sistema || existing.codigo === 'shalom' || existing.codigo === 'olva') {
      delete updates.codigo;
      delete updates.tipo_formulario;
      updates.es_sistema = true;

      // Asegurar que los campos del sistema se mantengan
      if (updates.campos_personalizados) {
        const baseSystemFieldIds = existing.codigo === 'shalom' 
          ? ['c-shalom-dni']
          : ['c-olva-dni', 'c-olva-dir'];
        
        const existingSystemFields = (existing.campos_personalizados || []).filter(c => c.sistema || baseSystemFieldIds.includes(c.id));
        const updatedFields = updates.campos_personalizados;

        // Si faltaba algún campo base en updatedFields, se reinserta
        existingSystemFields.forEach(sysField => {
          const found = updatedFields.find(u => u.id === sysField.id);
          if (!found) {
            updatedFields.unshift(sysField);
          } else {
            found.sistema = true;
            found.requerido = true;
          }
        });
        updates.campos_personalizados = updatedFields;
      }
    }

    methods[idx] = { ...existing, ...updates };
    this.saveShippingMethods(methods);
    return methods[idx];
  }

  deleteShippingMethod(id: string): boolean {
    let methods = this.getShippingMethods();
    const target = methods.find(m => m.id === id);
    if (!target) return false;

    // Protección estricta: Shalom y Olva NO se pueden borrar
    if (target.es_sistema || target.codigo === 'shalom' || target.codigo === 'olva' || target.id === 'met-shalom' || target.id === 'met-olva') {
      console.warn('[SEGURIDAD] No se puede eliminar una agencia oficial del sistema (Shalom / Olva).');
      return false;
    }

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
    if (pedido.shalom_ose_id !== undefined) payload.shalom_ose_id = pedido.shalom_ose_id || null;
    if (pedido.shalom_numero_guia !== undefined) payload.shalom_numero_guia = pedido.shalom_numero_guia || null;
    if (pedido.shalom_clave_recojo !== undefined) payload.shalom_clave_recojo = pedido.shalom_clave_recojo || null;
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
          const allKnownUsers: Usuario[] = [...(dbUsers || []), ...this.getUsers()];
          
          // Mapas de indexación rápida para enlazar la clienta con su pedido
          const userById = new Map<string, Usuario>();
          const userByDni = new Map<string, Usuario>();
          const userByPhone = new Map<string, Usuario>();

          allKnownUsers.forEach(u => {
            if (u.id) userById.set(u.id, u);
            if (u.dni && !u.dni.startsWith('usr-')) {
              userByDni.set(u.dni.trim().toLowerCase(), u);
            }
            if (u.telefono_default) {
              const pDigits = u.telefono_default.replace(/\D/g, '').slice(-9);
              if (pDigits) userByPhone.set(pDigits, u);
            }
          });

          const syncedOrders: Pedido[] = dbOrders
            .filter((p: any) => !deletedIds.has(p.id))
            .map((p: any) => {
              // 1. Extracción de DNI del texto del destino (ej: Shalom DNI/CE Recojo: 75864041)
              let extractedDni = '';
              const matchDoc = String(p.destino_detalle || '').match(/DNI(?:\/CE)?(?:\s*Recojo)?:\s*([0-9A-Za-z]+)/i);
              if (matchDoc && matchDoc[1] && !matchDoc[1].startsWith('usr-')) {
                extractedDni = matchDoc[1].trim().toLowerCase();
              }

              // 2. Extracción de Teléfono del texto del destino
              let extractedPhone = '';
              const matchPhone = String(p.destino_detalle || '').match(/(?:Tel|Cel|WhatsApp|Telefono|Celular)[\s:]*([0-9]{9})/i);
              if (matchPhone && matchPhone[1]) {
                extractedPhone = matchPhone[1].trim();
              }

              // 3. Enlazar usuario
              let matchedUser = 
                userById.get(p.usuario_id) ||
                (extractedDni ? userByDni.get(extractedDni) : undefined) ||
                (extractedPhone ? userByPhone.get(extractedPhone) : undefined) ||
                userByDni.get(String(p.usuario_id || '').toLowerCase()) ||
                p.usuario;

              // 4. Extraer el nombre real de la clienta
              let clientName = matchedUser?.nombre_completo;
              if (!clientName || clientName === 'Encomi Envíos' || clientName === 'ComiKids' || clientName.trim() === '') {
                if (p.detalles_bordado && p.detalles_bordado.includes('Envío de Mercadería para ')) {
                  clientName = p.detalles_bordado.replace(/^Envío de Mercadería para\s+/i, '').trim();
                } else if (p.detalles_bordado && p.detalles_bordado.includes('Venta directa a ')) {
                  clientName = p.detalles_bordado.replace(/^Venta directa a\s+/i, '').trim();
                }
              }

              // 5. Normalizar DNI
              let realDni = matchedUser?.dni;
              if (!realDni || realDni.startsWith('usr-') || realDni === '00000000') {
                realDni = extractedDni || matchedUser?.dni_default || '';
              }

              // 6. Normalizar Teléfono
              let realPhone = matchedUser?.telefono_default;
              if (!realPhone) {
                realPhone = extractedPhone || '';
              }

              if (matchedUser) {
                matchedUser = {
                  ...matchedUser,
                  dni: realDni || (matchedUser.dni && !matchedUser.dni.startsWith('usr-') ? matchedUser.dni : ''),
                  telefono_default: realPhone || matchedUser.telefono_default || '',
                  nombre_completo: clientName || matchedUser.nombre_completo || 'Cliente',
                };
              } else {
                matchedUser = {
                  id: p.usuario_id || ('usr-' + (realDni || Date.now())),
                  dni: realDni || '',
                  telefono_default: realPhone || '',
                  nombre_completo: clientName || 'Cliente',
                  rol: 'client',
                  created_at: p.created_at || new Date().toISOString()
                };
              }

              return {
                ...p,
                usuario: matchedUser
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

    // Guardar inmediatamente en localStorage local
    const orders = this.getLocalOrders();
    const updated = [newPedido, ...orders];
    this.saveLocalOrders(updated);

    // Contar pedidos previos del usuario para dar XP
    const allOrders = this.getLocalOrders();
    const userOrderCount = allOrders.filter(o => o.usuario_id === pedidoData.usuario_id).length;

    // PERSISTENCIA INMEDIATA EN LA NUBE SUPABASE (AWAITED):
    // Garantiza que el pedido esté 100% guardado en el servidor antes de que el navegador móvil abra WhatsApp
    const client = supabase;
    if (isSupabaseConfigured && client) {
      try {
        // 1. Sincronizar o crear el usuario en Supabase
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
            avatar_url: pedidoData.usuario.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${pedidoData.usuario.dni}`,
            puntos_xp: pedidoData.usuario.puntos_xp || 0,
            nivel: pedidoData.usuario.nivel || 1,
            telefono_default: pedidoData.usuario.telefono_default || null,
            created_at: pedidoData.usuario.created_at || now,
          };

          try {
            await Promise.race([
              client.from('usuarios').upsert(cleanUser, { onConflict: 'dni' }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout usuario')), 2500))
            ]);
          } catch (uErr) {
            console.warn('[SUPABASE USUARIO UPSERT NOTICE]:', uErr);
          }
        }

        // 2. Guardar el pedido en Supabase
        const dbPayload = this.sanitizePedidoForDb(newPedido);
        const { error: insErr } = await Promise.race([
          client.from('pedidos').upsert(dbPayload),
          new Promise<{ error: Error }>((_, reject) => setTimeout(() => reject(new Error('Timeout pedido')), 4500))
        ]).catch(async (tErr) => {
          console.warn('[RETRY] Reintentando inserción directa en Supabase:', tErr);
          return await client.from('pedidos').upsert(dbPayload);
        });

        if (insErr) {
          console.error('[CRITICAL] Error al insertar pedido en Supabase:', insErr);
        } else {
          console.log('[SUCCESS] Pedido confirmado y guardado en Supabase:', newPedido.id);
        }
      } catch (cloudErr) {
        console.warn('[SUPABASE PERSISTENCE WARN]:', cloudErr);
      }
    }

    // Tareas secundarias asíncronas (XP y Logros) ejecutadas en segundo plano
    setTimeout(async () => {
      try {
        this.awardXp(pedidoData.usuario_id, 50).catch(() => {});
        const { ACHIEVEMENTS_CATALOG } = await import('../data/achievementsList');
        for (const ach of ACHIEVEMENTS_CATALOG) {
          if (ach.reqCount && userOrderCount >= ach.reqCount) {
            const existing = this.getLocalAchievements();
            if (!existing.some(a => a.usuario_id === pedidoData.usuario_id && a.codigo_logro === ach.codigo)) {
              this.awardXp(pedidoData.usuario_id, ach.puntosXp, ach.codigo, ach.titulo, ach.descripcion).catch(() => {});
            }
          }
        }
      } catch (e) {
        console.warn('Background XP warn:', e);
      }
    }, 0);

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
        dbUpdates.updated_at = new Date().toISOString();

        if (Object.keys(dbUpdates).length > 0) {
          const { error: updErr } = await supabase.from('pedidos').update(dbUpdates).eq('id', pedidoId);
          if (updErr) {
            console.error('Error actualizando pedido en Supabase:', updErr);
          }
        }

        // Si se actualizó el nombre o teléfono del usuario, actualizar en Supabase usuarios
        if (updates.usuario && (updates.usuario.id || oldOrder.usuario_id)) {
          const uId = updates.usuario.id || oldOrder.usuario_id;
          const userPayload: Record<string, any> = {};
          if (updates.usuario.nombre_completo) userPayload.nombre_completo = updates.usuario.nombre_completo.trim();
          if (updates.usuario.telefono_default) userPayload.telefono_default = updates.usuario.telefono_default.trim();
          if (updates.usuario.dni) userPayload.dni = updates.usuario.dni.trim();

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
        console.error('Error actualizando pedido en Supabase:', e);
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
        await supabase.from('comprobantes_pago').delete().eq('pedido_id', pedidoId);
      } catch (e) {
        // ignore if not present
      }

      try {
        const { error } = await supabase.from('pedidos').delete().eq('id', pedidoId);
        if (error) {
          console.error('[DELETE PEDIDO SUPABASE ERROR]', error);
        }
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
        await supabase.from('comprobantes_pago').delete().in('pedido_id', pedidoIds);
      } catch (e) {
        // ignore
      }

      try {
        const { error } = await supabase.from('pedidos').delete().in('id', pedidoIds);
        if (error) {
          console.error('[DELETE MULTIPLE PEDIDOS SUPABASE ERROR]', error);
        }
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

  async fetchTallerConfig(): Promise<TallerConfig> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('taller_config').select('*').limit(1).maybeSingle();
        if (data && !error) {
          const merged: TallerConfig = {
            ...DEFAULT_TALLER_CONFIG,
            ...data,
          };
          localStorage.setItem(STORAGE_KEYS.TALLER_CONFIG, JSON.stringify(merged));
          return merged;
        }
      } catch (err) {
        console.warn('Error fetching taller_config from Supabase:', err);
      }
    }
    return this.getTallerConfig();
  }

  async saveTallerConfig(config: Partial<TallerConfig>): Promise<TallerConfig> {
    const current = this.getTallerConfig();
    const updated: TallerConfig = { ...current, ...config };
    localStorage.setItem(STORAGE_KEYS.TALLER_CONFIG, JSON.stringify(updated));

    if (isSupabaseConfigured && supabase) {
      try {
        const payloadToSupabase = {
          ...updated,
          id: 'config-main',
        };
        const { error } = await supabase.from('taller_config').upsert(payloadToSupabase);
        if (error) {
          console.error('[SUPABASE TALLER CONFIG UPSERT ERROR]', error);
        }
      } catch (e) {
        console.warn('Error en upsert taller_config:', e);
      }
    }


    return updated;
  }

}

export const ordersService = new OrdersService();
