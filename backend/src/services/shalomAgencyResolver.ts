import { SHALOM_AGENCIES } from '../data/shalomAgencies.js';
import officialAgenciesData from '../data/shalom_official_agencies.json' with { type: 'json' };
import {
  SHALOM_CODE_TO_OFFICIAL_MAP,
  SHALOM_NAME_TO_OFFICIAL_MAP,
  SHALOM_LOCAL_TO_OFFICIAL_MAP
} from '../data/shalomAgencyCanonicalMap.js';
import { ShalomAgency } from '../types/database.types.js';

export const OFFICIAL_DESTINATIONS: string[] = (officialAgenciesData as any).destinations || [];
export const OFFICIAL_ORIGINS: string[] = (officialAgenciesData as any).origins || [];

export interface ResolvedShalomAgency {
  terminalId: number;
  code: string;
  officialDestination: string;
  agencyName: string;
  fullName: string;
  department: string;
  province: string;
  district: string;
  address: string;
  isVerified: boolean;
}

export const normalizeTextKey = (str: string): string => {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const normalizeCompactKey = (str: string): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
};

const cleanCodeStr = (c: string): string => {
  return (c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
};

const agencyById = new Map<number, ShalomAgency>();
const agencyByCode = new Map<string, ShalomAgency[]>();
const agencyByOfficial = new Map<string, ShalomAgency[]>();
const agencyByCompactName = new Map<string, ShalomAgency>();

for (const ag of SHALOM_AGENCIES) {
  const numericId = Number(ag.id);
  if (numericId) {
    agencyById.set(numericId, ag);
  }

  if (ag.code) {
    const cClean = cleanCodeStr(ag.code);
    if (cClean) {
      const existing = agencyByCode.get(cClean) || [];
      existing.push(ag);
      agencyByCode.set(cClean, existing);
    }
  }

  const rawName = (ag.name || ag.nombre || '').trim();
  if (rawName) {
    agencyByCompactName.set(normalizeCompactKey(rawName), ag);
  }

  const off = (ag.code && SHALOM_CODE_TO_OFFICIAL_MAP[ag.code.toUpperCase().trim()]) || ag.distrito || ag.nombre;
  if (off) {
    const offNorm = normalizeCompactKey(off);
    const existing = agencyByOfficial.get(offNorm) || [];
    existing.push(ag);
    agencyByOfficial.set(offNorm, existing);
  }
}

export const extractShalomDestino = (destinoDetalle: string, agencyCode?: string | null): string => {
  if (agencyCode) {
    const codeClean = agencyCode.toUpperCase().trim();
    if (SHALOM_CODE_TO_OFFICIAL_MAP[codeClean]) {
      return SHALOM_CODE_TO_OFFICIAL_MAP[codeClean];
    }
    const ag = SHALOM_AGENCIES.find(a => a.code && cleanCodeStr(a.code) === cleanCodeStr(codeClean));
    if (ag) {
      const off = (ag.code && SHALOM_CODE_TO_OFFICIAL_MAP[ag.code.toUpperCase().trim()]) || ag.distrito || ag.nombre;
      if (off) return off;
    }
  }

  if (!destinoDetalle) return 'LIMA AV TINGO MARÍA';

  const embeddedCodeMatch = destinoDetalle.match(/\((?:CÓDIGO|CODIGO|COD)[\s:]*([^)]+)\)/i) ||
                            destinoDetalle.match(/(?:CÓDIGO|CODIGO|COD)[\s:]*([A-Za-z0-9._-]+)/i);
  if (embeddedCodeMatch && embeddedCodeMatch[1]) {
    const extractedCode = embeddedCodeMatch[1].toUpperCase().trim();
    if (SHALOM_CODE_TO_OFFICIAL_MAP[extractedCode]) {
      return SHALOM_CODE_TO_OFFICIAL_MAP[extractedCode];
    }
    const cClean = cleanCodeStr(extractedCode);
    const ag = SHALOM_AGENCIES.find(a => a.code && cleanCodeStr(a.code) === cClean);
    if (ag && ag.code && SHALOM_CODE_TO_OFFICIAL_MAP[ag.code.toUpperCase().trim()]) {
      return SHALOM_CODE_TO_OFFICIAL_MAP[ag.code.toUpperCase().trim()];
    }
  }

  const clean = destinoDetalle
    .replace(/^Agencia Shalom:\s*/i, '')
    .replace(/\(DNI[\s\/]*CE[^)]*\)/gi, '')
    .replace(/\(DNI[^)]*\)/gi, '')
    .replace(/\(CE[^)]*\)/gi, '')
    .replace(/\(Doc[^)]*\)/gi, '')
    .replace(/\(Tel[^)]*\)/gi, '')
    .replace(/\(Correo[^)]*\)/gi, '')
    .replace(/\(Email[^)]*\)/gi, '')
    .replace(/\(Ref[^)]*\)/gi, '')
    .replace(/\(\d+(?:\.\d+)?\s*(?:km|m)\)/gi, '')
    .replace(/\(CÓDIGO:[^)]+\)/gi, '')
    .replace(/\(CODIGO:[^)]+\)/gi, '')
    .trim();

  let locationPath = clean;
  if (clean.includes(' – ')) {
    locationPath = clean.split(' – ')[0].trim();
  } else if (clean.includes(' — ')) {
    locationPath = clean.split(' — ')[0].trim();
  } else if (clean.includes(' • ')) {
    locationPath = clean.split(' • ')[0].trim();
  } else if (clean.includes(' - ')) {
    const p = clean.split(' - ');
    if (p[0].includes('/')) {
      locationPath = p[0].trim();
    }
  }

  let extractedParenName = '';
  const parenMatch = locationPath.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]) {
    extractedParenName = parenMatch[1].trim().toUpperCase();
  }

  const compactLocation = normalizeCompactKey(locationPath);

  if (SHALOM_NAME_TO_OFFICIAL_MAP[locationPath.toUpperCase()]) {
    return SHALOM_NAME_TO_OFFICIAL_MAP[locationPath.toUpperCase()];
  }
  if (SHALOM_NAME_TO_OFFICIAL_MAP[compactLocation]) {
    return SHALOM_NAME_TO_OFFICIAL_MAP[compactLocation];
  }

  if (extractedParenName) {
    if (SHALOM_LOCAL_TO_OFFICIAL_MAP[extractedParenName]) {
      return SHALOM_LOCAL_TO_OFFICIAL_MAP[extractedParenName];
    }
    if (SHALOM_LOCAL_TO_OFFICIAL_MAP[normalizeCompactKey(extractedParenName)]) {
      return SHALOM_LOCAL_TO_OFFICIAL_MAP[normalizeCompactKey(extractedParenName)];
    }
  }

  const cleanPathNoParen = locationPath.replace(/\([^)]+\)/g, '').trim();
  const segments = cleanPathNoParen
    .split('/')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  const depSeg = segments[0] || '';
  const lastSeg = segments.length > 0 ? segments[segments.length - 1] : '';
  const compactLast = normalizeCompactKey(lastSeg);

  if (lastSeg && SHALOM_LOCAL_TO_OFFICIAL_MAP[lastSeg]) {
    return SHALOM_LOCAL_TO_OFFICIAL_MAP[lastSeg];
  }
  if (compactLast && SHALOM_LOCAL_TO_OFFICIAL_MAP[compactLast]) {
    return SHALOM_LOCAL_TO_OFFICIAL_MAP[compactLast];
  }

  if (depSeg && lastSeg) {
    const depLocalKey = normalizeCompactKey(depSeg + ' ' + lastSeg);
    if (SHALOM_NAME_TO_OFFICIAL_MAP[depLocalKey]) {
      return SHALOM_NAME_TO_OFFICIAL_MAP[depLocalKey];
    }
    if (SHALOM_LOCAL_TO_OFFICIAL_MAP[depLocalKey]) {
      return SHALOM_LOCAL_TO_OFFICIAL_MAP[depLocalKey];
    }
  }

  const matchedAg = SHALOM_AGENCIES.find(a => {
    const aNameNorm = normalizeCompactKey(a.name || a.nombre || '');
    const aDistNorm = normalizeCompactKey(a.distrito || a.district || '');
    return (
      (compactLast && (aDistNorm === compactLast || aNameNorm.endsWith(compactLast))) ||
      (compactLocation && (aNameNorm === compactLocation || compactLocation.endsWith(aDistNorm)))
    );
  });

  if (matchedAg) {
    const off = (matchedAg.code && SHALOM_CODE_TO_OFFICIAL_MAP[matchedAg.code.toUpperCase().trim()]) || matchedAg.distrito || matchedAg.nombre;
    if (off) return off;
  }

  return 'LIMA AV TINGO MARÍA';
};

export const resolveShalomAgencyDetails = (
  query: string | { destino_detalle?: string; agencyCode?: string; agencyId?: number | string; receiver?: any; destinatario?: any; destination_agency?: string }
): ResolvedShalomAgency => {
  let queryText = '';
  let directCode = '';
  let directId: number | undefined = undefined;

  if (typeof query === 'string') {
    queryText = query.trim();
  } else if (query) {
    queryText = (
      query.destino_detalle ||
      query.destination_agency ||
      query.receiver?.destination_agency ||
      query.destinatario?.agenciaDestino ||
      ''
    ).trim();
    directCode = (query.agencyCode || query.receiver?.destination_agency_code || '').trim();
    if (query.agencyId) directId = Number(query.agencyId);
  }

  // 1. Si se proporciona ID directo numérico válido
  if (directId && agencyById.has(directId)) {
    const ag = agencyById.get(directId)!;
    const off = (ag.code && SHALOM_CODE_TO_OFFICIAL_MAP[ag.code.toUpperCase().trim()]) || ag.distrito || ag.nombre;
    return {
      terminalId: Number(ag.id),
      code: ag.code || '',
      officialDestination: off,
      agencyName: ag.name || ag.nombre || '',
      fullName: ag.full_name || ag.name || '',
      department: ag.departamento || ag.department || '',
      province: ag.provincia || ag.province || '',
      district: ag.distrito || ag.district || '',
      address: ag.direccion || ag.address || '',
      isVerified: true,
    };
  }

  // 2. Si se proporciona código explícito o embebido en el texto
  let targetCode = directCode;
  if (!targetCode && queryText) {
    const m = queryText.match(/\((?:CÓDIGO|CODIGO|COD)[\s:]*([^)]+)\)/i) ||
              queryText.match(/(?:CÓDIGO|CODIGO|COD)[\s:]*([A-Za-z0-9._-]+)/i);
    if (m && m[1]) {
      targetCode = m[1].trim();
    }
  }

  if (targetCode) {
    const cClean = cleanCodeStr(targetCode);
    const matches = agencyByCode.get(cClean) || [];
    if (matches.length === 1) {
      const ag = matches[0];
      const off = (ag.code && SHALOM_CODE_TO_OFFICIAL_MAP[ag.code.toUpperCase().trim()]) || ag.distrito || ag.nombre;
      return {
        terminalId: Number(ag.id),
        code: ag.code || '',
        officialDestination: off,
        agencyName: ag.name || ag.nombre || '',
        fullName: ag.full_name || ag.name || '',
        department: ag.departamento || ag.department || '',
        province: ag.provincia || ag.province || '',
        district: ag.distrito || ag.district || '',
        address: ag.direccion || ag.address || '',
        isVerified: true,
      };
    } else if (matches.length > 1 && queryText) {
      const qNorm = normalizeCompactKey(queryText);
      const depMatch = matches.find(ag => {
        const depNorm = normalizeCompactKey(ag.departamento || ag.department || '');
        const distNorm = normalizeCompactKey(ag.distrito || ag.district || '');
        return (depNorm && qNorm.includes(depNorm)) || (distNorm && qNorm.includes(distNorm));
      });
      if (depMatch) {
        const off = (depMatch.code && SHALOM_CODE_TO_OFFICIAL_MAP[depMatch.code.toUpperCase().trim()]) || depMatch.distrito || depMatch.nombre;
        return {
          terminalId: Number(depMatch.id),
          code: depMatch.code || '',
          officialDestination: off,
          agencyName: depMatch.name || depMatch.nombre || '',
          fullName: depMatch.full_name || depMatch.name || '',
          department: depMatch.departamento || depMatch.department || '',
          province: depMatch.provincia || depMatch.province || '',
          district: depMatch.distrito || depMatch.district || '',
          address: depMatch.direccion || depMatch.address || '',
          isVerified: true,
        };
      }
    }
  }

  // 3. Extraer nombre canónico oficial
  const officialDest = extractShalomDestino(queryText, directCode);
  const offNorm = normalizeCompactKey(officialDest);

  if (agencyByOfficial.has(offNorm)) {
    const matches = agencyByOfficial.get(offNorm)!;
    if (matches.length === 1) {
      const ag = matches[0];
      return {
        terminalId: Number(ag.id),
        code: ag.code || '',
        officialDestination: officialDest,
        agencyName: ag.name || ag.nombre || '',
        fullName: ag.full_name || ag.name || '',
        department: ag.departamento || ag.department || '',
        province: ag.provincia || ag.province || '',
        district: ag.distrito || ag.district || '',
        address: ag.direccion || ag.address || '',
        isVerified: true,
      };
    } else if (matches.length > 1 && queryText) {
      const qNorm = normalizeCompactKey(queryText);
      const depMatch = matches.find(ag => {
        const depNorm = normalizeCompactKey(ag.departamento || ag.department || '');
        return depNorm && qNorm.includes(depNorm);
      });
      if (depMatch) {
        return {
          terminalId: Number(depMatch.id),
          code: depMatch.code || '',
          officialDestination: officialDest,
          agencyName: depMatch.name || depMatch.nombre || '',
          fullName: depMatch.full_name || depMatch.name || '',
          department: depMatch.departamento || depMatch.department || '',
          province: depMatch.provincia || depMatch.province || '',
          district: depMatch.distrito || depMatch.district || '',
          address: depMatch.direccion || depMatch.address || '',
          isVerified: true,
        };
      }
      const first = matches[0];
      return {
        terminalId: Number(first.id),
        code: first.code || '',
        officialDestination: officialDest,
        agencyName: first.name || first.nombre || '',
        fullName: first.full_name || first.name || '',
        department: first.departamento || first.department || '',
        province: first.provincia || first.province || '',
        district: first.distrito || first.district || '',
        address: first.direccion || first.address || '',
        isVerified: true,
      };
    }
  }

  // 4. Coincidencia por nombre compacto
  const qCompact = normalizeCompactKey(queryText);
  if (agencyByCompactName.has(qCompact)) {
    const ag = agencyByCompactName.get(qCompact)!;
    const off = (ag.code && SHALOM_CODE_TO_OFFICIAL_MAP[ag.code.toUpperCase().trim()]) || ag.distrito || ag.nombre;
    return {
      terminalId: Number(ag.id),
      code: ag.code || '',
      officialDestination: off,
      agencyName: ag.name || ag.nombre || '',
      fullName: ag.full_name || ag.name || '',
      department: ag.departamento || ag.department || '',
      province: ag.provincia || ag.province || '',
      district: ag.distrito || ag.district || '',
      address: ag.direccion || ag.address || '',
      isVerified: true,
    };
  }

  // 5. Fallback seguro
  const defaultAg = SHALOM_AGENCIES.find(a => a.id === 449 || a.code === 'lAVTM' || a.name?.includes('TINGO MARÍA')) || SHALOM_AGENCIES[0];
  return {
    terminalId: Number(defaultAg?.id || 449),
    code: defaultAg?.code || 'lAVTM',
    officialDestination: officialDest || 'LIMA AV TINGO MARÍA',
    agencyName: defaultAg?.name || defaultAg?.nombre || 'LIMA / LIMA / CERCADO LIMA / LIMA AV TINGO MARÍA',
    fullName: defaultAg?.full_name || defaultAg?.name || '',
    department: defaultAg?.departamento || defaultAg?.department || 'LIMA',
    province: defaultAg?.provincia || defaultAg?.province || 'LIMA',
    district: defaultAg?.distrito || defaultAg?.district || 'LIMA AV TINGO MARÍA',
    address: defaultAg?.direccion || defaultAg?.address || 'AV. TINGO MARÍA N°1252-A',
    isVerified: false,
  };
};
