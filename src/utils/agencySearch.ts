import { ShalomAgency, OlvaAgency } from '../types/database.types';

export interface UserCoordinates {
  latitude: number;
  longitude: number;
}

export const normalizeSearchText = (str: string | number | null | undefined): string => {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

function isFuzzyMatch(s1: string, s2: string): boolean {
  if (Math.abs(s1.length - s2.length) > 1) return false;
  if (s1 === s2) return true;

  let edits = 0;
  let i = 0;
  let j = 0;
  while (i < s1.length && j < s2.length) {
    if (s1[i] !== s2[j]) {
      edits++;
      if (edits > 1) return false;
      if (s1.length > s2.length) i++;
      else if (s2.length > s1.length) j++;
      else {
        i++;
        j++;
      }
    } else {
      i++;
      j++;
    }
  }
  return true;
}

/**
 * Motor de búsqueda inteligente de agencias (Shalom y Olva):
 * - Soporta orden inverso de palabras ("co pangoa" -> "pangoa co", "san isidro lima")
 * - Búsqueda por tokens múltiples e independientes
 * - Tolerancia de abreviaciones y prefijos ("co" -> "centro operativo", "comercial", "costado")
 * - Tolerancia de errores tipográficos (fuzzy match con distancia de Levenshtein <= 1)
 * - Puntuación de relevancia (score) y ordenamiento prioritario de resultados
 */
export function searchAndRankAgencies<T extends ShalomAgency | OlvaAgency>(
  agenciesList: T[],
  query: string
): T[] {
  if (!query || !query.trim()) {
    return agenciesList;
  }

  const rawTokens = normalizeSearchText(query).split(/\s+/).filter(t => t.length > 0);
  if (rawTokens.length === 0) return agenciesList;

  const scoredList: { agency: T; score: number }[] = [];

  for (const a of agenciesList) {
    const dep = normalizeSearchText(a.departamento || (a as any).department);
    const prov = normalizeSearchText(a.provincia || (a as any).province);
    const dist = normalizeSearchText(a.distrito || (a as any).district);
    const nom = normalizeSearchText(a.nombre || (a as any).name);
    const dir = normalizeSearchText(a.direccion || (a as any).address);
    const code = normalizeSearchText((a as any).code || (a as any).codigo);
    const ubi = normalizeSearchText(a.ubigeo);
    const full = normalizeSearchText((a as any).full_display_name || (a as any).full_name || `${dep} ${prov} ${dist} ${nom} ${dir}`);

    const primaryFields = [dist, nom, code];
    const secondaryFields = [prov, dep];
    const tertiaryFields = [dir, ubi, full];

    let matchesAllTokens = true;
    let score = 0;

    for (const token of rawTokens) {
      let tokenMatched = false;

      // 1. Coincidencia exacta o de prefijo en Distrito, Nombre o Código
      for (const field of primaryFields) {
        if (!field) continue;
        if (field === token) {
          score += 150;
          tokenMatched = true;
          break;
        } else if (field.startsWith(token) || field.includes(` ${token}`)) {
          score += 100;
          tokenMatched = true;
          break;
        } else if (field.includes(token)) {
          score += 60;
          tokenMatched = true;
          break;
        }
      }

      // 2. Coincidencia en Provincia o Departamento
      if (!tokenMatched) {
        for (const field of secondaryFields) {
          if (!field) continue;
          if (field === token) {
            score += 70;
            tokenMatched = true;
            break;
          } else if (field.startsWith(token) || field.includes(` ${token}`)) {
            score += 50;
            tokenMatched = true;
            break;
          } else if (field.includes(token)) {
            score += 30;
            tokenMatched = true;
            break;
          }
        }
      }

      // 3. Coincidencia en Dirección o texto completo
      if (!tokenMatched) {
        for (const field of tertiaryFields) {
          if (!field) continue;
          if (field.includes(token)) {
            score += 15;
            tokenMatched = true;
            break;
          }
        }
      }

      // 4. Si el token tiene 4+ letras, tolerar 1 letra de diferencia (typo)
      if (!tokenMatched && token.length >= 4) {
        const allWords = `${dist} ${nom} ${prov} ${dep} ${dir}`.split(/\s+/);
        for (const word of allWords) {
          if (word.length >= 3 && isFuzzyMatch(token, word)) {
            score += 35;
            tokenMatched = true;
            break;
          }
        }
      }

      if (!tokenMatched) {
        matchesAllTokens = false;
        break;
      }
    }

    if (matchesAllTokens) {
      const cleanQ = normalizeSearchText(query);
      if (dist.includes(cleanQ) || nom.includes(cleanQ)) {
        score += 300;
      } else if (full.includes(cleanQ)) {
        score += 100;
      }

      // Desempate por distancia haversine
      if (a.distance_meters !== undefined && a.distance_meters !== null) {
        const distKm = a.distance_meters / 1000;
        score += Math.max(0, 10 - distKm * 0.05);
      }

      scoredList.push({ agency: a, score });
    }
  }

  scoredList.sort((a, b) => b.score - a.score);

  return scoredList.map(item => item.agency);
}
