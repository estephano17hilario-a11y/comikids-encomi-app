import { MetodoEnvio } from '../types/database.types';

export const SYSTEM_CUSTOM_FIELD_KEYS = new Set([
  'c-shalom-dni',
  'c-shalom-tel',
  'c-shalom-celular',
  'c-shalom-nombre',
  'c-shalom-ref',
  'c-mot-dni',
  'c-mot-tel',
  'c-mot-celular',
  'c-mot-nombre',
  'c-mot-direccion',
  'c-mot-dir',
  'c-mot-ref',
  'c-olva-dni',
  'c-olva-tel',
  'c-olva-celular',
  'c-olva-nombre',
  'c-olva-dir',
  'c-olva-ref',
  'cliente_nombre',
  'cliente_dni',
  'cliente_telefono',
  'cliente_celular',
  'nombre_cliente',
  'dni_cliente',
  'telefono_cliente',
  'nombre',
  'dni',
  'telefono',
  'celular',
  'direccion',
  'referencia',
  'observaciones',
  'fecha_entrega',
  'fecha_envio',
]);

export interface CustomFieldContext {
  dni?: string | null;
  phone?: string | null;
  name?: string | null;
  destination?: string | null;
}

/**
 * Determina si una clave/valor de campos_personalizados es de sistema,
 * redundante con los datos nativos del cliente, o vacía.
 */
export function isIgnoredCustomField(
  key: string,
  val?: any,
  context?: CustomFieldContext
): boolean {
  if (val === undefined || val === null) return true;
  const strVal = String(val).trim();
  if (strVal === '') return true;

  const lowerKey = key.toLowerCase().trim();
  if (SYSTEM_CUSTOM_FIELD_KEYS.has(lowerKey)) return true;

  // Regex para prefijos de sistema conocidos
  if (/^c-(shalom|mot|olva)-(dni|tel|celular|nombre|dir|direccion|ref)$/i.test(lowerKey)) return true;
  if (/^cliente_(nombre|dni|tel|telefono|celular|direccion)$/i.test(lowerKey)) return true;

  // Si el valor coincide exactamente con DNI, teléfono o nombre del cliente
  if (context) {
    if (context.dni && strVal === String(context.dni).trim()) return true;
    if (context.phone) {
      const cleanVal = strVal.replace(/\D/g, '');
      const cleanCtxPhone = String(context.phone).replace(/\D/g, '');
      if (cleanVal.length >= 7 && cleanCtxPhone.length >= 7 && (cleanVal.endsWith(cleanCtxPhone) || cleanCtxPhone.endsWith(cleanVal))) {
        return true;
      }
    }
    if (context.name && strVal.toLowerCase() === String(context.name).trim().toLowerCase()) return true;
    if (context.destination && strVal.toLowerCase() === String(context.destination).trim().toLowerCase()) return true;
  }

  return false;
}

/**
 * Obtiene la etiqueta legible para un campo personalizado (ej: 'c-mot-tiktok' -> 'TikTok')
 */
export function getFriendlyCustomFieldLabel(
  key: string,
  method?: MetodoEnvio | null
): string {
  if (method?.campos_personalizados) {
    const configured = method.campos_personalizados.find(
      c => c.id === key || c.label === key || c.id.toLowerCase() === key.toLowerCase()
    );
    if (configured?.label) {
      return configured.label;
    }
  }

  const lower = key.toLowerCase().trim();
  if (lower === 'c-mot-tiktok' || lower === 'tiktok') return 'TikTok';
  if (lower === 'c-shalom-dni' || lower === 'c-olva-dni') return 'DNI de Recojo';

  // Quitar prefijos técnicos c-xxx- si quedase alguno
  const cleaned = key.replace(/^c-[a-z]+-/i, '').replace(/_/g, ' ').trim();
  if (!cleaned) return key;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export interface VisibleCustomField {
  key: string;
  label: string;
  value: string;
}

/**
 * Filtra los campos personalizados de un pedido dejando solo los reales adicionales
 * con sus etiquetas amigables.
 */
export function getVisibleCustomFields(
  campos?: Record<string, any> | null,
  method?: MetodoEnvio | null,
  context?: CustomFieldContext
): VisibleCustomField[] {
  if (!campos || typeof campos !== 'object') return [];

  const results: VisibleCustomField[] = [];
  const configuredFields = method?.campos_personalizados || [];

  for (const [key, val] of Object.entries(campos)) {
    if (isIgnoredCustomField(key, val, context)) continue;

    // Si está configurado en el método pero marcado como campo de sistema
    const configured = configuredFields.find(c => c.id === key || c.label === key);
    if (configured?.sistema) continue;

    const label = getFriendlyCustomFieldLabel(key, method);
    results.push({
      key,
      label,
      value: String(val).trim(),
    });
  }

  return results;
}

/**
 * Limpia un objeto campos_personalizados eliminando claves de sistema/duplicadas
 */
export function cleanCustomFieldsRecord(
  campos?: Record<string, any> | null,
  context?: CustomFieldContext
): Record<string, any> {
  if (!campos || typeof campos !== 'object') return {};
  const cleaned: Record<string, any> = {};

  for (const [key, val] of Object.entries(campos)) {
    if (!isIgnoredCustomField(key, val, context)) {
      cleaned[key] = val;
    }
  }

  return cleaned;
}
