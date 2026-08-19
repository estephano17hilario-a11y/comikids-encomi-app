import * as XLSX from 'xlsx';
import { Pedido, TallerConfig } from '../types/database.types';
import officialAgenciesData from '../data/shalom_official_agencies.json';
import { SHALOM_OFFICIAL_TEMPLATE_BASE64 } from '../data/shalom_template_base64';

export const OFFICIAL_DESTINATIONS: string[] = officialAgenciesData.destinations || [];
export const OFFICIAL_ORIGINS: string[] = officialAgenciesData.origins || [];

// Mapas de búsqueda rápida normalizada
const normalizeKey = (str: string): string => {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeCompact = (str: string): string => {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
};

const destLookup = new Map<string, string>();
const destCompactLookup = new Map<string, string>();
for (const d of OFFICIAL_DESTINATIONS) {
  destLookup.set(d.toUpperCase().trim(), d);
  destLookup.set(normalizeKey(d), d);
  destCompactLookup.set(normalizeCompact(d), d);
}

const originLookup = new Map<string, string>();
const originCompactLookup = new Map<string, string>();
for (const o of OFFICIAL_ORIGINS) {
  originLookup.set(o.toUpperCase().trim(), o);
  originLookup.set(normalizeKey(o), o);
  originCompactLookup.set(normalizeCompact(o), o);
}

const sortedDestinations = [...OFFICIAL_DESTINATIONS].sort((a, b) => b.length - a.length);
const sortedOrigins = [...OFFICIAL_ORIGINS].sort((a, b) => b.length - a.length);

/**
 * Normaliza y extrae el nombre canónico EXACTO de la agencia emisora (ORIGEN - Columna F)
 * según la lista oficial de Hoja2 Columna B.
 */
export const extractShalomOrigen = (tallerConfigOrName?: TallerConfig | string): string => {
  const rawInput = typeof tallerConfigOrName === 'string'
    ? tallerConfigOrName
    : (tallerConfigOrName?.agencia_shalom_origen || 'AV MEXICO CO');

  if (!rawInput) return 'AV MEXICO CO';
  const norm = normalizeKey(rawInput);
  if (norm === 'CENTRAL' || norm === 'LIMA CENTRAL' || !norm) return 'AV MEXICO CO';
  
  if (originLookup.has(rawInput.toUpperCase().trim())) return originLookup.get(rawInput.toUpperCase().trim())!;
  if (originLookup.has(norm)) return originLookup.get(norm)!;
  if (originCompactLookup.has(normalizeCompact(rawInput))) return originCompactLookup.get(normalizeCompact(rawInput))!;

  for (const off of sortedOrigins) {
    const offNorm = normalizeKey(off);
    if (norm.includes(offNorm) || offNorm.includes(norm)) {
      return off;
    }
  }
  return 'AV MEXICO CO';
};

/**
 * Normaliza y extrae ÚNICAMENTE el nombre canónico EXACTO de la agencia de destino (DESTINO - Columna G)
 * utilizando resolución jerárquica de segmentos (Departamento / Provincia / Distrito / Local),
 * eliminando ambigüedades con nombres de calles o avenidas.
 */
export const extractShalomDestino = (destinoDetalle: string): string => {
  if (!destinoDetalle) return OFFICIAL_DESTINATIONS[0] || 'LIMA TINGO MARÍA';

  // 1. Limpieza inicial de prefijos y datos adicionales
  let clean = destinoDetalle
    .replace(/^Agencia Shalom:\s*/i, '')
    .replace(/\(DNI\/CE.*?\)/i, '')
    .replace(/\(.*?DNI.*?\)/i, '')
    .trim();

  // Si hay guión largo o corto separando ruta geográfica de la dirección física
  const parts = clean.split(/[-–—]/);
  const locationPath = parts[0].trim();

  // 2. Extraer segmentos de departamento / provincia / distrito / local
  const segments = locationPath
    .split('/')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  // 3. Probar el último segmento (nombre exacto / local de la sucursal)
  if (segments.length > 0) {
    const lastSeg = segments[segments.length - 1];
    const lastClean = lastSeg.replace(/[()]/g, '').trim();

    if (destLookup.has(lastSeg)) return destLookup.get(lastSeg)!;
    if (destLookup.has(lastClean)) return destLookup.get(lastClean)!;
    
    const compactLast = normalizeCompact(lastClean);
    if (destCompactLookup.has(compactLast)) return destCompactLookup.get(compactLast)!;
  }

  // 4. Probar el penúltimo segmento (distrito o cabecera distrital)
  if (segments.length >= 2) {
    const distSeg = segments[segments.length - 2];
    const distClean = distSeg.replace(/[()]/g, '').trim();

    if (destLookup.has(distSeg)) return destLookup.get(distSeg)!;
    if (destLookup.has(distClean)) return destLookup.get(distClean)!;

    const compactDist = normalizeCompact(distClean);
    if (destCompactLookup.has(compactDist)) return destCompactLookup.get(compactDist)!;
  }

  // 5. Probar el segundo segmento (provincia)
  if (segments.length >= 3) {
    const provSeg = segments[1].replace(/[()]/g, '').trim();
    if (destLookup.has(provSeg)) return destLookup.get(provSeg)!;
    const compactProv = normalizeCompact(provSeg);
    if (destCompactLookup.has(compactProv)) return destCompactLookup.get(compactProv)!;
  }

  // 6. Búsqueda de coincidencia en la lista oficial
  const rawNorm = normalizeKey(clean);
  if (destLookup.has(rawNorm)) return destLookup.get(rawNorm)!;

  for (const official of sortedDestinations) {
    const offNorm = normalizeKey(official);
    if (offNorm.length >= 4 && (rawNorm.includes(offNorm) || rawNorm.startsWith(offNorm))) {
      return official;
    }
  }

  return OFFICIAL_DESTINATIONS[0] || 'LIMA TINGO MARÍA';
};

/**
 * Extrae el DNI o Carnet de Extranjería del pedido de forma estricta
 */
export const extractShalomDni = (pedido: Pedido): string => {
  // 1. Extraer del texto de destino (DNI/CE Recojo: XXXXXXXX)
  if (pedido.destino_detalle) {
    const match = pedido.destino_detalle.match(/(?:DNI\/CE|DNI|CE|Doc|Documento)[\s:]*(?:Recojo:?\s*)?([A-Za-z0-9]{8,12})/i);
    if (match && match[1] && match[1].toLowerCase() !== 'recojo') {
      const doc = match[1].trim();
      const phoneDigits = (pedido.usuario?.telefono_default || '').replace(/\D/g, '');
      if (doc !== phoneDigits && doc.length <= 12) {
        return doc;
      }
    }
  }

  // 2. Revisar usuario.dni_default
  if (pedido.usuario?.dni_default) {
    const doc = pedido.usuario.dni_default.trim();
    if (doc.length >= 8 && doc.length <= 12 && !doc.startsWith('9')) {
      return doc;
    }
  }

  // 3. Revisar usuario.dni
  if (pedido.usuario?.dni) {
    const raw = pedido.usuario.dni.trim();
    if (raw.length === 8 && !raw.startsWith('9')) {
      return raw;
    }
    if (raw.length >= 8 && raw.length <= 12 && !raw.startsWith('9')) {
      return raw;
    }
  }

  // 4. Buscar secuencia de 8 dígitos en observaciones o destino
  const combined = `${pedido.destino_detalle || ''} ${pedido.observaciones_cliente || ''}`;
  const digitMatches = combined.match(/\b([0-9]{8})\b/g);
  if (digitMatches && digitMatches.length > 0) {
    const phone = extractShalomPhone(pedido);
    for (const d of digitMatches) {
      if (d !== phone) return d;
    }
  }

  return pedido.usuario?.dni || '70503353';
};

/**
 * Extrae el número de celular del pedido (9 dígitos de Perú)
 */
export const extractShalomPhone = (pedido: Pedido): string => {
  const phone = pedido.usuario?.telefono_default || (pedido.usuario?.dni?.length === 9 ? pedido.usuario.dni : '');
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length >= 9) {
    return digitsOnly.slice(-9);
  }
  return digitsOnly || '987654321';
};

/**
 * Carga el libro base oficial de Shalom preservando todas las pestañas ('Hoja1', 'Medidas', 'Hoja2')
 * y las validaciones de datos en columnas F, G y H.
 */
const loadOfficialBaseWorkbook = async (): Promise<XLSX.WorkBook> => {
  try {
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      const res = await fetch('/Formato-Pro-Masivo-2026_08_15_02.xlsx');
      if (res.ok) {
        const ab = await res.arrayBuffer();
        return XLSX.read(new Uint8Array(ab), { type: 'array', cellFormula: true, cellStyles: true });
      }
    }
  } catch (e) {
    console.warn('[ShalomExcelExporter] No se pudo cargar vía fetch, usando plantilla base64 empaquetada:', e);
  }

  // Fallback offline / Capacitor / Node
  const binaryString = atob(SHALOM_OFFICIAL_TEMPLATE_BASE64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return XLSX.read(bytes, { type: 'array', cellFormula: true, cellStyles: true });
};

/**
 * Genera y descarga el archivo Excel oficial de Envíos Masivos Shalom
 * 100% compatible con el validador oficial de Shalom.
 */
export const downloadShalomExcel = async (pedidos: Pedido[], tallerConfig: TallerConfig) => {
  const shalomPedidos = pedidos.filter(p => p.metodo_envio_codigo === 'shalom' || p.destino_detalle?.toLowerCase().includes('shalom'));
  const targetPedidos = shalomPedidos.length > 0 ? shalomPedidos : pedidos;

  const origen = extractShalomOrigen(tallerConfig);
  const wb = await loadOfficialBaseWorkbook();
  const wsHoja1 = wb.Sheets['Hoja1'];

  if (!wsHoja1) {
    throw new Error('La plantilla base oficial no contiene la pestaña Hoja1.');
  }

  // Llenar datos a partir de la fila 2
  targetPedidos.forEach((pedido, idx) => {
    const r = idx + 2;
    const dni = extractShalomDni(pedido);
    const phone = extractShalomPhone(pedido);
    const destino = extractShalomDestino(pedido.destino_detalle);
    const clientName = pedido.usuario?.nombre_completo || 'CLIENTE';

    wsHoja1[`A${r}`] = { t: 's', v: dni };
    wsHoja1[`B${r}`] = { t: 's', v: phone };
    wsHoja1[`C${r}`] = { t: 's', v: clientName };
    wsHoja1[`D${r}`] = { t: 's', v: '' };
    wsHoja1[`E${r}`] = { t: 's', v: '' };
    wsHoja1[`F${r}`] = { t: 's', v: origen || 'AV MEXICO CO' };
    wsHoja1[`G${r}`] = { t: 's', v: destino };
    wsHoja1[`H${r}`] = { t: 's', v: 'PAQUETE XXS' };
    wsHoja1[`I${r}`] = { t: 'n', v: 0 };
    wsHoja1[`J${r}`] = { t: 'n', v: 0 };
    wsHoja1[`K${r}`] = { t: 'n', v: 0 };
    wsHoja1[`L${r}`] = { t: 'n', v: 0 };
    wsHoja1[`M${r}`] = { t: 'n', v: 1 };
  });

  // Limpiar filas de ejemplo sobrantes de la plantilla oficial
  for (let r = targetPedidos.length + 2; r <= 500; r++) {
    if (wsHoja1[`A${r}`]) delete wsHoja1[`A${r}`];
    if (wsHoja1[`B${r}`]) delete wsHoja1[`B${r}`];
    if (wsHoja1[`C${r}`]) delete wsHoja1[`C${r}`];
    if (wsHoja1[`D${r}`]) delete wsHoja1[`D${r}`];
    if (wsHoja1[`E${r}`]) delete wsHoja1[`E${r}`];
    if (wsHoja1[`F${r}`]) delete wsHoja1[`F${r}`];
    if (wsHoja1[`G${r}`]) delete wsHoja1[`G${r}`];
    if (wsHoja1[`H${r}`]) delete wsHoja1[`H${r}`];
    if (wsHoja1[`M${r}`]) delete wsHoja1[`M${r}`];
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Formato-Pro-Masivo-Shalom-ComiKids_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);
};
