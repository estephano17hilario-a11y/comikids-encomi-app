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
 * Formatea el nombre completo y detallado de la agencia con todos sus identificadores:
 * [DEPARTAMENTO] / [PROVINCIA] / [DISTRITO] / [NOMBRE_AGENCIA] - [DIRECCION] (CÓDIGO: [CODE]) ([DISTANCIA] km)
 */
export function formatFullAgencyName(agency: ShalomAgency): string {
  const dep = (agency.departamento || agency.department || 'PERÚ').toUpperCase().trim();
  const prov = (agency.provincia || agency.province || dep).toUpperCase().trim();
  const dist = (agency.distrito || agency.district || 'CENTRO').toUpperCase().trim();
  const locationPath = `${dep} / ${prov} / ${dist}`;
  const agencyDetail = `${agency.nombre}${agency.direccion ? ` - ${agency.direccion}` : ''}`;
  const codeTag = agency.code ? ` (CÓDIGO: ${agency.code})` : '';
  const distanceTag = agency.distance_meters !== undefined 
    ? ` (${(agency.distance_meters / 1000).toFixed(1)} km)` 
    : '';

  return `${locationPath} / ${agencyDetail}${codeTag}${distanceTag}`.toUpperCase();
}

/**
 * Calcula la distancia haversine aproximada en metros entre dos puntos (fallback offline)
 */
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
 * Hook personalizado para la gestión y geolocalización inteligente de Agencias Shalom
 */
export function useShalomAgencies(options: UseShalomAgenciesOptions = {}) {
  const { autoFetchNearby = true, initialDepartment = 'TODOS', defaultLimit = 1500 } = options;

  const [agencies, setAgencies] = useState<ShalomAgency[]>([]);
  const [allAgencies, setAllAgencies] = useState<ShalomAgency[]>([]);
  const [nearestAgency, setNearestAgency] = useState<ShalomAgency | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserCoordinates | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>(initialDepartment);
  const [searchQuery, setSearchQuery] = useState<string>('');

  /**
   * Obtener coordenadas GPS del usuario (Capacitor / Browser Geolocation)
   */
  const requestUserLocation = useCallback(async (): Promise<UserCoordinates | null> => {
    return new Promise((resolve) => {
      // 1. Intentar Capacitor Geolocation si está disponible globalmente
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isPluginAvailable?.('Geolocation')) {
        try {
          const Geolocation = (window as any).Capacitor.Plugins.Geolocation;
          Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 })
            .then((pos: any) => {
              const coords = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude
              };
              setUserLocation(coords);
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
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
            };
            setUserLocation(coords);
            resolvePromise(coords);
          },
          (err) => {
            console.warn('⚠️ No se pudo obtener ubicación por GPS:', err.message);
            resolvePromise(null);
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
      } else {
        resolvePromise(null);
      }
    }
  }, []);

  /**
   * Cargar catálogo general desde Supabase o fallback local (546 agencias de todo el Perú)
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
          .limit(1500);

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
              latitude: row.latitude,
              longitude: row.longitude
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
            district: a.distrito
          };
          item.full_display_name = formatFullAgencyName(item);
          return item;
        });
      }

      // Si hay coordenadas GPS, calcular distancias para todas las agencias
      const targetCoords = coords || userLocation;
      if (targetCoords) {
        catalog = catalog.map(ag => {
          if (ag.latitude && ag.longitude) {
            const dist = calculateDistanceMeters(
              targetCoords.latitude,
              targetCoords.longitude,
              ag.latitude,
              ag.longitude
            );
            return { ...ag, distance_meters: dist, full_display_name: formatFullAgencyName({ ...ag, distance_meters: dist }) };
          }
          return ag;
        }).sort((a, b) => (a.distance_meters ?? 99999999) - (b.distance_meters ?? 99999999));

        setNearestAgency(catalog[0] || null);
      }

      setAllAgencies(catalog);
      setAgencies(catalog);
    } catch (err: any) {
      console.warn('Usando catálogo local de agencias Shalom:', err);
      setAllAgencies(SHALOM_AGENCIES);
      setAgencies(SHALOM_AGENCIES);
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  // Inicialización garantizada: siempre carga el catálogo completo de 546 agencias
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
   * Filtrar por texto y/o departamento en memoria (sin límite artificial)
   */
  const filteredAgencies = useMemo(() => {
    let result = allAgencies.length > 0 ? allAgencies : (agencies.length > 0 ? agencies : SHALOM_AGENCIES);

    const q = normalizeSearchText(searchQuery);

    if (q) {
      // Búsqueda global en todas las provincias de Perú
      result = result.filter((a) => {
        const fullStr = normalizeSearchText(a.full_display_name || formatFullAgencyName(a));
        const fullName = normalizeSearchText(a.full_name);
        const dep = normalizeSearchText(a.departamento || a.department);
        const prov = normalizeSearchText(a.provincia || a.province);
        const dist = normalizeSearchText(a.distrito || a.district);
        const nom = normalizeSearchText(a.nombre);
        const dir = normalizeSearchText(a.direccion);
        const code = normalizeSearchText(a.code);
        const ubi = normalizeSearchText(a.ubigeo);

        return (
          fullStr.includes(q) ||
          fullName.includes(q) ||
          dep.includes(q) ||
          prov.includes(q) ||
          dist.includes(q) ||
          nom.includes(q) ||
          dir.includes(q) ||
          code.includes(q) ||
          ubi.includes(q)
        );
      });
    } else if (selectedDepartment && selectedDepartment !== 'TODOS') {
      const depTarget = normalizeSearchText(selectedDepartment);
      result = result.filter(
        (a) => normalizeSearchText(a.departamento || a.department) === depTarget
      );
    }

    return result;
  }, [agencies, allAgencies, selectedDepartment, searchQuery]);

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

  return {
    agencies: filteredAgencies,
    allAgencies,
    nearestAgency,
    loading,
    error,
    userLocation,
    selectedDepartment,
    setSelectedDepartment,
    searchQuery,
    setSearchQuery,
    availableDepartments,
    refreshLocation: async () => {
      const coords = await requestUserLocation();
      if (coords) {
        await fetchAgenciesCatalog(coords);
      }
      return coords;
    },
    refetchCatalog: fetchAgenciesCatalog
  };
}
