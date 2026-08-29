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
const normalizedAgencyCache = new WeakMap<object, {
  dist: string;
  nom: string;
  code: string;
  prov: string;
  dep: string;
  dir: string;
  full: string;
  words: string[];
}>();

function getCachedNormalized(a: any) {
  let cached = normalizedAgencyCache.get(a);
  if (!cached) {
    const dep = normalizeSearchText(a.departamento || a.department);
    const prov = normalizeSearchText(a.provincia || a.province);
    const dist = normalizeSearchText(a.distrito || a.district);
    const nom = normalizeSearchText(a.nombre || a.name);
    const dir = normalizeSearchText(a.direccion || a.address);
    const code = normalizeSearchText(a.code || a.codigo);
    const full = `${dep} ${prov} ${dist} ${nom} ${dir} ${code}`;
    const words = full.split(/\s+/).filter(Boolean);
    cached = { dist, nom, code, prov, dep, dir, full, words };
    normalizedAgencyCache.set(a, cached);
  }
  return cached;
}

/**
 * Motor de búsqueda inteligente de agencias (Shalom y Olva) con caché de alto rendimiento:
 * - Soporta orden inverso de palabras ("co pangoa" -> "pangoa co", "san isidro lima")
 * - Búsqueda por tokens múltiples e independientes
 * - Tolerancia de errores tipográficos (fuzzy match rápido)
 * - Puntuación de relevancia (score) y ordenamiento prioritario
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

  const cleanQ = normalizeSearchText(query);
  const scoredList: { agency: T; score: number }[] = [];

  for (let idx = 0; idx < agenciesList.length; idx++) {
    const a = agenciesList[idx];
    const { dist, nom, code, prov, dep, dir, full, words } = getCachedNormalized(a);

    let matchesAllTokens = true;
    let score = 0;

    for (let tIdx = 0; tIdx < rawTokens.length; tIdx++) {
      const token = rawTokens[tIdx];
      let tokenMatched = false;

      // 1. Coincidencia directa en Distrito, Nombre o Código
      if (dist === token || nom === token || code === token) {
        score += 150;
        tokenMatched = true;
      } else if (dist.startsWith(token) || nom.startsWith(token) || code.startsWith(token)) {
        score += 100;
        tokenMatched = true;
      } else if (dist.includes(token) || nom.includes(token) || code.includes(token)) {
        score += 60;
        tokenMatched = true;
      }

      // 2. Coincidencia en Provincia o Departamento
      if (!tokenMatched) {
        if (prov === token || dep === token) {
          score += 70;
          tokenMatched = true;
        } else if (prov.startsWith(token) || dep.startsWith(token)) {
          score += 50;
          tokenMatched = true;
        } else if (prov.includes(token) || dep.includes(token)) {
          score += 30;
          tokenMatched = true;
        }
      }

      // 3. Coincidencia en Dirección o texto completo
      if (!tokenMatched) {
        if (dir.includes(token) || full.includes(token)) {
          score += 15;
          tokenMatched = true;
        }
      }

      // 4. Fuzzy match tolerante a 1 typo para tokens de 4+ letras
      if (!tokenMatched && token.length >= 4) {
        for (let wIdx = 0; wIdx < words.length; wIdx++) {
          const word = words[wIdx];
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
      if (dist.includes(cleanQ) || nom.includes(cleanQ)) {
        score += 300;
      } else if (full.includes(cleanQ)) {
        score += 100;
      }

      // Desempate por distancia GPS si está disponible
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
