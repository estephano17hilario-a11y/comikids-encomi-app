/**
 * Backend CLI Tool — Generador Oficial de Envíos Masivos Shalom Perú
 * Uso: node scripts/generate_shalom_masivo.mjs [ruta_salida]
 */
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { matchShalomDestino, matchShalomOrigen } from './test_matcher.mjs';

const TEMPLATE_PATH = 'public/Formato-Pro-Masivo-2026_08_15_02.xlsx';
const OUTPUT_DEFAULT = `Formato-Pro-Masivo-Shalom-ComiKids_${new Date().toISOString().slice(0, 10)}.xlsx`;

export async function generateShalomExcelFile(pedidosList, origenName = 'AV MEXICO CO', outputPath = OUTPUT_DEFAULT) {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`No se encontró la plantilla base oficial en ${TEMPLATE_PATH}`);
  }

  const templateBuf = fs.readFileSync(TEMPLATE_PATH);
  const wb = XLSX.read(templateBuf, { type: 'buffer', cellFormula: true, cellStyles: true });
  const wsHoja1 = wb.Sheets['Hoja1'];

  const origen = matchShalomOrigen(origenName);

  pedidosList.forEach((pedido, idx) => {
    const r = idx + 2;
    const dni = pedido.dni || pedido.documento || '70503353';
    const phone = (pedido.telefono || pedido.celular || '987654321').replace(/\D/g, '').slice(-9);
    const destino = matchShalomDestino(pedido.destino || pedido.destino_detalle || '');
    const mercaderia = pedido.mercaderia || 'PAQUETE XXS';

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

  // Limpia filas sobrantes
  for (let r = pedidosList.length + 2; r <= 500; r++) {
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

  XLSX.writeFile(wb, outputPath);
  console.log(`✅ Archivo Excel generado con éxito en: ${outputPath}`);
  return outputPath;
}

// Ejecución directa por CLI si se invoca directamente
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/generate_shalom_masivo.mjs')) {
  const sampleOrders = [
    { dni: '74561234', telefono: '987654321', destino: 'TUMBES PUYANGO – URB. ANDRÉS ARAUJO MORÁN MZ. 28', mercaderia: 'PAQUETE XXS' },
    { dni: '45678912', telefono: '912345678', destino: 'JR AGUILAR – JR. AGUILAR N° 872', mercaderia: 'PAQUETE XS' },
    { dni: '78912345', telefono: '955443322', destino: 'SURCO MATEO PUMACAHUA – AV. SAN JUAN MZ A LOTE 01...', mercaderia: 'PAQUETE S' },
    { dni: '12345678', telefono: '998877665', destino: 'GARATEA – URB. NICOLAS GARATEA MZ. 100 LT. 24', mercaderia: 'PAQUETE M' },
    { dni: '87654321', telefono: '944332211', destino: 'SATIPO – JR. FRANCISCO IRAZOLA 1077', mercaderia: 'PAQUETE L' },
    { dni: '65432198', telefono: '933221100', destino: 'AV JESUS – AV. JESÚS N° 1100 PAUCARPATA...', mercaderia: 'SOBRE' },
    { dni: '54321987', telefono: '922110099', destino: 'N. CDRA 9 REFERENCIA : FRENTE A LA CLÍNICA CUTERVO', mercaderia: 'PAQUETE XXS' },
    { dni: '43219876', telefono: '911009988', destino: 'LAS AMERICAS (LAS AMERICAS) – AV. LOS PRECURSORES...', mercaderia: 'PAQUETE XS' },
    { dni: '32198765', telefono: '900998877', destino: 'AV RAUL MATA LA CRUZ', mercaderia: 'PAQUETE S' }
  ];

  const targetOut = process.argv[2] || OUTPUT_DEFAULT;
  generateShalomExcelFile(sampleOrders, 'AV MEXICO CO', targetOut);
}
