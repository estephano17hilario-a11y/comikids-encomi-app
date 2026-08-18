import fs from 'fs';

const buf = fs.readFileSync('public/Formato-Pro-Masivo-2026_08_15_02.xlsx');
const b64 = buf.toString('base64');
const tsContent = `// Base64 encoded official template Formato-Pro-Masivo-2026_08_15_02.xlsx
export const SHALOM_OFFICIAL_TEMPLATE_BASE64 = "${b64}";
`;

fs.writeFileSync('src/data/shalom_template_base64.ts', tsContent);
console.log('Successfully created src/data/shalom_template_base64.ts, length:', b64.length);
