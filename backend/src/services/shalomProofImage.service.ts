import { execFile } from 'node:child_process';
import QRCode from 'qrcode';

export interface ShalomTrackingMilestone {
  fecha?: string;
  completo?: boolean;
  cargueros?: string[];
  carguero?: string;
  [key: string]: any;
}

export interface ShalomTrackingStatusObj {
  registrado?: ShalomTrackingMilestone | null;
  origen?: ShalomTrackingMilestone | null;
  transito?: ShalomTrackingMilestone | null;
  demora?: ShalomTrackingMilestone | null;
  destino?: ShalomTrackingMilestone | null;
  entregado?: ShalomTrackingMilestone | null;
  reparto?: ShalomTrackingMilestone | null;
}

export interface ProofImageInput {
  brandName: string;
  clientName: string;
  clientDni: string;
  agencyName: string;
  agencyAddress?: string;
  orderNumber: string;
  orderCode?: string;
  pickupCode?: string;
  status: ShalomTrackingStatusObj;
  verifiedAt?: string;
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncateText(str: string, maxLen: number): string {
  const clean = String(str || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1)}…`;
}

function wrapLines(str: string, maxChars: number, maxLines: number): string[] {
  const words = String(str || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + ' ' + word).length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  if (lines.length === maxLines) {
    const joined = lines.join(' ');
    const full = words.join(' ');
    if (full.length > joined.length) {
      lines[maxLines - 1] = truncateText(lines[maxLines - 1], maxChars);
    }
  }
  return lines.length > 0 ? lines : ['Agencia Shalom Destino'];
}

function formatShalomDate(raw?: string | null): string {
  if (!raw) return 'Pendiente';
  const clean = String(raw).trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+|T)(\d{2}):(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]} • ${match[4]}:${match[5]}`;
  }
  return clean.slice(0, 19);
}

/**
 * Genera una constancia visual (PNG) oficial de rastreo Shalom como prueba de llegada a agencia.
 * Usa SVG limpio + QR real + rsvg-convert (Alpine librsvg) para renderizado ultrarrápido y nítido.
 */
export class ShalomProofImageService {
  public static async buildProofSvg(input: ProofImageInput): Promise<string> {
    const brandName = truncateText(input.brandName || 'Encomi', 28);
    const clientName = truncateText(input.clientName || 'Cliente', 36);
    const clientDni = truncateText(input.clientDni || 'S/DNI', 16);
    const orderNumber = truncateText(input.orderNumber || '---', 18);
    const orderCode = truncateText((input.orderCode || '').toUpperCase(), 10);
    const pickupCode = truncateText((input.pickupCode || '0808').toUpperCase(), 8);
    const agencyLines = wrapLines(input.agencyName || 'Agencia Shalom Destino', 42, 2);
    const addressLine = input.agencyAddress ? truncateText(input.agencyAddress, 58) : '';

    const isDelivered = Boolean(input.status?.entregado?.fecha);
    const isAtDestination = Boolean(input.status?.destino?.fecha);
    const isInTransit = Boolean(input.status?.transito?.fecha) || isAtDestination || isDelivered;
    const isAtOrigin = Boolean(input.status?.origen?.fecha) || isInTransit;
    const isRegistered = Boolean(input.status?.registrado?.fecha) || isAtOrigin;

    const statusBadgeText = isDelivered
      ? 'ENTREGADO AL CLIENTE'
      : isAtDestination
      ? 'LISTO PARA RECOGER EN AGENCIA'
      : isInTransit
      ? 'EN TRÁNSITO A DESTINO'
      : 'REGISTRADO EN SHALOM';

    const statusBadgeBg = isAtDestination || isDelivered ? '#10b981' : '#f59e0b';

    const verifiedLabel = input.verifiedAt
      ? input.verifiedAt
      : new Date().toLocaleString('es-PE', {
          timeZone: 'America/Lima',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

    // Generar QR real hacia rastrea.shalom.pe embebido como data URI PNG
    let qrDataUri = '';
    try {
      const qrUrl = 'https://rastrea.shalom.pe';
      qrDataUri = await QRCode.toDataURL(qrUrl, {
        width: 148,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
    } catch {
      qrDataUri = '';
    }

    const milestones = [
      {
        title: '1. Pedido Registrado',
        done: isRegistered,
        date: formatShalomDate(input.status?.registrado?.fecha || input.status?.origen?.fecha),
        highlight: false,
      },
      {
        title: '2. Recibido en Agencia Origen',
        done: isAtOrigin,
        date: formatShalomDate(input.status?.origen?.fecha),
        highlight: false,
      },
      {
        title: '3. En Tránsito hacia Destino',
        done: isInTransit,
        date: formatShalomDate(input.status?.transito?.fecha),
        highlight: false,
      },
      {
        title: isDelivered ? '4. Entregado al Destinatario' : '4. En Agencia Destino (Listo para recoger)',
        done: isAtDestination || isDelivered,
        date: formatShalomDate(
          isDelivered ? input.status?.entregado?.fecha : input.status?.destino?.fecha
        ),
        highlight: isAtDestination && !isDelivered,
      },
    ];

    const milestonesSvg = milestones
      .map((m, idx) => {
        const y = 472 + idx * 78;
        const cardBg = m.highlight ? '#ecfdf5' : m.done ? '#f8fafc' : '#f1f5f9';
        const cardStroke = m.highlight ? '#10b981' : m.done ? '#cbd5e1' : '#e2e8f0';
        const dotFill = m.highlight ? '#059669' : m.done ? '#10b981' : '#94a3b8';
        const titleColor = m.highlight ? '#065f46' : m.done ? '#0f172a' : '#64748b';
        const dateColor = m.highlight ? '#047857' : '#475569';
        const connector =
          idx < milestones.length - 1
            ? `<line x1="74" y1="${y + 44}" x2="74" y2="${y + 78}" stroke="${m.done ? '#10b981' : '#cbd5e1'}" stroke-width="3" stroke-dasharray="${m.done ? '' : '4 4'}" />`
            : '';

        return `
          ${connector}
          <rect x="44" y="${y}" width="712" height="64" rx="14" fill="${cardBg}" stroke="${cardStroke}" stroke-width="${m.highlight ? '2.5' : '1.2'}" />
          <circle cx="74" cy="${y + 32}" r="14" fill="${dotFill}" />
          ${
            m.done
              ? `<path d="M68 ${y + 32} L72.5 ${y + 36.5} L81 ${y + 27.5}" fill="none" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />`
              : `<circle cx="74" cy="${y + 32}" r="4.5" fill="#ffffff" />`
          }
          <text x="104" y="${y + 27}" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" font-weight="700" fill="${titleColor}">${escapeXml(m.title)}</text>
          <text x="104" y="${y + 49}" font-family="DejaVu Sans, Arial, sans-serif" font-size="13.5" font-weight="${m.highlight ? '700' : '400'}" fill="${dateColor}">${escapeXml(m.date)}</text>
          ${
            m.highlight
              ? `<rect x="572" y="${y + 17}" width="166" height="30" rx="15" fill="#059669" />
                 <text x="655" y="${y + 37}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" font-weight="700" fill="#ffffff">DISPONIBLE HOY</text>`
              : m.done
              ? `<text x="734" y="${y + 37}" text-anchor="end" font-family="DejaVu Sans, Arial, sans-serif" font-size="12.5" font-weight="700" fill="#059669">COMPLETADO</text>`
              : `<text x="734" y="${y + 37}" text-anchor="end" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" font-weight="600" fill="#94a3b8">PENDIENTE</text>`
          }
        `;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="940" viewBox="0 0 800 940">
  <defs>
    <linearGradient id="headerGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#991b1b" />
      <stop offset="55%" stop-color="#dc2626" />
      <stop offset="100%" stop-color="#b91c1c" />
    </linearGradient>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#eef2f7" />
    </linearGradient>
  </defs>

  <!-- Fondo general -->
  <rect width="800" height="940" fill="url(#bgGrad)" />

  <!-- Encabezado rojo Shalom Pro -->
  <rect x="0" y="0" width="800" height="168" fill="url(#headerGrad)" />
  <circle cx="740" cy="30" r="90" fill="#ffffff" fill-opacity="0.07" />
  <circle cx="670" cy="140" r="65" fill="#ffffff" fill-opacity="0.06" />

  <text x="44" y="52" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="2" fill="#fecaca">CONSTANCIA OFICIAL DE RASTREO • SHALOM PRO</text>
  <text x="44" y="96" font-family="DejaVu Sans, Arial, sans-serif" font-size="31" font-weight="700" fill="#ffffff">${escapeXml(brandName)}</text>

  <!-- Badge de estado -->
  <rect x="44" y="114" width="370" height="34" rx="17" fill="${statusBadgeBg}" />
  <text x="64" y="136" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" font-weight="700" fill="#ffffff">✓  ${escapeXml(statusBadgeText)}</text>

  <!-- Tarjeta principal de datos de recojo -->
  <rect x="32" y="190" width="736" height="226" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />

  <!-- N Orden / Codigo / Clave -->
  <rect x="52" y="210" width="230" height="74" rx="14" fill="#fef2f2" stroke="#fecaca" stroke-width="1.2" />
  <text x="68" y="233" font-family="DejaVu Sans, Arial, sans-serif" font-size="11.5" font-weight="700" fill="#991b1b">N° DE ORDEN / GUÍA</text>
  <text x="68" y="268" font-family="DejaVu Sans, Arial, sans-serif" font-size="25" font-weight="700" fill="#7f1d1d">${escapeXml(orderNumber)}</text>

  <rect x="298" y="210" width="196" height="74" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2" />
  <text x="314" y="233" font-family="DejaVu Sans, Arial, sans-serif" font-size="11.5" font-weight="700" fill="#475569">CÓDIGO RASTREO</text>
  <text x="314" y="268" font-family="DejaVu Sans, Arial, sans-serif" font-size="25" font-weight="700" fill="#0f172a">${escapeXml(orderCode || 'SHALOM')}</text>

  <rect x="510" y="210" width="238" height="74" rx="14" fill="#ecfdf5" stroke="#6ee7b7" stroke-width="1.8" />
  <text x="526" y="233" font-family="DejaVu Sans, Arial, sans-serif" font-size="11.5" font-weight="700" fill="#047857">CLAVE DE RECOJO (PIN)</text>
  <text x="526" y="269" font-family="DejaVu Sans, Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="4" fill="#065f46">${escapeXml(pickupCode)}</text>

  <!-- Destinatario + DNI -->
  <text x="54" y="314" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" font-weight="700" fill="#64748b">DESTINATARIO</text>
  <text x="54" y="338" font-family="DejaVu Sans, Arial, sans-serif" font-size="17" font-weight="700" fill="#0f172a">${escapeXml(clientName)}</text>

  <text x="530" y="314" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" font-weight="700" fill="#64748b">DOCUMENTO (DNI / CE)</text>
  <text x="530" y="338" font-family="DejaVu Sans, Arial, sans-serif" font-size="17" font-weight="700" fill="#0f172a">${escapeXml(clientDni)}</text>

  <line x1="54" y1="354" x2="746" y2="354" stroke="#e2e8f0" stroke-width="1" />

  <!-- Agencia destino -->
  <text x="54" y="376" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" font-weight="700" fill="#64748b">AGENCIA DE RECOJO SHALOM</text>
  <text x="54" y="398" font-family="DejaVu Sans, Arial, sans-serif" font-size="15.5" font-weight="700" fill="#0f172a">${escapeXml(agencyLines[0])}</text>
  ${
    agencyLines[1]
      ? `<text x="54" y="414" font-family="DejaVu Sans, Arial, sans-serif" font-size="13.5" font-weight="600" fill="#334155">${escapeXml(agencyLines[1])}</text>`
      : addressLine
      ? `<text x="54" y="414" font-family="DejaVu Sans, Arial, sans-serif" font-size="12.5" font-weight="400" fill="#475569">${escapeXml(addressLine)}</text>`
      : ''
  }

  <!-- Sección Línea de Tiempo -->
  <text x="44" y="454" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="1" fill="#334155">SEGUIMIENTO EN TIEMPO REAL VERIFICADO</text>
  ${milestonesSvg}

  <!-- Footer con QR y agradecimiento -->
  <rect x="32" y="796" width="736" height="118" rx="18" fill="#0f172a" />
  ${
    qrDataUri
      ? `<rect x="52" y="812" width="86" height="86" rx="10" fill="#ffffff" />
         <image x="56" y="816" width="78" height="78" href="${qrDataUri}" />`
      : ''
  }
  <text x="${qrDataUri ? 158 : 56}" y="838" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" font-weight="700" fill="#ffffff">¡Gracias por elegir a ${escapeXml(brandName)}!</text>
  <text x="${qrDataUri ? 158 : 56}" y="863" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#cbd5e1">Presenta tu DNI original y clave ${escapeXml(pickupCode)} en ventanilla de Shalom.</text>
  <text x="${qrDataUri ? 158 : 56}" y="889" font-family="DejaVu Sans, Arial, sans-serif" font-size="11.5" fill="#94a3b8">Verificado en vivo el ${escapeXml(verifiedLabel)} • rastrea.shalom.pe</text>
</svg>`;
  }

  /**
   * Renderiza el SVG a un Buffer PNG nítido usando rsvg-convert (o null si no está disponible).
   */
  public static async generateProofPngBase64(input: ProofImageInput): Promise<{ base64: string; mimeType: string; svg: string }> {
    const svg = await this.buildProofSvg(input);

    try {
      const pngBuffer = await new Promise<Buffer>((resolve, reject) => {
        const child = execFile(
          'rsvg-convert',
          ['-f', 'png', '-w', '800', '-h', '940'],
          { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024, timeout: 10000 },
          (err, stdout) => {
            if (err) return reject(err);
            resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout));
          }
        );
        child.stdin?.write(svg, 'utf8');
        child.stdin?.end();
      });

      if (pngBuffer && pngBuffer.length > 500) {
        return {
          base64: pngBuffer.toString('base64'),
          mimeType: 'image/png',
          svg,
        };
      }
    } catch (err: any) {
      console.warn('[SHALOM PROOF IMAGE] rsvg-convert no disponible, usando fallback SVG:', err?.message);
    }

    // Fallback seguro si se ejecuta localmente en Windows sin rsvg-convert
    return {
      base64: Buffer.from(svg, 'utf8').toString('base64'),
      mimeType: 'image/svg+xml',
      svg,
    };
  }
}
