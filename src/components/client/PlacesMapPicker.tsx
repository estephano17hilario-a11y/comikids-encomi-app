import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Compass, CheckCircle, Loader2, AlertCircle, Sparkles } from 'lucide-react';
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
}

// Icono personalizado para el marcador interactivo del usuario
const createMotorizadoPickerIcon = () => {
  const html = `
    <div style="position: relative; width: 44px; height: 52px; display: flex; flex-direction: column; align-items: center; justify-content: center; transform: translate(-50%, -100%);">
      <div style="
        width: 40px; 
        height: 40px; 
        border-radius: 50% 50% 50% 0; 
        transform: rotate(-45deg); 
        background: linear-gradient(135deg, #06b6d4, #3b82f6);
        border: 2.5px solid #ffffff; 
        box-shadow: 0 4px 16px rgba(6, 182, 212, 0.7);
        display: flex; 
        align-items: center; 
        justify-content: center;
        cursor: grab;
      ">
        <div style="transform: rotate(45deg); font-size: 18px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
          📍
        </div>
      </div>
      <div style="
        width: 14px; 
        height: 5px; 
        background: rgba(0,0,0,0.4); 
        border-radius: 50%; 
        margin-top: -3px; 
        filter: blur(1px);
      "></div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-motorizado-pin',
    html,
    iconSize: [44, 52],
    iconAnchor: [22, 52],
    popupAnchor: [0, -52],
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

  // Si no se encuentra en la lista, retornar el distrito original limpio
  return rawDistrict.trim();
}

export const PlacesMapPicker: React.FC<Props> = ({
  initialLat = -12.1215,
  initialLng = -77.0298,
  initialAddress = '',
  initialDistrict = '',
  onConfirmLocation
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
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState<boolean>(false);
  const [hasConfirmed, setHasConfirmed] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Geocodificación inversa con Nominatim OpenStreetMap
  const fetchAddressFromCoords = useCallback(async (latitude: number, longitude: number) => {
    setIsGeocoding(true);
    setStatusMessage('Identificando calle y distrito...');
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'es',
          },
        }
      );

      if (!response.ok) throw new Error('Error en servicio de geocodificación');

      const data = await response.json();
      const addr = data.address || {};

      // Extraer calle y número
      const road = addr.road || addr.pedestrian || addr.street || addr.footway || addr.path || '';
      const houseNumber = addr.house_number || '';
      const neighbourhood = addr.neighbourhood || addr.suburb || addr.quarter || '';
      const rawDistrict = addr.city_district || addr.suburb || addr.town || addr.municipality || addr.city || '';

      let cleanRoad = road;
      if (cleanRoad && houseNumber) {
        cleanRoad = `${cleanRoad} ${houseNumber}`;
      } else if (!cleanRoad && neighbourhood) {
        cleanRoad = neighbourhood;
      } else if (!cleanRoad) {
        cleanRoad = data.display_name?.split(',')[0] || `Ubicación GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
      }

      // Encontrar distrito de Lima
      const matchedDistrict = findMatchingDistrict(rawDistrict, data.display_name || '');

      setDetectedAddress(cleanRoad);
      setDetectedDistrict(matchedDistrict || rawDistrict);
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

  // Pedir ubicación GPS del navegador
  const requestCurrentLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationPermissionDenied(true);
      return;
    }

    setIsLocating(true);
    setLocationPermissionDenied(false);
    setStatusMessage('Solicitando acceso GPS al navegador...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        setCoords({ lat: userLat, lng: userLng });
        setIsLocating(false);
        setLocationPermissionDenied(false);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([userLat, userLng], 17, {
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

  // Inicializar mapa de Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [coords.lat, coords.lng],
      zoom: 16,
      zoomControl: true,
      attributionControl: false,
    });

    // Tiles claros de alta definición estilo CartoDB Voyager
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // Marcador interactivo y arrastrable
    const marker = L.marker([coords.lat, coords.lng], {
      icon: createMotorizadoPickerIcon(),
      draggable: true,
      autoPan: true,
    }).addTo(map);

    // Evento al arrastrar el pin
    marker.on('dragend', () => {
      const newPos = marker.getLatLng();
      setCoords({ lat: newPos.lat, lng: newPos.lng });
      setHasConfirmed(false);
      fetchAddressFromCoords(newPos.lat, newPos.lng);
    });

    // Evento al hacer clic en cualquier parte del mapa
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      setCoords({ lat, lng });
      setHasConfirmed(false);
      fetchAddressFromCoords(lat, lng);
    });

    markerRef.current = marker;
    mapInstanceRef.current = map;

    // Pedir permiso y detectar GPS automáticamente al cargar
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
    const finalAddress = detectedAddress.trim() || `Ubicación GPS (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;

    onConfirmLocation({
      district: finalDistrict,
      address: finalAddress,
      lat: coords.lat,
      lng: coords.lng,
    });

    setHasConfirmed(true);
  };

  return (
    <div className="space-y-3 animate-fadeIn">
      
      {/* Encabezado del Mapa con Acciones */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Mapa de Entrega en Tiempo Real</span>
          </h4>
          <p className="text-[11px] text-slate-400">
            Toca o arrastra el pin hasta la puerta de tu domicilio
          </p>
        </div>

        {/* Botón GPS */}
        <button
          type="button"
          onClick={requestCurrentLocation}
          disabled={isLocating}
          className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 active:scale-95 text-cyan-300 text-xs font-bold flex items-center gap-1.5 border border-cyan-500/30 transition-all cursor-pointer shadow-sm shrink-0"
        >
          {isLocating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Buscando...</span>
            </>
          ) : (
            <>
              <Navigation className="w-3.5 h-3.5" />
              <span>Mi Ubicación</span>
            </>
          )}
        </button>
      </div>

      {/* Aviso si el permiso de ubicación fue denegado o no otorgado */}
      {locationPermissionDenied && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2.5 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Por favor activa el permiso de ubicación en tu navegador para centrar el mapa.</span>
          </div>
          <button
            type="button"
            onClick={requestCurrentLocation}
            className="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[11px] transition-colors shrink-0"
          >
            Activar GPS
          </button>
        </div>
      )}

      {/* Contenedor del Mapa Leaflet Interactivo Grande */}
      <div className="relative w-full h-72 sm:h-80 md:h-96 rounded-3xl overflow-hidden border border-white/15 bg-slate-900 shadow-2xl">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Banner Flotante Superior: Dirección Detectada */}
        <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none">
          <div className="p-3 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-white/15 shadow-xl flex items-center justify-between gap-3 text-xs text-white">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-cyan-400 tracking-wider">
                    {detectedDistrict ? `Distrito: ${detectedDistrict}` : 'Ubicación seleccionada'}
                  </span>
                  {isGeocoding && <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />}
                </div>
                <p className="font-bold text-white text-xs truncate leading-snug">
                  {detectedAddress || statusMessage || 'Mueve el pin o haz clic en el mapa...'}
                </p>
              </div>
            </div>

            <span className="text-[10px] font-mono text-slate-400 bg-white/10 px-2 py-0.5 rounded-lg shrink-0 hidden sm:inline-block">
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Botón Flotante Inferior: CONFIRMAR, ES AQUÍ */}
        <div className="absolute bottom-3.5 left-3.5 right-3.5 z-10">
          <button
            type="button"
            onClick={handleConfirm}
            className={`w-full py-3.5 px-5 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 shadow-2xl transition-all cursor-pointer active:scale-[0.98] ${
              hasConfirmed
                ? 'bg-emerald-500 text-white shadow-emerald-500/40 border border-emerald-400/50'
                : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 text-white shadow-cyan-500/40 hover:brightness-110 border border-cyan-400/40'
            }`}
          >
            {hasConfirmed ? (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>¡Ubicación Confirmada! (Casillas actualizadas)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-cyan-200" />
                <span>Confirmar, es aquí 📍</span>
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
};
