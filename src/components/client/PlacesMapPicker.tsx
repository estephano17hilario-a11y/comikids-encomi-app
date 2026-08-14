import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Navigation,
  Compass,
  CheckCircle,
  Loader2,
  AlertCircle,
  Sparkles,
  Search,
  X,
  Maximize2,
  Minimize2,
  Crosshair,
  Building2
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
  isModal?: boolean;
}

// Icono hiper-preciso: la punta inferior coincide exactamente con el punto del mapa
const createPrecisePinIcon = () => {
  const html = `
    <div style="position: relative; width: 36px; height: 44px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
      <!-- Pin principal elevado -->
      <div style="
        width: 34px; 
        height: 34px; 
        border-radius: 50% 50% 50% 0; 
        transform: rotate(-45deg); 
        background: linear-gradient(135deg, #06b6d4, #2563eb);
        border: 2.5px solid #ffffff; 
        box-shadow: 0 4px 16px rgba(6, 182, 212, 0.8), 0 0 20px rgba(37, 99, 235, 0.4);
        display: flex; 
        align-items: center; 
        justify-content: center;
        cursor: grab;
      ">
        <div style="transform: rotate(45deg); font-size: 15px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));">
          📍
        </div>
      </div>
      <!-- Punto diana inferior en la punta exacta del anclaje -->
      <div style="
        width: 8px; 
        height: 8px; 
        border-radius: 50%; 
        background: #06b6d4; 
        border: 2px solid #ffffff; 
        box-shadow: 0 0 8px rgba(6, 182, 212, 0.9);
        margin-top: 2px;
      "></div>
    </div>
  `;

  return L.divIcon({
    className: 'precise-motorizado-pin-wrapper',
    html,
    iconSize: [36, 44],
    iconAnchor: [18, 44], // EXACTAMENTE en el centro horizontal (18) y en la base inferior (44)
    popupAnchor: [0, -44],
  });
};

// Normalizar texto para emparejar distritos
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Encontrar el distrito canónico de Lima correspondiente
function findMatchingDistrict(rawDistrict: string, fullAddressText: string = ''): string {
  if (!rawDistrict && !fullAddressText) return '';

  const normalizedRaw = normalizeText(rawDistrict || '');
  const normalizedFull = normalizeText(fullAddressText || '');

  // 1. Coincidencia directa con lista oficial de Lima
  const directMatch = DISTRITOS_LIMA.find(d => {
    const nd = normalizeText(d);
    return normalizedRaw === nd || normalizedRaw.includes(nd) || nd.includes(normalizedRaw);
  });
  if (directMatch) return directMatch;

  // 2. Coincidencia buscando dentro del texto completo
  const textMatch = DISTRITOS_LIMA.find(d => {
    const nd = normalizeText(d);
    return normalizedFull.includes(nd);
  });
  if (textMatch) return textMatch;

  return rawDistrict.trim();
}

// Formatear dirección limpia y exacta evitando términos como "Ciclovía"
function formatDetailedAddress(addr: Record<string, string>, displayName: string, lat: number, lng: number): string {
  // Extraer nombres de vías posibles
  let road = addr.road || addr.pedestrian || addr.street || addr.footway || addr.path || addr.residential || '';
  const houseNumber = addr.house_number || '';
  const neighbourhood = addr.neighbourhood || addr.quarter || addr.suburb || '';
  const building = addr.building || addr.amenity || addr.shop || '';

  // Limpiar artefactos como "Ciclovía ..." o "Vía ..." para poner el nombre real de la calle o avenida
  if (road.toLowerCase().startsWith('ciclovia ')) {
    road = road.replace(/ciclovia\s+/i, 'Av. ');
  } else if (road.toLowerCase().startsWith('ciclovía ')) {
    road = road.replace(/ciclovía\s+/i, 'Av. ');
  } else if (road.toLowerCase().startsWith('via auxiliar ')) {
    road = road.replace(/via auxiliar\s+/i, 'Av. ');
  }

  // Si road no tiene prefijo como Av., Jr., Calle, Pasaje, podemos conservarlo
  let fullStreet = road.trim();
  if (fullStreet && houseNumber) {
    fullStreet = `${fullStreet} ${houseNumber}`;
  }

  // Agregar Urbanización o Barrio si existe
  let details = '';
  if (neighbourhood && !fullStreet.toLowerCase().includes(neighbourhood.toLowerCase())) {
    details = neighbourhood.toLowerCase().startsWith('urb') ? neighbourhood : `Urb. ${neighbourhood}`;
  }

  if (building && !fullStreet.toLowerCase().includes(building.toLowerCase())) {
    details = details ? `${details}, ${building}` : building;
  }

  if (fullStreet && details) {
    return `${fullStreet}, ${details}`;
  }

  if (fullStreet) {
    return fullStreet;
  }

  // Si no se encontró calle específica, intentar extraer la primera parte relevante del display_name
  if (displayName) {
    const parts = displayName.split(',').map(p => p.trim());
    // Tomar las 2 primeras partes representativas (ej. "Av. José Larco 812, Miraflores")
    const meaningfulParts = parts.filter(p => 
      !['perú', 'peru', 'lima', 'región lima', 'provincia de lima'].includes(p.toLowerCase()) &&
      !/^\d{5}$/.test(p)
    );
    if (meaningfulParts.length > 0) {
      return meaningfulParts.slice(0, 2).join(', ');
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
  const [customDetailInput, setCustomDetailInput] = useState<string>(''); // Dpto / Mz / Lote / Int
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState<boolean>(false);
  const [hasConfirmed, setHasConfirmed] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  // Búsqueda de calles dentro del mapa
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);

  // Geocodificación inversa con Nominatim OpenStreetMap
  const fetchAddressFromCoords = useCallback(async (latitude: number, longitude: number) => {
    setIsGeocoding(true);
    setStatusMessage('Consultando mapa de calles exactas...');
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=19&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'es',
          },
        }
      );

      if (!response.ok) throw new Error('Error en geocodificación');

      const data = await response.json();
      const addr = data.address || {};

      const rawDistrict = addr.city_district || addr.suburb || addr.town || addr.municipality || addr.city || '';
      const matchedDistrict = findMatchingDistrict(rawDistrict, data.display_name || '');
      const cleanAddress = formatDetailedAddress(addr, data.display_name || '', latitude, longitude);

      setDetectedAddress(cleanAddress);
      setDetectedDistrict(matchedDistrict || rawDistrict || 'Lima');
      setStatusMessage('');
    } catch (err) {
      console.warn('Fallo geocodificación inversa:', err);
      if (!detectedAddress) {
        setDetectedAddress(`Ubicación GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
      }
      setStatusMessage('');
    } finally {
      setIsGeocoding(false);
    }
  }, [detectedAddress]);

  // Buscar dirección por texto en Lima
  const handleSearchAddress = async (query: string) => {
    if (!query || query.trim().length < 3) return;
    setIsSearching(true);
    try {
      const encoded = encodeURIComponent(`${query.trim()}, Lima, Peru`);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=pe&limit=5&addressdetails=1`,
        {
          headers: { 'Accept-Language': 'es' }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data || []);
        setShowSearchResults(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: { display_name: string; lat: string; lon: string }) => {
    const newLat = parseFloat(result.lat);
    const newLng = parseFloat(result.lon);

    setCoords({ lat: newLat, lng: newLng });
    setShowSearchResults(false);
    setSearchQuery('');

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([newLat, newLng], 18, { duration: 1.2 });
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([newLat, newLng]);
    }

    fetchAddressFromCoords(newLat, newLng);
  };

  // Pedir ubicación GPS del navegador
  const requestCurrentLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationPermissionDenied(true);
      return;
    }

    setIsLocating(true);
    setLocationPermissionDenied(false);
    setStatusMessage('Solicitando coordenadas GPS de tu dispositivo...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        setCoords({ lat: userLat, lng: userLng });
        setIsLocating(false);
        setLocationPermissionDenied(false);

        if (mapInstanceRef.current) {
          // Zoom profundo 18 para ver la calle exacta y la fachada
          mapInstanceRef.current.flyTo([userLat, userLng], 18, {
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

  // Inicializar mapa de Leaflet con soporte de zoom profundo hasta 20
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [coords.lat, coords.lng],
      zoom: 17,
      maxZoom: 20,
      minZoom: 10,
      zoomControl: false,
      attributionControl: false,
    });

    // Tiles nítidos de alta definición CartoDB Voyager
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(map);

    // Marcador interactivo posicionado exactamente en el centro
    const marker = L.marker([coords.lat, coords.lng], {
      icon: createPrecisePinIcon(),
      draggable: true,
      autoPan: true,
    }).addTo(map);

    // Evento al soltar el pin arrastrado
    marker.on('dragend', () => {
      const newPos = marker.getLatLng();
      setCoords({ lat: newPos.lat, lng: newPos.lng });
      setHasConfirmed(false);
      fetchAddressFromCoords(newPos.lat, newPos.lng);
    });

    // Evento al hacer clic en el mapa: mueve el pin EXACTAMENTE a donde se presionó
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      setCoords({ lat, lng });
      setHasConfirmed(false);
      fetchAddressFromCoords(lat, lng);
    });

    markerRef.current = marker;
    mapInstanceRef.current = map;

    // Forzar renderizado de tamaño completo de Leaflet
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    // Solicitar GPS automáticamente
    requestCurrentLocation();

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Botón de Confirmación "Es aquí"
  const handleConfirm = () => {
    const finalDistrict = detectedDistrict.trim() || 'Lima';
    let finalAddress = detectedAddress.trim() || `Ubicación GPS (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;

    if (customDetailInput.trim()) {
      finalAddress = `${finalAddress} (${customDetailInput.trim()})`;
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
      }, 400);
    }
  };

  return (
    <div className="space-y-3.5 animate-fadeIn">
      
      {/* Barra Superior con Buscador de Calles en Lima */}
      <div className="relative">
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleSearchAddress(e.target.value);
            }}
            placeholder="Buscar calle, pasaje o lugar en Lima (ej. Av. Larco 812, Pasaje Los Sauces)..."
            className="w-full pl-11 pr-24 py-3 bg-slate-900/90 border border-white/15 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20 shadow-inner transition-all"
          />
          <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 pointer-events-none" />

          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setShowSearchResults(false);
              }}
              className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center absolute right-12 cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={requestCurrentLocation}
            disabled={isLocating}
            className="absolute right-2 px-2.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1 border border-cyan-500/30 transition-all cursor-pointer"
            title="Ubicar mi GPS"
          >
            <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">{isLocating ? 'GPS...' : 'Mi GPS'}</span>
          </button>
        </div>

        {/* Resultados de búsqueda flotantes */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute z-50 top-full mt-1.5 w-full bg-slate-900/98 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn max-h-56 overflow-y-auto">
            <div className="p-2 border-b border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">Lugares encontrados:</span>
              <button
                type="button"
                onClick={() => setShowSearchResults(false)}
                className="text-cyan-400 hover:underline cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            {searchResults.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSearchResult(item)}
                className="w-full text-left px-3.5 py-2.5 hover:bg-cyan-500/15 text-xs text-slate-200 border-b border-white/[0.06] last:border-0 flex items-start gap-2.5 transition-colors cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span className="leading-snug line-clamp-2">{item.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Aviso de permiso GPS si es necesario */}
      {locationPermissionDenied && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2.5 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Permiso de ubicación desactivado. Actívalo en tu navegador para detectar tu casa automáticamente.</span>
          </div>
          <button
            type="button"
            onClick={requestCurrentLocation}
            className="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[11px] transition-colors shrink-0 cursor-pointer"
          >
            Activar GPS
          </button>
        </div>
      )}

      {/* Contenedor del Mapa Leaflet Amplio, Inmersivo y con Zoom Profundo */}
      <div className={`relative w-full ${isModal ? 'h-[440px] sm:h-[540px]' : 'h-[360px] sm:h-[440px]'} rounded-3xl overflow-hidden border border-white/15 bg-slate-950 shadow-2xl`}>
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Controles de Zoom Flotantes estilo Apple Maps */}
        <div className="absolute right-3.5 top-3.5 z-[400] flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-bold flex items-center justify-center border border-white/15 shadow-xl transition-all active:scale-95 cursor-pointer text-base"
            title="Acercar mapa (Zoom In)"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-bold flex items-center justify-center border border-white/15 shadow-xl transition-all active:scale-95 cursor-pointer text-base"
            title="Alejar mapa (Zoom Out)"
          >
            -
          </button>
          <button
            type="button"
            onClick={requestCurrentLocation}
            className="w-9 h-9 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center shadow-xl shadow-cyan-600/30 transition-all active:scale-95 cursor-pointer"
            title="Centrar en mi ubicación actual"
          >
            <Crosshair className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Banner Flotante Superior: Dirección en Tiempo Real */}
        <div className="absolute top-3 left-3 right-16 z-[400] pointer-events-none">
          <div className="p-3 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-white/15 shadow-2xl flex items-center gap-2.5 text-xs text-white">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-extrabold uppercase text-cyan-400 tracking-wider">
                  {detectedDistrict ? `Distrito: ${detectedDistrict}` : 'Ubicación seleccionada'}
                </span>
                {isGeocoding && <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />}
              </div>
              <p className="font-bold text-white text-xs sm:text-sm truncate leading-tight mt-0.5">
                {detectedAddress || statusMessage || 'Toca o arrastra el mapa hasta tu domicilio...'}
              </p>
            </div>
          </div>
        </div>

        {/* Barra Inferior Flotante de Confirmación y Ajuste de Dpto / Int */}
        <div className="absolute bottom-3.5 left-3.5 right-3.5 z-[400] space-y-2">
          
          {/* Campo opcional de Departamento / Interior / Mz */}
          <div className="p-2.5 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-white/15 shadow-2xl flex items-center gap-2 text-xs">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            <input
              type="text"
              value={customDetailInput}
              onChange={(e) => setCustomDetailInput(e.target.value)}
              placeholder="Dpto, Mz, Lote o Interior (ej. Dpto 402, Mz C Lt 12)..."
              className="w-full bg-transparent text-white placeholder-slate-500 text-xs focus:outline-none font-medium"
            />
          </div>

          {/* Botón Principal: CONFIRMAR, ES AQUÍ */}
          <button
            type="button"
            onClick={handleConfirm}
            className={`w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-3 shadow-2xl transition-all cursor-pointer active:scale-[0.98] ${
              hasConfirmed
                ? 'bg-emerald-500 text-white shadow-emerald-500/40 border border-emerald-400/50'
                : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 text-white shadow-cyan-500/40 hover:brightness-110 border border-cyan-400/40'
            }`}
          >
            {hasConfirmed ? (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>¡Ubicación Confirmada! (Casillas rellenadas)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-cyan-200" />
                <span>Confirmar, es aquí 📍</span>
              </>
            )}
          </button>
        </div>

      </div>

    </div>
  );
};
