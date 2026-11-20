import type OpenAI from 'openai';
import { supabaseAdmin } from '../config/supabase.js';
import { ShalomMatcherService } from './shalomMatcher.service.js';
import { ShalomSyncService } from './shalomSync.service.js';
import { aiClient, AI_MODEL } from './ai.service.js';

const MODELS = Array.from(
  new Set([
    AI_MODEL,
    'google/gemini-2.5-flash',
    'openai/gpt-4o-mini',
    'deepseek/deepseek-chat',
    'meta-llama/llama-3.3-70b-instruct',
  ])
);

const MASTER_EMPRESA = 'empresa-master-comikids';
const ESTADO_ENVIO_VALIDOS = ['pendiente', 'en_camino', 'listo_para_recojo', 'entregado', 'cancelado'];
const ESTADO_PROD_VALIDOS = ['en_cola', 'bordando', 'completado'];

const peruNow = () => new Date(Date.now() - 5 * 3600 * 1000);
const todayPeru = () => peruNow().toISOString().slice(0, 10);
const peruDay = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return new Date(d.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
};
const addDays = (day: string, n: number) =>
  new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

const resolveDate = (v?: string): string => {
  const t = (v || 'hoy').toString().trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  if (t === 'hoy') return todayPeru();
  if (t === 'ayer') return addDays(todayPeru(), -1);
  if (t === 'mañana' || t === 'manana') return addDays(todayPeru(), 1);
  return todayPeru();
};

const scopeOrders = (q: any, empresaId: string) =>
  !empresaId || empresaId === MASTER_EMPRESA
    ? q.or(`empresa_id.eq.${MASTER_EMPRESA},empresa_id.is.null`)
    : q.eq('empresa_id', empresaId);

const ORDER_COLS =
  'id, codigo_seguimiento, usuario_id, detalles_bordado, metodo_envio_codigo, metodo_envio_nombre, destino_detalle, estado_produccion, estado_envio, observaciones_cliente, fecha_limite, created_at, updated_at, registrado_shalom, shalom_clave_recojo, shalom_numero_guia, shalom_ose_id, empresa_id';

async function fetchAllScopedOrders(empresaId: string, maxRows = 2000): Promise<any[]> {
  const all: any[] = [];
  const pageSize = 500;
  let offset = 0;

  while (all.length < maxRows) {
    const q = scopeOrders(supabaseAdmin.from('pedidos').select(ORDER_COLS), empresaId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function fetchUsersMap(ids: string[]): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  for (let i = 0; i < unique.length; i += 150) {
    const { data } = await supabaseAdmin
      .from('usuarios')
      .select('id, dni, nombre_completo, telefono_default, dni_default, direccion_default, referencia_default')
      .in('id', unique.slice(i, i + 150));
    (data || []).forEach((u: any) => map.set(u.id, u));
  }
  return map;
}

function formatOrderCompact(o: any, users: Map<string, any>) {
  const u = users.get(o.usuario_id);
  let cliente = u?.nombre_completo;
  if (!cliente || ['Encomi Envíos', 'ComiKids'].includes(cliente.trim())) {
    if (o.detalles_bordado?.includes('Envío de Mercadería para ')) {
      cliente = o.detalles_bordado.replace(/^.*Envío de Mercadería para\s+/i, '').trim();
    } else {
      cliente = 'Cliente';
    }
  }
  let dni = u?.dni && !String(u.dni).startsWith('usr-') ? u.dni : u?.dni_default || '';
  if (!dni) {
    const m = String(o.destino_detalle || '').match(/(?:DNI\/CE|DNI|CE)\s*Recojo:\s*([0-9A-Za-z]+)/i);
    dni = m ? m[1] : '';
  }
  return {
    codigo: o.codigo_seguimiento,
    cliente,
    dni,
    telefono: u?.telefono_default || '',
    metodo_envio: o.metodo_envio_nombre || o.metodo_envio_codigo,
    destino: o.destino_detalle,
    estado_produccion: o.estado_produccion,
    estado_envio: o.estado_envio,
    fecha_envio: o.fecha_limite ? String(o.fecha_limite).slice(0, 10) : null,
    creado_peru: o.created_at
      ? new Date(new Date(o.created_at).getTime() - 5 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16)
      : null,
    registrado_shalom: Boolean(o.registrado_shalom),
    guia_shalom: o.shalom_numero_guia || null,
    clave_recojo: o.shalom_clave_recojo || null,
    detalle: o.detalles_bordado || null,
    notas: o.observaciones_cliente || null,
  };
}

export interface WhatsAppAgentContext {
  empresaId: string;
  empresaNombre: string;
  accountCode: string;
  userSenderInstance: string;
  userSenderPhone: string;
  hasAttachedMedia: boolean;
  attachedFileName: string;
  isImage: boolean;
  isDoc: boolean;
  extractedClientInfo?: any;
  registerOrderCallback: (actionData: any) => Promise<{ sentDirectly: boolean; message: string }>;
  sendWhatsAppToClientCallback: (params: {
    targetPhone: string;
    customerName?: string;
    text: string;
    sendAttachedDoc?: boolean;
    mediaUrl?: string | null;
    mediaType?: string;
    fileName?: string;
  }) => Promise<string>;
  recordBackupCallback: (action: string, data: any) => Promise<void>;
}

export interface WhatsAppAgentRunResult {
  reply: string;
  alreadySentDirectMessage: boolean;
  tokensUsed: number;
  model: string;
}

const S = (properties: Record<string, any>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const TOOL_DEFS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'consultar_agencias_shalom',
      description:
        'Consulta EN VIVO la tabla shalom_agencies de PostgreSQL. Verifica si existe sucursal Shalom en un distrito/ciudad/dirección/código, detecta si está CERRADA/DESHABILITADA/SOLO ENVÍOS/(POR DEFINIR), detecta si CAMBIÓ DE NOMBRE recientemente, y entrega las sedes activas más cercanas por GPS + alternativas en Olva.',
      parameters: S({
        busqueda: { type: 'string', description: 'Distrito, provincia, avenida, nombre o código de agencia Shalom (ej: "San Isidro", "Curahuasi", "Av. Benavides", "Mochumi", "HRZ")' },
        limite: { type: 'number', description: 'Máximo de resultados (default 8)' },
      }, ['busqueda']),
    },
  },
  {
    type: 'function',
    function: {
      name: 'verificar_cambios_shalom',
      description:
        'Muestra el listado real de agencias Shalom que cambiaron de nombre recientemente, las que cerraron o fueron deshabilitadas en los últimos 30 días, y conteo total activo. Opcionalmente puede ejecutar una sincronización en vivo con la API oficial de Shalom.',
      parameters: S({
        sincronizar_ahora: { type: 'boolean', description: 'Solo true si el usuario pide explícitamente sincronizar o actualizar las agencias Shalom con la API ahora mismo.' },
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_agencias_olva',
      description: 'Busca agencias activas de Olva Courier en la base de datos (útil cuando Shalom no tiene cobertura en una zona).',
      parameters: S({
        busqueda: { type: 'string', description: 'Distrito, provincia, departamento o dirección' },
        limite: { type: 'number' },
      }, ['busqueda']),
    },
  },
  {
    type: 'function',
    function: {
      name: 'resumen_general_bd',
      description:
        'Obtiene métricas 100% reales y exactas en tiempo real de toda la base de datos: pedidos activos por estado, pedidos de hoy, entregados históricos, total de clientes, comprobantes de pago recientes y total de agencias Shalom activas.',
      parameters: S({}),
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_pedidos',
      description:
        'Busca y filtra en TODOS los pedidos de la base de datos (activos e históricos >1000 registros) por código, guía Shalom, nombre de cliente, DNI, teléfono, destino, fecha (hoy/ayer/mañana/YYYY-MM-DD), estado o método de envío.',
      parameters: S({
        buscar: { type: 'string', description: 'Nombre, DNI, teléfono, código de seguimiento, guía Shalom o palabra del destino' },
        solo_activos: { type: 'boolean', description: 'true para excluir entregados y cancelados' },
        estado_envio: { type: 'string', description: 'pendiente | en_camino | listo_para_recojo | entregado | cancelado' },
        estado_produccion: { type: 'string', description: 'en_cola | bordando | completado' },
        fecha: { type: 'string', description: 'hoy | ayer | mañana | YYYY-MM-DD' },
        agencia: { type: 'string', description: 'shalom | motorizado | olva' },
        limite: { type: 'number', description: 'Máximo de resultados (default 20, máx 50)' },
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_detalle_pedido',
      description: 'Muestra el detalle completo de un pedido específico por código de seguimiento, ID o guía Shalom, incluyendo datos del cliente y comprobantes de pago asociados.',
      parameters: S({ referencia: { type: 'string', description: 'Código de seguimiento (ej: COM-2026-7029), guía Shalom o ID' } }, ['referencia']),
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_pedido',
      description:
        'Registra un nuevo pedido en la base de datos validando automáticamente la agencia Shalom EN VIVO (avisa si la sede cerró, no tiene sucursal, cambió de nombre o requiere elegir entre varias sedes). Requiere nombre, DNI (8+ dígitos), teléfono (9 dígitos) y destino.',
      parameters: S({
        clienteNombre: { type: 'string' },
        clienteDni: { type: 'string' },
        clienteTelefono: { type: 'string' },
        destino: { type: 'string', description: 'Agencia Shalom deseada o dirección completa si es motorizado' },
        metodoEnvio: { type: 'string', description: 'shalom | motorizado' },
        referencia: { type: 'string' },
        prendasBordado: { type: 'string' },
      }, ['clienteNombre', 'clienteDni', 'clienteTelefono', 'destino']),
    },
  },
  {
    type: 'function',
    function: {
      name: 'actualizar_pedido',
      description:
        'Actualiza un pedido existente en PostgreSQL (estado de envío, producción, destino —validando agencia Shalom en vivo—, fecha programada, notas, clave de recojo o guía Shalom).',
      parameters: S({
        referencia: { type: 'string', description: 'Código de seguimiento (ej: COM-2026-7029) o DNI si es único' },
        estadoEnvio: { type: 'string', description: 'pendiente | en_camino | listo_para_recojo | entregado | cancelado' },
        estadoProduccion: { type: 'string', description: 'en_cola | bordando | completado' },
        nuevoDestino: { type: 'string', description: 'Nuevo destino o agencia Shalom (se valida contra shalom_agencies antes de guardar)' },
        fechaEnvio: { type: 'string', description: 'hoy | mañana | YYYY-MM-DD' },
        claveShalom: { type: 'string' },
        guiaShalom: { type: 'string' },
        notas: { type: 'string' },
        detallesBordado: { type: 'string' },
      }, ['referencia']),
    },
  },
  {
    type: 'function',
    function: {
      name: 'eliminar_pedido',
      description: 'Elimina permanentemente un pedido. Primero llamar con confirmar=false para confirmar con el usuario; solo usar confirmar=true cuando el usuario confirme explícitamente.',
      parameters: S({ referencia: { type: 'string' }, confirmar: { type: 'boolean' } }, ['referencia']),
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_clientes',
      description: 'Busca clientes registrados en la tabla usuarios (por nombre, DNI o teléfono) mostrando dirección guardada y total de pedidos.',
      parameters: S({ buscar: { type: 'string' }, limite: { type: 'number' } }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'actualizar_cliente',
      description: 'Actualiza datos de un cliente en la tabla usuarios (nombre, celular, DNI o dirección por defecto).',
      parameters: S({
        cliente: { type: 'string', description: 'DNI, celular o nombre del cliente' },
        nombre: { type: 'string' },
        telefono: { type: 'string' },
        direccion: { type: 'string' },
      }, ['cliente']),
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_comprobantes_pago',
      description: 'Consulta la tabla comprobantes_pago (pagos Yape, Plin, transferencias BCP/BBVA/Interbank, montos, números de operación y validación).',
      parameters: S({
        buscar: { type: 'string', description: 'Número de operación, banco, titular o teléfono' },
        limite: { type: 'number' },
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_mensajes_whatsapp',
      description: 'Consulta el historial reciente en whatsapp_mensajes_log para saber qué escribieron los clientes o buscar una conversación por nombre, teléfono o palabra clave.',
      parameters: S({
        buscar: { type: 'string', description: 'Nombre de cliente, teléfono o texto del mensaje' },
        limite: { type: 'number' },
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_y_configurar_taller',
      description: 'Lee o actualiza la configuración del negocio en taller_config y metodos_envio (hora de corte, días de despacho, agencia origen, anuncios públicos).',
      parameters: S({
        actualizar: { type: 'boolean', description: 'false para solo leer; true para aplicar cambios indicados' },
        hora_corte_envio_hoy: { type: 'string', description: 'HH:MM' },
        despacho_domingo_habilitado: { type: 'boolean' },
        anuncio_publico_clientes: { type: 'string' },
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'enviar_whatsapp_a_clienta',
      description: 'Envía un mensaje o el archivo/foto/PDF adjunto actual directamente al WhatsApp de una clienta usando la línea Sub-QR de la empresa.',
      parameters: S({
        targetPhone: { type: 'string', description: 'Número de celular de 9 dígitos o con prefijo 51' },
        customerName: { type: 'string' },
        text: { type: 'string', description: 'Texto a enviar' },
        sendAttachedDoc: { type: 'boolean', description: 'true si debe reenviar la foto/PDF adjunto en el mensaje actual' },
      }, ['targetPhone', 'text']),
    },
  },
];

async function executeTool(
  name: string,
  args: any,
  ctx: WhatsAppAgentContext
): Promise<{ output: any; sentDirectMessage?: string }> {
  switch (name) {
    case 'consultar_agencias_shalom': {
      const q = String(args.busqueda || '').trim();
      const lim = Math.min(Math.max(Number(args.limite) || 8, 1), 15);
      const [searchRes, liveRes] = await Promise.all([
        ShalomMatcherService.searchAgenciesLive(q, lim),
        ShalomMatcherService.resolveDestinationLive(q, ''),
      ]);
      return {
        output: {
          estado_resolucion: liveRes.status,
          total_activas_en_bd: searchRes.totalActiveCatalog,
          coincidencia_cerrada_o_deshabilitada: liveRes.closedMatch
            ? {
                titulo: liveRes.closedMatch.displayTitle,
                direccion: liveRes.closedMatch.displayAddress,
                motivo: liveRes.closedMatch.reason,
                categoria: liveRes.closedMatch.category,
                fecha_baja: liveRes.closedMatch.deletedAt,
              }
            : null,
          aviso_cambio_nombre: liveRes.renameNotice || null,
          agencias_activas_encontradas: searchRes.activeMatches,
          agencias_cerradas_o_inactivas_encontradas: searchRes.closedOrDisabledMatches,
          alternativas_activas_mas_cercanas: liveRes.nearestAlternatives.map(a => ({
            codigo: a.code,
            titulo: a.displayTitle,
            direccion: a.displayAddress,
            distancia_km: a.distanceKm ?? null,
            cambio_nombre_anterior: a.renameNotice?.previousName || null,
          })),
          alternativas_olva_courier:
            liveRes.olvaAlternatives.length > 0 ? liveRes.olvaAlternatives : searchRes.olvaAlternatives,
        },
      };
    }

    case 'verificar_cambios_shalom': {
      let syncReport: any = null;
      if (args.sincronizar_ahora === true) {
        syncReport = await ShalomSyncService.syncAgenciesAndPropagateOrders();
      }
      const changes = await ShalomMatcherService.getRecentAgencyChanges();
      return {
        output: {
          sincronizacion_ejecutada: syncReport,
          total_agencias_activas: changes.totalActive,
          renombradas_recientes_30d: changes.totalRenamedRecent30d,
          cerradas_recientes_30d: changes.totalClosedRecent30d,
          detalle_renombradas: changes.renamedAgencies.slice(0, 20),
          detalle_cerradas_recientes: changes.closedRecentAgencies.slice(0, 25),
        },
      };
    }

    case 'consultar_agencias_olva': {
      const q = String(args.busqueda || '').trim();
      const lim = Math.min(Math.max(Number(args.limite) || 8, 1), 15);
      const { data, error } = await supabaseAdmin
        .from('olva_agencies')
        .select('id, code, name, department, province, district, address, schedule, phone, is_active')
        .eq('is_active', true)
        .or(`name.ilike.%${q}%,district.ilike.%${q}%,province.ilike.%${q}%,department.ilike.%${q}%,address.ilike.%${q}%`)
        .limit(lim);
      if (error) return { output: { error: error.message } };
      return { output: { total: (data || []).length, agencias_olva: data || [] } };
    }

    case 'resumen_general_bd': {
      const [orders, usersCountRes, vouchersCountRes, shalomChanges] = await Promise.all([
        fetchAllScopedOrders(ctx.empresaId, 2500),
        supabaseAdmin.from('usuarios').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('comprobantes_pago').select('*', { count: 'exact', head: true }),
        ShalomMatcherService.getRecentAgencyChanges(),
      ]);

      const hoy = todayPeru();
      const activos = orders.filter(o => o.estado_envio !== 'entregado' && o.estado_envio !== 'cancelado');
      const entregados = orders.filter(o => o.estado_envio === 'entregado');
      const cancelados = orders.filter(o => o.estado_envio === 'cancelado');
      const deHoy = activos.filter(
        o => peruDay(o.created_at) === hoy || (o.fecha_limite && String(o.fecha_limite).slice(0, 10) === hoy)
      );

      const countBy = (arr: any[], fn: (x: any) => string) =>
        arr.reduce((acc: Record<string, number>, item) => {
          const k = fn(item) || 'sin_dato';
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {});

      return {
        output: {
          fecha_peru: hoy,
          pedidos_activos: activos.length,
          pedidos_programados_o_creados_hoy: deHoy.length,
          pedidos_entregados_hoy: entregados.filter(o => peruDay(o.updated_at) === hoy).length,
          desglose_activos_por_produccion: countBy(activos, o => o.estado_produccion),
          desglose_activos_por_envio: countBy(activos, o => o.estado_envio),
          desglose_activos_por_agencia: countBy(activos, o => o.metodo_envio_nombre),
          total_historico_pedidos: orders.length,
          total_entregados_historicos: entregados.length,
          total_cancelados: cancelados.length,
          total_clientes_registrados: usersCountRes.count || 0,
          total_comprobantes_pago: vouchersCountRes.count || 0,
          agencias_shalom_activas: shalomChanges.totalActive,
          agencias_shalom_renombradas_30d: shalomChanges.totalRenamedRecent30d,
          agencias_shalom_cerradas_30d: shalomChanges.totalClosedRecent30d,
        },
      };
    }

    case 'buscar_pedidos': {
      const orders = await fetchAllScopedOrders(ctx.empresaId, 2000);
      const users = await fetchUsersMap(orders.map(o => o.usuario_id));
      let list = orders;

      if (args.solo_activos) {
        list = list.filter(o => o.estado_envio !== 'entregado' && o.estado_envio !== 'cancelado');
      }
      if (args.estado_envio) list = list.filter(o => o.estado_envio === args.estado_envio);
      if (args.estado_produccion) list = list.filter(o => o.estado_produccion === args.estado_produccion);
      if (args.fecha) {
        const d = resolveDate(args.fecha);
        list = list.filter(
          o => peruDay(o.created_at) === d || (o.fecha_limite && String(o.fecha_limite).slice(0, 10) === d)
        );
      }
      if (args.agencia) {
        const ag = String(args.agencia).toLowerCase();
        list = list.filter(
          o =>
            String(o.metodo_envio_nombre || '').toLowerCase().includes(ag) ||
            String(o.metodo_envio_codigo || '').toLowerCase().includes(ag)
        );
      }
      if (args.buscar) {
        const t = String(args.buscar).toLowerCase().trim();
        list = list.filter(o => {
          const u = users.get(o.usuario_id);
          return [
            o.codigo_seguimiento,
            o.shalom_numero_guia,
            o.destino_detalle,
            o.detalles_bordado,
            o.observaciones_cliente,
            u?.nombre_completo,
            u?.dni,
            u?.dni_default,
            u?.telefono_default,
          ]
            .filter(Boolean)
            .some(v => String(v).toLowerCase().includes(t));
        });
      }

      const lim = Math.min(Math.max(Number(args.limite) || 20, 1), 50);
      return {
        output: {
          total_coincidencias: list.length,
          mostrando: Math.min(list.length, lim),
          pedidos: list.slice(0, lim).map(o => formatOrderCompact(o, users)),
        },
      };
    }

    case 'ver_detalle_pedido': {
      const ref = String(args.referencia || '').trim().toLowerCase();
      const orders = await fetchAllScopedOrders(ctx.empresaId, 2000);
      const found =
        orders.find(
          o =>
            String(o.codigo_seguimiento || '').toLowerCase() === ref ||
            String(o.id || '').toLowerCase() === ref ||
            String(o.shalom_numero_guia || '').toLowerCase() === ref
        ) ||
        orders.find(
          o =>
            String(o.codigo_seguimiento || '').toLowerCase().includes(ref) ||
            String(o.shalom_numero_guia || '').toLowerCase().includes(ref)
        );

      if (!found) {
        return { output: { error: `No encontré ningún pedido con referencia "${args.referencia}".` } };
      }

      const [users, vouchersRes] = await Promise.all([
        fetchUsersMap([found.usuario_id]),
        supabaseAdmin.from('comprobantes_pago').select('*').eq('pedido_id', found.id).limit(5),
      ]);

      return {
        output: {
          pedido: formatOrderCompact(found, users),
          usuario: users.get(found.usuario_id) || null,
          comprobantes_pago: vouchersRes.data || [],
        },
      };
    }

    case 'registrar_pedido': {
      const res = await ctx.registerOrderCallback(args);
      if (res.sentDirectly) {
        return {
          output: { enviado_directamente_al_usuario: true, resumen: res.message },
          sentDirectMessage: res.message,
        };
      }
      return { output: { resultado: res.message } };
    }

    case 'actualizar_pedido': {
      const ref = String(args.referencia || '').trim().toLowerCase();
      const orders = await fetchAllScopedOrders(ctx.empresaId, 2000);
      const users = await fetchUsersMap(orders.map(o => o.usuario_id));
      const target =
        orders.find(
          o =>
            String(o.codigo_seguimiento || '').toLowerCase() === ref ||
            String(o.id || '').toLowerCase() === ref
        ) ||
        orders.find(o => {
          const u = users.get(o.usuario_id);
          return (
            String(o.codigo_seguimiento || '').toLowerCase().includes(ref) ||
            String(u?.dni || '').toLowerCase() === ref ||
            String(u?.dni_default || '').toLowerCase() === ref
          );
        });

      if (!target) {
        return { output: { error: `No encontré un pedido con referencia "${args.referencia}".` } };
      }

      const patch: Record<string, any> = { updated_at: new Date().toISOString() };
      let agencyNotice: string | null = null;

      if (args.estadoEnvio) {
        if (!ESTADO_ENVIO_VALIDOS.includes(args.estadoEnvio)) {
          return { output: { error: `estadoEnvio inválido. Valores permitidos: ${ESTADO_ENVIO_VALIDOS.join(', ')}` } };
        }
        patch.estado_envio = args.estadoEnvio;
      }
      if (args.estadoProduccion) {
        if (!ESTADO_PROD_VALIDOS.includes(args.estadoProduccion)) {
          return { output: { error: `estadoProduccion inválido. Valores permitidos: ${ESTADO_PROD_VALIDOS.join(', ')}` } };
        }
        patch.estado_produccion = args.estadoProduccion;
      }
      if (args.nuevoDestino) {
        const destStr = String(args.nuevoDestino).trim();
        const isShalomOrder =
          target.metodo_envio_codigo === 'shalom' && !/motorizado|delivery|domicilio/i.test(destStr);
        if (isShalomOrder) {
          const dniMatch = String(target.destino_detalle || '').match(/(?:DNI\/CE|DNI|CE)\s*Recojo:\s*([0-9A-Za-z]+)/i);
          const telMatch = String(target.destino_detalle || '').match(/Tel:\s*([0-9]{9})/i);
          const existingDni = dniMatch?.[1] || users.get(target.usuario_id)?.dni_default || '';
          const live = await ShalomMatcherService.resolveDestinationLive(destStr, existingDni);

          if (live.status === 'closed_or_disabled') {
            return {
              output: {
                error: 'AGENCIA_CERRADA_O_DESHABILITADA',
                mensaje: `No se actualizó el pedido porque la agencia "${live.closedMatch?.displayTitle}" está inactiva: ${live.closedMatch?.reason}.`,
                alternativas_activas_cercanas: live.nearestAlternatives.map(a => ({
                  codigo: a.code,
                  titulo: a.displayTitle,
                  direccion: a.displayAddress,
                  distancia_km: a.distanceKm ?? null,
                })),
              },
            };
          }
          if (live.status === 'not_found') {
            return {
              output: {
                error: 'AGENCIA_NO_EXISTE',
                mensaje: `No se actualizó porque Shalom no tiene sucursal activa en "${destStr}".`,
                alternativas_shalom: live.nearestAlternatives.map(a => ({ codigo: a.code, titulo: a.displayTitle, direccion: a.displayAddress })),
                alternativas_olva: live.olvaAlternatives,
              },
            };
          }
          if (live.status === 'ambiguous') {
            return {
              output: {
                error: 'AGENCIA_AMBIGUA',
                mensaje: `Hay varias agencias Shalom activas para "${destStr}". Pide al usuario elegir una exacta.`,
                opciones: live.matches.slice(0, 6).map(m => ({ codigo: m.code, titulo: m.displayTitle, direccion: m.displayAddress })),
              },
            };
          }

          let formatted = live.resolvedDestination;
          if (telMatch?.[1] && !formatted.includes(telMatch[1])) {
            formatted = formatted.replace(/(DNI\/CE Recojo:\s*[0-9A-Za-z]+)/i, `$1 • Tel: ${telMatch[1]}`);
          }
          patch.destino_detalle = formatted;
          if (live.renameNotice) {
            agencyNotice = `Aviso: esta agencia cambió de nombre recientemente (antes "${live.renameNotice.previousName}", ahora "${live.renameNotice.newName}").`;
          }
        } else {
          patch.destino_detalle = destStr;
        }
      }

      if (args.fechaEnvio) patch.fecha_limite = resolveDate(args.fechaEnvio);
      if (args.claveShalom) patch.shalom_clave_recojo = String(args.claveShalom).trim();
      if (args.guiaShalom) patch.shalom_numero_guia = String(args.guiaShalom).trim();
      if (args.notas !== undefined) patch.observaciones_cliente = String(args.notas);
      if (args.detallesBordado) patch.detalles_bordado = String(args.detallesBordado);

      if (Object.keys(patch).length <= 1) {
        return { output: { error: 'No indicaste ningún campo para actualizar.' } };
      }

      const { error } = await supabaseAdmin.from('pedidos').update(patch).eq('id', target.id);
      if (error) return { output: { error: error.message } };

      await ctx.recordBackupCallback('UPDATE_ORDER', { orderId: target.id, codigo: target.codigo_seguimiento, changes: patch });
      return {
        output: {
          actualizado: true,
          codigo: target.codigo_seguimiento,
          cambios: Object.keys(patch).filter(k => k !== 'updated_at'),
          destino_final: patch.destino_detalle || target.destino_detalle,
          aviso_agencia: agencyNotice,
        },
      };
    }

    case 'eliminar_pedido': {
      const ref = String(args.referencia || '').trim().toLowerCase();
      const orders = await fetchAllScopedOrders(ctx.empresaId, 2000);
      const target = orders.find(
        o => String(o.codigo_seguimiento || '').toLowerCase() === ref || String(o.id || '').toLowerCase() === ref
      );
      if (!target) return { output: { error: `No encontré pedido exacto "${args.referencia}".` } };
      if (args.confirmar !== true) {
        return {
          output: {
            vista_previa: true,
            codigo: target.codigo_seguimiento,
            destino: target.destino_detalle,
            aviso: 'NO se eliminó todavía. Pide confirmación explícita al usuario antes de llamar con confirmar=true.',
          },
        };
      }
      await supabaseAdmin.from('comprobantes_pago').delete().eq('pedido_id', target.id);
      const { error } = await supabaseAdmin.from('pedidos').delete().eq('id', target.id);
      if (error) return { output: { error: error.message } };
      await ctx.recordBackupCallback('DELETE_ORDER', { orderId: target.id, codigo: target.codigo_seguimiento });
      return { output: { eliminado: true, codigo: target.codigo_seguimiento } };
    }

    case 'buscar_clientes': {
      const lim = Math.min(Math.max(Number(args.limite) || 15, 1), 40);
      const q = String(args.buscar || '').trim();
      let query = supabaseAdmin
        .from('usuarios')
        .select('id, dni, nombre_completo, telefono_default, dni_default, direccion_default, created_at')
        .order('created_at', { ascending: false })
        .limit(lim);
      if (q) {
        query = query.or(`nombre_completo.ilike.%${q}%,dni.ilike.%${q}%,dni_default.ilike.%${q}%,telefono_default.ilike.%${q}%`);
      }
      const { data, error } = await query;
      if (error) return { output: { error: error.message } };
      return { output: { total: (data || []).length, clientes: data || [] } };
    }

    case 'actualizar_cliente': {
      const ref = String(args.cliente || '').trim();
      const { data } = await supabaseAdmin
        .from('usuarios')
        .select('id, dni, dni_default, nombre_completo, telefono_default')
        .or(`dni.eq.${ref},dni_default.eq.${ref},telefono_default.eq.${ref},nombre_completo.ilike.%${ref}%`)
        .limit(5);

      if (!data || data.length === 0) return { output: { error: `No encontré ningún cliente con "${ref}".` } };
      if (data.length > 1) {
        const exact = data.find(u => u.dni === ref || u.dni_default === ref || u.telefono_default === ref);
        if (!exact) {
          return { output: { error: 'Varios clientes coinciden, pide el DNI exacto.', coincidencias: data } };
        }
        data.splice(0, data.length, exact);
      }

      const target = data[0];
      const patch: Record<string, any> = {};
      if (args.nombre) patch.nombre_completo = String(args.nombre).trim();
      if (args.telefono) patch.telefono_default = String(args.telefono).replace(/\D/g, '').slice(-9);
      if (args.direccion) patch.direccion_default = String(args.direccion).trim();
      if (Object.keys(patch).length === 0) return { output: { error: 'No indicaste campos para actualizar.' } };

      const { error } = await supabaseAdmin.from('usuarios').update(patch).eq('id', target.id);
      if (error) return { output: { error: error.message } };
      return { output: { actualizado: true, cliente: target.nombre_completo, cambios: Object.keys(patch) } };
    }

    case 'consultar_comprobantes_pago': {
      const lim = Math.min(Math.max(Number(args.limite) || 15, 1), 30);
      const q = String(args.buscar || '').trim();
      let query = supabaseAdmin
        .from('comprobantes_pago')
        .select('id, pedido_id, whatsapp_sender, numero_operacion, monto, moneda, banco_emisor, titular_origen, fecha_pago, es_valido, estado_verificacion, created_at')
        .order('created_at', { ascending: false })
        .limit(lim);
      if (q) {
        query = query.or(`numero_operacion.ilike.%${q}%,banco_emisor.ilike.%${q}%,titular_origen.ilike.%${q}%,whatsapp_sender.ilike.%${q}%`);
      }
      const { data, error } = await query;
      if (error) return { output: { error: error.message } };
      return { output: { total: (data || []).length, comprobantes: data || [] } };
    }

    case 'consultar_mensajes_whatsapp': {
      const lim = Math.min(Math.max(Number(args.limite) || 15, 1), 30);
      const q = String(args.buscar || '').trim();
      let query = supabaseAdmin
        .from('whatsapp_mensajes_log')
        .select('remote_jid, push_name, tipo_mensaje, contenido_texto, tipo_procesamiento, created_at')
        .order('created_at', { ascending: false })
        .limit(lim);
      if (q) {
        query = query.or(`push_name.ilike.%${q}%,remote_jid.ilike.%${q}%,contenido_texto.ilike.%${q}%`);
      }
      const { data, error } = await query;
      if (error) return { output: { error: error.message } };
      return { output: { total: (data || []).length, mensajes: data || [] } };
    }

    case 'ver_y_configurar_taller': {
      const cfgId = ctx.empresaId === MASTER_EMPRESA ? 'config-main' : ctx.empresaId;
      const { data: row } = await supabaseAdmin.from('taller_config').select('*').eq('id', cfgId).maybeSingle();
      const { data: metodos } = await supabaseAdmin.from('metodos_envio').select('codigo, nombre, activo');

      if (args.actualizar === true && row) {
        const patch: Record<string, any> = {};
        if (args.hora_corte_envio_hoy && /^\d{2}:\d{2}$/.test(args.hora_corte_envio_hoy)) {
          patch.hora_corte_envio_hoy = args.hora_corte_envio_hoy;
        }
        if (typeof args.despacho_domingo_habilitado === 'boolean') {
          patch.despacho_domingo_habilitado = args.despacho_domingo_habilitado;
        }
        if (args.anuncio_publico_clientes !== undefined) {
          patch.anuncio_publico_clientes = String(args.anuncio_publico_clientes);
        }
        if (Object.keys(patch).length > 0) {
          const { error } = await supabaseAdmin.from('taller_config').update(patch).eq('id', cfgId);
          if (error) return { output: { error: error.message } };
          return { output: { actualizado: true, cambios: patch } };
        }
      }

      return {
        output: {
          taller: row
            ? {
                nombre_taller: row.nombre_taller,
                whatsapp_pedidos: row.whatsapp_pedidos,
                ciudad_origen: row.ciudad_origen,
                agencia_shalom_origen: row.agencia_shalom_origen,
                hora_corte_envio_hoy: row.hora_corte_envio_hoy,
                dias_despacho_activos: row.dias_despacho_activos,
                despacho_domingo_habilitado: row.despacho_domingo_habilitado,
                anuncio_publico_clientes: row.anuncio_publico_clientes,
              }
            : null,
          metodos_envio: metodos || [],
        },
      };
    }

    case 'enviar_whatsapp_a_clienta': {
      const msg = await ctx.sendWhatsAppToClientCallback({
        targetPhone: String(args.targetPhone || ''),
        customerName: args.customerName,
        text: String(args.text || ''),
        sendAttachedDoc: Boolean(args.sendAttachedDoc ?? ctx.hasAttachedMedia),
        mediaType: ctx.isImage ? 'image' : ctx.isDoc ? 'document' : 'image',
        fileName: ctx.attachedFileName,
      });
      return { output: { enviado: true, resumen: msg }, sentDirectMessage: msg };
    }

    default:
      return { output: { error: `Herramienta desconocida: ${name}` } };
  }
}

type ChatMsg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

async function callModelWithFallback(
  messages: ChatMsg[],
  withTools: boolean
): Promise<{ msg: OpenAI.Chat.Completions.ChatCompletionMessage; model: string; tokens: number }> {
  let lastErr: any = null;
  for (const model of MODELS) {
    try {
      const res = await aiClient.chat.completions.create(
        {
          model,
          messages,
          temperature: 0.2,
          ...(withTools ? { tools: TOOL_DEFS, tool_choice: 'auto' as const } : {}),
        },
        { timeout: 25000 }
      );
      const msg = res.choices?.[0]?.message;
      if (msg && (msg.content || msg.tool_calls?.length)) {
        return {
          msg,
          model,
          tokens: res.usage?.total_tokens || 600,
        };
      }
    } catch (e: any) {
      lastErr = e;
      console.warn(`[WHATSAPP AGENT] Modelo ${model} falló (${e?.status || e?.message}); probando siguiente...`);
    }
  }
  throw lastErr || new Error('Ningún modelo de IA respondió.');
}

/**
 * Motor Autónomo de WhatsApp con acceso total EN VIVO a PostgreSQL (agencias Shalom/Olva,
 * pedidos históricos y activos, clientes, pagos, historial WhatsApp, configuración y envíos).
 */
export async function runWhatsAppAutonomousAgent(
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ctx: WhatsAppAgentContext
): Promise<WhatsAppAgentRunResult> {
  const now = peruNow();
  const peruDateTime = `${now.toISOString().slice(0, 10)} ${now.toISOString().slice(11, 16)} PET`;

  const mediaNote = ctx.hasAttachedMedia
    ? `\nARCHIVO ADJUNTO EN ESTE MENSAJE (${ctx.isImage ? 'IMAGEN' : 'DOCUMENTO'}: ${ctx.attachedFileName}):\n` +
      `- Nombre detectado OCR: ${ctx.extractedClientInfo?.nombre || 'No detectado'}\n` +
      `- Teléfono detectado OCR: ${ctx.extractedClientInfo?.telefono || 'No detectado'}\n` +
      `- DNI detectado OCR: ${ctx.extractedClientInfo?.dni || 'No detectado'}\n` +
      `- Guía/Tracking OCR: ${ctx.extractedClientInfo?.guia || 'No detectado'}\n` +
      `- Detalle OCR: ${ctx.extractedClientInfo?.descripcion || 'No detectado'}\n`
    : '';

  const systemPrompt = `Eres el *Copiloto Autónomo de Encomi WhatsApp* para la empresa "${ctx.empresaNombre}".
Hablas directamente con el dueño/administrador por WhatsApp. Tienes **ACCESO TOTAL EN VIVO** a la base de datos real mediante tus herramientas:
- Agencias Shalom (504+ activas, renombradas, cerradas/deshabilitadas, SOLO ENVÍOS, próximas sedes y cercanía GPS)
- Agencias Olva Courier (como alternativa cuando Shalom no cubre una localidad)
- Todos los pedidos (activos e históricos), clientes, comprobantes de pago, mensajes recientes de WhatsApp y configuración del taller
- Acciones reales: registrar pedidos (con validación en vivo), actualizar/eliminar pedidos, editar clientes, sincronizar Shalom y enviar archivos/mensajes por WhatsApp a clientas.

Fecha y hora actual en Perú: ${peruDateTime}.
Línea Sub-QR vinculada: +${ctx.userSenderPhone} (${ctx.userSenderInstance}).${mediaNote}

REGLAS CRÍTICAS DE AUTONOMÍA Y PRECISIÓN:
1. **NUNCA inventes datos, cifras ni existencia de sucursales.** Siempre consulta tus herramientas antes de responder sobre agencias, pedidos, clientes, pagos o métricas.
2. **VALIDACIÓN INTELIGENTE DE AGENCIAS SHALOM:**
   - Si preguntan si hay Shalom en un lugar o quieren registrar/cambiar un pedido a una agencia: usa \`consultar_agencias_shalom\` o \`registrar_pedido\`.
   - Si la sede **NO EXISTE** (Shalom no tiene sucursal allí): dilo con total claridad ("⚠️ Shalom no tiene sucursal en..."), ofrece las **sedes Shalom activas más cercanas** (con dirección y distancia si está disponible) y menciona si **Olva Courier** sí cubre esa zona.
   - Si la sede está **CERRADA / DESHABILITADA / SOLO ENVÍOS / (POR DEFINIR)**: explica el motivo exacto, NO permitas registrarla ahí y propón de inmediato las **sedes activas más cercanas**.
   - Si la sede **CAMBIÓ DE NOMBRE recientemente**: avísalo explícitamente mostrando **Nombre anterior → Nombre oficial actual** y su dirección vigente.
3. **REGISTRO DE PEDIDOS:** Solo requiere 4 datos obligatorios (Nombre completo, DNI/CE 8+ dígitos, Teléfono 9 dígitos, Destino). Cuando los tengas completos, llama inmediatamente a \`registrar_pedido\`. Si falta alguno, pídelo en 1 frase corta.
4. **ACTUALIZACIONES Y ELIMINACIONES:** Puedes actualizar estados, destinos (validados en vivo), fechas, guías, claves y datos de clientes de forma autónoma. Para eliminar un pedido, pide confirmación primero.
5. **FORMATO WHATSAPP:** Español peruano, claro, directo, amable y escaneable en celular. Usa *negritas*, viñetas cortas y emojis moderados (📦 ✅ ⚠️ 🔄 📍 🚚). No repitas comprobantes si \`registrar_pedido\` o \`enviar_whatsapp_a_clienta\` ya envió el mensaje directo al usuario.
6. **SEGURIDAD:** Nunca reveles contraseñas ni claves privadas de la cuenta.`;

  const messages: ChatMsg[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map(h => ({ role: h.role, content: String(h.content || '').slice(0, 2500) } as ChatMsg)),
    { role: 'user', content: userMessage.slice(0, 4000) },
  ];

  let totalTokens = 0;
  let usedModel = MODELS[0];
  let directMessageSent: string | null = null;

  for (let step = 0; step < 6; step++) {
    const { msg, model, tokens } = await callModelWithFallback(messages, true);
    usedModel = model;
    totalTokens += tokens;

    const calls = msg.tool_calls || [];
    if (calls.length === 0) {
      return {
        reply: (msg.content || '').trim() || 'Listo ✅',
        alreadySentDirectMessage: Boolean(directMessageSent),
        tokensUsed: totalTokens,
        model: usedModel,
      };
    }

    messages.push({ role: 'assistant', content: msg.content || '', tool_calls: calls });

    for (const call of calls) {
      if (call.type !== 'function') continue;
      let parsedArgs: any = {};
      try {
        parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        parsedArgs = {};
      }

      try {
        const res = await executeTool(call.function.name, parsedArgs, ctx);
        if (res.sentDirectMessage) {
          directMessageSent = res.sentDirectMessage;
          // Si registrar_pedido o enviar_whatsapp ya envió el comprobante/alerta formateado por WhatsApp, devolver directo sin duplicar mensajes
          return {
            reply: res.sentDirectMessage,
            alreadySentDirectMessage: true,
            tokensUsed: totalTokens,
            model: usedModel,
          };
        }
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(res.output).slice(0, 14000),
        });
      } catch (err: any) {
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ error: err?.message || 'Error ejecutando herramienta' }),
        });
      }
    }
  }

  // Cierre limpio si alcanzó el máximo de pasos
  messages.push({ role: 'user', content: 'Resume de forma clara y concisa para WhatsApp el resultado de tus consultas.' });
  const final = await callModelWithFallback(messages, false);
  totalTokens += final.tokens;
  return {
    reply: (final.msg.content || '').trim() || 'Listo ✅',
    alreadySentDirectMessage: Boolean(directMessageSent),
    tokensUsed: totalTokens,
    model: final.model,
  };
}
