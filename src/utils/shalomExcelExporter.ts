import * as XLSX from 'xlsx';
import { Pedido, TallerConfig } from '../types/database.types';
import shalomAgenciesFull from '../../data/shalom_agencies_full.json';

// Medidas con valor 0 para no especificar (Requerimiento explícito del usuario)
export const SHALOM_MEDIDAS_TABLE = [
  { MERCADERIA: 'PAQUETE XXS', ALTO: 0, ANCHO: 0, LARGO: 0, PESO: 0 },
  { MERCADERIA: 'PAQUETE XS', ALTO: 0, ANCHO: 0, LARGO: 0, PESO: 0 },
  { MERCADERIA: 'PAQUETE S', ALTO: 0, ANCHO: 0, LARGO: 0, PESO: 0 },
  { MERCADERIA: 'PAQUETE M', ALTO: 0, ANCHO: 0, LARGO: 0, PESO: 0 },
  { MERCADERIA: 'PAQUETE L', ALTO: 0, ANCHO: 0, LARGO: 0, PESO: 0 },
  { MERCADERIA: 'PAQUETE XL', ALTO: 0, ANCHO: 0, LARGO: 0, PESO: 0 },
  { MERCADERIA: 'PAQUETE XXL', ALTO: 0, ANCHO: 0, LARGO: 0, PESO: 0 },
  { MERCADERIA: 'SOBRE', ALTO: 0, ANCHO: 0, LARGO: 0, PESO: 0 },
  { MERCADERIA: 'CAJA', ALTO: 0, ANCHO: 0, LARGO: 0, PESO: 0 },
  { MERCADERIA: 'VALIJA', ALTO: 0, ANCHO: 0, LARGO: 0, PESO: 0 },
  { MERCADERIA: 'SACO', ALTO: 0, ANCHO: 0, LARGO: 0, PESO: 0 },
];

export const extractShalomDni = (pedido: Pedido): string => {
  // 1. Extraer del texto de destino e.g. "DNI/CE Recojo: 74561234" o "(DNI/CE: 74561234)"
  if (pedido.destino_detalle) {
    const match = pedido.destino_detalle.match(/(?:DNI\/CE|DNI|CE|Doc|Documento)[\s:]*(?:Recojo:?\s*)?([A-Za-z0-9]{8,12})/i);
    if (match && match[1] && match[1].toLowerCase() !== 'recojo') {
      const doc = match[1].trim();
      const phoneDigits = (pedido.usuario?.telefono_default || '').replace(/\D/g, '');
      // Si no es exactamente igual al celular de 9 dígitos
      if (doc !== phoneDigits && doc.length <= 12) {
        return doc;
      }
    }
  }

  // 2. Revisar dni_default del usuario (si tiene 8 dígitos o CE)
  if (pedido.usuario?.dni_default) {
    const doc = pedido.usuario.dni_default.trim();
    if (doc.length === 8 || doc.length === 9 || doc.length === 12) {
      return doc;
    }
  }

  // 3. Revisar usuario.dni (SOLO si es un DNI nacional de 8 dígitos y NO es un celular de 9 dígitos)
  if (pedido.usuario?.dni) {
    const raw = pedido.usuario.dni.trim();
    if (raw.length === 8 && !raw.startsWith('9')) {
      return raw;
    }
    // Si es Carnet de Extranjería (CE de 9 o 12 dígitos alfanuméricos)
    if (raw.length >= 9 && raw.length <= 12 && !raw.startsWith('9')) {
      return raw;
    }
  }

  // 4. Buscar cualquier secuencia de 8 dígitos en destino u observaciones que no sea el teléfono
  const combined = `${pedido.destino_detalle || ''} ${pedido.observaciones_cliente || ''}`;
  const digitMatches = combined.match(/\b([0-9]{8})\b/g);
  if (digitMatches && digitMatches.length > 0) {
    const phone = extractShalomPhone(pedido);
    for (const d of digitMatches) {
      if (d !== phone) return d;
    }
  }

  // 5. Retornar DNI por defecto válido si el usuario solo se registró con teléfono
  return '70503353';
};

export const extractShalomPhone = (pedido: Pedido): string => {
  const phone = pedido.usuario?.telefono_default || (pedido.usuario?.dni?.length === 9 ? pedido.usuario.dni : '');
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length >= 9) {
    return digitsOnly.slice(-9);
  }
  return digitsOnly;
};

export const extractShalomDestino = (destinoDetalle: string): string => {
  if (!destinoDetalle) return 'LIMA';
  let clean = destinoDetalle.replace(/Agencia Shalom:\s*/i, '');
  clean = clean.replace(/\(DNI\/CE.*?\)/i, '').trim();

  // Si tiene formato DEPARTAMENTO / PROVINCIA / AGENCIA, tomar la agencia o provincia
  const parts = clean.split('/').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1].split('-')[0].trim();
    return lastPart.toUpperCase();
  }
  
  const chunk = clean.split('-')[0].trim();
  return chunk.toUpperCase();
};

export const extractShalomOrigen = (tallerConfig: TallerConfig): string => {
  if (tallerConfig.agencia_shalom_origen && tallerConfig.agencia_shalom_origen.trim()) {
    return tallerConfig.agencia_shalom_origen.trim().toUpperCase();
  }
  if (tallerConfig.direccion_taller) {
    const dirUpper = tallerConfig.direccion_taller.toUpperCase();
    if (dirUpper.includes('VICTORIA')) return 'LA VICTORIA - AV 28 DE JULIO';
    if (dirUpper.includes('TINGO MARIA')) return 'LIMA TINGO MARIA';
    if (dirUpper.includes('TACNA')) return 'LIMA AV TACNA';
  }
  if (tallerConfig.ciudad_origen && tallerConfig.ciudad_origen.trim()) {
    const clean = tallerConfig.ciudad_origen.replace(/,.*$/, '').trim().toUpperCase();
    return clean || 'LA VICTORIA - AV 28 DE JULIO';
  }
  return 'LA VICTORIA - AV 28 DE JULIO';
};

export const downloadShalomExcel = (pedidos: Pedido[], tallerConfig: TallerConfig) => {
  // Filtrar o tomar los pedidos Shalom
  const shalomPedidos = pedidos.filter(p => p.metodo_envio_codigo === 'shalom' || p.destino_detalle?.toLowerCase().includes('shalom'));
  const targetPedidos = shalomPedidos.length > 0 ? shalomPedidos : pedidos;

  const origen = extractShalomOrigen(tallerConfig);

  // --- 1. CONSTRUCCIÓN DE HOJA PRINCIPAL: 'Hoja1' (13 Columnas Oficiales) ---
  const headers = [
    'DESTINATARIO (DOC)',
    'TELF. DESTINATARIO',
    'CONTACTO (DOC)',
    'TELF. CONTACTO',
    'NRO GRR',
    'ORIGEN',
    'DESTINO',
    'MERCADERIA',
    'ALTO',
    'ANCHO',
    'LARGO',
    'PESO',
    'CANTIDAD'
  ];

  // Matriz de datos para Hoja1 con medidas 0 para no especificar
  const hoja1Data: any[][] = [headers];

  targetPedidos.forEach((pedido, index) => {
    const rowNum = index + 2;
    const dni = extractShalomDni(pedido);
    const phone = extractShalomPhone(pedido);
    const destino = extractShalomDestino(pedido.destino_detalle);
    const mercaderia = 'PAQUETE XXS';

    // Fila con valores 0 para no especificar medidas
    const row = [
      dni,
      phone,
      '', // CONTACTO (DOC)
      '', // TELF. CONTACTO
      '', // NRO GRR
      origen,
      destino,
      mercaderia,
      { t: 'n', v: 0, f: `VLOOKUP(H${rowNum},Medidas!A:E,2,FALSE)` },
      { t: 'n', v: 0, f: `VLOOKUP(H${rowNum},Medidas!A:E,3,FALSE)` },
      { t: 'n', v: 0, f: `VLOOKUP(H${rowNum},Medidas!A:E,4,FALSE)` },
      { t: 'n', v: 0, f: `VLOOKUP(H${rowNum},Medidas!A:E,5,FALSE)` },
      1 // CANTIDAD (Columna M obligatoria)
    ];

    hoja1Data.push(row);
  });

  const wsHoja1 = XLSX.utils.aoa_to_sheet(hoja1Data);

  // Anchos de columna optimizados
  wsHoja1['!cols'] = [
    { wch: 22 }, // A: DESTINATARIO (DOC)
    { wch: 20 }, // B: TELF. DESTINATARIO
    { wch: 18 }, // C: CONTACTO (DOC)
    { wch: 18 }, // D: TELF. CONTACTO
    { wch: 15 }, // E: NRO GRR
    { wch: 28 }, // F: ORIGEN
    { wch: 28 }, // G: DESTINO
    { wch: 18 }, // H: MERCADERIA
    { wch: 10 }, // I: ALTO
    { wch: 10 }, // J: ANCHO
    { wch: 10 }, // K: LARGO
    { wch: 10 }, // L: PESO
    { wch: 12 }, // M: CANTIDAD
  ];

  // --- 2. CONSTRUCCIÓN DE HOJA AUXILIAR: 'Medidas' (Todas con medidas 0) ---
  const wsMedidas = XLSX.utils.json_to_sheet(SHALOM_MEDIDAS_TABLE);
  wsMedidas['!cols'] = [
    { wch: 18 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
  ];

  // --- 3. CONSTRUCCIÓN DE HOJA AUXILIAR: 'Hoja2' (Agencias Oficiales) ---
  const agenciasList = Array.from(
    new Set(
      (shalomAgenciesFull as Array<{ name?: string; nombre?: string }>).map(
        a => (a.nombre || a.name || '').trim().toUpperCase()
      ).filter(Boolean)
    )
  ).map(agencia => ({ AGENCIAS: agencia }));

  const wsHoja2 = XLSX.utils.json_to_sheet(agenciasList.length > 0 ? agenciasList : [
    { AGENCIAS: 'LA VICTORIA - AV 28 DE JULIO' },
    { AGENCIAS: 'LIMA TINGO MARIA' },
    { AGENCIAS: 'ZAMACOLA' },
    { AGENCIAS: 'JAEN' },
    { AGENCIAS: 'CHACHAPOYAS' }
  ]);
  wsHoja2['!cols'] = [{ wch: 45 }];

  // --- 4. CREAR EL WORKBOOK CON LAS 3 PESTAÑAS OFICIALES ---
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, wsHoja1, 'Hoja1');
  XLSX.utils.book_append_sheet(workbook, wsMedidas, 'Medidas');
  XLSX.utils.book_append_sheet(workbook, wsHoja2, 'Hoja2');

  // Descargar archivo Excel oficial
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Formato-Pro-Masivo-Shalom-ComiKids_${dateStr}.xlsx`;
  XLSX.writeFile(workbook, filename);
};
