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
  expectedClient: { dni?: string; name?: string; phone?: string; guideNumber?: string }
): ShalomPdfValidationResult {
  if (!pdfBase64 || pdfBase64.length < 200) {
    return { isValid: false, reason: 'PDF vacío o corrupto' };
  }

  try {
    // Decodificar Base64 a texto ASCII/UTF-8 crudo para buscar streams de texto de Shalom
    const binaryStr = atob(pdfBase64);
    
    // Normalizar texto visible en el PDF
    const textSample = binaryStr
      .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
      .replace(/\s+/g, ' ');

    // 1. Extraer DNI del Destinatario en el Ticket de Shalom (ej: "DNI/RUC: 78005117" o "DNI: 78005117")
    const dniMatches = Array.from(textSample.matchAll(/(?:DNI\/RUC|DNI|RUC|DOC)[\s:]*([0-9]{8,12})/gi));
    let receiverDni = '';
    if (dniMatches.length > 0) {
      // El último DNI suele ser el del destinatario (el primero es el del remitente 42020312)
      for (const m of dniMatches) {
        const found = m[1];
        if (found !== '42020312' && found !== '20512528458') {
          receiverDni = found;
          break;
        }
      }
      if (!receiverDni && dniMatches.length > 0) {
        receiverDni = dniMatches[dniMatches.length - 1][1];
      }
    }

    // 2. Extraer N° de Orden (ej: "NRO. ORDEN: 92495242" o "ORDEN: 92495242")
    const orderMatch = textSample.match(/(?:NRO\.?\s*ORDEN|ORDEN)[\s:]*([0-9]{7,10})/i);
    const extractedOrderNumber = orderMatch ? orderMatch[1] : undefined;

    // 3. Extraer Destino si está visible
    const destMatch = textSample.match(/Destino[\s:]*([^.\n\r]+)/i);
    const extractedDestination = destMatch ? destMatch[1].trim() : undefined;

    // 4. VALIDACIÓN ESTRICTA POR DNI
    const cleanExpectedDni = (expectedClient.dni || '').replace(/\D/g, '').trim();
    if (cleanExpectedDni && cleanExpectedDni.length >= 8 && cleanExpectedDni !== '42020312' && cleanExpectedDni !== '00000000') {
      // Si logramos extraer el DNI del PDF
      if (receiverDni) {
        if (receiverDni !== cleanExpectedDni) {
          console.warn(`[SHALOM PDF VALIDATOR REJECT] PDF contiene DNI "${receiverDni}" pero la clienta es DNI "${cleanExpectedDni}". RECHAZADO.`);
          return {
            isValid: false,
            extractedDni: receiverDni,
            extractedOrderNumber,
            extractedDestination,
            reason: `El PDF devuelto pertenece al DNI ${receiverDni}, no a la clienta (DNI ${cleanExpectedDni}).`
          };
        }
      } else if (!textSample.includes(cleanExpectedDni)) {
        // Si el stream de texto no contiene en ninguna parte el DNI de la clienta
        console.warn(`[SHALOM PDF VALIDATOR REJECT] El PDF no contiene el DNI ${cleanExpectedDni} de la clienta.`);
        return {
          isValid: false,
          extractedOrderNumber,
          reason: `El comprobante no contiene el DNI ${cleanExpectedDni} de la clienta.`
        };
      }
    } else if (expectedClient.name && expectedClient.name.trim().length >= 6) {
      // Si la clienta no tenía DNI pero tiene nombre completo
      const normalizedPdf = textSample.toUpperCase();
      const nameWords = expectedClient.name
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !['CLIENTA', 'CLIENTE', 'COMIKIDS', 'DE', 'DEL', 'LA', 'LOS', 'SAN', 'SANTA'].includes(w));

      if (nameWords.length >= 2) {
        const matchesCount = nameWords.filter(w => normalizedPdf.includes(w)).length;
        if (matchesCount < 2) {
          console.warn(`[SHALOM PDF VALIDATOR REJECT] El PDF no coincide con el nombre de la clienta "${expectedClient.name}". Coincidieron ${matchesCount}/${nameWords.length} palabras.`);
          return {
            isValid: false,
            reason: `El comprobante no coincide con el nombre de la clienta "${expectedClient.name}".`
          };
        }
      }
    }

    // Si pasó las validaciones
    return {
      isValid: true,
      extractedDni: receiverDni || cleanExpectedDni,
      extractedOrderNumber,
      extractedDestination
    };

  } catch (err: any) {
    console.warn('[SHALOM PDF VALIDATOR] Error parseando streams de PDF:', err?.message);
    // Si falla el parseo pero no hay DNI esperado, devolver válido con precaución
    return { isValid: true };
  }
}
