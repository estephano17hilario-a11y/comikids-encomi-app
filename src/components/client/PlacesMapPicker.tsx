/**
 * PlacesMapPicker — Mapbox GL JS
 * Search: Mapbox Search API v1 → Mapbox Geocoding v5 (fuzzy+autocomplete) → Nominatim
 * Reverse geocode: Mapbox Geocoding API v5
 * Region: Perú · Language: es
 * Features:
 *  - GPS cacheado (GeolocationContext) → cero lag al abrir
 *  - Auto-pan inmediato a ubicación del usuario
 *  - Búsqueda de jirones/calles/avs con número (Jr. Huamanga 1586)
 *  - Fuzzy match: si no existe el número exacto recomienda el más cercano
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import {
  MapPin,
  Navigation,
  CheckCircle,
  Loader2,
  AlertCircle,
  Crosshair,
  Search,
  X,
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
}

// ─────────────────────────────────────────────────────────
//  Constants
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
  for (const level of ['neighborhood', 'locality', 'place']) {
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

// Prioriza resultados en Perú sobre resultados internacionales
function peruFirst(features: any[]): any[] {
  return features.sort((a, b) => {
    const aInPe = JSON.stringify(a).toLowerCase().includes('peru') || JSON.stringify(a).toLowerCase().includes('perú');
    const bInPe = JSON.stringify(b).toLowerCase().includes('peru') || JSON.stringify(b).toLowerCase().includes('perú');
    if (aInPe && !bInPe) return -1;
    if (!aInPe && bInPe) return 1;
    return 0;
  });
}

// ─────────────────────────────────────────────────────────
//  Geocoding functions
// ─────────────────────────────────────────────────────────

/** Búsqueda en Mapbox Search API v1 (SearchBox) — mejor para Jr. + número */
async function searchMapboxSearchAPI(query: string, proximity: string): Promise<Suggestion[]> {
  const url = `${MAPBOX_SEARCH}/suggest?q=${encodeURIComponent(query)}&access_token=${MAPBOX_TOKEN}&session_token=${SESSION_TOKEN}&country=PE&language=es&proximity=${proximity}&types=address,street,neighborhood,locality,place&limit=8`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.suggestions?.length) return [];

  return data.suggestions.map((s: any) => {
    const mainText = s.full_address
      ? cleanAddress(s.full_address.split(',').slice(0, 2).join(','))
      : (s.name || '');
    const dist = s.context?.district?.name || s.context?.place?.name || 'Lima';
    return {
      id: s.mapbox_id || s.name + Math.random(),
      mainText: mainText || s.place_name || query,
      secondaryText: `${dist}, Lima, Perú`,
      district: dist,
      mapbox_id: s.mapbox_id,
      lat: s.coordinates?.latitude,
      lng: s.coordinates?.longitude,
    } as Suggestion;
  });
}

/** Búsqueda en Mapbox Geocoding v5 con fuzzyMatch y autocomplete — para números exactos */
async function searchMapboxGeocodingV5(query: string, proximity: string): Promise<Suggestion[]> {
  const queryPerú = query.toLowerCase().includes('lima') ? query : `${query}, Lima, Peru`;
  const url = `${MAPBOX_GEO}/${encodeURIComponent(queryPerú)}.json?access_token=${MAPBOX_TOKEN}&country=PE&language=es&proximity=${proximity}&types=address,neighborhood,locality,place&autocomplete=true&fuzzyMatch=true&limit=8`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.features?.length) return [];

  return peruFirst(data.features).map((f: any) => {
    const mainText = cleanAddress(f.place_name).split(',').slice(0, 2).join(',').trim();
    const dist = extractDistrictFromContext(f.context || []);
    return {
      id: f.id,
      mainText,
      secondaryText: `${dist !== 'Lima' ? dist + ', ' : ''}Lima, Perú`,
      lat: f.center[1],
      lng: f.center[0],
      district: dist,
    } as Suggestion;
  });
}

/** Búsqueda en Nominatim (OSM) — excelente para jirones peruanos con número */
async function searchNominatim(query: string): Promise<Suggestion[]> {
  const q = query.toLowerCase().includes('lima') ? query : `${query}, Lima, Peru`;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&countrycodes=pe&limit=8&addressdetails=1&accept-language=es`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
  const data: any[] = await res.json();
  if (!data.length) return [];

  return data.slice(0, 6).map((item: any, i: number) => {
    const addr = item.address || {};
    const road = addr.road || addr.pedestrian || addr.path || '';
    const houseNum = addr.house_number || '';
    const mainText = road ? (houseNum ? `${road} ${houseNum}` : road) : (item.display_name || '').split(',')[0].trim();
    const rawDist = addr.city_district || addr.suburb || addr.town || addr.city || 'Lima';
    const dist = matchDistrict(rawDist, item.display_name || '');
    return {
      id: `nom-${item.osm_id || i}`,
      mainText: cleanAddress(mainText),
      secondaryText: `${dist !== 'Lima' ? dist + ', ' : ''}Lima, Perú`,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      district: dist,
    } as Suggestion;
  });
}

// Deduplicar sugerencias por coordenadas aproximadas
function deduplicateSuggestions(suggestions: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    const key = s.mainText.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────────────────────────────────────
//  Component
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
  const gpsPannedRef = useRef(false); // evita doble-pan si GPS llega antes del load

  const { position: cachedPosition, requestLocation, permissionState } = useGeolocation();

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

  // ── Reverse geocode ────────────────────────────────────
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsGeocoding(true);
    try {
      const url = `${MAPBOX_GEO}/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&country=PE&language=es&types=address,neighborhood,locality,place&limit=1`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.features?.length > 0) {
        const feat = data.features[0];
        setAddress(cleanAddress(feat.place_name));
        setDistrict(extractDistrictFromContext(feat.context || []));
      } else {
        // Fallback Nominatim
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

  // ── Move pin ──────────────────────────────────────────
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
    // FLY TO inmediato a la posición del usuario
    mapRef.current.flyTo({ center: [lng, lat], zoom: 18, speed: 1.6, curve: 1 });
  }, []);

  // ── GPS ───────────────────────────────────────────────
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

  // ── Autocomplete: 3 fuentes en paralelo ───────────────
  const fetchSuggestions = useCallback(async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setIsFetchingSuggestions(true);

    const proximity = `${LIMA_CENTER.lng},${LIMA_CENTER.lat}`;

    try {
      // Lanzamos las 3 fuentes en paralelo para máxima cobertura
      const [searchAPIResults, geoV5Results, nominatimResults] = await Promise.allSettled([
        searchMapboxSearchAPI(trimmed, proximity),
        searchMapboxGeocodingV5(trimmed, proximity),
        searchNominatim(trimmed),
      ]);

      const combined: Suggestion[] = [
        ...(searchAPIResults.status === 'fulfilled' ? searchAPIResults.value : []),
        ...(nominatimResults.status === 'fulfilled' ? nominatimResults.value : []),
        ...(geoV5Results.status === 'fulfilled' ? geoV5Results.value : []),
      ];

      const deduped = deduplicateSuggestions(combined).slice(0, 8);

      if (deduped.length > 0) {
        setSuggestions(deduped);
        setShowSuggestions(true);
      } else {
        // Último fallback: distrito
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
      console.warn('Autocomplete error:', err);
    } finally {
      setIsFetchingSuggestions(false);
    }
  }, []);

  const onQueryChange = (val: string) => {
    setQuery(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => fetchSuggestions(val), 200);
  };

  // ── Select suggestion ─────────────────────────────────
  const selectSuggestion = useCallback(
    async (sug: Suggestion) => {
      setQuery(sug.mainText);
      setShowSuggestions(false);
      setSuggestions([]);

      // Coordenadas directas (Nominatim / Geocoding v5)
      if (sug.lat !== undefined && sug.lng !== undefined) {
        movePin(sug.lat, sug.lng, sug.mainText, sug.district);
        mapRef.current?.flyTo({ center: [sug.lng, sug.lat], zoom: 18, speed: 1.6 });
        return;
      }

      // Search API: retrieve para coordenadas exactas
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
        } catch { /* fallthrough */ }
      }

      // Fallback geocode por texto
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

    // Usar GPS cacheado si existe; si no, Lima centro
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
        // GPS ya cacheado: mueve inmediatamente
        gpsPannedRef.current = true;
        showUserDot(cachedPosition.lat, cachedPosition.lng);
        movePin(cachedPosition.lat, cachedPosition.lng);
      } else if (!cachedPosition) {
        // No hay GPS cacheado: pide ahora
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

  // Si el GPS llega DESPUÉS de que el mapa ya esté listo
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
    <div className="w-full animate-fadeIn">
      {/* GPS Warning — ultra compacto */}
      {gpsError && (
        <div className="mb-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Sin GPS. Busca tu calle o toca el mapa.</span>
          </div>
          <button type="button" onClick={locateMe}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-xs shrink-0 cursor-pointer">
            Activar
          </button>
        </div>
      )}

      {/* Map Container */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-white/20 bg-slate-950 shadow-2xl"
           style={{ height: 'min(620px, 73dvh)' }}>

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

        {/* ══ Floating Search Bar — ultra compacta ══ */}
        <div className="absolute top-2 left-2 right-2 z-40 space-y-1.5">
          <div className="relative">
            <div className="flex items-center rounded-xl bg-slate-950/97 backdrop-blur-2xl border border-cyan-500/50 shadow-xl p-0.5 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/20 transition-all">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 ml-1">
                {isFetchingSuggestions
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Search className="w-3 h-3" />}
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Jr. Huamanga 1586, Av. Abancay 250..."
                className="flex-1 px-2 py-1.5 text-xs font-bold text-white placeholder-slate-500 bg-transparent focus:outline-none"
              />
              {query ? (
                <button type="button"
                  onClick={() => { setQuery(''); setSuggestions([]); setShowSuggestions(false); }}
                  className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              ) : null}
              <button type="button" onClick={locateMe} disabled={isLocating}
                className="mr-0.5 px-2 py-1.5 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/40 text-cyan-300 text-xs font-black flex items-center gap-1 border border-cyan-500/40 transition-all cursor-pointer shrink-0 active:scale-95">
                <Navigation className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline text-[10px]">{isLocating ? '...' : 'GPS'}</span>
              </button>
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-52 overflow-y-auto rounded-xl bg-slate-900/98 backdrop-blur-3xl border border-cyan-500/40 p-1 shadow-2xl space-y-0.5">
                {suggestions.map((sug) => (
                  <button key={sug.id} type="button"
                    onClick={() => selectSuggestion(sug)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-cyan-500/20 border border-transparent hover:border-cyan-500/30 transition-all flex items-center gap-2 cursor-pointer group">
                    <div className="w-5 h-5 rounded-md bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <MapPin className="w-2.5 h-2.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate group-hover:text-cyan-300 leading-tight">{sug.mainText}</p>
                      <p className="text-[9px] text-slate-400 truncate leading-tight">{sug.secondaryText}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Address card — ultra compacta */}
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

        {/* Zoom + GPS buttons — compactos */}
        <div className="absolute right-2 bottom-[4.5rem] z-40 flex flex-col gap-1.5">
          <button type="button"
            onClick={() => mapRef.current?.setZoom((mapRef.current.getZoom() ?? 17) + 1)}
            className="w-8 h-8 rounded-xl bg-slate-900/95 hover:bg-slate-800 text-white font-black flex items-center justify-center border border-white/20 shadow-xl transition-all active:scale-95 cursor-pointer text-sm">+</button>
          <button type="button"
            onClick={() => mapRef.current?.setZoom((mapRef.current.getZoom() ?? 17) - 1)}
            className="w-8 h-8 rounded-xl bg-slate-900/95 hover:bg-slate-800 text-white font-black flex items-center justify-center border border-white/20 shadow-xl transition-all active:scale-95 cursor-pointer text-sm">−</button>
          <button type="button" onClick={locateMe} title="Mi ubicación"
            className="w-8 h-8 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center shadow-xl shadow-cyan-600/40 transition-all active:scale-95 cursor-pointer">
            <Crosshair className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Confirm button */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-40">
          <button type="button" onClick={handleConfirm}
            className={`w-full py-3 px-5 rounded-xl font-black text-sm flex items-center justify-center gap-2.5 shadow-2xl transition-all cursor-pointer active:scale-[0.98] border ${
              confirmed
                ? 'bg-emerald-500 text-white shadow-emerald-500/50 border-emerald-400'
                : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 text-white shadow-cyan-500/50 hover:brightness-110 border-cyan-400/80'
            }`}>
            {confirmed ? (
              <><CheckCircle className="w-4 h-4" /> ¡Ubicación Confirmada!</>
            ) : (
              <><span className="text-base">🏍️</span> Confirmar ubicación y continuar ➔</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
