/**
 * PlacesMapPicker — 100% Google Maps Platform
 * Maps JavaScript API  ·  Places API (New) Autocomplete  ·  Geocoding REST API
 * Region: PE (Perú) · Language: es
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import { loadGoogleMapsScript } from '../../services/googleMapsLoader';

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
  title: string;
  subtitle: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  district?: string;
}

// ─────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────
const LIMA_CENTER = { lat: -12.0464, lng: -77.0428 };

function normalizeText(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function matchDistrict(raw: string, fullText = ''): string {
  const nd = normalizeText(raw);
  const nf = normalizeText(fullText);
  const match = DISTRITOS_LIMA.find((d) => {
    const n = normalizeText(d);
    return nd === n || nd.includes(n) || n.includes(nd) || nf.includes(n);
  });
  return match ?? raw.trim() ?? 'Lima';
}

/** Geocoding REST API — avoids JS Geocoder class (deprecated) */
async function reverseGeocode(
  lat: number,
  lng: number,
  apiKey: string
): Promise<{ address: string; district: string }> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=es&region=PE`
    );
    if (!res.ok) throw new Error('geocode http error');
    const data = await res.json();
    if (data.status === 'OK' && data.results?.length) {
      const top = data.results[0];
      const addr = (top.formatted_address as string)
        .replace(/,?\s*(Lima \d{5}|Provincia de Lima|Lima|Perú|Peru)\s*$/gi, '')
        .trim();
      const distComp = top.address_components?.find((c: any) =>
        c.types.includes('sublocality_level_1') ||
        c.types.includes('administrative_area_level_3') ||
        c.types.includes('locality')
      );
      return {
        address: addr || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        district: matchDistrict(distComp?.long_name ?? '', top.formatted_address ?? ''),
      };
    }
  } catch (e) {
    console.warn('reverseGeocode:', e);
  }
  return {
    address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    district: 'Lima',
  };
}

/** Geocode place by text query — fallback when placeId fetch fails */
async function geocodeText(
  query: string,
  apiKey: string
): Promise<{ lat: number; lng: number; address: string; district: string } | null> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}&language=es&region=PE&components=country:PE`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 'OK' && data.results?.length) {
      const r = data.results[0];
      const loc = r.geometry.location;
      const addr = (r.formatted_address as string)
        .replace(/,?\s*(Lima \d{5}|Provincia de Lima|Lima|Perú|Peru)\s*$/gi, '')
        .trim();
      const distComp = r.address_components?.find((c: any) =>
        c.types.includes('sublocality_level_1') ||
        c.types.includes('administrative_area_level_3') ||
        c.types.includes('locality')
      );
      return {
        lat: loc.lat,
        lng: loc.lng,
        address: addr,
        district: matchDistrict(distComp?.long_name ?? '', r.formatted_address ?? ''),
      };
    }
  } catch (e) {
    console.warn('geocodeText:', e);
  }
  return null;
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
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const userDotRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteSessionRef = useRef<any>(null);
  const searchDebounceRef = useRef<any>(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

  const [coords, setCoords] = useState({ lat: initialLat, lng: initialLng });
  const [address, setAddress] = useState(initialAddress);
  const [district, setDistrict] = useState(initialDistrict);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Search state
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);

  // ── Update pin & reverse geocode ──────────────────────
  const movePin = useCallback(
    async (lat: number, lng: number, explicitAddr?: string, explicitDist?: string) => {
      setCoords({ lat, lng });
      setConfirmed(false);

      if (markerRef.current) {
        markerRef.current.position = { lat, lng };
      }
      if (mapRef.current) {
        mapRef.current.panTo({ lat, lng });
      }

      if (explicitAddr) {
        setAddress(explicitAddr);
        if (explicitDist) setDistrict(explicitDist);
        return;
      }

      setIsGeocoding(true);
      const result = await reverseGeocode(lat, lng, apiKey);
      setAddress(result.address);
      setDistrict(result.district);
      setIsGeocoding(false);
    },
    [apiKey]
  );

  // ── Ultra-fast GPS (5-min cache) ─────────────────────
  const locateMe = useCallback(() => {
    if (!navigator.geolocation) { setGpsError(true); return; }
    setIsLocating(true);
    setGpsError(false);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setIsLocating(false);

        // Move user dot
        if (mapRef.current) {
          if (!userDotRef.current) {
            const dot = document.createElement('div');
            dot.innerHTML = `
              <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center">
                <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(14,165,233,0.35);animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite"></div>
                <div style="width:13px;height:13px;border-radius:50%;background:#0284c7;border:2.5px solid #fff;box-shadow:0 0 10px rgba(14,165,233,0.9)"></div>
              </div>`;
            userDotRef.current = new (window as any).google.maps.marker.AdvancedMarkerElement({
              map: mapRef.current,
              position: { lat, lng },
              content: dot.firstElementChild as HTMLElement,
              zIndex: 99,
            });
          } else {
            userDotRef.current.position = { lat, lng };
          }
          mapRef.current.setZoom(18);
        }
        movePin(lat, lng);
      },
      (err) => {
        console.warn('GPS error:', err);
        setIsLocating(false);
        setGpsError(true);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 300000 }
    );
  }, [movePin]);

  // ── Autocomplete suggestions (Places API New) ─────────
  const fetchSuggestions = useCallback(
    async (input: string) => {
      if (!input.trim() || input.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsFetchingSuggestions(true);
      const results: Suggestion[] = [];

      try {
        const gmaps = (window as any).google?.maps;
        if (gmaps?.places?.AutocompleteSuggestion) {
          // New Places API — session-based autocomplete
          if (!autocompleteSessionRef.current) {
            autocompleteSessionRef.current = new gmaps.places.AutocompleteSessionToken();
          }
          const { suggestions: gmSuggestions } =
            await gmaps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
              input,
              sessionToken: autocompleteSessionRef.current,
              locationBias: {
                circle: {
                  center: LIMA_CENTER,
                  radius: 40000,
                },
              },
              includedRegionCodes: ['PE'],
              language: 'es',
            });

          for (const sug of gmSuggestions ?? []) {
            const p = sug.placePrediction;
            if (!p) continue;
            results.push({
              id: p.placeId ?? String(Math.random()),
              title: p.mainText?.toString() ?? p.text?.toString() ?? input,
              subtitle: p.secondaryText?.toString() ?? '',
              placeId: p.placeId,
            });
          }
        }
      } catch (e) {
        console.warn('AutocompleteSuggestion error, using geocoder fallback:', e);
      }

      // Fallback: district matching
      if (results.length < 2) {
        DISTRITOS_LIMA.forEach((d) => {
          if (normalizeText(d).includes(normalizeText(input))) {
            results.push({
              id: `dist-${d}`,
              title: `Distrito de ${d}`,
              subtitle: 'Lima Metropolitana, Perú',
              district: d,
            });
          }
        });
      }

      setSuggestions(results.slice(0, 6));
      setShowSuggestions(results.length > 0);
      setIsFetchingSuggestions(false);
    },
    []
  );

  const onQueryChange = (val: string) => {
    setQuery(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => fetchSuggestions(val), 200);
  };

  // ── Select suggestion ─────────────────────────────────
  const selectSuggestion = useCallback(
    async (sug: Suggestion) => {
      setQuery(sug.title);
      setShowSuggestions(false);
      autocompleteSessionRef.current = null; // reset session after selection

      // If we already have coords (district fallback)
      if (sug.lat !== undefined && sug.lng !== undefined && sug.district) {
        movePin(sug.lat, sug.lng, sug.title, sug.district);
        return;
      }

      // Resolve placeId via Place.fetchFields
      if (sug.placeId) {
        try {
          const gmaps = (window as any).google?.maps;
          const { Place } = await gmaps.importLibrary('places');
          const place = new Place({ id: sug.placeId, requestedLanguage: 'es' });
          await place.fetchFields({ fields: ['location', 'formattedAddress', 'addressComponents'] });
          const loc = place.location;
          if (loc) {
            const distComp = place.addressComponents?.find((c: any) =>
              c.types?.includes('sublocality_level_1') || c.types?.includes('administrative_area_level_3')
            );
            const cleanAddr = (place.formattedAddress ?? sug.title)
              .replace(/,?\s*(Lima \d{5}|Provincia de Lima|Lima|Perú|Peru)\s*$/gi, '')
              .trim();
            movePin(
              loc.lat(),
              loc.lng(),
              cleanAddr || sug.title,
              matchDistrict(distComp?.longText ?? '', place.formattedAddress ?? '')
            );
            mapRef.current?.setZoom(18);
            return;
          }
        } catch (e) {
          console.warn('Place.fetchFields failed, falling back to geocodeText:', e);
        }
      }

      // Text-geocode fallback
      const geo = await geocodeText(`${sug.title} ${sug.subtitle} Lima Peru`, apiKey);
      if (geo) {
        movePin(geo.lat, geo.lng, geo.address, geo.district);
        mapRef.current?.setZoom(18);
      }
    },
    [apiKey, movePin]
  );

  // ── Init Google Map ───────────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current) return;
    let alive = true;

    (async () => {
      await loadGoogleMapsScript(apiKey);
      if (!alive || !mapDivRef.current) return;

      const gmaps = (window as any).google?.maps;
      if (!gmaps) {
        console.error('Google Maps SDK failed to load');
        return;
      }

      const { Map } = await gmaps.importLibrary('maps');
      const { AdvancedMarkerElement } = await gmaps.importLibrary('marker');

      const map: google.maps.Map = new Map(mapDivRef.current, {
        center: { lat: initialLat, lng: initialLng },
        zoom: 17,
        mapId: 'COMIKIDS_DELIVERY_MAP',
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
      });

      // Custom delivery pin HTML
      const pinEl = document.createElement('div');
      pinEl.innerHTML = `
        <div style="
          width:40px;height:48px;display:flex;flex-direction:column;
          align-items:center;justify-content:flex-end;cursor:grab;
          filter:drop-shadow(0 4px 12px rgba(6,182,212,0.7));
        ">
          <div style="
            width:36px;height:36px;border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            background:linear-gradient(135deg,#06b6d4,#3b82f6);
            border:2.5px solid #fff;
            display:flex;align-items:center;justify-content:center;
          ">
            <span style="transform:rotate(45deg);font-size:17px">📍</span>
          </div>
          <div style="width:7px;height:7px;border-radius:50%;background:#06b6d4;border:1.5px solid #fff;margin-top:2px"></div>
        </div>`;

      const marker: google.maps.marker.AdvancedMarkerElement = new AdvancedMarkerElement({
        map,
        position: { lat: initialLat, lng: initialLng },
        content: pinEl.firstElementChild as HTMLElement,
        gmpDraggable: true,
        title: 'Punto de entrega',
        zIndex: 500,
      });

      // Drag end
      marker.addListener('dragend', () => {
        const pos = marker.position as google.maps.LatLngLiteral;
        if (pos) movePin(pos.lat as number, pos.lng as number);
      });

      // Map click
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) movePin(e.latLng.lat(), e.latLng.lng());
      });

      mapRef.current = map;
      markerRef.current = marker;
      setMapReady(true);

      // Auto-locate on mount
      locateMe();
    })();

    return () => {
      alive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Confirm ───────────────────────────────────────────
  const handleConfirm = () => {
    const finalDistrict = district.trim() || 'Lima';
    const finalAddress =
      address.trim() || `Ubicación GPS (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`;
    onConfirmLocation({ district: finalDistrict, address: finalAddress, lat: coords.lat, lng: coords.lng });
    setConfirmed(true);
    if (onCloseModal) setTimeout(onCloseModal, 300);
  };

  // ─────────────────────────────────────────────────────
  return (
    <div className="space-y-3 w-full animate-fadeIn">
      {/* GPS Warning */}
      {gpsError && (
        <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>GPS desactivado o sin permiso. Busca tu calle o mueve el mapa.</span>
          </div>
          <button
            type="button"
            onClick={locateMe}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 font-bold text-xs shrink-0 cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Map Container */}
      <div className="relative w-full rounded-3xl overflow-hidden border-2 border-white/20 bg-slate-950 shadow-2xl"
           style={{ height: 'min(520px, 60dvh)' }}>

        {/* Google Map */}
        <div ref={mapDivRef} className="w-full h-full z-0" />

        {/* Loading overlay */}
        {!mapReady && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950">
            <div className="flex flex-col items-center gap-3 text-white">
              <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
              <span className="text-sm font-bold text-slate-300">Cargando mapa...</span>
            </div>
          </div>
        )}

        {/* ══ Floating Search Bar ══ */}
        <div className="absolute top-3 left-3 right-3 z-40 space-y-2">
          <div className="relative">
            <div className="flex items-center rounded-2xl bg-slate-950/95 backdrop-blur-2xl border-2 border-cyan-500/50 shadow-2xl p-1 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-400/20 transition-all">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 ml-1">
                {isFetchingSuggestions
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Search className="w-4 h-4" />}
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Busca tu calle, tienda, mall, avenida..."
                className="flex-1 px-3 py-2.5 text-sm font-bold text-white placeholder-slate-400 bg-transparent focus:outline-none"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setSuggestions([]); setShowSuggestions(false); }}
                  className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={locateMe}
                disabled={isLocating}
                className="ml-1 px-3 py-2 rounded-xl bg-cyan-500/25 hover:bg-cyan-500/40 text-cyan-300 text-xs font-black flex items-center gap-1.5 border border-cyan-500/40 transition-all cursor-pointer shrink-0 active:scale-95"
              >
                <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isLocating ? 'GPS...' : 'Mi GPS'}</span>
              </button>
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 z-50 max-h-64 overflow-y-auto rounded-2xl bg-slate-900/98 backdrop-blur-3xl border-2 border-cyan-500/40 p-1.5 shadow-2xl space-y-1">
                {suggestions.map((sug) => (
                  <button
                    key={sug.id}
                    type="button"
                    onClick={() => selectSuggestion(sug)}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-cyan-500/20 border border-transparent hover:border-cyan-500/30 transition-all flex items-start gap-2.5 cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white truncate group-hover:text-cyan-300">{sug.title}</p>
                      <p className="text-[10px] text-slate-400 truncate">{sug.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Address card */}
          <div className="px-3.5 py-3 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-white/20 shadow-xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                  {district ? `DISTRITO: ${district.toUpperCase()}` : 'UBICACIÓN SELECCIONADA'}
                </span>
                {isGeocoding && <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />}
              </div>
              <p className="text-xs font-black text-white leading-snug truncate mt-0.5">
                {address || 'Toca el mapa o mueve el pin a la puerta de entrega...'}
              </p>
            </div>
          </div>
        </div>

        {/* Zoom + GPS buttons */}
        <div className="absolute right-3 bottom-24 z-40 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => mapRef.current?.setZoom((mapRef.current.getZoom() ?? 17) + 1)}
            className="w-10 h-10 rounded-2xl bg-slate-900/95 hover:bg-slate-800 text-white font-black flex items-center justify-center border border-white/20 shadow-xl transition-all active:scale-95 cursor-pointer text-lg"
          >+</button>
          <button
            type="button"
            onClick={() => mapRef.current?.setZoom((mapRef.current.getZoom() ?? 17) - 1)}
            className="w-10 h-10 rounded-2xl bg-slate-900/95 hover:bg-slate-800 text-white font-black flex items-center justify-center border border-white/20 shadow-xl transition-all active:scale-95 cursor-pointer text-lg"
          >−</button>
          <button
            type="button"
            onClick={locateMe}
            title="Mi ubicación actual"
            className="w-10 h-10 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center shadow-xl shadow-cyan-600/40 transition-all active:scale-95 cursor-pointer"
          >
            <Crosshair className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Confirm button */}
        <div className="absolute bottom-4 left-4 right-4 z-40">
          <button
            type="button"
            onClick={handleConfirm}
            className={`w-full py-4 px-6 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-3 shadow-2xl transition-all cursor-pointer active:scale-[0.98] border-2 ${
              confirmed
                ? 'bg-emerald-500 text-white shadow-emerald-500/50 border-emerald-400'
                : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 text-white shadow-cyan-500/50 hover:brightness-110 border-cyan-400'
            }`}
          >
            {confirmed ? (
              <>
                <CheckCircle className="w-6 h-6" />
                ¡Ubicación Confirmada!
              </>
            ) : (
              'Confirmar ubicación y continuar ➔'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
