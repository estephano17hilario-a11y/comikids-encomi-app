import { SHALOM_AGENCIES } from '../data/shalomAgencies.js';
import { ShalomAgency } from '../types/database.types.js';

export interface ShalomMatchResult {
  agency: ShalomAgency;
  score: number;
  formattedDestino: string;
  displayTitle: string;
  displayAddress: string;
  code: string;
}

export class ShalomMatcherService {
  private static agencies: ShalomAgency[] = SHALOM_AGENCIES;

  /**
   * Normaliza texto eliminando tildes, caracteres especiales y convirtiendo a mayúsculas
   */
  public static normalize(str: string): string {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Limpia palabras de ruido no discriminantes en consultas de WhatsApp
   */
  public static extractMeaningfulTokens(query: string): string[] {
    const raw = this.normalize(query);
    const noiseWords = new Set([
      'AGENCIA', 'SHALOM', 'SALOM', 'CHALOM', 'PARA', 'DESTINO', 'ENVIAR', 'ENTREGAR',
      'RECOJO', 'SEDE', 'DIRECCION', 'LLEVAR', 'DESPACHO', 'DESPACHAR', 'EN', 'EL',
      'LA', 'LOS', 'LAS', 'DE', 'DEL', 'A', 'AL', 'POR', 'FAVOR', 'CON', 'MI', 'SU',
      'QUE', 'SEA', 'HOLA', 'QUIERO', 'PORFA', 'MANDAR', 'ENVIAME', 'REGISTRAR'
    ]);

    const words = raw.split(/\s+/).filter(w => w.length >= 2 && !noiseWords.has(w));
    return words;
  }

  /**
   * Limpia direcciones redundantes para una presentación impecable
   */
  public static cleanAddressText(address?: string, province?: string, department?: string): string {
    if (!address) return '';
    let addr = address.trim();
    if (addr.toUpperCase().startsWith('DIRECCION:') || addr.toUpperCase().startsWith('DIRECCIÓN:')) {
      addr = addr.replace(/^DIRECCI[OÓ]N:\s*/i, '').trim();
    }
    return addr;
  }

  /**
   * Formatea el destino oficial de una agencia Shalom exactamente como lo requiere Encomi
   */
  public static formatAgencyDestination(agency: ShalomAgency, dni: string): string {
    const cleanDni = (dni || '').replace(/[^0-9A-Za-z]/g, '').trim() || 'S/DNI';
    const dep = (agency.department || agency.departamento || 'LIMA').toUpperCase().trim();
    const prov = (agency.province || agency.provincia || dep).toUpperCase().trim();
    const dist = (agency.district || agency.distrito || agency.nombre || 'CENTRO').toUpperCase().trim();
    const codeStr = agency.code ? ` (CÓDIGO: ${agency.code.toUpperCase().trim()})` : '';
    const cleanAddr = this.cleanAddressText(agency.address || agency.direccion, prov, dep);
    const addrStr = cleanAddr ? ` – ${cleanAddr}` : '';

    return `Agencia Shalom: ${dep} / ${prov} / ${dist}${codeStr}${addrStr} (DNI/CE Recojo: ${cleanDni})`;
  }

  /**
   * Calcula el puntaje de afinidad y coincidencia de una agencia respecto a los tokens de búsqueda
   */
  private static scoreAgency(agency: ShalomAgency, tokens: string[], fullNormQuery: string): number {
    if (tokens.length === 0) return 0;

    const dep = this.normalize(agency.department || agency.departamento || '');
    const prov = this.normalize(agency.province || agency.provincia || '');
    const dist = this.normalize(agency.district || agency.distrito || '');
    const name = this.normalize(agency.name || agency.nombre || '');
    const fullName = this.normalize(agency.full_name || '');
    const addr = this.normalize(agency.address || agency.direccion || '');
    const code = this.normalize(agency.code || '');

    const combinedAll = `${dep} ${prov} ${dist} ${name} ${fullName} ${addr} ${code}`;

    let score = 0;
    let tokensMatchedCount = 0;

    // 1. Coincidencia exacta de código de agencia (ej. SAT, SMARPA, AVPAS, JRCDE)
    for (const token of tokens) {
      if (code && token === code) {
        score += 250;
        tokensMatchedCount++;
      }
    }

    // 2. Coincidencia de tokens individuales
    for (const token of tokens) {
      let tokenMatched = false;

      // Coincidencia exacta en Distrito / Sede
      if (dist === token || dist.startsWith(token) || dist.split(/\s+/).includes(token)) {
        score += 100;
        tokenMatched = true;
      } else if (dist.includes(token)) {
        score += 60;
        tokenMatched = true;
      }

      // Coincidencia exacta en Provincia
      if (prov === token || prov.split(/\s+/).includes(token)) {
        score += 70;
        tokenMatched = true;
      } else if (prov.includes(token)) {
        score += 35;
        tokenMatched = true;
      }

      // Coincidencia en Nombre de Agencia / Sede
      if (name.includes(token)) {
        score += 50;
        tokenMatched = true;
      }

      // Coincidencia en Dirección
      if (addr.includes(token)) {
        score += 40;
        tokenMatched = true;
      }

      // Coincidencia en Departamento
      if (dep === token || dep.includes(token)) {
        score += 30;
        tokenMatched = true;
      }

      if (tokenMatched) {
        tokensMatchedCount++;
      }
    }

    // 3. Multi-token intersection bonus
    // Si la consulta tiene múltiples palabras (ej. "satipo pangoa", "av pastor", "tingo maria")
    // y la agencia contiene TODAS las palabras clave:
    if (tokens.length >= 2) {
      if (tokensMatchedCount >= tokens.length) {
        score += 150; // Gran bonificación por contener todas las palabras clave
      } else if (tokensMatchedCount >= 2) {
        score += 60;
      }
    }

    // 4. Frase completa consecutiva en nombre, distrito o dirección
    if (fullNormQuery.length >= 4) {
      if (dist.includes(fullNormQuery)) score += 120;
      else if (name.includes(fullNormQuery)) score += 100;
      else if (addr.includes(fullNormQuery)) score += 80;
      else if (prov.includes(fullNormQuery)) score += 60;
    }

    // 5. Preferencia leve para agencias activas y capitales principales
    if (agency.is_active !== false) score += 5;
    if (dist.includes('CENTRO') || dist.includes('PRINCIPAL') || name.includes('CENTRAL')) score += 3;

    return score;
  }

  /**
   * Busca y rankea todas las agencias Shalom con puntuación inteligente
   */
  public static findMatchingAgencies(destinationInput: string, limit: number = 6): ShalomMatchResult[] {
    const rawDest = (destinationInput || '').trim();
    if (!rawDest) return [];

    const tokens = this.extractMeaningfulTokens(rawDest);
    const fullNormQuery = this.normalize(rawDest)
      .replace(/^(?:AGENCIA|SHALOM|PARA|DESTINO|SEDE)\s+/gi, '')
      .trim();

    if (tokens.length === 0 && fullNormQuery.length < 2) return [];

    const scored: Array<{ agency: ShalomAgency; score: number }> = [];

    for (const ag of this.agencies) {
      const score = this.scoreAgency(ag, tokens, fullNormQuery);
      if (score > 25) {
        scored.push({ agency: ag, score });
      }
    }

    // Ordenar de mayor a menor puntuación
    scored.sort((a, b) => b.score - a.score);

    const topMatches = scored.slice(0, limit);

    return topMatches.map(item => {
      const ag = item.agency;
      const dep = (ag.department || ag.departamento || 'LIMA').toUpperCase().trim();
      const prov = (ag.province || ag.provincia || dep).toUpperCase().trim();
      const dist = (ag.district || ag.distrito || ag.nombre || 'CENTRO').toUpperCase().trim();
      const codeStr = ag.code ? ` (CÓDIGO: ${ag.code.toUpperCase().trim()})` : '';
      const displayTitle = `${dep} / ${prov} / ${dist}${codeStr}`;
      const displayAddress = this.cleanAddressText(ag.address || ag.direccion, prov, dep);

      return {
        agency: ag,
        score: item.score,
        formattedDestino: this.formatAgencyDestination(ag, ''),
        displayTitle,
        displayAddress,
        code: ag.code || '',
      };
    });
  }

  /**
   * Resuelve de forma inteligente si la búsqueda es concluyente o requiere desambiguación interactiva
   */
  public static resolveDestination(destinationInput: string, dni: string): {
    isUnambiguousMatch: boolean;
    resolvedDestination: string;
    matches: ShalomMatchResult[];
    topMatch?: ShalomMatchResult;
  } {
    const cleanDni = (dni || '').replace(/[^0-9A-Za-z]/g, '').trim();
    const rawDest = (destinationInput || '').trim();

    // Si ya viene formateado con "Agencia Shalom: ... (DNI/CE Recojo: ...)"
    if (rawDest.toUpperCase().includes('AGENCIA SHALOM:') && rawDest.includes('DNI/CE Recojo:')) {
      return {
        isUnambiguousMatch: true,
        resolvedDestination: rawDest,
        matches: [],
      };
    }

    const matches = this.findMatchingAgencies(destinationInput, 8);

    if (matches.length === 0) {
      // Fallback limpio
      const cleanUpper = rawDest.replace(/^(?:Agencia\s*Shalom\s*:?\s*|Shalom\s*:?\s*)/i, '').trim().toUpperCase();
      return {
        isUnambiguousMatch: true,
        resolvedDestination: `Agencia Shalom: ${cleanUpper} (DNI/CE Recojo: ${cleanDni})`,
        matches: [],
      };
    }

    const first = matches[0];
    const second = matches.length > 1 ? matches[1] : null;

    // Condición de coincidencia inambigua (Exacta o Dominante):
    // 1. Solo hay 1 coincidencia
    // 2. O la primera tiene puntuación >= 150 y le saca más de 40 puntos a la segunda
    // 3. O la puntuación es altísima (>= 220) por coincidencia de código o multi-token completo
    const isDominant =
      matches.length === 1 ||
      first.score >= 220 ||
      (first.score >= 140 && (!second || first.score - second.score >= 40));

    if (isDominant) {
      return {
        isUnambiguousMatch: true,
        resolvedDestination: this.formatAgencyDestination(first.agency, cleanDni),
        matches,
        topMatch: first,
      };
    }

    return {
      isUnambiguousMatch: false,
      resolvedDestination: this.formatAgencyDestination(first.agency, cleanDni),
      matches,
      topMatch: first,
    };
  }
}
