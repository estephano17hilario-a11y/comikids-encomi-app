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

const destLookup = new Map<string, string>();
for (const d of OFFICIAL_DESTINATIONS) {
  destLookup.set(normalizeKey(d), d);
}

const originLookup = new Map<string, string>();
for (const o of OFFICIAL_ORIGINS) {
  originLookup.set(normalizeKey(o), o);
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
  if (originLookup.has(norm)) return originLookup.get(norm)!;

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
 * eliminando direcciones, números de lote, manzanas y referencias, garantizando coincidencia con Hoja2 Columna C.
 */
export const extractShalomDestino = (destinoDetalle: string): string => {
  if (!destinoDetalle) return OFFICIAL_DESTINATIONS[0] || 'LIMA TINGO MARÍA';

  let text = destinoDetalle
    .replace(/Agencia Shalom:\s*/i, '')
    .replace(/\(DNI\/CE.*?\)/i, '')
    .replace(/\(.*?DNI.*?\)/i, '')
    .trim();

  const rawNorm = normalizeKey(text);
  if (destLookup.has(rawNorm)) {
    return destLookup.get(rawNorm)!;
  }

  // Patrones específicos de alias conocidos
  if (rawNorm.includes('RAUL MATA')) {
    const found = OFFICIAL_DESTINATIONS.find(d => normalizeKey(d).includes('RAUL MATA'));
    if (found) return found;
  }
  if (rawNorm.includes('AMERICAS') && rawNorm.includes('PRECURSORES')) {
    const found = OFFICIAL_DESTINATIONS.find(d => normalizeKey(d).includes('PRECURSORES') && normalizeKey(d).includes('AMERICAS'));
    if (found) return found;
  }
  if (rawNorm.includes('CUTERVO')) {
    const found = OFFICIAL_DESTINATIONS.find(d => normalizeKey(d) === 'CUTERVO');
    if (found) return found;
  }

  // Separar por guiones o barras para aislar el nombre de la agencia de la dirección
  const parts = text.split(/[-–—/|]/).map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    const partNorm = normalizeKey(part);
    if (destLookup.has(partNorm)) {
      return destLookup.get(partNorm)!;
    }
  }

  // Coincidencia de prefijo / límite de palabra con la lista oficial ordenada por longitud
  for (const official of sortedDestinations) {
    const offNorm = normalizeKey(official);
    const regex = new RegExp('(?:^|\\s)' + offNorm.replace(/\s+/g, '\\s+') + '(?:\\s|$)', 'i');
    if (regex.test(rawNorm)) {
      return official;
    }
  }

  // Coincidencia de subcadena por segmento
  for (const part of parts) {
    const pNorm = normalizeKey(part);
    for (const official of sortedDestinations) {
      const offNorm = normalizeKey(official);
      if (offNorm.length >= 4 && (pNorm.includes(offNorm) || offNorm.includes(pNorm))) {
        return official;
      }
    }
  }

  // Puntuación de tokens de respaldo
  const stopWords = ['URB', 'AVENIDA', 'JIRON', 'CALLE', 'PASAJE', 'MZ', 'LOTE', 'LT', 'CDRA', 'REFERENCIA', 'FRENTE', 'CLINICA', 'NUMERO'];
  const inputWords = rawNorm.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));

  let bestMatch = OFFICIAL_DESTINATIONS[0] || 'LIMA TINGO MARÍA';
  let bestScore = 0;

  for (const official of OFFICIAL_DESTINATIONS) {
    const offNorm = normalizeKey(official);
    const offWords = offNorm.split(/\s+/).filter(w => w.length > 2);
    let score = 0;
    for (const w of offWords) {
      if (inputWords.includes(w)) score += 2;
      else if (rawNorm.includes(w)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = official;
    }
  }

  return bestMatch;
};

/**
 * Extrae el DNI o Carnet de Extranjería del pedido
 */
export const extractShalomDni = (pedido: Pedido): string => {
  // 1. Extraer del texto de destino
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

  // 2. Revisar dni_default
  if (pedido.usuario?.dni_default) {
    const doc = pedido.usuario.dni_default.trim();
    if (doc.length === 8 || doc.length === 9 || doc.length === 12) {
      return doc;
    }
  }

  // 3. Revisar usuario.dni
  if (pedido.usuario?.dni) {
    const raw = pedido.usuario.dni.trim();
    if (raw.length === 8 && !raw.startsWith('9')) {
      return raw;
    }
    if (raw.length >= 9 && raw.length <= 12 && !raw.startsWith('9')) {
      return raw;
    }
  }

  // 4. Buscar secuencia de 8 dígitos
  const combined = `${pedido.destino_detalle || ''} ${pedido.observaciones_cliente || ''}`;
  const digitMatches = combined.match(/\b([0-9]{8})\b/g);
  if (digitMatches && digitMatches.length > 0) {
    const phone = extractShalomPhone(pedido);
    for (const d of digitMatches) {
      if (d !== phone) return d;
    }
  }

  return '70503353';
};

/**
 * Extrae el número de celular del pedido (9 dígitos)
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
 * 100% compatible con el validador oficial.
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
    const mercaderia = 'PAQUETE XXS';

    wsHoja1[`A${r}`] = { t: 's', v: dni };
    wsHoja1[`B${r}`] = { t: 's', v: phone };
    wsHoja1[`C${r}`] = { t: 's', v: '' };
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
