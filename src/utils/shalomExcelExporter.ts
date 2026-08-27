import * as XLSX from 'xlsx';
import { Pedido, TallerConfig } from '../types/database.types';
import officialAgenciesData from '../data/shalom_official_agencies.json';
import { SHALOM_OFFICIAL_TEMPLATE_BASE64 } from '../data/shalom_template_base64';
import {
  SHALOM_CODE_TO_OFFICIAL_MAP,
  SHALOM_NAME_TO_OFFICIAL_MAP,
  SHALOM_LOCAL_TO_OFFICIAL_MAP
} from '../data/shalomAgencyCanonicalMap';
import { SHALOM_AGENCIES } from '../data/shalomAgencies';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import {
  extractShalomDestino,
  OFFICIAL_DESTINATIONS,
  OFFICIAL_ORIGINS,
  normalizeTextKey as normalizeKey,
  normalizeCompactKey as normalizeCompact,
  resolveShalomAgencyDetails
} from './shalomAgencyResolver';

export { extractShalomDestino, OFFICIAL_DESTINATIONS, OFFICIAL_ORIGINS, resolveShalomAgencyDetails };

const originLookup = new Map<string, string>();
const originCompactLookup = new Map<string, string>();
for (const o of OFFICIAL_ORIGINS) {
  originLookup.set(o.toUpperCase().trim(), o);
  originLookup.set(normalizeKey(o), o);
  originCompactLookup.set(normalizeCompact(o), o);
}

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



export const extractShalomDni = (pedido: Pedido): string => {
  const SENDER_DOCS = new Set(['42020312', '20512528458', '20000000001', '00000000']);
  const phone = (extractShalomPhone(pedido) || '').replace(/\D/g, '');

  const isValidDoc = (doc: string): boolean => {
    if (!doc) return false;
    const clean = doc.trim();
    if (clean.startsWith('usr-') || SENDER_DOCS.has(clean)) return false;
    const digits = clean.replace(/\D/g, '');
    // Un celular de 9 dígitos que empieza con 9 NO es un DNI
    if (digits.length === 9 && digits.startsWith('9')) return false;
    if (digits === phone) return false;
    // DNI válido (8 dígitos), RUC (11 dígitos) o CE (6 a 12 caracteres alfanuméricos)
    if (digits.length === 8 || digits.length === 11) return true;
    if (clean.length >= 6 && clean.length <= 12) return true;
    return false;
  };

  // 1. Extraer desde destino_detalle explícito (ej: "DNI: 78005117", "(DNI 78005117)", "Doc: 78005117", "CE: 00123456")
  if (pedido.destino_detalle) {
    const match = pedido.destino_detalle.match(/(?:DNI[\s\/]*CE|DNI|CE|Doc|Documento|RUC)[\s:]*(?:Recojo:?\s*)?([A-Za-z0-9]{6,12})/i);
    if (match && match[1] && match[1].toLowerCase() !== 'recojo') {
      const doc = match[1].trim();
      if (isValidDoc(doc)) {
        return doc.replace(/\D/g, '') || doc;
      }
    }
  }

  // 2. Extraer desde usuario.dni_default
  if (pedido.usuario?.dni_default) {
    const doc = pedido.usuario.dni_default.trim();
    if (isValidDoc(doc)) {
      return doc.replace(/\D/g, '') || doc;
    }
  }

  // 3. Extraer desde usuario.dni
  if (pedido.usuario?.dni) {
    const raw = pedido.usuario.dni.trim();
    if (isValidDoc(raw)) {
      return raw.replace(/\D/g, '') || raw;
    }
  }

  // 4. Búsqueda de cualquier bloque de 8 dígitos en destino_detalle u observaciones
  const combined = `${pedido.destino_detalle || ''} ${pedido.observaciones_cliente || ''}`;
  const digitMatches = combined.match(/\b([0-9]{8})\b/g);
  if (digitMatches && digitMatches.length > 0) {
    for (const d of digitMatches) {
      if (isValidDoc(d)) return d;
    }
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
