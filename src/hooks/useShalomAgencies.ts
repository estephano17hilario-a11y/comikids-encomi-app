import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { ShalomAgency } from '../types/database.types';
import { SHALOM_AGENCIES } from '../data/shalomAgencies';

export interface UseShalomAgenciesOptions {
  autoFetchNearby?: boolean;
  initialDepartment?: string;
  defaultLimit?: number;
}

export interface UserCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Limpia el texto de la dirección eliminando sufijos repetitivos de provincia/departamento
 */
export function cleanAddressText(address: string | null | undefined, prov?: string, dep?: string): string {
  if (!address) return '';
  let cleaned = address.trim();

  // Quitar etiquetas de código si vinieran en el string
  cleaned = cleaned.replace(/\(CÓDIGO:[^)]+\)/gi, '').trim();

  // Quitar repeticiones tipo ", BAGUA - BAGUA - AMAZONAS" o "- LIMA - LIMA"
  if (prov && dep) {
    const p = prov.toUpperCase().trim();
    const d = dep.toUpperCase().trim();
    const regex1 = new RegExp(`,?\\s*${p}\\s*-\\s*${p}\\s*-\\s*${d}`, 'gi');
    const regex2 = new RegExp(`,?\\s*${p}\\s*-\\s*${d}`, 'gi');
    const regex3 = new RegExp(`,?\\s*${d}\\s*-\\s*${p}`, 'gi');
    cleaned = cleaned.replace(regex1, '').replace(regex2, '').replace(regex3, '');
  }

  // Limpiar dobles comas o guiones colgados
  cleaned = cleaned
    .replace(/,\s*,/g, ',')
    .replace(/,\s*-\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

/**
 * Formatea el nombre completo y canónico de la agencia con su jerarquía exacta y código oficial:
 * [DEPARTAMENTO] / [PROVINCIA] / [DISTRITO] / [LOCAL] (CÓDIGO: XXX) – [DIRECCIÓN_LIMPIA] ([DISTANCIA] km)
 */
export function formatFullAgencyName(agency: ShalomAgency): string {
  const dep = (agency.departamento || agency.department || 'PERÚ').toUpperCase().trim();
  const prov = (agency.provincia || agency.province || dep).toUpperCase().trim();
  const dist = (agency.distrito || agency.district || 'CENTRO').toUpperCase().trim();
  
  // Extraer nombre local si aporta valor y no repite el distrito
  let localName = '';
  if (agency.nombre && agency.nombre.includes('/')) {
    const segments = agency.nombre.split('/').map(s => s.trim().toUpperCase()).filter(Boolean);
    const lastSeg = segments[segments.length - 1];
    if (lastSeg && lastSeg !== dist && lastSeg !== prov && lastSeg !== dep) {
      localName = ` / ${lastSeg}`;
    }
  }

  const codeTag = agency.code ? ` (CÓDIGO: ${agency.code.toUpperCase().trim()})` : '';
  const locationPath = `${dep} / ${prov} / ${dist}${localName}${codeTag}`;
  const cleanAddr = cleanAddressText(agency.direccion || agency.address, prov, dep);
  
  const distanceTag = agency.distance_meters !== undefined 
    ? (agency.distance_meters < 1000 
        ? ` (${Math.round(agency.distance_meters)} m)` 
        : ` (${(agency.distance_meters / 1000).toFixed(1)} km)`)
    : '';

  if (cleanAddr) {
    return `${locationPath} – ${cleanAddr}${distanceTag}`.toUpperCase();
  }

  return `${locationPath}${distanceTag}`.toUpperCase();
}

/**
 * Nombre corto y amigable para tarjetas o pines en el mapa
 */
export function formatShortAgencyName(agency: ShalomAgency): string {
  const dist = (agency.distrito || agency.district || 'CENTRO').toUpperCase().trim();
  let localName = dist;

  if (agency.nombre && agency.nombre.includes('/')) {
    const segments = agency.nombre.split('/').map(s => s.trim().toUpperCase()).filter(Boolean);
    const lastSeg = segments[segments.length - 1];
    if (lastSeg) localName = lastSeg;
  }

  return localName;
}

/**
 * Calcula la distancia haversine aproximada en metros entre dos puntos
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

const normalizeSearchText = (str: string | number | null | undefined): string => {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

/**
 * Hook personalizado para la gestión, mapa interactivo y geolocalización inteligente de Agencias Shalom
 */
export function useShalomAgencies(options: UseShalomAgenciesOptions = {}) {
  const { autoFetchNearby = false, initialDepartment = 'TODOS', defaultLimit = 1500 } = options;

  const [agencies, setAgencies] = useState<ShalomAgency[]>([]);
  const [allAgencies, setAllAgencies] = useState<ShalomAgency[]>([]);
  const [nearestAgency, setNearestAgency] = useState<ShalomAgency | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserCoordinates | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>(initialDepartment);
  const [searchQuery, setSearchQueryState] = useState<string>('');
  const [showOnlyNearest5, setShowOnlyNearest5] = useState<boolean>(false);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    if (query.trim()) {
      setShowOnlyNearest5(false);
    }
  }, []);

  /**
   * Recalcula distancias para todas las agencias a partir de las coordenadas del usuario
   */
  const applyDistances = useCallback((catalog: ShalomAgency[], coords: UserCoordinates): ShalomAgency[] => {
    return catalog
      .map(ag => {
        if (ag.latitude && ag.longitude) {
          const dist = calculateDistanceMeters(
            coords.latitude,
            coords.longitude,
            Number(ag.latitude),
            Number(ag.longitude)
          );
          return {
            ...ag,
            distance_meters: dist,
            full_display_name: formatFullAgencyName({ ...ag, distance_meters: dist })
          };
        }
        return {
          ...ag,
          full_display_name: formatFullAgencyName(ag)
        };
      })
      .sort((a, b) => (a.distance_meters ?? 99999999) - (b.distance_meters ?? 99999999));
  }, []);

  /**
   * Solicitar coordenadas GPS del usuario (Navegador / Capacitor)
   */
  const requestUserLocation = useCallback(async (): Promise<UserCoordinates | null> => {
    setIsLocating(true);
    setGpsError(null);

    return new Promise((resolve) => {
      // 1. Intentar Capacitor Geolocation si está disponible en móvil
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isPluginAvailable?.('Geolocation')) {
        try {
          const Geolocation = (window as any).Capacitor.Plugins.Geolocation;
          Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 })
            .then((pos: any) => {
              const coords: UserCoordinates = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude
              };
              setUserLocation(coords);
              setIsLocating(false);
              resolve(coords);
            })
            .catch(() => fallbackBrowserLocation(resolve));
          return;
        } catch {
          // continuar a browser
        }
      }

      fallbackBrowserLocation(resolve);
    });

    function fallbackBrowserLocation(resolvePromise: (val: UserCoordinates | null) => void) {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setGpsError('Tu navegador no soporta geolocalización GPS.');
        setIsLocating(false);
        resolvePromise(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: UserCoordinates = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          };
          setUserLocation(coords);
          setIsLocating(false);
          setGpsError(null);
          resolvePromise(coords);
        },
        (err) => {
          console.warn('⚠️ Error de geolocalización GPS:', err.message);
          let userMsg = 'No se pudo obtener tu ubicación GPS.';
          if (err.code === 1) {
            userMsg = 'Permiso denegado. Por favor autoriza el acceso a tu ubicación en tu navegador para ver las agencias cercanas.';
          } else if (err.code === 2) {
            userMsg = 'Ubicación no disponible en este momento.';
          } else if (err.code === 3) {
            userMsg = 'Tiempo de espera agotado al conectar con GPS.';
          }
          setGpsError(userMsg);
          setIsLocating(false);
          resolvePromise(null);
        },
        { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 }
      );
    }
  }, []);

  /**
   * Cargar catálogo general desde Supabase o fallback local
   */
  const fetchAgenciesCatalog = useCallback(async (coords?: UserCoordinates | null) => {
    setLoading(true);
    try {
      let catalog: ShalomAgency[] = [];

      if (supabase) {
        const { data, error: dbError } = await supabase
          .from('shalom_agencies')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true })
          .limit(defaultLimit);

        if (!dbError && data && data.length > 0) {
          catalog = data.map((row: any) => {
            const item: ShalomAgency = {
              id: row.id,
              code: row.code,
              nombre: row.name,
              departamento: row.department,
              provincia: row.province,
              distrito: row.district,
              department: row.department,
              province: row.province,
              district: row.district,
              ubigeo: row.ubigeo,
              dep_id: row.dep_id,
              prov_id: row.prov_id,
              dist_id: row.dist_id,
              direccion: row.address,
              telefono: row.phone,
              horario: row.schedule,
              latitude: row.latitude ? Number(row.latitude) : null,
              longitude: row.longitude ? Number(row.longitude) : null
            };
            item.full_display_name = formatFullAgencyName(item);
            return item;
          });
        }
      }

      if (catalog.length === 0) {
        catalog = SHALOM_AGENCIES.map(a => {
          const item: ShalomAgency = {
            ...a,
            department: a.departamento,
            province: a.provincia,
            district: a.distrito,
            latitude: a.latitude ? Number(a.latitude) : null,
            longitude: a.longitude ? Number(a.longitude) : null
          };
          item.full_display_name = formatFullAgencyName(item);
          return item;
        });
      }

      const targetCoords = coords || userLocation;
      if (targetCoords) {
        catalog = applyDistances(catalog, targetCoords);
        setNearestAgency(catalog[0] || null);
      }

      setAllAgencies(catalog);
      setAgencies(catalog);
    } catch (err: any) {
      console.warn('Usando catálogo local de agencias Shalom:', err);
      let localCat: ShalomAgency[] = SHALOM_AGENCIES.map(a => ({
        ...a,
        department: a.departamento,
        province: a.provincia,
        district: a.distrito,
        latitude: a.latitude ? Number(a.latitude) : null,
        longitude: a.longitude ? Number(a.longitude) : null,
        full_display_name: formatFullAgencyName(a)
      }));
      const targetCoords = coords || userLocation;
      if (targetCoords) {
        localCat = applyDistances(localCat, targetCoords);
        setNearestAgency(localCat[0] || null);
      }
      setAllAgencies(localCat);
      setAgencies(localCat);
    } finally {
      setLoading(false);
    }
  }, [userLocation, applyDistances, defaultLimit]);

  // Carga inicial
  useEffect(() => {
    let isMounted = true;

    async function init() {
      let coords: UserCoordinates | null = null;
      if (autoFetchNearby) {
        coords = await requestUserLocation();
      }
      if (isMounted) {
        await fetchAgenciesCatalog(coords);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [autoFetchNearby, fetchAgenciesCatalog, requestUserLocation]);

  /**
   * Obtener las N sedes más cercanas
   */
  const getTopNearestAgencies = useCallback((count: number = 5): ShalomAgency[] => {
    const list = allAgencies.length > 0 ? allAgencies : (agencies.length > 0 ? agencies : SHALOM_AGENCIES);
    const withDistance = list.filter(a => a.distance_meters !== undefined && a.distance_meters !== null);
    if (withDistance.length > 0) {
      return withDistance.slice(0, count);
    }
    return list.slice(0, count);
  }, [allAgencies, agencies]);

  /**
   * Filtrar por texto, departamento o modo "Top 5 más cercanas"
   */
  const filteredAgencies = useMemo(() => {
    let source = allAgencies.length > 0 ? allAgencies : (agencies.length > 0 ? agencies : SHALOM_AGENCIES);

    if (showOnlyNearest5 && userLocation) {
      return source
        .filter(a => a.distance_meters !== undefined && a.distance_meters !== null)
        .slice(0, 5);
    }

    const q = normalizeSearchText(searchQuery);

    if (q) {
      return source.filter((a) => {
        const fullStr = normalizeSearchText(a.full_display_name || formatFullAgencyName(a));
        const dep = normalizeSearchText(a.departamento || a.department);
        const prov = normalizeSearchText(a.provincia || a.province);
        const dist = normalizeSearchText(a.distrito || a.district);
        const nom = normalizeSearchText(a.nombre);
        const dir = normalizeSearchText(a.direccion);
        const ubi = normalizeSearchText(a.ubigeo);

        return (
          fullStr.includes(q) ||
          dep.includes(q) ||
          prov.includes(q) ||
          dist.includes(q) ||
          nom.includes(q) ||
          dir.includes(q) ||
          ubi.includes(q)
        );
      });
    } else if (selectedDepartment && selectedDepartment !== 'TODOS') {
      const depTarget = normalizeSearchText(selectedDepartment);
      return source.filter(
        (a) => normalizeSearchText(a.departamento || a.department) === depTarget
      );
    }

    return source;
  }, [agencies, allAgencies, selectedDepartment, searchQuery, showOnlyNearest5, userLocation]);

  /**
   * Lista de todos los departamentos únicos disponibles
   */
  const availableDepartments = useMemo(() => {
    const source = allAgencies.length > 0 ? allAgencies : SHALOM_AGENCIES;
    const deps = new Set(
      source
        .map((a) => (a.departamento || a.department || '').toUpperCase().trim())
        .filter(Boolean)
    );
    return ['TODOS', ...Array.from(deps).sort()];
  }, [allAgencies]);

  /**
   * Activar GPS explícitamente y actualizar todas las distancias
   */
  const triggerGpsLookup = useCallback(async (): Promise<{ coords: UserCoordinates | null; nearest: ShalomAgency | null; top5: ShalomAgency[] }> => {
    const coords = await requestUserLocation();
    if (coords) {
      const updated = applyDistances(allAgencies.length > 0 ? allAgencies : SHALOM_AGENCIES, coords);
      setAllAgencies(updated);
      setAgencies(updated);
      const topNearest = updated[0] || null;
      setNearestAgency(topNearest);
      return {
        coords,
        nearest: topNearest,
        top5: updated.slice(0, 5)
      };
    }
    return {
      coords: null,
      nearest: nearestAgency,
      top5: []
    };
  }, [requestUserLocation, applyDistances, allAgencies, nearestAgency]);

  return {
    agencies: filteredAgencies,
    allAgencies,
    nearestAgency,
    loading,
    isLocating,
    error,
    gpsError,
    userLocation,
    selectedDepartment,
    setSelectedDepartment,
    searchQuery,
    setSearchQuery,
    availableDepartments,
    showOnlyNearest5,
    setShowOnlyNearest5,
    getTopNearestAgencies,
    triggerGpsLookup,
    refreshLocation: triggerGpsLookup,
    refetchCatalog: fetchAgenciesCatalog
  };
}
