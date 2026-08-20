import * as XLSX from 'xlsx';
import { Pedido, TallerConfig } from '../types/database.types';
import officialAgenciesData from '../data/shalom_official_agencies.json';
import { SHALOM_OFFICIAL_TEMPLATE_BASE64 } from '../data/shalom_template_base64';
import {
  SHALOM_CODE_TO_OFFICIAL_MAP,
  SHALOM_NAME_TO_OFFICIAL_MAP,
  SHALOM_LOCAL_TO_OFFICIAL_MAP
} from '../data/shalomAgencyCanonicalMap';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

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
 * utilizando el diccionario estático oficial de 544 agencias y resolución jerárquica de alta precisión.
 */
export const extractShalomDestino = (destinoDetalle: string, agencyCode?: string): string => {
  // 1. Si se proporciona código de agencia explícito (ej. CBT, SRA, AVGAL)
  if (agencyCode) {
    const codeClean = agencyCode.toUpperCase().trim();
    if (SHALOM_CODE_TO_OFFICIAL_MAP[codeClean]) {
      return SHALOM_CODE_TO_OFFICIAL_MAP[codeClean];
    }
  }

  if (!destinoDetalle) return 'LIMA AV TINGO MARÍA';

  // 2. Extraer código de agencia si viene embebido en el texto (ej: "(CÓDIGO: CBT)" o "(CODIGO: SRA)")
  const embeddedCodeMatch = destinoDetalle.match(/(?:CÓDIGO|CODIGO|COD)[\s:]*([A-Za-z0-9]+)/i);
  if (embeddedCodeMatch && embeddedCodeMatch[1]) {
    const extractedCode = embeddedCodeMatch[1].toUpperCase().trim();
    if (SHALOM_CODE_TO_OFFICIAL_MAP[extractedCode]) {
      return SHALOM_CODE_TO_OFFICIAL_MAP[extractedCode];
    }
  }

  // 3. Limpieza inicial de prefijos y metadatos
  let clean = destinoDetalle
    .replace(/^Agencia Shalom:\s*/i, '')
    .replace(/\(DNI\/CE.*?\)/i, '')
    .replace(/\(.*?DNI.*?\)/i, '')
    .replace(/\(.*?\)/g, '')
    .trim();

  // Si hay guión largo o corto separando ruta geográfica de la dirección física
  const parts = clean.split(/[-–—]/);
  const locationPath = parts[0].trim();
  const compactLocation = normalizeCompact(locationPath);

  // 4. Comprobar directamente en el mapa canónico oficial
  if (SHALOM_NAME_TO_OFFICIAL_MAP[locationPath.toUpperCase()]) {
    return SHALOM_NAME_TO_OFFICIAL_MAP[locationPath.toUpperCase()];
  }
  if (SHALOM_NAME_TO_OFFICIAL_MAP[compactLocation]) {
    return SHALOM_NAME_TO_OFFICIAL_MAP[compactLocation];
  }

  // 5. Extraer segmentos geográficos: [DEP, PROV, DIST, LOCAL]
  const segments = locationPath
    .split('/')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  const depSeg = segments[0] || '';
  const provSeg = segments.length >= 3 ? segments[1] : '';
  const distSeg = segments.length >= 4 ? segments[2] : (segments.length === 3 ? segments[1] : '');
  const lastSeg = segments.length > 0 ? segments[segments.length - 1] : '';
  const compactLast = normalizeCompact(lastSeg);

  // Prioridad 1: Coincidencia por Local en el mapa canónico
  if (lastSeg && SHALOM_LOCAL_TO_OFFICIAL_MAP[lastSeg]) {
    return SHALOM_LOCAL_TO_OFFICIAL_MAP[lastSeg];
  }
  if (compactLast && SHALOM_LOCAL_TO_OFFICIAL_MAP[compactLast]) {
    return SHALOM_LOCAL_TO_OFFICIAL_MAP[compactLast];
  }

  // Prioridad 2: Coincidencia de Departamento + Local
  const depLocalKey = normalizeCompact(`${depSeg} ${lastSeg}`);
  if (SHALOM_NAME_TO_OFFICIAL_MAP[depLocalKey]) {
    return SHALOM_NAME_TO_OFFICIAL_MAP[depLocalKey];
  }

  // Prioridad 3: Búsqueda ponderada filtrando por departamento para no cruzar regiones
  const rawTokens = clean
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !['AV', 'JR', 'CALLE', 'PASAJE', 'AUTOPISTA', 'CARRETERA', 'MZ', 'LT', 'NRO', 'NUM', 'REF', 'AGENCIA', 'SHALOM'].includes(t));

  const lastTokens = lastSeg
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !['AV', 'JR', 'CALLE', 'PASAJE', 'AUTOPISTA', 'CARRETERA', 'MZ', 'LT', 'NRO', 'NUM', 'REF', 'AGENCIA', 'SHALOM'].includes(t));

  let bestMatch = null;
  let bestScore = -1;

  for (const official of OFFICIAL_DESTINATIONS) {
    const offTokens = official
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1 && !['AV', 'JR', 'CALLE', 'PASAJE', 'AUTOPISTA', 'CARRETERA', 'MZ', 'LT', 'NRO', 'NUM', 'REF', 'AGENCIA', 'SHALOM'].includes(t));

    let score = 0;
    for (const tok of offTokens) {
      if (lastTokens.includes(tok)) {
        score += 20; // Gran peso si coincide con el local exacto
      } else if (rawTokens.includes(tok)) {
        score += 4; // Peso si coincide con provincia o distrito
      }
    }

    const extraTokens = offTokens.filter(t => !rawTokens.includes(t)).length;
    score -= extraTokens * 2;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = official;
    }
  }

  if (bestScore > 0 && bestMatch) {
    return bestMatch;
  }

  return 'LIMA AV TINGO MARÍA';
};


export const extractShalomDni = (pedido: Pedido): string => {
  if (pedido.destino_detalle) {
    const match = pedido.destino_detalle.match(/(?:DNI[\s\/]*CE|DNI|CE|Doc|Documento)[\s:]*(?:Recojo:?\s*)?([A-Za-z0-9]{6,12})/i);
    if (match && match[1] && match[1].toLowerCase() !== 'recojo') {
      const doc = match[1].trim();
      const phoneDigits = (pedido.usuario?.telefono_default || '').replace(/\D/g, '');
      if (doc !== phoneDigits && !doc.startsWith('usr-') && doc.length <= 12) {
        return doc;
      }
    }
  }

  if (pedido.usuario?.dni_default) {
    const doc = pedido.usuario.dni_default.trim();
    if (doc.length >= 6 && doc.length <= 12 && !doc.startsWith('usr-') && !doc.startsWith('9')) {
      return doc;
    }
  }

  if (pedido.usuario?.dni) {
    const raw = pedido.usuario.dni.trim();
    if (!raw.startsWith('usr-') && raw !== '00000000') {
      if (raw.length === 8 && !raw.startsWith('9')) {
        return raw;
      }
      if (raw.length >= 6 && raw.length <= 12) {
        return raw;
      }
    }
  }

  const combined = `${pedido.destino_detalle || ''} ${pedido.observaciones_cliente || ''}`;
  const digitMatches = combined.match(/\b([0-9]{8})\b/g);
  if (digitMatches && digitMatches.length > 0) {
    const phone = extractShalomPhone(pedido);
    for (const d of digitMatches) {
      if (d !== phone && !d.startsWith('usr-')) return d;
    }
  }

  const rawFallback = (pedido.usuario?.dni || pedido.usuario?.dni_default || '').trim();
  if (rawFallback && !rawFallback.startsWith('usr-') && rawFallback !== '00000000' && rawFallback.length >= 6) {
    return rawFallback;
  }

  return '';
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
 * Limpia todas las filas residuales, comprime el archivo a peso ligero (~150 KB)
 * y funciona al 100% en Web y en App Android (Capacitor).
 */
export const downloadShalomExcel = async (pedidos: Pedido[], tallerConfig: TallerConfig): Promise<void> => {
  const shalomPedidos = pedidos.filter(p => p.metodo_envio_codigo === 'shalom' || p.destino_detalle?.toLowerCase().includes('shalom'));
  const targetPedidos = shalomPedidos.length > 0 ? shalomPedidos : pedidos;

  const origen = extractShalomOrigen(tallerConfig);
  const wb = await loadOfficialBaseWorkbook();
  const wsHoja1 = wb.Sheets['Hoja1'];

  if (!wsHoja1) {
    throw new Error('La plantilla base oficial no contiene la pestaña Hoja1.');
  }

  // 1. Limpiar todas las celdas previas de Hoja1 excepto los encabezados (fila 1)
  // Esto elimina cualquier celda fantasma, fórmula vacía o residuo que inflaba el peso a 800 KB
  const allKeys = Object.keys(wsHoja1);
  for (const k of allKeys) {
    if (k.startsWith('!')) continue;
    const rowNum = parseInt(k.replace(/^[A-Z]+/, ''), 10);
    if (rowNum > 1) {
      delete wsHoja1[k];
    }
  }

  // 2. Llenar los datos de los pedidos seleccionados
  targetPedidos.forEach((pedido, idx) => {
    const r = idx + 2;
    const dni = extractShalomDni(pedido);
    const phone = extractShalomPhone(pedido);
    const destino = extractShalomDestino(pedido.destino_detalle);
    const clientName = (pedido.usuario?.nombre_completo || 'CLIENTE').toUpperCase().trim();

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

  // 3. Establecer el rango exacto de Hoja1 para que Excel no muestre 500 filas vacías
  wsHoja1['!ref'] = `A1:M${targetPedidos.length + 1}`;

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Formato-Pro-Masivo-Shalom-ComiKids_${dateStr}.xlsx`;

  if (Capacitor.isNativePlatform()) {
    // En App Android: Exportar base64 con compresión y compartir nativamente
    const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64', compression: true });
    const savedFile = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true
    });

    await Share.share({
      title: 'Formato Masivo Shalom',
      files: [savedFile.uri],
      dialogTitle: 'Guardar o Compartir Excel de Shalom'
    });
  } else {
    // En Navegador Web de PC
    XLSX.writeFile(wb, filename, { compression: true });
  }
};
