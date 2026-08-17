import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Navigation,
  CheckCircle,
  Loader2,
  AlertCircle,
  Crosshair,
  Search,
  X
} from 'lucide-react';
import { DISTRITOS_LIMA } from '../../data/distritosLima';
import { loadGoogleMapsScript } from '../../services/googleMapsLoader';

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

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  district: string;
  lat: number;
  lng: number;
}

const createPinIcon = () => {
  const html = `
    <div style="position: relative; width: 40px; height: 48px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
      <div style="
        width: 36px; 
        height: 36px; 
        border-radius: 50% 50% 50% 0; 
        transform: rotate(-45deg); 
        background: linear-gradient(135deg, #06b6d4, #3b82f6);
        border: 2px solid #ffffff; 
        box-shadow: 0 4px 15px rgba(6, 182, 212, 0.8);
        display: flex; 
        align-items: center; 
        justify-content: center;
        cursor: grab;
      ">
        <div style="transform: rotate(45deg); font-size: 16px;">📍</div>
      </div>
      <div style="width: 8px; height: 8px; border-radius: 50%; background: #06b6d4; border: 1.5px solid #fff; margin-top: 2px;"></div>
    </div>
  `;
  return L.divIcon({
    className: 'delivery-pin-marker',
    html,
    iconSize: [40, 48],
    iconAnchor: [20, 48],
  });
};

const createUserDotIcon = () => {
  const html = `
    <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 30px; height: 30px; border-radius: 50%; background: rgba(14, 165, 233, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="width: 14px; height: 14px; border-radius: 50%; background: #0284c7; border: 2.5px solid #ffffff; box-shadow: 0 0 10px rgba(14, 165, 233, 1);"></div>
    </div>
  `;
  return L.divIcon({
    className: 'user-gps-dot',
    html,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function findMatchingDistrict(rawDistrict: string, fullAddressText: string = ''): string {
  if (!rawDistrict && !fullAddressText) return 'Lima';
  const ndRaw = normalizeText(rawDistrict);
  const ndFull = normalizeText(fullAddressText);

  const match = DISTRITOS_LIMA.find(d => {
    const nd = normalizeText(d);
    return ndRaw === nd || ndRaw.includes(nd) || nd.includes(ndRaw) || ndFull.includes(nd);
  });
  return match || rawDistrict.trim() || 'Lima';
}

function cleanStreetName(rawStreet: string, houseNumber?: string): string {
  if (!rawStreet) return '';
  let street = rawStreet.trim();
  if (!/^(jr|jir[oó]n|av|avenida|calle|ca|pje|pasaje|prol|prolongaci[oó]n|alameda|carretera)/i.test(street)) {
    street = `Jr. ${street}`;
  }
  street = street
    .replace(/^jiron\s+/i, 'Jr. ')
    .replace(/^jirón\s+/i, 'Jr. ')
    .replace(/^avenida\s+/i, 'Av. ')
    .replace(/^pasaje\s+/i, 'Pje. ')
    .replace(/^prolongacion\s+/i, 'Prol. ')
    .replace(/^prolongación\s+/i, 'Prol. ');

  if (houseNumber && !street.includes(houseNumber)) {
    return `${street} ${houseNumber}`;
  }
  return street;
}

export const PlacesMapPicker: React.FC<Props> = ({
  initialLat = -12.1215,
  initialLng = -77.0298,
  initialAddress = '',
  initialDistrict = '',
  onConfirmLocation,
  onCloseModal,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const deliveryMarkerRef = useRef<L.Marker | null>(null);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);

  const googleMapRef = useRef<google.maps.Map | null>(null);
  const googleMarkerRef = useRef<google.maps.Marker | null>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat,
    lng: initialLng,
  });

  const [userGpsCoords, setUserGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [detectedAddress, setDetectedAddress] = useState<string>(initialAddress);
  const [detectedDistrict, setDetectedDistrict] = useState<string>(initialDistrict);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<boolean>(false);
  const [hasConfirmed, setHasConfirmed] = useState<boolean>(false);

  // Search & Autocomplete
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const searchTimeoutRef = useRef<any>(null);

  // Geocodificación Inversa Rápida
  const fetchAddressFromCoords = useCallback(async (latitude: number, longitude: number) => {
    setIsGeocoding(true);

    // 1. Google Maps Geocoder si está disponible
    if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
      try {
        const geocoder = new (window as any).google.maps.Geocoder();
        const response = await new Promise<any>((resolve) => {
          geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results: any, status: string) => {
            if (status === 'OK' && results && results.length > 0) resolve(results);
            else resolve(null);
          });
        });

        if (response && response.length > 0) {
          const mostSpecific = response[0];
          const cleanAddr = (mostSpecific.formatted_address || '').replace(/,\s*(Perú|Peru|15\d{3})$/gi, '').trim();
          const districtComp = mostSpecific.address_components?.find((c: any) =>
            c.types.includes('sublocality_level_1') || c.types.includes('administrative_area_level_3') || c.types.includes('locality')
          );
          setDetectedAddress(cleanAddr);
          setDetectedDistrict(findMatchingDistrict(districtComp?.long_name || '', cleanAddr));
          setIsGeocoding(false);
          return;
        }
      } catch (err) {
        console.warn('Google geocoder:', err);
      }
    }

    // 2. OpenStreetMap Reverse Geocode
    try {
      const osmRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=19&addressdetails=1`,
        { headers: { 'Accept-Language': 'es' } }
      );
      if (osmRes.ok) {
        const data = await osmRes.json();
        const addr = data.address || {};
        const road = addr.road || addr.pedestrian || addr.street || data.display_name?.split(',')[0] || '';
        const houseNum = addr.house_number || '';
        const urb = addr.residential || addr.neighbourhood || addr.suburb || '';
        const district = findMatchingDistrict(addr.city_district || addr.suburb || addr.town || addr.city || 'Lima', data.display_name);

        let formatted = cleanStreetName(road, houseNum);
        if (urb && !formatted.toLowerCase().includes(urb.toLowerCase())) {
          formatted = `${formatted}, ${urb.replace(/^urbanizaci[oó]n\s+/i, 'Urb. ')}`;
        }

        setDetectedAddress(formatted || `Ubicación (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
        setDetectedDistrict(district);
        setIsGeocoding(false);
        return;
      }
    } catch (err) {
      console.warn('OSM reverse:', err);
    }

    setDetectedAddress(`Ubicación GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
    setDetectedDistrict(detectedDistrict || 'Lima');
    setIsGeocoding(false);
  }, [detectedDistrict]);

  const updateDeliveryPosition = useCallback((newLat: number, newLng: number, explicitAddr?: string, explicitDist?: string) => {
    setCoords({ lat: newLat, lng: newLng });
    setHasConfirmed(false);

    if (deliveryMarkerRef.current) deliveryMarkerRef.current.setLatLng([newLat, newLng]);
    if (googleMarkerRef.current) googleMarkerRef.current.setPosition({ lat: newLat, lng: newLng });

    if (explicitAddr) {
      setDetectedAddress(explicitAddr);
      if (explicitDist) setDetectedDistrict(explicitDist);
    } else {
      fetchAddressFromCoords(newLat, newLng);
    }
  }, [fetchAddressFromCoords]);

  // Obtención Ultrarrápida de Ubicación GPS (con caché de 5 minutos y timeout de 4s)
  const getFastGpsLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationError(true);
      return;
    }

    setIsLocating(true);
    setLocationError(false);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = pos.coords.latitude;
        const uLng = pos.coords.longitude;

        setUserGpsCoords({ lat: uLat, lng: uLng });
        setIsLocating(false);
        setLocationError(false);

        if (leafletMapRef.current) {
          if (!userLocationMarkerRef.current) {
            userLocationMarkerRef.current = L.marker([uLat, uLng], { icon: createUserDotIcon(), zIndexOffset: 200 }).addTo(leafletMapRef.current);
          } else {
            userLocationMarkerRef.current.setLatLng([uLat, uLng]);
          }
          leafletMapRef.current.setView([uLat, uLng], 18, { animate: true });
        }

        if (googleMapRef.current) {
          googleMapRef.current.panTo({ lat: uLat, lng: uLng });
          googleMapRef.current.setZoom(18);
        }

        updateDeliveryPosition(uLat, uLng);
      },
      (err) => {
        setIsLocating(false);
        setLocationError(true);
        console.warn('GPS fast error:', err);
      },
      {
        enableHighAccuracy: true,
        timeout: 4000,
        maximumAge: 300000, // 5 min cache = instant position!
      }
    );
  }, [updateDeliveryPosition]);

  // Autocompletado de Búsqueda
  const handleSearchInput = (text: string) => {
    setSearchQuery(text);
    if (!text.trim() || text.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      const query = text.trim();
      const results: SearchResult[] = [];

      // 1. Photon API
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=-12.0464&lon=-77.0428&limit=6&bbox=-77.35,-12.35,-76.7,-11.7`);
        if (res.ok) {
          const data = await res.json();
          if (data.features) {
            data.features.forEach((f: any, idx: number) => {
              const p = f.properties || {};
              const coords = f.geometry?.coordinates || [];
              if (coords.length >= 2) {
                const dist = findMatchingDistrict(p.district || p.city || 'Lima');
                results.push({
                  id: `p-${idx}`,
                  title: p.name || cleanStreetName(p.street || query, p.housenumber),
                  subtitle: [p.street !== p.name ? p.street : '', p.district, p.city || 'Lima'].filter(Boolean).join(', '),
                  district: dist,
                  lat: coords[1],
                  lng: coords[0]
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn('Search fallback:', err);
      }

      // 2. Coincidencias con Distritos
      DISTRITOS_LIMA.forEach(dist => {
        if (normalizeText(dist).includes(normalizeText(query)) && !results.some(r => r.title.toLowerCase().includes(dist.toLowerCase()))) {
          results.push({
            id: `d-${dist}`,
            title: `Distrito de ${dist}`,
            subtitle: 'Lima Metropolitana, Perú',
            district: dist,
            lat: coords.lat,
            lng: coords.lng
          });
        }
      });

      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setIsSearching(false);
    }, 220);
  };

  const handleSelectSuggestion = (sug: SearchResult) => {
    setSearchQuery(sug.title);
    setShowSuggestions(false);

    if (leafletMapRef.current) leafletMapRef.current.flyTo([sug.lat, sug.lng], 18, { duration: 0.8 });
    if (googleMapRef.current) {
      googleMapRef.current.panTo({ lat: sug.lat, lng: sug.lng });
      googleMapRef.current.setZoom(18);
    }
    updateDeliveryPosition(sug.lat, sug.lng, `${sug.title} (${sug.subtitle})`, sug.district);
  };

  // Inicialización Inmediata del Mapa
  useEffect(() => {
    if (!mapContainerRef.current) return;
    let isMounted = true;

    loadGoogleMapsScript().then((googleMaps) => {
      if (!isMounted || !mapContainerRef.current) return;

      if (googleMaps && !leafletMapRef.current && !googleMapRef.current) {
        try {
          const gMap = new googleMaps.Map(mapContainerRef.current, {
            center: { lat: coords.lat, lng: coords.lng },
            zoom: 18,
            mapTypeId: 'roadmap',
            disableDefaultUI: true,
            zoomControl: false,
            gestureHandling: 'greedy',
            styles: [
              { elementType: 'geometry', stylers: [{ color: '#171c26' }] },
              { elementType: 'labels.text.stroke', stylers: [{ color: '#171c26' }] },
              { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
              { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c3344' }] },
              { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
              { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b9' }] },
              { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
              { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
            ],
          });

          const gMarker = new googleMaps.Marker({
            position: { lat: coords.lat, lng: coords.lng },
            map: gMap,
            draggable: true,
            title: 'Punto de Entrega',
          });

          gMap.addListener('click', (e: google.maps.MapMouseEvent) => {
            if (e.latLng) updateDeliveryPosition(e.latLng.lat(), e.latLng.lng());
          });

          gMarker.addListener('dragend', () => {
            const pos = gMarker.getPosition();
            if (pos) updateDeliveryPosition(pos.lat(), pos.lng());
          });

          googleMapRef.current = gMap;
          googleMarkerRef.current = gMarker;
          getFastGpsLocation();
          return;
        } catch (err) {
          console.warn('Google Maps fallback to Leaflet:', err);
        }
      }

      if (!leafletMapRef.current && !googleMapRef.current && mapContainerRef.current) {
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
          icon: createPinIcon(),
          draggable: true,
          autoPan: true,
          zIndexOffset: 500,
        }).addTo(map);

        marker.on('dragend', () => {
          const p = marker.getLatLng();
          updateDeliveryPosition(p.lat, p.lng);
        });

        map.on('click', (e: L.LeafletMouseEvent) => {
          updateDeliveryPosition(e.latlng.lat, e.latlng.lng);
        });

        deliveryMarkerRef.current = marker;
        leafletMapRef.current = map;

        setTimeout(() => map.invalidateSize(), 200);
        getFastGpsLocation();
      }
    });

    return () => {
      isMounted = false;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      googleMapRef.current = null;
      googleMarkerRef.current = null;
    };
  }, []);

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
    if (onCloseModal) setTimeout(onCloseModal, 300);
  };

  return (
    <div className="space-y-3 animate-fadeIn w-full">
      {locationError && (
        <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Permiso GPS desactivado. Puedes buscar tu calle arriba o mover el mapa.</span>
          </div>
          <button
            type="button"
            onClick={getFastGpsLocation}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 font-bold text-xs shrink-0 cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Contenedor del Mapa */}
      <div className="relative w-full h-120 sm:h-135 min-h-110 rounded-3xl overflow-hidden border-2 border-white/20 bg-slate-950 shadow-2xl">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* ═══ Barra de Búsqueda y Autocompletado ═══ */}
        <div className="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 z-400 space-y-2">
          <div className="relative">
            <div className="flex items-center rounded-2xl bg-slate-950/95 backdrop-blur-2xl border-2 border-cyan-500/50 shadow-2xl p-1.5 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-400/25 transition-all">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 ml-1">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </div>
              
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearchInput(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                placeholder="🔍 Busca tu calle, avenida, negocio, tienda, mall..."
                className="w-full px-3 py-2 text-xs sm:text-sm font-bold text-white placeholder-slate-400 bg-transparent focus:outline-none"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSuggestions([]);
                    setShowSuggestions(false);
                  }}
                  className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={getFastGpsLocation}
                disabled={isLocating}
                className="px-3 py-2 rounded-xl bg-cyan-500/25 hover:bg-cyan-500/35 text-cyan-300 text-xs font-black flex items-center gap-1.5 border border-cyan-500/40 transition-all cursor-pointer shadow-md shrink-0 active:scale-95"
                title="Centrar en mi ubicación GPS exacta"
              >
                <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                <span className="hidden xs:inline sm:inline">{isLocating ? 'GPS...' : 'Mi GPS'}</span>
              </button>
            </div>

            {/* Menú de Sugerencias */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 z-50 max-h-60 overflow-y-auto rounded-2xl bg-slate-900/98 backdrop-blur-3xl border-2 border-cyan-500/40 p-1.5 shadow-2xl space-y-1 animate-scaleUp">
                {suggestions.map((sug) => (
                  <button
                    key={sug.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(sug)}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-cyan-500/20 border border-transparent hover:border-cyan-500/30 transition-all flex items-start gap-2.5 cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-white truncate group-hover:text-cyan-300">
                        {sug.title}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {sug.subtitle}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tarjeta de Dirección Detectada */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-white/20 shadow-xl flex items-center justify-between gap-2.5 text-xs text-white">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase text-cyan-300 tracking-wider">
                    {detectedDistrict ? `DISTRITO: ${detectedDistrict.toUpperCase()}` : 'UBICACIÓN SELECCIONADA'}
                  </span>
                  {isGeocoding && <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />}
                </div>
                <p className="font-black text-white text-xs leading-snug truncate mt-0.5">
                  {detectedAddress || 'Mueve el pin a la puerta de entrega...'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Controles de Zoom & GPS */}
        <div className="absolute right-3.5 bottom-24 z-400 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              if (leafletMapRef.current) leafletMapRef.current.zoomIn();
              if (googleMapRef.current) googleMapRef.current.setZoom((googleMapRef.current.getZoom() || 18) + 1);
            }}
            className="w-10 h-10 rounded-2xl bg-slate-900/95 hover:bg-slate-800 text-white font-bold flex items-center justify-center border border-white/20 shadow-2xl transition-all active:scale-95 cursor-pointer text-lg"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              if (leafletMapRef.current) leafletMapRef.current.zoomOut();
              if (googleMapRef.current) googleMapRef.current.setZoom((googleMapRef.current.getZoom() || 18) - 1);
            }}
            className="w-10 h-10 rounded-2xl bg-slate-900/95 hover:bg-slate-800 text-white font-bold flex items-center justify-center border border-white/20 shadow-2xl transition-all active:scale-95 cursor-pointer text-lg"
          >
            -
          </button>
          <button
            type="button"
            onClick={getFastGpsLocation}
            className="w-10 h-10 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center shadow-2xl shadow-cyan-600/40 transition-all active:scale-95 cursor-pointer"
            title="Centrar en mi GPS"
          >
            <Crosshair className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Botón de Confirmar Ubicación */}
        <div className="absolute bottom-4 left-4 right-4 z-400">
          <button
            type="button"
            onClick={handleConfirm}
            className={`w-full py-4.5 px-6 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-3 shadow-2xl transition-all cursor-pointer active:scale-[0.98] ${
              hasConfirmed
                ? 'bg-emerald-500 text-white shadow-emerald-500/50 border-2 border-emerald-400'
                : 'bg-linear-to-r from-cyan-500 via-blue-600 to-cyan-500 text-white shadow-cyan-500/50 hover:brightness-110 border-2 border-cyan-400'
            }`}
          >
            {hasConfirmed ? (
              <>
                <CheckCircle className="w-6 h-6" />
                <span>¡Ubicación Confirmada!</span>
              </>
            ) : (
              <span>Confirmar ubicación y continuar ➔</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
