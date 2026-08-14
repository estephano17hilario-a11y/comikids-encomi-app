import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Navigation,
  CheckCircle,
  Loader2,
  AlertCircle,
  Sparkles,
  Search,
  X,
  Crosshair,
  Building2,
  Compass
} from 'lucide-react';
import { DISTRITOS_LIMA } from '../../data/distritosLima';

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
  onOpenModal?: () => void;
  isModal?: boolean;
}

interface SearchPlaceItem {
  display_name: string;
  lat: string;
  lon: string;
  mainText: string;
  subText: string;
  district: string;
  addressDetails?: Record<string, string>;
}

// Resaltar coincidencias de búsqueda (igual que Shalom)
const HighlightMatch: React.FC<{ text: string; query: string; className?: string }> = ({
  text,
  query,
  className = ''
}) => {
  if (!query || !query.trim() || !text) {
    return <span className={className}>{text}</span>;
  }

  const q = query.trim();
  try {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);

    return (
      <span className={className}>
        {parts.map((part, idx) =>
          regex.test(part) ? (
            <span
              key={idx}
              className="font-bold text-cyan-300 bg-cyan-400/25 px-1 py-0.5 rounded"
            >
              {part}
            </span>
          ) : (
            <span key={idx}>{part}</span>
          )
        )}
      </span>
    );
  } catch {
    return <span className={className}>{text}</span>;
  }
};

// Icono milimétrico con punta inferior de alta precisión
const createPrecisePinIcon = () => {
  const html = `
    <div style="position: relative; width: 42px; height: 50px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
      <!-- Pin principal -->
      <div style="
        width: 40px; 
        height: 40px; 
        border-radius: 50% 50% 50% 0; 
        transform: rotate(-45deg); 
        background: linear-gradient(135deg, #06b6d4, #2563eb);
        border: 2.5px solid #ffffff; 
        box-shadow: 0 4px 20px rgba(6, 182, 212, 0.9), 0 0 25px rgba(37, 99, 235, 0.6);
        display: flex; 
        align-items: center; 
        justify-content: center;
        cursor: grab;
      ">
        <div style="transform: rotate(45deg); font-size: 18px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));">
          📍
        </div>
      </div>
      <!-- Diana en la punta exacta del anclaje -->
      <div style="
        width: 10px; 
        height: 10px; 
        border-radius: 50%; 
        background: #06b6d4; 
        border: 2px solid #ffffff; 
        box-shadow: 0 0 12px rgba(6, 182, 212, 1);
        margin-top: 2px;
      "></div>
    </div>
  `;

  return L.divIcon({
    className: 'precise-motorizado-pin-wrapper',
    html,
    iconSize: [42, 50],
    iconAnchor: [21, 50], // Centro horizontal 21, base exacta 50
    popupAnchor: [0, -50],
  });
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function findMatchingDistrict(rawDistrict: string, fullAddressText: string = ''): string {
  if (!rawDistrict && !fullAddressText) return 'Lima';

  const normalizedRaw = normalizeText(rawDistrict || '');
  const normalizedFull = normalizeText(fullAddressText || '');

  const directMatch = DISTRITOS_LIMA.find(d => {
    const nd = normalizeText(d);
    return normalizedRaw === nd || normalizedRaw.includes(nd) || nd.includes(normalizedRaw);
  });
  if (directMatch) return directMatch;

  const textMatch = DISTRITOS_LIMA.find(d => {
    const nd = normalizeText(d);
    return normalizedFull.includes(nd);
  });
  if (textMatch) return textMatch;

  return rawDistrict.trim() || 'Lima';
}

// Extraer y limpiar dirección milimétrica exacta (ej: Jr. Huamanga 1586)
function formatMilimetricAddress(addr: Record<string, string>, displayName: string, lat: number, lng: number): string {
  let road = addr.road || addr.pedestrian || addr.street || addr.footway || addr.path || addr.residential || addr.highway || '';
  let houseNumber = addr.house_number || '';

  // Si display_name empieza con número (ej. "1586, Jirón Huamanga..."), extraerlo
  if (!houseNumber && displayName) {
    const firstPart = displayName.split(',')[0]?.trim() || '';
    if (/^\d+[a-zA-Z]?$/.test(firstPart)) {
      houseNumber = firstPart;
    }
  }

  // Limpiar y formatear prefijos comunes de Lima
  if (road.toLowerCase().startsWith('ciclovia ') || road.toLowerCase().startsWith('ciclovía ')) {
    road = road.replace(/ciclov[ií]a\s+/i, 'Av. ');
  } else if (road.toLowerCase().startsWith('via auxiliar ') || road.toLowerCase().startsWith('vía auxiliar ')) {
    road = road.replace(/v[ií]a auxiliar\s+/i, 'Av. ');
  }

  let fullStreet = road.trim();

  // Si la calle no tiene prefijo pero es un nombre propio conocido en Lima
  if (fullStreet && !/^(jr|jir[oó]n|av|avenida|calle|ca|pje|pasaje|prol|prolongaci[oó]n|alameda|carretera)/i.test(fullStreet)) {
    fullStreet = `Jr. ${fullStreet}`;
  }

  // Normalizar abreviaturas
  fullStreet = fullStreet
    .replace(/^jiron\s+/i, 'Jr. ')
    .replace(/^jirón\s+/i, 'Jr. ')
    .replace(/^avenida\s+/i, 'Av. ')
    .replace(/^pasaje\s+/i, 'Pje. ')
    .replace(/^prolongacion\s+/i, 'Prol. ')
    .replace(/^prolongación\s+/i, 'Prol. ');

  if (fullStreet && houseNumber) {
    return `${fullStreet} ${houseNumber}`;
  }

  if (fullStreet) {
    return fullStreet;
  }

  // Fallback: Analizar partes del display_name
  if (displayName) {
    const parts = displayName.split(',').map(p => p.trim());
    const validParts = parts.filter(p => {
      const lower = p.toLowerCase();
      return (
        !['perú', 'peru', 'lima', 'región lima', 'provincia de lima'].includes(lower) &&
        !lower.startsWith('pueblo joven') &&
        !lower.startsWith('asentamiento humano') &&
        !lower.startsWith('asoc.') &&
        !/^\d{5}$/.test(p)
      );
    });

    if (validParts.length > 0) {
      return validParts.slice(0, 2).join(', ');
    }
  }

  return `Ubicación GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

export const PlacesMapPicker: React.FC<Props> = ({
  initialLat = -12.1215,
  initialLng = -77.0298,
  initialAddress = '',
  initialDistrict = '',
  onConfirmLocation,
  onCloseModal,
  isModal = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat,
    lng: initialLng,
  });

  const [detectedAddress, setDetectedAddress] = useState<string>(initialAddress);
  const [detectedDistrict, setDetectedDistrict] = useState<string>(initialDistrict);
  const [exactNumberInput, setExactNumberInput] = useState<string>(''); // Para añadir número exacto si falta
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState<boolean>(false);
  const [hasConfirmed, setHasConfirmed] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  // Buscador de calles en Perú / Lima con sugerencias instantáneas
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchPlaceItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);

  // Sincronizar props externas
  useEffect(() => {
    if (initialLat && initialLng && (initialLat !== coords.lat || initialLng !== coords.lng)) {
      setCoords({ lat: initialLat, lng: initialLng });
      if (markerRef.current) markerRef.current.setLatLng([initialLat, initialLng]);
      if (mapInstanceRef.current) mapInstanceRef.current.setView([initialLat, initialLng]);
    }
    if (initialAddress && initialAddress !== detectedAddress) {
      setDetectedAddress(initialAddress);
    }
    if (initialDistrict && initialDistrict !== detectedDistrict) {
      setDetectedDistrict(initialDistrict);
    }
  }, [initialLat, initialLng, initialAddress, initialDistrict]);

  // Geocodificación Inversa Milimétrica
  const fetchAddressFromCoords = useCallback(async (latitude: number, longitude: number) => {
    setIsGeocoding(true);
    setStatusMessage('Localizando calle y numeración exacta...');
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=19&addressdetails=1&namedetails=1`,
        {
          headers: {
            'Accept-Language': 'es',
          },
        }
      );

      if (!response.ok) throw new Error('Error al geocodificar');

      const data = await response.json();
      const addr = data.address || {};

      const rawDistrict = addr.city_district || addr.suburb || addr.town || addr.municipality || addr.city || '';
      const matchedDistrict = findMatchingDistrict(rawDistrict, data.display_name || '');
      const cleanAddress = formatMilimetricAddress(addr, data.display_name || '', latitude, longitude);

      setDetectedAddress(cleanAddress);
      setDetectedDistrict(matchedDistrict || rawDistrict || 'Lima');
      setStatusMessage('');
    } catch (err) {
      console.warn('Fallo geocodificación:', err);
      if (!detectedAddress) {
        setDetectedAddress(`Ubicación GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
      }
      setStatusMessage('');
    } finally {
      setIsGeocoding(false);
    }
  }, [detectedAddress]);

  // Buscador Exclusivo de Perú con soporte de calles, jirones, pasajes y números
  const handleSearchAddress = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const cleanQuery = query.trim();
      const encoded = encodeURIComponent(`${cleanQuery}, Lima, Peru`);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=pe&limit=8&addressdetails=1`,
        {
          headers: { 'Accept-Language': 'es' }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const formattedList: SearchPlaceItem[] = (data || []).map((item: any) => {
          const addr = item.address || {};
          const main = formatMilimetricAddress(addr, item.display_name, parseFloat(item.lat), parseFloat(item.lon));
          const district = findMatchingDistrict(addr.city_district || addr.suburb || addr.town || addr.city || '', item.display_name);
          const sub = `${district}, Lima, Perú`;

          return {
            display_name: item.display_name,
            lat: item.lat,
            lon: item.lon,
            mainText: main,
            subText: sub,
            district: district,
            addressDetails: addr
          };
        });

        setSearchResults(formattedList);
        setShowSearchResults(true);
      }
    } catch (err) {
      console.error('Error buscando dirección:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: SearchPlaceItem) => {
    const newLat = parseFloat(result.lat);
    const newLng = parseFloat(result.lon);

    setCoords({ lat: newLat, lng: newLng });
    setShowSearchResults(false);
    setSearchQuery('');
    setHasConfirmed(false);
    setDetectedAddress(result.mainText);
    setDetectedDistrict(result.district || 'Lima');

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([newLat, newLng], 19, { duration: 1.2 });
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([newLat, newLng]);
    }
  };

  // Pedir GPS en tiempo real
  const requestCurrentLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationPermissionDenied(true);
      return;
    }

    setIsLocating(true);
    setLocationPermissionDenied(false);
    setStatusMessage('Localizando tu GPS en alta precisión...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        setCoords({ lat: userLat, lng: userLng });
        setIsLocating(false);
        setLocationPermissionDenied(false);
        setSearchQuery('');
        setHasConfirmed(false);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([userLat, userLng], 19, {
            duration: 1.2,
          });
        }

        if (markerRef.current) {
          markerRef.current.setLatLng([userLat, userLng]);
        }

        fetchAddressFromCoords(userLat, userLng);
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationPermissionDenied(true);
        }
        setStatusMessage('');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [fetchAddressFromCoords]);

  // Inicializar Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [coords.lat, coords.lng],
      zoom: 18,
      maxZoom: 20,
      minZoom: 10,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(map);

    const marker = L.marker([coords.lat, coords.lng], {
      icon: createPrecisePinIcon(),
      draggable: true,
      autoPan: true,
    }).addTo(map);

    marker.on('dragend', () => {
      const newPos = marker.getLatLng();
      setCoords({ lat: newPos.lat, lng: newPos.lng });
      setSearchQuery('');
      setShowSearchResults(false);
      setHasConfirmed(false);
      fetchAddressFromCoords(newPos.lat, newPos.lng);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      setCoords({ lat, lng });
      setSearchQuery('');
      setShowSearchResults(false);
      setHasConfirmed(false);
      fetchAddressFromCoords(lat, lng);
    });

    markerRef.current = marker;
    mapInstanceRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    requestCurrentLocation();

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Confirmación
  const handleConfirm = () => {
    const finalDistrict = detectedDistrict.trim() || 'Lima';
    let finalAddress = detectedAddress.trim() || `Ubicación GPS (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;

    if (exactNumberInput.trim() && !finalAddress.includes(exactNumberInput.trim())) {
      finalAddress = `${finalAddress} #${exactNumberInput.trim()}`;
    }

    onConfirmLocation({
      district: finalDistrict,
      address: finalAddress,
      lat: coords.lat,
      lng: coords.lng,
    });

    setHasConfirmed(true);

    if (onCloseModal) {
      setTimeout(() => {
        onCloseModal();
      }, 300);
    }
  };

  return (
    <div className="space-y-3 animate-fadeIn w-full">
      
      {/* ÚNICO BUSCADOR SUPERIOR: Calles, Pasajes, Jirones y Lugares en Lima/Perú */}
      <div className="relative w-full z-30">
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleSearchAddress(e.target.value);
            }}
            placeholder="Buscar calle, jirón, pasaje o avenida (ej. Jr. Huamanga 1586, Av. Larco 812)..."
            className="w-full pl-12 pr-28 py-4 bg-slate-900/95 border-2 border-white/20 rounded-2xl text-sm sm:text-base text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/25 shadow-2xl transition-all font-semibold"
          />
          <Search className="w-5 h-5 text-cyan-400 absolute left-4 pointer-events-none" />

          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setShowSearchResults(false);
              }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center absolute right-16 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={requestCurrentLocation}
            disabled={isLocating}
            className="absolute right-2 px-3.5 py-2.5 rounded-xl bg-cyan-500/25 hover:bg-cyan-500/35 text-cyan-300 text-xs font-black flex items-center gap-1.5 border border-cyan-500/40 transition-all cursor-pointer shadow-md"
            title="Ubicar mi GPS"
          >
            <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'GPS...' : 'Mi GPS'}</span>
          </button>
        </div>

        {/* Dropdown de Coincidencias al estilo Shalom (Resaltado y Específico) */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-slate-950/98 backdrop-blur-2xl border-2 border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn max-h-72 overflow-y-auto">
            <div className="p-3 border-b border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-cyan-300">Coincidencias encontradas en Perú:</span>
              <button
                type="button"
                onClick={() => setShowSearchResults(false)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer font-bold"
              >
                Cerrar ✕
              </button>
            </div>

            {searchResults.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSearchResult(item)}
                className="w-full text-left px-4 py-3.5 hover:bg-cyan-500/20 text-xs sm:text-sm text-slate-200 border-b border-white/[0.06] last:border-0 flex items-start gap-3 transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h5 className="font-bold text-white leading-snug">
                    <HighlightMatch text={item.mainText} query={searchQuery} />
                  </h5>
                  <p className="text-xs text-slate-400 mt-0.5">
                    <HighlightMatch text={item.subText} query={searchQuery} />
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Aviso de permiso GPS si es necesario */}
      {locationPermissionDenied && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2.5 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Permiso de GPS desactivado. Actívalo para detectar tu casa automáticamente.</span>
          </div>
          <button
            type="button"
            onClick={requestCurrentLocation}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs transition-colors shrink-0 cursor-pointer"
          >
            Activar GPS
          </button>
        </div>
      )}

      {/* CONTENEDOR DEL MAPA EXTRA-LARGO EN EL EJE Y (640px a 740px) */}
      <div className="relative w-full h-[620px] sm:h-[720px] min-h-[560px] rounded-3xl overflow-hidden border-2 border-white/20 bg-slate-950 shadow-2xl">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Controles Flotantes de Zoom */}
        <div className="absolute right-4 top-4 z-[400] flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="w-11 h-11 rounded-2xl bg-slate-900/95 hover:bg-slate-800 text-white font-bold flex items-center justify-center border border-white/20 shadow-2xl transition-all active:scale-95 cursor-pointer text-xl"
            title="Acercar mapa (Zoom In)"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="w-11 h-11 rounded-2xl bg-slate-900/95 hover:bg-slate-800 text-white font-bold flex items-center justify-center border border-white/20 shadow-2xl transition-all active:scale-95 cursor-pointer text-xl"
            title="Alejar mapa (Zoom Out)"
          >
            -
          </button>
          <button
            type="button"
            onClick={requestCurrentLocation}
            className="w-11 h-11 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center shadow-2xl shadow-cyan-600/40 transition-all active:scale-95 cursor-pointer"
            title="Centrar en mi ubicación actual"
          >
            <Crosshair className={`w-5 h-5 ${isLocating ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Banner Superior: Dirección Milimétrica en Tiempo Real */}
        <div className="absolute top-4 left-4 right-20 z-[400] pointer-events-none">
          <div className="p-4 rounded-2xl bg-slate-950/95 backdrop-blur-2xl border-2 border-white/25 shadow-2xl flex items-center gap-3.5 text-xs text-white">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/25 text-cyan-400 flex items-center justify-center shrink-0 shadow-md">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase text-cyan-300 tracking-wider">
                  {detectedDistrict ? `DISTRITO: ${detectedDistrict.toUpperCase()}` : 'UBICACIÓN SELECCIONADA'}
                </span>
                {isGeocoding && <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />}
              </div>
              <p className="font-black text-white text-sm sm:text-base truncate leading-tight mt-0.5">
                {detectedAddress || statusMessage || 'Toca o mueve el pin hasta tu puerta exacta...'}
              </p>
            </div>
          </div>
        </div>

        {/* Botón Principal Flotante: CONFIRMAR UBICACIÓN */}
        <div className="absolute bottom-4 left-4 right-4 z-[400]">
          <button
            type="button"
            onClick={handleConfirm}
            className={`w-full py-5 px-6 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-3 shadow-2xl transition-all cursor-pointer active:scale-[0.98] ${
              hasConfirmed
                ? 'bg-emerald-500 text-white shadow-emerald-500/50 border-2 border-emerald-400'
                : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 text-white shadow-cyan-500/50 hover:brightness-110 border-2 border-cyan-400'
            }`}
          >
            {hasConfirmed ? (
              <>
                <CheckCircle className="w-6 h-6" />
                <span>¡Ubicación Confirmada! Pasando al formulario...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-6 h-6 text-cyan-200" />
                <span>Confirmar ubicación y continuar ➔</span>
              </>
            )}
          </button>
        </div>

      </div>

    </div>
  );
};
