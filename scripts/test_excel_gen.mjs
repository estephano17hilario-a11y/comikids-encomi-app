import * as XLSX from 'xlsx';
import fs from 'fs';
import { matchShalomDestino, matchShalomOrigen } from './test_matcher.mjs';

const templateBuf = fs.readFileSync('public/Formato-Pro-Masivo-2026_08_15_02.xlsx');
const wb = XLSX.read(templateBuf, { type: 'buffer', cellFormula: true, cellStyles: true });

const wsHoja1 = wb.Sheets['Hoja1'];

const mockPedidos = [
  { dni: '74561234', phone: '987654321', destino: 'TUMBES PUYANGO – URB. ANDRÉS ARAUJO MORÁN MZ. 28', mercaderia: 'PAQUETE XXS' },
  { dni: '45678912', phone: '912345678', destino: 'JR AGUILAR – JR. AGUILAR N° 872', mercaderia: 'PAQUETE XS' },
  { dni: '78912345', phone: '955443322', destino: 'SURCO MATEO PUMACAHUA – AV. SAN JUAN MZ A LOTE 01...', mercaderia: 'PAQUETE S' },
  { dni: '12345678', phone: '998877665', destino: 'GARATEA – URB. NICOLAS GARATEA MZ. 100 LT. 24', mercaderia: 'PAQUETE M' },
  { dni: '87654321', phone: '944332211', destino: 'SATIPO – JR. FRANCISCO IRAZOLA 1077', mercaderia: 'PAQUETE L' },
  { dni: '65432198', phone: '933221100', destino: 'AV JESUS – AV. JESÚS N° 1100 PAUCARPATA...', mercaderia: 'SOBRE' },
  { dni: '54321987', phone: '922110099', destino: 'N. CDRA 9 REFERENCIA : FRENTE A LA CLÍNICA CUTERVO', mercaderia: 'PAQUETE XXS' },
  { dni: '43219876', phone: '911009988', destino: 'LAS AMERICAS (LAS AMERICAS) – AV. LOS PRECURSORES...', mercaderia: 'PAQUETE XS' },
  { dni: '32198765', phone: '900998877', destino: 'AV RAUL MATA LA CRUZ', mercaderia: 'PAQUETE S' }
];

const origen = matchShalomOrigen('CENTRAL'); // Maps to AV MEXICO CO

mockPedidos.forEach((p, idx) => {
  const r = idx + 2;
  const dest = matchShalomDestino(p.destino);
  const merc = p.mercaderia || 'PAQUETE XXS';

  wsHoja1[`A${r}`] = { t: 's', v: p.dni };
  wsHoja1[`B${r}`] = { t: 's', v: p.phone };
  wsHoja1[`C${r}`] = { t: 's', v: '' };
  wsHoja1[`D${r}`] = { t: 's', v: '' };
  wsHoja1[`E${r}`] = { t: 's', v: '' };
  wsHoja1[`F${r}`] = { t: 's', v: origen };
  wsHoja1[`G${r}`] = { t: 's', v: dest };
  wsHoja1[`H${r}`] = { t: 's', v: merc };
  wsHoja1[`I${r}`] = { t: 's', v: '0', f: `IF(H${r}="SOBRE",0.1,IF(H${r}="PAQUETE XXS",0.15,IF(H${r}="PAQUETE XS",0.2,IF(H${r}="PAQUETE S",0.3,IF(H${r}="PAQUETE M",0.3,IF(H${r}="PAQUETE L",0.42,""))))))` };
  wsHoja1[`J${r}`] = { t: 's', v: '0', f: `IF(H${r}="SOBRE",0.1,IF(H${r}="PAQUETE XXS",0.1,IF(H${r}="PAQUETE XS",0.15,IF(H${r}="PAQUETE S",0.3,IF(H${r}="PAQUETE M",0.24,IF(H${r}="PAQUETE L",0.3,""))))))` };
  wsHoja1[`K${r}`] = { t: 's', v: '0', f: `IF(H${r}="SOBRE",0.15,IF(H${r}="PAQUETE XXS",0.1,IF(H${r}="PAQUETE XS",0.12,IF(H${r}="PAQUETE S",0.12,IF(H${r}="PAQUETE M",0.2,IF(H${r}="PAQUETE L",0.23,""))))))` };
  wsHoja1[`L${r}`] = { t: 's', v: '0', f: `IF(H${r}="SOBRE",0,IF(H${r}="PAQUETE XXS",0.25,IF(H${r}="PAQUETE XS",0.5,IF(H${r}="PAQUETE S",2,IF(H${r}="PAQUETE M",5,IF(H${r}="PAQUETE L",10,""))))))` };
  wsHoja1[`M${r}`] = { t: 'n', v: 1 };
});

// Limpia filas restantes
for (let r = mockPedidos.length + 2; r <= 500; r++) {
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

const outPath = 'scripts/test_output_shalom.xlsx';
const outBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer', cellFormula: true, cellStyles: true });
fs.writeFileSync(outPath, outBuf);
console.log('Saved test output to:', outPath);

// Verificación detallada
const wbCheck = XLSX.read(fs.readFileSync(outPath), { type: 'buffer', cellFormula: true });
console.log('Sheets in generated file:', wbCheck.SheetNames);
const wsCheck = wbCheck.Sheets['Hoja1'];
for (let r = 2; r <= mockPedidos.length + 1; r++) {
  console.log(`Row ${r}:`, {
    DNI: wsCheck[`A${r}`]?.v,
    TELF: wsCheck[`B${r}`]?.v,
    ORIGEN: wsCheck[`F${r}`]?.v,
    DESTINO: wsCheck[`G${r}`]?.v,
    MERC: wsCheck[`H${r}`]?.v,
    ALTO_F: wsCheck[`I${r}`]?.f,
    ANCHO_F: wsCheck[`J${r}`]?.f,
    LARGO_F: wsCheck[`K${r}`]?.f,
    PESO_F: wsCheck[`L${r}`]?.f,
    CANT: wsCheck[`M${r}`]?.v
  });
}
