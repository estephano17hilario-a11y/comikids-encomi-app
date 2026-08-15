import * as XLSX from 'xlsx';
import { Pedido, TallerConfig } from '../types/database.types';

export interface ShalomRowData {
  'DESTINATARIO (DOC)': string;
  'TELF. DESTINATARIO': string;
  'CONTACTO (DOC)': string;
  'TELF. CONTACTO': string;
  'NRO GRR': string;
  'ORIGEN': string;
  'DESTINO': string;
  'MERCADERIA': string;
  'ALTO': number;
  'ANCHO': number;
  'LARGO': number;
  'PESO': number;
}

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
    // Tomar la provincia o agencia en mayúsculas
    return (parts[1] || parts[0]).toUpperCase();
  }
  
  // O tomar las primeras 2 palabras
  const firstChunk = clean.split('-')[0].trim();
  return firstChunk.toUpperCase();
};

export const generateShalomExcelData = (pedidos: Pedido[], tallerConfig: TallerConfig): ShalomRowData[] => {
  const origen = (tallerConfig.ciudad_origen || 'LIMA').toUpperCase();

  return pedidos.map((pedido) => {
    const dni = extractShalomDni(pedido);
    const phone = extractShalomPhone(pedido);
    const destino = extractShalomDestino(pedido.destino_detalle);

    return {
      'DESTINATARIO (DOC)': dni,
      'TELF. DESTINATARIO': phone,
      'CONTACTO (DOC)': '',
      'TELF. CONTACTO': '',
      'NRO GRR': '',
      'ORIGEN': origen,
      'DESTINO': destino,
      'MERCADERIA': 'PAQUETE XXS', // Requerimiento explícito en mayúsculas
      'ALTO': 0,
      'ANCHO': 0,
      'LARGO': 0,
      'PESO': 0,
    };
  });
};

export const downloadShalomExcel = (pedidos: Pedido[], tallerConfig: TallerConfig) => {
  // Filtrar o tomar los pedidos Shalom
  const shalomPedidos = pedidos.filter(p => p.metodo_envio_codigo === 'shalom' || p.destino_detalle?.toLowerCase().includes('shalom'));
  const targetPedidos = shalomPedidos.length > 0 ? shalomPedidos : pedidos;

  const data = generateShalomExcelData(targetPedidos, tallerConfig);

  // Crear la hoja de trabajo (Worksheet)
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Establecer anchos de columna para formato profesional
  worksheet['!cols'] = [
    { wch: 22 }, // DESTINATARIO (DOC)
    { wch: 20 }, // TELF. DESTINATARIO
    { wch: 18 }, // CONTACTO (DOC)
    { wch: 18 }, // TELF. CONTACTO
    { wch: 15 }, // NRO GRR
    { wch: 18 }, // ORIGEN
    { wch: 25 }, // DESTINO
    { wch: 18 }, // MERCADERIA
    { wch: 10 }, // ALTO
    { wch: 10 }, // ANCHO
    { wch: 10 }, // LARGO
    { wch: 10 }, // PESO
  ];

  // Crear el libro de trabajo (Workbook) con nombre de hoja 'Hoja1'
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Hoja1');

  // Descargar archivo Excel
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Plantilla_Masiva_Shalom_ComiKids_${dateStr}.xlsx`;
  XLSX.writeFile(workbook, filename);
};
