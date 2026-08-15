import * as XLSX from 'xlsx';
import { Pedido, TallerConfig } from '../types/database.types';
import shalomAgenciesFull from '../../data/shalom_agencies_full.json';

// Lista oficial de medidas de mercadería de Shalom
export const SHALOM_MEDIDAS_TABLE = [
  { MERCADERIA: 'PAQUETE XXS', ALTO: 10, ANCHO: 10, LARGO: 10, PESO: 1 },
  { MERCADERIA: 'PAQUETE XS', ALTO: 15, ANCHO: 15, LARGO: 15, PESO: 2 },
  { MERCADERIA: 'PAQUETE S', ALTO: 20, ANCHO: 20, LARGO: 20, PESO: 3 },
  { MERCADERIA: 'PAQUETE M', ALTO: 25, ANCHO: 25, LARGO: 25, PESO: 5 },
  { MERCADERIA: 'PAQUETE L', ALTO: 30, ANCHO: 30, LARGO: 30, PESO: 8 },
  { MERCADERIA: 'PAQUETE XL', ALTO: 40, ANCHO: 40, LARGO: 40, PESO: 12 },
  { MERCADERIA: 'PAQUETE XXL', ALTO: 50, ANCHO: 50, LARGO: 50, PESO: 15 },
  { MERCADERIA: 'SOBRE', ALTO: 1, ANCHO: 25, LARGO: 35, PESO: 0.5 },
  { MERCADERIA: 'CAJA', ALTO: 20, ANCHO: 20, LARGO: 20, PESO: 3 },
  { MERCADERIA: 'VALIJA', ALTO: 30, ANCHO: 30, LARGO: 30, PESO: 5 },
  { MERCADERIA: 'SACO', ALTO: 40, ANCHO: 40, LARGO: 50, PESO: 10 },
];

export const extractShalomDni = (pedido: Pedido): string => {
  if (pedido.usuario?.dni && pedido.usuario.dni.length === 8 && !pedido.usuario.dni.startsWith('9')) {
    return pedido.usuario.dni;
  }
  if (pedido.usuario?.dni_default) {
    return pedido.usuario.dni_default;
  }
  if (pedido.destino_detalle) {
    const match = pedido.destino_detalle.match(/(?:DNI|CE|Recojo)[\s:]*([0-9A-Za-z]{7,12})/i);
    if (match && match[1] && match[1].toLowerCase() !== 'recojo') {
      return match[1];
    }
  }
  if (pedido.usuario?.dni && pedido.usuario.dni.toLowerCase() !== 'recojo') {
    return pedido.usuario.dni;
  }
  return '';
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

  // Matriz de datos para Hoja1
  const hoja1Data: any[][] = [headers];

  targetPedidos.forEach((pedido, index) => {
    const rowNum = index + 2; // Fila Excel 1-indexed (fila 1 es el header)
    const dni = extractShalomDni(pedido);
    const phone = extractShalomPhone(pedido);
    const destino = extractShalomDestino(pedido.destino_detalle);
    const mercaderia = 'PAQUETE XXS';

    // Fila con fórmulas oficiales vinculadas a la hoja 'Medidas'
    const row = [
      dni,
      phone,
      '', // CONTACTO (DOC)
      '', // TELF. CONTACTO
      '', // NRO GRR
      origen,
      destino,
      mercaderia,
      { t: 'n', v: 10, f: `VLOOKUP(H${rowNum},Medidas!A:E,2,FALSE)` },
      { t: 'n', v: 10, f: `VLOOKUP(H${rowNum},Medidas!A:E,3,FALSE)` },
      { t: 'n', v: 10, f: `VLOOKUP(H${rowNum},Medidas!A:E,4,FALSE)` },
      { t: 'n', v: 1, f: `VLOOKUP(H${rowNum},Medidas!A:E,5,FALSE)` },
      1 // CANTIDAD (Columna M obligatoria)
    ];

    hoja1Data.push(row);
  });

  const wsHoja1 = XLSX.utils.aoa_to_sheet(hoja1Data);

  // Anchos de columna optimizados para las 13 columnas
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
    { wch: 12 }, // M: CANTIDAD (13ª columna)
  ];

  // --- 2. CONSTRUCCIÓN DE HOJA AUXILIAR: 'Medidas' ---
  const wsMedidas = XLSX.utils.json_to_sheet(SHALOM_MEDIDAS_TABLE);
  wsMedidas['!cols'] = [
    { wch: 18 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
  ];

  // --- 3. CONSTRUCCIÓN DE HOJA AUXILIAR: 'Hoja2' (Lista Oficial de Agencias Shalom) ---
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
