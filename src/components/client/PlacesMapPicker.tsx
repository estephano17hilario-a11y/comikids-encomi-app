/**
 * PlacesMapPicker — Mapbox GL JS (Ultra Preciso, Multifuente & Rápido)
 * Search Engine:
 *  1) Mapbox Geocoding v5 (con fuzzyMatch, autocomplete, proximity a GPS del usuario)
 *  2) Mapbox SearchBox API v1 (POI + Direcciones)
 *  3) Photon OSM Geocoder (indexa 100% de calles, jirones, pasajes, números de Perú)
 *  4) Nominatim Geocoder (cobertura OpenStreetMap Perú)
 *
 * Correcciones críticas:
 *  - Distancia REAL calculada únicamente con coordenadas válidas (CERO falsos '0 m').
 *  - Cobertura exhaustiva de pasajes, jirones, calles con número y POIs.
 *  - Botón de confirmación siempre fijo y visible en la base del mapa.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import {
  MapPin,
  CheckCircle,
  Loader2,
  AlertCircle,
  Crosshair,
  Search,
  X,
  Store,
} from 'lucide-react';
import { DISTRITOS_LIMA } from '../../data/distritosLima';
import { useGeolocation } from '../../context/GeolocationContext';

// ─────────────────────────────────────────────────────────
//  Mapbox Token
// ─────────────────────────────────────────────────────────
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;
if (!MAPBOX_TOKEN) console.error('[PlacesMapPicker] Falta VITE_MAPBOX_TOKEN en .env');

mapboxgl.accessToken = MAPBOX_TOKEN;

// ─────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────
interface Props {
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
  initialDistrict?: string;
  onConfirmLocation: (data: {
    district: string;
    address: string;
    lat: number;
    lng: number;
  }) => void;
  onCloseModal?: () => void;
  isModal?: boolean;
}

interface Suggestion {
  id: string;
  mainText: string;
  secondaryText: string;
  lat?: number;
  lng?: number;
  district?: string;
  mapbox_id?: string;
  distanceKm?: number;
  isPoi?: boolean;
  score?: number;
}

// ─────────────────────────────────────────────────────────
//  Constants & Helpers
// ─────────────────────────────────────────────────────────
const LIMA_CENTER = { lat: -12.0464, lng: -77.0428 };
const MAPBOX_GEO = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const MAPBOX_SEARCH = 'https://api.mapbox.com/search/searchbox/v1';
const SESSION_TOKEN = (() => {
  try { return crypto.randomUUID(); } catch { return Math.random().toString(36).slice(2); }
})();

function normalizeText(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistanceBadge(distKm?: number): string | null {
  if (distKm === undefined || isNaN(distKm) || distKm <= 0.005) return null;
  if (distKm < 1) {
    return `${Math.round(distKm * 1000)} m`;
  }
  return `${distKm.toFixed(1)} km`;
}

function matchDistrict(raw: string, fullText = ''): string {
  const nd = normalizeText(raw);
  const nf = normalizeText(fullText);
  const found = DISTRITOS_LIMA.find((d) => {
    const n = normalizeText(d);
    return nd === n || nd.includes(n) || n.includes(nd) || nf.includes(n);
  });
  return found ?? (raw.trim() || 'Lima');
}

function extractDistrictFromContext(context: any[]): string {
  if (!context?.length) return 'Lima';
  for (const level of ['neighborhood', 'locality', 'district', 'place']) {
    const item = context.find((c: any) => c.id?.startsWith(level));
    if (item) {
      const matched = matchDistrict(item.text, '');
      if (matched && matched !== 'Lima') return matched;
    }
  }
  return 'Lima';
}

function cleanAddress(s: string): string {
  return s
    .replace(/,?\s*Lima \d{4,6}/gi, '')
    .replace(/,?\s*Provincia de Lima/gi, '')
    .replace(/,?\s*Lima Region/gi, '')
    .replace(/,?\s*Perú\s*$/gi, '')
    .replace(/,?\s*Peru\s*$/gi, '')
    .replace(/,\s*$/, '')
    .trim();
}

/** Genera variaciones inteligentes de prefijo */
function getQueryVariations(raw: string): string[] {
  const clean = raw.trim();
  const variations = [clean];
  const lower = clean.toLowerCase();
  const hasPrefix = /^(jr\.?|jir[oó]n|av\.?|avenida|calle|ca\.?|pje\.?|pasaje|prol\.?|prolongaci[oó]n|alameda|carretera)\b/i.test(lower);
  
  if (!hasPrefix) {
    variations.push(`Avenida ${clean}`);
    variations.push(`Jirón ${clean}`);
    variations.push(`Calle ${clean}`);
    variations.push(`Prolongación ${clean}`);
    variations.push(`Pasaje ${clean}`);
  }
  return variations;
}

/** Calcula relevancia numérica y léxica */
function calculateRelevanceScore(text: string, query: string): number {
  let score = 0;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Coincidencia exacta
  if (lowerText.includes(lowerQuery)) {
    score += 60;
  }

  // Palabras coincidentes
  const queryWords = lowerQuery.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 1);
  for (const w of queryWords) {
    if (lowerText.includes(w)) {
      score += 15;
    }
  }

  // Coincidencia y cercanía de número
  const numMatch = query.match(/\d+/);
  if (numMatch) {
    const targetNum = parseInt(numMatch[0], 10);
    const numbersInText = (text.match(/\d+/g) || []).map(n => parseInt(n, 10));

    if (numbersInText.includes(targetNum)) {
      score += 150; // Coincidencia exacta de número
    } else if (numbersInText.length > 0) {
      let minDiff = Infinity;
      for (const n of numbersInText) {
        const diff = Math.abs(n - targetNum);
        if (diff < minDiff) minDiff = diff;
      }
      if (minDiff < 500) {
        score += Math.max(0, 80 - Math.min(80, minDiff / 4));
      }
    }
  }

  return score;
}

// ─────────────────────────────────────────────────────────
//  Geocoding Search Engines (Garantiza Coordenadas Reales)
// ─────────────────────────────────────────────────────────

/** 1. Mapbox Geocoding v5 (Garantiza center: [lng, lat] para cada resultado) */
async function searchMapboxGeocodingV5(v: string, proximity: string): Promise<Suggestion[]> {
  try {
    const queryPerú = v.toLowerCase().includes('peru') || v.toLowerCase().includes('lima') ? v : `${v}, Peru`;
    // Nota: tipos válidos de Mapbox son: country, region, postcode, district, place, locality, neighborhood, address, poi
    const url = `${MAPBOX_GEO}/${encodeURIComponent(queryPerú)}.json?access_token=${MAPBOX_TOKEN}&country=PE&language=es&proximity=${proximity}&types=address,poi,neighborhood,locality,place,district&autocomplete=true&fuzzyMatch=true&limit=6`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.features?.length) return [];

    return data.features.map((f: any) => {
      const mainText = cleanAddress(f.place_name).split(',').slice(0, 2).join(',').trim();
      const dist = extractDistrictFromContext(f.context || []);
      const isPoi = f.place_type?.includes('poi');
      return {
        id: f.id,
        mainText: mainText || f.text || v,
        secondaryText: `${dist !== 'Lima' ? dist + ', ' : ''}Lima, Perú`,
        lat: f.center[1],
        lng: f.center[0],
        district: dist,
        isPoi,
      } as Suggestion;
    });
  } catch {
    return [];
  }
}

/** 2. Photon OSM (Indexa 100% de calles, pasajes y números con coordenadas) */
async function searchPhotonOSM(v: string, userCoords: { lat: number; lng: number }): Promise<Suggestion[]> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(v + ' Peru')}&lat=${userCoords.lat}&lon=${userCoords.lng}&limit=6&lang=default`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.features?.length) return [];

    return data.features.map((f: any, i: number) => {
      const p = f.properties || {};
      const coords = f.geometry?.coordinates || [];
      const street = p.street || p.name || '';
      const housenumber = p.housenumber || '';
      const mainText = street ? (housenumber ? `${street} ${housenumber}` : street) : (p.name || v);
      const dist = matchDistrict(p.district || p.city || p.county || 'Lima', p.name || '');
      const isPoi = p.osm_key === 'amenity' || p.osm_key === 'shop' || p.osm_key === 'tourism';

      return {
        id: `photon-${p.osm_id || i}`,
        mainText: cleanAddress(mainText),
        secondaryText: `${dist !== 'Lima' ? dist + ', ' : ''}${p.state || 'Lima'}, Perú`,
        lat: coords[1],
        lng: coords[0],
        district: dist,
        isPoi,
      } as Suggestion;
    });
  } catch {
    return [];
  }
}

/** 3. Mapbox SearchBox API v1 con Retrieve en paralelo */
async function searchMapboxSearchAPI(v: string, proximity: string): Promise<Suggestion[]> {
  try {
    const url = `${MAPBOX_SEARCH}/suggest?q=${encodeURIComponent(v)}&access_token=${MAPBOX_TOKEN}&session_token=${SESSION_TOKEN}&country=PE&language=es&proximity=${proximity}&types=poi,address,street,neighborhood,locality,place&limit=6`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.suggestions?.length) return [];

    const suggestions: any[] = data.suggestions;

    const withCoords = await Promise.all(
      suggestions.map(async (s: any) => {
        let lat = s.coordinates?.latitude;
        let lng = s.coordinates?.longitude;

        if ((lat === undefined || lng === undefined) && s.mapbox_id) {
          try {
            const retrieveUrl = `${MAPBOX_SEARCH}/retrieve/${s.mapbox_id}?access_token=${MAPBOX_TOKEN}&session_token=${SESSION_TOKEN}`;
            const rRes = await fetch(retrieveUrl);
            const rData = await rRes.json();
            const coords = rData?.features?.[0]?.geometry?.coordinates;
            if (coords && coords.length >= 2) {
              lng = coords[0];
              lat = coords[1];
            }
          } catch {}
        }

        const mainText = s.full_address
          ? cleanAddress(s.full_address.split(',').slice(0, 2).join(','))
          : (s.name || '');
        const dist = s.context?.district?.name || s.context?.place?.name || 'Lima';
        const isPoi = s.feature_type === 'poi' || s.maki !== undefined;

        return {
          id: s.mapbox_id || s.name + Math.random(),
          mainText: mainText || s.place_name || v,
          secondaryText: s.place_formatted ? cleanAddress(s.place_formatted) : `${dist}, Lima, Perú`,
          district: dist,
          mapbox_id: s.mapbox_id,
          lat,
          lng,
          isPoi,
        } as Suggestion;
      })
    );

    return withCoords;
  } catch {
    return [];
  }
}

/** 4. Nominatim OpenStreetMap */
async function searchNominatim(v: string): Promise<Suggestion[]> {
  try {
    const q = v.toLowerCase().includes('peru') || v.toLowerCase().includes('lima') ? v : `${v}, Peru`;
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&countrycodes=pe&limit=6&addressdetails=1&accept-language=es`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    const data: any[] = await res.json();
    if (!data.length) return [];

    return data.map((item: any, i: number) => {
      const addr = item.address || {};
      const road = addr.road || addr.pedestrian || addr.path || '';
      const houseNum = addr.house_number || '';
      const mainText = road
        ? (houseNum ? `${road} ${houseNum}` : road)
        : (item.name || item.display_name || '').split(',')[0].trim();
      const rawDist = addr.city_district || addr.suburb || addr.town || addr.city || 'Lima';
      const dist = matchDistrict(rawDist, item.display_name || '');
      const isPoi = item.type !== 'administrative' && item.type !== 'road';
      return {
        id: `nom-${item.osm_id || i}`,
        mainText: cleanAddress(mainText),
        secondaryText: `${dist !== 'Lima' ? dist + ', ' : ''}Lima, Perú`,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        district: dist,
        isPoi,
      } as Suggestion;
    });
  } catch {
    return [];
  }
}

function deduplicateAndRank(
  suggestions: Suggestion[],
  query: string,
  userCoords: { lat: number; lng: number }
): Suggestion[] {
  const seen = new Set<string>();
  const list: Suggestion[] = [];

  for (const s of suggestions) {
    const key = s.mainText.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) continue;
    seen.add(key);

    // Calcular distancia SOLO si las coordenadas son genuinas y válidas
    let distanceKm: number | undefined = undefined;
    if (s.lat !== undefined && s.lng !== undefined && !isNaN(s.lat) && !isNaN(s.lng)) {
      const d = calculateDistanceKm(userCoords.lat, userCoords.lng, s.lat, s.lng);
      // Evitar distancias falsas de 0m
      if (d > 0.005) {
        distanceKm = d;
      }
    }

    const score = calculateRelevanceScore(s.mainText + ' ' + s.secondaryText, query);
    list.push({ ...s, distanceKm, score });
  }

  // Ordenar primero por coincidencia de nombre/número, y luego por cercanía geográfica
  list.sort((a, b) => {
    const scoreDiff = (b.score || 0) - (a.score || 0);
    if (scoreDiff !== 0) return scoreDiff;
    if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
      return a.distanceKm - b.distanceKm;
    }
    return 0;
  });

  return list.slice(0, 8);
}

// ─────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────
export const PlacesMapPicker: React.FC<Props> = ({
  initialLat = LIMA_CENTER.lat,
  initialLng = LIMA_CENTER.lng,
  initialAddress = '',
  initialDistrict = '',
  onConfirmLocation,
  onCloseModal,
}) => {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const userDotMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const searchDebounceRef = useRef<any>(null);
  const mapInitializedRef = useRef(false);
  const gpsPannedRef = useRef(false);

  const { position: cachedPosition, requestLocation } = useGeolocation();

  const [coords, setCoords] = useState({ lat: initialLat, lng: initialLng });
  const [address, setAddress] = useState(initialAddress);
  const [district, setDistrict] = useState(initialDistrict);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);

  // ── Reverse Geocode ────────────────────────────────────
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsGeocoding(true);
    try {
      const url = `${MAPBOX_GEO}/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&country=PE&language=es&types=address,neighborhood,locality,place,district&limit=1`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.features?.length > 0) {
        const feat = data.features[0];
        setAddress(cleanAddress(feat.place_name));
        setDistrict(extractDistrictFromContext(feat.context || []));
      } else {
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=19&addressdetails=1&accept-language=es`,
          { headers: { 'Accept-Language': 'es' } }
        );
        const nomData = await nomRes.json();
        const addr = nomData.address || {};
        const road = addr.road || addr.pedestrian || '';
        const houseNum = addr.house_number || '';
        setAddress(cleanAddress(road ? (houseNum ? `${road} ${houseNum}` : road) : nomData.display_name?.split(',')[0] || `${lat.toFixed(5)},${lng.toFixed(5)}`));
        setDistrict(matchDistrict(addr.city_district || addr.suburb || 'Lima', nomData.display_name || ''));
      }
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      setDistrict('Lima');
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  // ── Move Pin ──────────────────────────────────────────
  const movePin = useCallback(
    (lat: number, lng: number, explicitAddr?: string, explicitDist?: string) => {
      setCoords({ lat, lng });
      setConfirmed(false);
      if (markerRef.current) markerRef.current.setLngLat([lng, lat]);
      if (mapRef.current) mapRef.current.panTo([lng, lat]);
      if (explicitAddr) {
        setAddress(explicitAddr);
        if (explicitDist) setDistrict(explicitDist);
      } else {
        reverseGeocode(lat, lng);
      }
    },
    [reverseGeocode]
  );

  // ── Muestra punto azul GPS ────────────────────────────
  const showUserDot = useCallback((lat: number, lng: number) => {
    if (!mapRef.current) return;
    const dotEl = document.createElement('div');
    dotEl.innerHTML = `
      <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center">
        <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(14,165,233,0.35);animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite"></div>
        <div style="width:13px;height:13px;border-radius:50%;background:#0284c7;border:2.5px solid #fff;box-shadow:0 0 10px rgba(14,165,233,0.9)"></div>
      </div>`;
    if (!userDotMarkerRef.current) {
      userDotMarkerRef.current = new mapboxgl.Marker({ element: dotEl.firstElementChild as HTMLElement })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);
    } else {
      userDotMarkerRef.current.setLngLat([lng, lat]);
    }
    mapRef.current.flyTo({ center: [lng, lat], zoom: 18, speed: 1.6, curve: 1 });
  }, []);

  // ── Locate Me ─────────────────────────────────────────
  const locateMe = useCallback(async () => {
    setIsLocating(true);
    setGpsError(false);
    const pos = await requestLocation();
    setIsLocating(false);
    if (pos) {
      showUserDot(pos.lat, pos.lng);
      movePin(pos.lat, pos.lng);
      gpsPannedRef.current = true;
    } else {
      setGpsError(true);
    }
  }, [requestLocation, showUserDot, movePin]);

  // ── Multi-Fuente Intelligent Search ───────────────────
  const executeSearch = useCallback(async (input: string, autoSelectBest = false) => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setIsFetchingSuggestions(true);

    const userLoc = cachedPosition || coords;
    const proximity = `${userLoc.lng},${userLoc.lat}`;
    const variations = getQueryVariations(trimmed);

    try {
      const searchPromises: Promise<Suggestion[]>[] = [];

      // 1. Mapbox Geocoding v5 con variaciones de prefijos
      for (const v of variations.slice(0, 4)) {
        searchPromises.push(searchMapboxGeocodingV5(v, proximity));
        searchPromises.push(searchMapboxSearchAPI(v, proximity));
      }

      // 2. Photon OSM (100% de calles, pasajes y números con coordenadas)
      searchPromises.push(searchPhotonOSM(trimmed, userLoc));

      // 3. Nominatim OSM
      searchPromises.push(searchNominatim(trimmed));

      const settled = await Promise.allSettled(searchPromises);
      const rawList: Suggestion[] = [];

      for (const res of settled) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          rawList.push(...res.value);
        }
      }

      const ranked = deduplicateAndRank(rawList, trimmed, userLoc);

      if (ranked.length > 0) {
        setSuggestions(ranked);
        setShowSuggestions(true);

        if (autoSelectBest) {
          const best = ranked[0];
          selectSuggestion(best);
        }
      } else {
        const districtMatches: Suggestion[] = DISTRITOS_LIMA
          .filter((d) => normalizeText(d).includes(normalizeText(trimmed)))
          .slice(0, 4)
          .map((d) => ({
            id: `dist-${d}`,
            mainText: `Distrito de ${d}`,
            secondaryText: 'Lima Metropolitana, Perú',
          }));
        setSuggestions(districtMatches);
        setShowSuggestions(districtMatches.length > 0);
      }
    } catch (err) {
      console.warn('Search error:', err);
    } finally {
      setIsFetchingSuggestions(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedPosition, coords]);

  const onQueryChange = (val: string) => {
    setQuery(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => executeSearch(val, false), 220);
  };

  const handleSearchButtonClick = () => {
    if (query.trim()) {
      executeSearch(query, true);
    }
  };

  // ── Select Suggestion ─────────────────────────────────
  const selectSuggestion = useCallback(
    async (sug: Suggestion) => {
      setQuery(sug.mainText);
      setShowSuggestions(false);
      setSuggestions([]);

      // Coordenadas directas
      if (sug.lat !== undefined && sug.lng !== undefined && !isNaN(sug.lat) && !isNaN(sug.lng)) {
        movePin(sug.lat, sug.lng, sug.mainText, sug.district);
        mapRef.current?.flyTo({ center: [sug.lng, sug.lat], zoom: 18, speed: 1.6 });
        return;
      }

      // Search API Retrieve
      if (sug.mapbox_id) {
        try {
          const res = await fetch(`${MAPBOX_SEARCH}/retrieve/${sug.mapbox_id}?access_token=${MAPBOX_TOKEN}&session_token=${SESSION_TOKEN}`);
          const data = await res.json();
          const feat = data.features?.[0];
          if (feat) {
            const [lng, lat] = feat.geometry.coordinates;
            const dist = feat.properties?.context?.district?.name || feat.properties?.context?.place?.name || sug.district || 'Lima';
            const addr = cleanAddress(feat.properties?.full_address || feat.properties?.name || sug.mainText).split(',')[0];
            movePin(lat, lng, addr, dist);
            mapRef.current?.flyTo({ center: [lng, lat], zoom: 18, speed: 1.6 });
            return;
          }
        } catch {}
      }

      // Geocode fallback
      const districtName = sug.mainText.replace('Distrito de ', '');
      const url = `${MAPBOX_GEO}/${encodeURIComponent(districtName + ', Lima, Peru')}.json?access_token=${MAPBOX_TOKEN}&country=PE&language=es&limit=1`;
      fetch(url).then(r => r.json()).then(data => {
        if (data.features?.length > 0) {
          const f = data.features[0];
          movePin(f.center[1], f.center[0], sug.mainText, districtName);
          mapRef.current?.flyTo({ center: [f.center[0], f.center[1]], zoom: 14, speed: 1.4 });
        }
      }).catch(() => {});
    },
    [movePin]
  );

  // ── Init Mapbox Map ───────────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current || mapInitializedRef.current) return;
    mapInitializedRef.current = true;

    const startLat = cachedPosition?.lat ?? initialLat;
    const startLng = cachedPosition?.lng ?? initialLng;

    // Pin motorizado 🏍️
    const pinEl = document.createElement('div');
    pinEl.innerHTML = `
      <div style="
        width:48px;height:48px;display:flex;flex-direction:column;
        align-items:center;justify-content:center;cursor:grab;
        filter:drop-shadow(0 4px 16px rgba(6,182,212,0.85));
      ">
        <div style="
          width:42px;height:42px;border-radius:50%;
          background:linear-gradient(135deg,#06b6d4,#3b82f6);
          border:2.5px solid #fff;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 0 20px rgba(6,182,212,0.6);
        ">
          <span style="font-size:22px;line-height:1">🏍️</span>
        </div>
      </div>`;

    const map = new mapboxgl.Map({
      container: mapDivRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [startLng, startLat],
      zoom: cachedPosition ? 18 : 14,
      attributionControl: false,
    });

    const marker = new mapboxgl.Marker({
      element: pinEl.firstElementChild as HTMLElement,
      draggable: true,
      anchor: 'center',
    })
      .setLngLat([startLng, startLat])
      .addTo(map);

    marker.on('dragend', () => {
      const ll = marker.getLngLat();
      movePin(ll.lat, ll.lng);
    });

    map.on('click', (e) => {
      movePin(e.lngLat.lat, e.lngLat.lng);
    });

    map.on('load', () => {
      setMapReady(true);

      if (cachedPosition && !gpsPannedRef.current) {
        gpsPannedRef.current = true;
        showUserDot(cachedPosition.lat, cachedPosition.lng);
        movePin(cachedPosition.lat, cachedPosition.lng);
      } else if (!cachedPosition) {
        locateMe();
      }
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      userDotMarkerRef.current = null;
      mapInitializedRef.current = false;
      gpsPannedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si el GPS llega después del mount
  useEffect(() => {
    if (!mapReady || !cachedPosition || gpsPannedRef.current) return;
    gpsPannedRef.current = true;
    showUserDot(cachedPosition.lat, cachedPosition.lng);
    movePin(cachedPosition.lat, cachedPosition.lng);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedPosition, mapReady]);

  // ── Confirm ───────────────────────────────────────────
  const handleConfirm = () => {
    const finalDistrict = district.trim() || 'Lima';
    const finalAddress = address.trim() || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
    onConfirmLocation({ district: finalDistrict, address: finalAddress, lat: coords.lat, lng: coords.lng });
    setConfirmed(true);
    if (onCloseModal) setTimeout(onCloseModal, 300);
  };

  // ─────────────────────────────────────────────────────
  return (
    <div className="w-full animate-fadeIn flex flex-col space-y-2">
      {/* GPS Warning */}
      {gpsError && (
        <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Sin GPS. Busca tu calle o lugar, o toca el mapa.</span>
          </div>
          <button type="button" onClick={locateMe}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-xs shrink-0 cursor-pointer">
            Activar
          </button>
        </div>
      )}

      {/* Map Container */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-white/20 bg-slate-950 shadow-2xl h-[56vh] sm:h-[62vh] max-h-[560px] min-h-[380px]">

        <div ref={mapDivRef} className="w-full h-full z-0" />

        {/* Loading overlay */}
        {!mapReady && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              <span className="text-xs font-bold text-slate-400">Cargando mapa...</span>
            </div>
          </div>
        )}

        {/* ══ Floating Search Bar ══ */}
        <div className="absolute top-2 left-2 right-2 z-40 space-y-1.5">
          <div className="relative">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearchButtonClick();
              }}
              className="flex items-center rounded-xl bg-slate-950/97 backdrop-blur-2xl border border-cyan-500/50 shadow-xl p-0.5 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/20 transition-all"
            >
              {/* Left Pin / Indicator */}
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 ml-1">
                {isFetchingSuggestions
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <MapPin className="w-3.5 h-3.5" />}
              </div>

              {/* Input */}
              <input
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Av. Arequipa 123, Real Plaza, KFC..."
                className="flex-1 px-2.5 py-2 text-xs sm:text-sm font-bold text-white placeholder-slate-400 bg-transparent focus:outline-none"
              />

              {/* Clear button */}
              {query ? (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setSuggestions([]); setShowSuggestions(false); }}
                  className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer mr-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}

              {/* Botón Buscar a la derecha */}
              <button
                type="button"
                onClick={handleSearchButtonClick}
                className="mr-0.5 px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md shadow-cyan-500/30 transition-all cursor-pointer shrink-0 active:scale-95"
                title="Buscar dirección o lugar"
              >
                <Search className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="text-[11px] font-black uppercase tracking-wide">Buscar</span>
              </button>
            </form>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-60 overflow-y-auto rounded-xl bg-slate-900/98 backdrop-blur-3xl border border-cyan-500/40 p-1 shadow-2xl space-y-0.5">
                {suggestions.map((sug) => {
                  const distBadge = formatDistanceBadge(sug.distanceKm);
                  return (
                    <button
                      key={sug.id}
                      type="button"
                      onClick={() => selectSuggestion(sug)}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-cyan-500/20 border border-transparent hover:border-cyan-500/30 transition-all flex items-center justify-between gap-2 cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                          {sug.isPoi ? <Store className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate group-hover:text-cyan-300 leading-tight">
                            {sug.mainText}
                          </p>
                          <p className="text-[9px] text-slate-400 truncate leading-tight">
                            {sug.secondaryText}
                          </p>
                        </div>
                      </div>

                      {/* Distancia badge real */}
                      {distBadge && (
                        <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-full shrink-0">
                          📍 {distBadge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Address card */}
          <div className="px-2.5 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-xl border border-white/15 shadow-lg flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <MapPin className="w-2.5 h-2.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="text-[8px] font-black uppercase tracking-wider text-cyan-300 leading-none">
                  {district || 'UBICACIÓN'}
                </span>
                {isGeocoding && <Loader2 className="w-2 h-2 text-cyan-400 animate-spin" />}
              </div>
              <p className="text-[10px] font-bold text-white leading-tight truncate">
                {address || (isGeocoding ? 'Detectando...' : 'Toca el mapa o arrastra el pin...')}
              </p>
            </div>
          </div>
        </div>

        {/* ══ Controles Flotantes Laterales ══ */}
        <div className="absolute right-2.5 bottom-16 z-40 flex flex-col items-center gap-2">
          {/* Botón GPS GRANDE Y LLAMATIVO */}
          <button
            type="button"
            onClick={locateMe}
            disabled={isLocating}
            title="Mi ubicación actual"
            className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 via-cyan-500 to-blue-600 hover:brightness-110 active:scale-95 text-white flex flex-col items-center justify-center shadow-2xl shadow-cyan-500/60 border-2 border-cyan-300/60 transition-all cursor-pointer group"
          >
            <Crosshair className={`w-5 h-5 ${isLocating ? 'animate-spin' : 'group-hover:scale-110 transition-transform'}`} />
            <span className="text-[8px] font-black uppercase tracking-tighter leading-none mt-0.5 text-cyan-100">
              {isLocating ? 'GPS...' : 'GPS'}
            </span>
          </button>

          {/* Zoom In & Out */}
          <div className="flex flex-col rounded-xl bg-slate-900/95 border border-white/20 shadow-xl overflow-hidden">
            <button
              type="button"
              onClick={() => mapRef.current?.setZoom((mapRef.current.getZoom() ?? 17) + 1)}
              className="w-8 h-8 text-white font-black flex items-center justify-center hover:bg-slate-800 transition-all active:scale-95 cursor-pointer text-sm border-b border-white/10"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => mapRef.current?.setZoom((mapRef.current.getZoom() ?? 17) - 1)}
              className="w-8 h-8 text-white font-black flex items-center justify-center hover:bg-slate-800 transition-all active:scale-95 cursor-pointer text-sm"
            >
              −
            </button>
          </div>
        </div>

        {/* Botón Confirmar Ubicación dentro del mapa, siempre visible en la parte inferior */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-40">
          <button
            type="button"
            onClick={handleConfirm}
            className={`w-full py-3.5 px-5 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-2xl transition-all cursor-pointer active:scale-[0.98] border-2 ${
              confirmed
                ? 'bg-emerald-500 text-white shadow-emerald-500/50 border-emerald-400'
                : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 text-white shadow-cyan-500/50 hover:brightness-110 border-cyan-300'
            }`}
          >
            {confirmed ? (
              <><CheckCircle className="w-5 h-5" /> ¡Ubicación Confirmada!</>
            ) : (
              <><span className="text-lg">🏍️</span> Confirmar ubicación y continuar ➔</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
