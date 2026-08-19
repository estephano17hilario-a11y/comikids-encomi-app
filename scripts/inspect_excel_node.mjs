import * as XLSX from 'xlsx';
import * as fs from 'fs';

const base64Content = fs.readFileSync('src/data/shalom_template_base64.ts', 'utf-8');
const match = base64Content.match(/SHALOM_OFFICIAL_TEMPLATE_BASE64\s*=\s*['"`]([^'"`]+)['"`]/);

if (match) {
  const b64 = match[1];
  console.log("Base64 string length:", b64.length);
  const buf = Buffer.from(b64, 'base64');
  console.log("Decoded buffer byte length:", buf.length, "bytes (~", Math.round(buf.length / 1024), "KB)");
  
  const wb = XLSX.read(buf, { type: 'buffer' });
  console.log("Sheet names:", wb.SheetNames);
  
  const ws1 = wb.Sheets['Hoja1'];
  console.log("Hoja1 ref range:", ws1['!ref']);
  
  // Inspect some cells in Hoja1
  console.log("Hoja1 A1:", ws1['A1']);
  console.log("Hoja1 A2:", ws1['A2']);
  console.log("Hoja1 F2:", ws1['F2']);
  console.log("Hoja1 G2:", ws1['G2']);
  
  // Simulate downloadShalomExcel export
  // If we write it:
  const outBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  console.log("Exported file size:", outBuf.length, "bytes (~", Math.round(outBuf.length / 1024), "KB)");
}
