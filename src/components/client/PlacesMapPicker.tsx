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
  Crosshair
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

// 1. Icono para el PIN de entrega seleccionado (Punta inferior milimétrica)
const createDeliveryPinIcon = () => {
  const html = `
    <div style="position: relative; width: 44px; height: 52px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
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
    className: 'delivery-pin-marker',
    html,
    iconSize: [44, 52],
    iconAnchor: [22, 52],
    popupAnchor: [0, -52],
  });
};

// 2. Icono para la ubicación física GPS del usuario (Puntito azul pulsante)
const createUserLocationDotIcon = () => {
  const html = `
    <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
      <div style="
        position: absolute; 
        width: 34px; 
        height: 34px; 
        border-radius: 50%; 
        background: rgba(14, 165, 233, 0.45); 
        animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></div>
      <div style="
        position: relative; 
        width: 16px; 
        height: 16px; 
        border-radius: 50%; 
        background: #0284c7; 
        border: 3px solid #ffffff; 
        box-shadow: 0 0 16px rgba(14, 165, 233, 1), 0 2px 6px rgba(0,0,0,0.4);
      "></div>
    </div>
  `;

  return L.divIcon({
    className: 'user-gps-blue-dot',
    html,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
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

function cleanStreetName(rawStreet: string, houseNumber?: string): string {
  if (!rawStreet) return '';

  let street = rawStreet.trim();

  // Limpiar prefijos de vías auxiliares o ciclovías
  if (street.toLowerCase().startsWith('ciclovia ') || street.toLowerCase().startsWith('ciclovía ')) {
    street = street.replace(/ciclov[ií]a\s+/i, 'Av. ');
  } else if (street.toLowerCase().startsWith('via auxiliar ') || street.toLowerCase().startsWith('vía auxiliar ')) {
    street = street.replace(/v[ií]a auxiliar\s+/i, 'Av. ');
  }

  // Normalizar prefijos de Lima
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

// Analizar la respuesta completa de OpenStreetMap Nominatim metro a metro
function parseOsmDetailedAddress(data: any, lat: number, lng: number): { fullAddress: string; district: string } {
  const addr = data.address || {};
  const dispName = data.display_name || '';
  const parts = dispName.split(',').map((p: string) => p.trim());

  let road = addr.road || addr.pedestrian || addr.footway || addr.path || addr.street || '';
  let houseNumber = addr.house_number || '';
  let urb = addr.residential || addr.neighbourhood || addr.quarter || addr.suburb || '';
  let landmark = addr.amenity || addr.shop || addr.building || data.name || '';
  let rawDistrict = addr.city_district || addr.suburb || addr.town || addr.city || 'Lima';

  // Extraer número de puerta de display_name si existe (ej. "1166, Avenida México")
  if (!houseNumber && parts.length > 0) {
    const numPart = parts.find((p: string) => /^\d+[a-zA-Z]?$/.test(p));
    if (numPart) houseNumber = numPart;
  }

  // Extraer urbanización de display_name si existe
  if (!urb && parts.length > 0) {
    const urbPart = parts.find((p: string) => /^urbanizaci[oó]n\s+/i.test(p) || /^urb\.?\s+/i.test(p) || /^unidad vecinal\s+/i.test(p));
    if (urbPart) urb = urbPart;
  }

  let formattedRoad = cleanStreetName(road || parts[0] || 'Ubicación', houseNumber);
  let full = formattedRoad;

  if (urb && !full.toLowerCase().includes(urb.toLowerCase())) {
    const cleanUrb = urb.replace(/^urbanizaci[oó]n\s+/i, 'Urb. ').replace(/^unidad vecinal\s+/i, 'U.V. ');
    if (!cleanUrb.toLowerCase().startsWith('pueblo joven') && !cleanUrb.toLowerCase().startsWith('asociacion')) {
      full = `${full}, ${cleanUrb}`;
    }
  }

  if (landmark && landmark !== road && !full.toLowerCase().includes(landmark.toLowerCase())) {
    if (!landmark.toLowerCase().includes('colegio') && !landmark.toLowerCase().includes('educativa')) {
      full = `${full} (${landmark})`;
    }
  }

  return {
    fullAddress: full || `Ubicación GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    district: findMatchingDistrict(rawDistrict, dispName)
  };
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
  
  // Referencias para Leaflet Engine
  const leafletMapRef = useRef<L.Map | null>(null);
  const deliveryMarkerRef = useRef<L.Marker | null>(null);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);

  // Referencias para Google Maps Engine
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
  const [locationPermissionDenied, setLocationPermissionDenied] = useState<boolean>(false);
  const [hasConfirmed, setHasConfirmed] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Geocodificación Inversa Metro a Metro de Alta Fidelidad
  const fetchAddressFromCoords = useCallback(async (latitude: number, longitude: number) => {
    setIsGeocoding(true);
    setStatusMessage('Localizando número y calle exacta...');

    // 1. Google Maps Geocoder (si está activo con region=PE y language=es)
    if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
      try {
        const geocoder = new (window as any).google.maps.Geocoder();
        const response = await new Promise<any>((resolve) => {
          geocoder.geocode(
            { location: { lat: latitude, lng: longitude } },
            (results: any, status: string) => {
              if (status === 'OK' && results && results.length > 0) {
                resolve(results);
              } else {
                resolve(null);
              }
            }
          );
        });

        if (response && response.length > 0) {
          const mostSpecific = response[0];
          const fullAddress = mostSpecific.formatted_address || '';

          let district = '';
          const districtComp = mostSpecific.address_components?.find((c: any) =>
            c.types.includes('sublocality_level_1') ||
            c.types.includes('administrative_area_level_3') ||
            c.types.includes('locality')
          );
          if (districtComp) district = districtComp.long_name;

          let cleanAddr = fullAddress.replace(/,\s*(Perú|Peru|15\d{3})$/gi, '').trim();

          setDetectedAddress(cleanAddr);
          setDetectedDistrict(findMatchingDistrict(district, cleanAddr));
          setIsGeocoding(false);
          setStatusMessage('');
          return;
        }
      } catch (err) {
        console.warn('Google Geocoder fallback:', err);
      }
    }

    // 2. OpenStreetMap Nominatim JSONv2 Regional con Headers Oficiales
    let addressResolved = false;
    try {
      const osmRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=19&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'es',
            'User-Agent': 'EncomiPerúApp/1.0 (contacto@comikids.pe)'
          }
        }
      );

      if (osmRes.ok) {
        const osmData = await osmRes.json();
        const { fullAddress, district } = parseOsmDetailedAddress(osmData, latitude, longitude);

        if (fullAddress && !fullAddress.startsWith('Ubicación GPS')) {
          setDetectedAddress(fullAddress);
          setDetectedDistrict(district);
          addressResolved = true;
        }
      }
    } catch (err) {
      console.warn('OSM reverse fallback:', err);
    }

    // 3. Fallback BigDataCloud
    if (!addressResolved) {
      try {
        const bdcRes = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=es`
        );

        if (bdcRes.ok) {
          const bdcData = await bdcRes.json();
          const locality = bdcData.locality || bdcData.city || '';
          const district = findMatchingDistrict(locality, bdcData.principalSubdivision || '');

          const adminParts = bdcData.localityInfo?.administrative || [];
          const specificName = adminParts.find((a: any) => a.order >= 7)?.name || '';

          const street = specificName && !specificName.toLowerCase().includes('distrito')
            ? cleanStreetName(specificName)
            : `Ubicación (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;

          setDetectedAddress(street);
          setDetectedDistrict(district);
          addressResolved = true;
        }
      } catch (err) {
        console.warn('BDC fallback:', err);
      }
    }

    if (!addressResolved) {
      setDetectedAddress(`Ubicación GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
      setDetectedDistrict(detectedDistrict || 'Lima');
    }

    setStatusMessage('');
    setIsGeocoding(false);
  }, [detectedDistrict]);

  // Actualizar la posición de entrega de forma inmediata
  const updateDeliveryPosition = useCallback((newLat: number, newLng: number, explicitAddress?: string, explicitDistrict?: string) => {
    setCoords({ lat: newLat, lng: newLng });
    setHasConfirmed(false);

    if (deliveryMarkerRef.current) {
      deliveryMarkerRef.current.setLatLng([newLat, newLng]);
    }

    if (googleMarkerRef.current) {
      googleMarkerRef.current.setPosition({ lat: newLat, lng: newLng });
    }

    if (explicitAddress) {
      setDetectedAddress(explicitAddress);
      if (explicitDistrict) setDetectedDistrict(explicitDistrict);
    } else {
      fetchAddressFromCoords(newLat, newLng);
    }
  }, [fetchAddressFromCoords]);

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

        setUserGpsCoords({ lat: userLat, lng: userLng });
        setIsLocating(false);
        setLocationPermissionDenied(false);

        if (leafletMapRef.current) {
          if (!userLocationMarkerRef.current) {
            userLocationMarkerRef.current = L.marker([userLat, userLng], {
              icon: createUserLocationDotIcon(),
              zIndexOffset: 100,
            }).addTo(leafletMapRef.current);
          } else {
            userLocationMarkerRef.current.setLatLng([userLat, userLng]);
          }

          leafletMapRef.current.flyTo([userLat, userLng], 19, {
            duration: 1.2,
          });
        }

        if (googleMapRef.current) {
          googleMapRef.current.panTo({ lat: userLat, lng: userLng });
          googleMapRef.current.setZoom(19);
        }

        updateDeliveryPosition(userLat, userLng);
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
  }, [updateDeliveryPosition]);

  // Inicializar Leaflet / Google Maps
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let isMounted = true;

    loadGoogleMapsScript().then((googleMaps) => {
      if (!isMounted || !mapContainerRef.current) return;

      if (googleMaps && !leafletMapRef.current && !googleMapRef.current) {
        try {
          const gMap = new googleMaps.Map(mapContainerRef.current, {
            center: { lat: coords.lat, lng: coords.lng },
            zoom: 19,
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
            if (e.latLng) {
              const lat = e.latLng.lat();
              const lng = e.latLng.lng();
              updateDeliveryPosition(lat, lng);
            }
          });

          gMarker.addListener('dragend', () => {
            const pos = gMarker.getPosition();
            if (pos) {
              updateDeliveryPosition(pos.lat(), pos.lng());
            }
          });

          googleMapRef.current = gMap;
          googleMarkerRef.current = gMarker;

          requestCurrentLocation();
          return;
        } catch (err) {
          console.warn('Fallo Google Maps, usando Leaflet:', err);
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

        const deliveryMarker = L.marker([coords.lat, coords.lng], {
          icon: createDeliveryPinIcon(),
          draggable: true,
          autoPan: true,
          zIndexOffset: 500,
        }).addTo(map);

        deliveryMarker.on('dragend', () => {
          const newPos = deliveryMarker.getLatLng();
          updateDeliveryPosition(newPos.lat, newPos.lng);
        });

        map.on('click', (e: L.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          updateDeliveryPosition(lat, lng);
        });

        deliveryMarkerRef.current = deliveryMarker;
        leafletMapRef.current = map;

        setTimeout(() => {
          map.invalidateSize();
        }, 250);

        requestCurrentLocation();
      }
    });

    return () => {
      isMounted = false;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        deliveryMarkerRef.current = null;
        userLocationMarkerRef.current = null;
      }
      googleMapRef.current = null;
      googleMarkerRef.current = null;
    };
  }, []);

  const handleCenterOnUserGps = () => {
    if (userGpsCoords) {
      if (leafletMapRef.current) {
        leafletMapRef.current.flyTo([userGpsCoords.lat, userGpsCoords.lng], 19, { duration: 1 });
      }
      if (googleMapRef.current) {
        googleMapRef.current.panTo({ lat: userGpsCoords.lat, lng: userGpsCoords.lng });
        googleMapRef.current.setZoom(19);
      }
      updateDeliveryPosition(userGpsCoords.lat, userGpsCoords.lng);
    } else {
      requestCurrentLocation();
    }
  };

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

    if (onCloseModal) {
      setTimeout(() => {
        onCloseModal();
      }, 300);
    }
  };

  return (
    <div className="space-y-3 animate-fadeIn w-full">
      
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

      {/* MAPA MOTORIZADO CON ALTURA OPTIMIZADA */}
      <div className="relative w-full h-117.5 sm:h-127.5 min-h-105 rounded-3xl overflow-hidden border-2 border-white/20 bg-slate-950 shadow-2xl">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Leyenda sutil: Puntito Azul = Tu ubicación física | Pin = Punto de entrega */}
        <div className="absolute bottom-24 left-4 z-400 pointer-events-none hidden sm:flex items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-950/90 backdrop-blur-md border border-white/15 text-[11px] text-slate-300 shadow-xl">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 border border-white shadow-[0_0_8px_rgba(6,182,212,1)] inline-block"></span>
            <span className="font-semibold text-white">Tu ubicación GPS</span>
          </div>
          <span className="text-slate-600">•</span>
          <div className="flex items-center gap-1.5">
            <span>📍</span>
            <span className="font-semibold text-white">Punto de Entrega</span>
          </div>
        </div>

        {/* Banner Superior Flotante: Dirección en Tiempo Real Completa */}
        <div className="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 z-400">
          <div className="p-3 sm:p-4 rounded-2xl bg-slate-950/95 backdrop-blur-2xl border-2 border-white/25 shadow-2xl flex items-center justify-between gap-2.5 text-xs text-white">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-cyan-500/25 text-cyan-400 flex items-center justify-center shrink-0 shadow-md">
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase text-cyan-300 tracking-wider">
                    {detectedDistrict ? `DISTRITO: ${detectedDistrict.toUpperCase()}` : 'UBICACIÓN SELECCIONADA'}
                  </span>
                  {isGeocoding && <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />}
                </div>
                <p className="font-black text-white text-xs sm:text-sm leading-snug line-clamp-2 wrap-break-word mt-0.5">
                  {detectedAddress || statusMessage || 'Mueve o toca el mapa en la puerta de entrega...'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCenterOnUserGps}
              disabled={isLocating}
              className="px-3 py-2 rounded-xl bg-cyan-500/25 hover:bg-cyan-500/35 text-cyan-300 text-xs font-black flex items-center gap-1.5 border border-cyan-500/40 transition-all cursor-pointer shadow-md shrink-0 active:scale-95"
              title="Centrar en mi ubicación GPS"
            >
              <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'GPS...' : 'Mi GPS'}</span>
            </button>
          </div>
        </div>

        {/* Controles Flotantes de Zoom & GPS reubicados debajo del banner */}
        <div className="absolute right-3.5 top-28 sm:top-28 z-400 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              if (leafletMapRef.current) leafletMapRef.current.zoomIn();
              if (googleMapRef.current) {
                const z = googleMapRef.current.getZoom() || 19;
                googleMapRef.current.setZoom(z + 1);
              }
            }}
            className="w-10 h-10 rounded-2xl bg-slate-900/95 hover:bg-slate-800 text-white font-bold flex items-center justify-center border border-white/20 shadow-2xl transition-all active:scale-95 cursor-pointer text-lg"
            title="Acercar mapa"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              if (leafletMapRef.current) leafletMapRef.current.zoomOut();
              if (googleMapRef.current) {
                const z = googleMapRef.current.getZoom() || 19;
                googleMapRef.current.setZoom(z - 1);
              }
            }}
            className="w-10 h-10 rounded-2xl bg-slate-900/95 hover:bg-slate-800 text-white font-bold flex items-center justify-center border border-white/20 shadow-2xl transition-all active:scale-95 cursor-pointer text-lg"
            title="Alejar mapa"
          >
            -
          </button>
          <button
            type="button"
            onClick={handleCenterOnUserGps}
            className="w-10 h-10 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center shadow-2xl shadow-cyan-600/40 transition-all active:scale-95 cursor-pointer"
            title="Centrar en mi GPS"
          >
            <Crosshair className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Panel Inferior Flotante: Botón Confirmar Ubicación */}
        <div className="absolute bottom-4 left-4 right-4 z-400">
          <button
            type="button"
            onClick={handleConfirm}
            className={`w-full py-4.5 sm:py-5 px-6 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-3 shadow-2xl transition-all cursor-pointer active:scale-[0.98] ${
              hasConfirmed
                ? 'bg-emerald-500 text-white shadow-emerald-500/50 border-2 border-emerald-400'
                : 'bg-linear-to-r from-cyan-500 via-blue-600 to-cyan-500 text-white shadow-cyan-500/50 hover:brightness-110 border-2 border-cyan-400'
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
