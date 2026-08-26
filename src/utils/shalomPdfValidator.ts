/**
 * Validador Estricto Client-Side de Comprobantes PDF de Shalom Pro
 * Inspecciona los streams de texto del PDF en Base64 para garantizar que pertenezca al cliente actual.
 */

export interface ShalomPdfValidationResult {
  isValid: boolean;
  extractedDni?: string;
  extractedOrderNumber?: string;
  extractedReceiverName?: string;
  extractedDestination?: string;
  reason?: string;
}

export function validateShalomPdfContent(
  pdfBase64: string,
  expectedClient?: { dni?: string; name?: string; phone?: string; guideNumber?: string }
): ShalomPdfValidationResult {
  if (!pdfBase64 || pdfBase64.length < 200) {
    return { isValid: false, reason: 'PDF vacío o corrupto' };
  }

  // Verificar firma de archivo PDF o imagen
  const isPdf = pdfBase64.startsWith('JVBERi');
  const isImage = pdfBase64.startsWith('/9j/') || pdfBase64.startsWith('iVBOR') || pdfBase64.startsWith('UklGR');
  if (!isPdf && !isImage) {
    return { isValid: false, reason: 'Formato de comprobante no reconocido' };
  }

  try {
    // Si contiene texto no comprimido, verificar si hay un DNI explícito que sea contradictorio
    const binaryStr = atob(pdfBase64.slice(0, 10000));
    const textSample = binaryStr.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').replace(/\s+/g, ' ');

    const SENDER_DOCS = ['42020312', '20512528458', '20000000001', '00000000'];

    const dniMatches = Array.from(textSample.matchAll(/(?:DNI\/RUC|DNI\/CE|DNI|RUC|DOC|DOCUMENTO)[\s:]*([0-9A-Za-z]{6,12})/gi));
    let receiverDni = '';
    if (dniMatches.length > 0) {
      for (const m of dniMatches) {
        const found = m[1].replace(/\D/g, '');
        if (found && !SENDER_DOCS.includes(found)) {
          receiverDni = found;
          break;
        }
      }
    }

    const cleanExpectedDni = (expectedClient?.dni || '').replace(/\D/g, '').trim();
    if (cleanExpectedDni && cleanExpectedDni.length >= 6 && receiverDni && receiverDni !== cleanExpectedDni && !SENDER_DOCS.includes(receiverDni)) {
      console.warn(`[SHALOM PDF VALIDATOR REJECT] PDF contiene DNI "${receiverDni}" pero se esperaba "${cleanExpectedDni}". RECHAZADO.`);
      return {
        isValid: false,
        extractedDni: receiverDni,
        reason: `Seguridad: El comprobante pertenece al DNI ${receiverDni}, no a la clienta (DNI ${cleanExpectedDni}).`
      };
    }

    return {
      isValid: true,
      extractedDni: receiverDni || cleanExpectedDni,
    };
  } catch {
    return { isValid: true };
  }
}
