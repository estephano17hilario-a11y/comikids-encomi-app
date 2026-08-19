import * as XLSX from 'xlsx';
import * as fs from 'fs';

const base64Content = fs.readFileSync('src/data/shalom_template_base64.ts', 'utf-8');
const match = base64Content.match(/SHALOM_OFFICIAL_TEMPLATE_BASE64\s*=\s*['"`]([^'"`]+)['"`]/);

if (match) {
  const b64 = match[1];
  const buf = Buffer.from(b64, 'base64');
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws1 = wb.Sheets['Hoja1'];
  
  // Simular llenado de 2 pedidos
  const targetPedidos = [
    { dni: '71234567', phone: '987654321', name: 'JUAN PEREZ', origen: 'AV MEXICO CO', destino: 'AV ENRIQUE MEIGGS' },
    { dni: '72345678', phone: '912345678', name: 'MARIA GARCIA', origen: 'AV MEXICO CO', destino: 'SANTA' }
  ];
  
  // Limpiar todas las celdas antiguas de Hoja1 excepto el encabezado A1..M1
  const keys = Object.keys(ws1);
  for (const k of keys) {
    if (k.startsWith('!')) continue;
    const rowNum = parseInt(k.replace(/^[A-Z]+/, ''), 10);
    if (rowNum > 1) {
      delete ws1[k];
    }
  }
  
  // Llenar exactamente las filas de los pedidos
  targetPedidos.forEach((p, idx) => {
    const r = idx + 2;
    ws1[`A${r}`] = { t: 's', v: p.dni };
    ws1[`B${r}`] = { t: 's', v: p.phone };
    ws1[`C${r}`] = { t: 's', v: p.name };
    ws1[`D${r}`] = { t: 's', v: '' };
    ws1[`E${r}`] = { t: 's', v: '' };
    ws1[`F${r}`] = { t: 's', v: p.origen };
    ws1[`G${r}`] = { t: 's', v: p.destino };
    ws1[`H${r}`] = { t: 's', v: 'PAQUETE XXS' };
    ws1[`I${r}`] = { t: 'n', v: 0 };
    ws1[`J${r}`] = { t: 'n', v: 0 };
    ws1[`K${r}`] = { t: 'n', v: 0 };
    ws1[`L${r}`] = { t: 'n', v: 0 };
    ws1[`M${r}`] = { t: 'n', v: 1 };
  });
  
  // Ajustar el !ref exacto para que no existan 500 filas vacías bugeadas
  ws1['!ref'] = `A1:M${targetPedidos.length + 1}`;
  
  // Probar exportación con compresión
  const outBufCompressed = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer', compression: true });
  console.log("Tamaño con compresión y !ref limpio:", outBufCompressed.length, "bytes (~", Math.round(outBufCompressed.length / 1024), "KB)");
  
  fs.writeFileSync('scripts/test_clean_export.xlsx', outBufCompressed);
}
