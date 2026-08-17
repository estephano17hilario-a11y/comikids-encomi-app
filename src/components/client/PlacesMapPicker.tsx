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
  Crosshair,
  Search,
  X,
  Compass,
  Building,
  RotateCcw,
  Check
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

interface PlaceSuggestion {
  id: string;
  title: string;
  subtitle: string;
  district: string;
  lat: number;
  lng: number;
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

  // Limpiar prefijos
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

function parseOsmDetailedAddress(data: any, lat: number, lng: number): { fullAddress: string; district: string } {
  const addr = data.address || {};
  const dispName = data.display_name || '';
  const parts = dispName.split(',').map((p: string) => p.trim());

  let road = addr.road || addr.pedestrian || addr.footway || addr.path || addr.street || '';
  let houseNumber = addr.house_number || '';
  let urb = addr.residential || addr.neighbourhood || addr.quarter || addr.suburb || '';
  let landmark = addr.amenity || addr.shop || addr.building || data.name || '';
  let rawDistrict = addr.city_district || addr.suburb || addr.town || addr.city || 'Lima';

  if (!houseNumber && parts.length > 0) {
    const numPart = parts.find((p: string) => /^\d+[a-zA-Z]?$/.test(p));
    if (numPart) houseNumber = numPart;
  }

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

  // Estados de Pantalla: 'prompt' (pide permiso/pregunta) -> 'loading_gps' (calibrando) -> 'map' (mapa activo)
  const [screenState, setScreenState] = useState<'prompt' | 'loading_gps' | 'map'>('prompt');
  const [gpsCalibratingStep, setGpsCalibratingStep] = useState<string>('Buscando satélites...');

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

  // Estados de Búsqueda y Autocompletador
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const searchTimeoutRef = useRef<any>(null);

  // Geocodificación Inversa Metro a Metro de Alta Fidelidad
  const fetchAddressFromCoords = useCallback(async (latitude: number, longitude: number) => {
    setIsGeocoding(true);
    setStatusMessage('Localizando número y calle exacta...');

    // 1. Google Maps Geocoder (si está activo)
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

    // 2. OpenStreetMap Nominatim JSONv2 Regional
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

  // Buscar lugares y autocompletar en tiempo real con Photon/Nominatim
  const handleSearchInputChange = (text: string) => {
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
      const results: PlaceSuggestion[] = [];

      // 1. Photon Komoot API (Ultra rápido con tipo adelante y puntos de interés)
      try {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=-12.0464&lon=-77.0428&limit=6&bbox=-77.35,-12.35,-76.7,-11.7`;
        const res = await fetch(photonUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.features && Array.isArray(data.features)) {
            data.features.forEach((feat: any, idx: number) => {
              const props = feat.properties || {};
              const geom = feat.geometry?.coordinates || [];
              if (geom.length >= 2) {
                const pLng = geom[0];
                const pLat = geom[1];
                const name = props.name || props.street || '';
                const street = props.street || '';
                const houseNum = props.housenumber || '';
                const district = findMatchingDistrict(props.district || props.city || props.county || 'Lima');
                
                let title = name || cleanStreetName(street, houseNum);
                let subtitle = [street !== name ? street : '', props.district, props.city || 'Lima'].filter(Boolean).join(', ');

                results.push({
                  id: `photon-${idx}-${pLat}-${pLng}`,
                  title: title || 'Lugar encontrado',
                  subtitle: subtitle || `${district}, Lima`,
                  district,
                  lat: pLat,
                  lng: pLng
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn('Photon search fallback:', err);
      }

      // 2. Nominatim Search si Photon no dio suficientes
      if (results.length < 3) {
        try {
          const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' Lima Peru')}&format=jsonv2&addressdetails=1&limit=5&countrycodes=pe`;
          const res = await fetch(nomUrl, {
            headers: {
              'Accept-Language': 'es',
              'User-Agent': 'EncomiPerúApp/1.0 (contacto@comikids.pe)'
            }
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              data.forEach((item: any) => {
                const pLat = parseFloat(item.lat);
                const pLng = parseFloat(item.lon);
                if (!results.some(r => Math.abs(r.lat - pLat) < 0.0005 && Math.abs(r.lng - pLng) < 0.0005)) {
                  const addr = item.address || {};
                  const district = findMatchingDistrict(addr.city_district || addr.suburb || addr.town || 'Lima', item.display_name);
                  results.push({
                    id: `nom-${item.place_id || pLat}`,
                    title: cleanStreetName(addr.road || item.name || item.display_name?.split(',')[0] || query),
                    subtitle: item.display_name?.split(',').slice(1, 3).join(',').trim() || `${district}, Lima`,
                    district,
                    lat: pLat,
                    lng: pLng
                  });
                }
              });
            }
          }
        } catch (err) {
          console.warn('Nominatim search fallback:', err);
        }
      }

      // 3. Coincidencias con distritos de Lima
      DISTRITOS_LIMA.forEach(dist => {
        if (normalizeText(dist).includes(normalizeText(query)) && !results.some(r => r.title.toLowerCase().includes(dist.toLowerCase()))) {
          results.push({
            id: `dist-${dist}`,
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
    }, 280);
  };

  // Seleccionar una sugerencia del autocompletador
  const handleSelectSuggestion = (sug: PlaceSuggestion) => {
    setSearchQuery(sug.title);
    setShowSuggestions(false);

    if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([sug.lat, sug.lng], 19, { duration: 1 });
    }
    if (googleMapRef.current) {
      googleMapRef.current.panTo({ lat: sug.lat, lng: sug.lng });
      googleMapRef.current.setZoom(19);
    }

    updateDeliveryPosition(sug.lat, sug.lng, `${sug.title} (${sug.subtitle})`, sug.district);
  };

  // Pedir GPS en tiempo real con calibración y transición a pantalla de mapa
  const requestCurrentLocationWithCalibration = useCallback(() => {
    setScreenState('loading_gps');
    setGpsCalibratingStep('🛰️ Conectando con satélites GPS...');

    if (!('geolocation' in navigator)) {
      setLocationPermissionDenied(true);
      setScreenState('map');
      return;
    }

    const t1 = setTimeout(() => setGpsCalibratingStep('📡 Calibrando señal de alta precisión...'), 900);
    const t2 = setTimeout(() => setGpsCalibratingStep('📍 Fijando coordenadas de tu ubicación exacta...'), 1800);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(t1);
        clearTimeout(t2);

        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const accuracy = position.coords.accuracy ? Math.round(position.coords.accuracy) : 10;

        setUserGpsCoords({ lat: userLat, lng: userLng });
        setCoords({ lat: userLat, lng: userLng });
        setLocationPermissionDenied(false);
        setStatusMessage(`📍 Precisión GPS: ${accuracy}m`);

        // Pasar a pantalla de mapa
        setScreenState('map');

        setTimeout(() => {
          if (leafletMapRef.current) {
            if (!userLocationMarkerRef.current) {
              userLocationMarkerRef.current = L.marker([userLat, userLng], {
                icon: createUserLocationDotIcon(),
                zIndexOffset: 200,
              }).addTo(leafletMapRef.current);
            } else {
              userLocationMarkerRef.current.setLatLng([userLat, userLng]);
            }

            leafletMapRef.current.setView([userLat, userLng], 19, { animate: true });
          }

          if (googleMapRef.current) {
            googleMapRef.current.panTo({ lat: userLat, lng: userLng });
            googleMapRef.current.setZoom(19);
          }

          updateDeliveryPosition(userLat, userLng);
        }, 300);
      },
      (error) => {
        clearTimeout(t1);
        clearTimeout(t2);
        setScreenState('map');

        if (error.code === error.PERMISSION_DENIED) {
          setLocationPermissionDenied(true);
          setStatusMessage('Por favor concede permiso de ubicación en tu navegador.');
        } else {
          setStatusMessage('No se pudo obtener señal GPS en este momento.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 25000,
        maximumAge: 0,
      }
    );
  }, [updateDeliveryPosition]);

  // Inicializar Leaflet / Google Maps cuando la pantalla sea 'map'
  useEffect(() => {
    if (screenState !== 'map' || !mapContainerRef.current) return;

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

          fetchAddressFromCoords(coords.lat, coords.lng);
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

        if (userGpsCoords) {
          userLocationMarkerRef.current = L.marker([userGpsCoords.lat, userGpsCoords.lng], {
            icon: createUserLocationDotIcon(),
            zIndexOffset: 200,
          }).addTo(map);
        }

        deliveryMarkerRef.current = deliveryMarker;
        leafletMapRef.current = map;

        setTimeout(() => {
          map.invalidateSize();
        }, 250);

        fetchAddressFromCoords(coords.lat, coords.lng);
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
  }, [screenState]);

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
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const uLat = pos.coords.latitude;
          const uLng = pos.coords.longitude;
          setUserGpsCoords({ lat: uLat, lng: uLng });
          setIsLocating(false);

          if (leafletMapRef.current) {
            if (!userLocationMarkerRef.current) {
              userLocationMarkerRef.current = L.marker([uLat, uLng], {
                icon: createUserLocationDotIcon(),
                zIndexOffset: 200,
              }).addTo(leafletMapRef.current);
            } else {
              userLocationMarkerRef.current.setLatLng([uLat, uLng]);
            }
            leafletMapRef.current.flyTo([uLat, uLng], 19, { duration: 1 });
          }
          if (googleMapRef.current) {
            googleMapRef.current.panTo({ lat: uLat, lng: uLng });
            googleMapRef.current.setZoom(19);
          }
          updateDeliveryPosition(uLat, uLng);
        },
        () => {
          setIsLocating(false);
          setLocationPermissionDenied(true);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
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

  // =========================================================================
  // PANTALLA 1: SOLICITUD DE PERMISO GPS (PROMPT INICIAL)
  // =========================================================================
  if (screenState === 'prompt') {
    return (
      <div className="p-5 sm:p-7 rounded-3xl bg-slate-900 border-2 border-cyan-500/40 shadow-2xl space-y-6 text-center animate-fadeIn max-w-lg mx-auto">
        {/* Visual Radar Animation */}
        <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping"></div>
          <div className="absolute inset-2 rounded-full bg-cyan-500/30 animate-pulse"></div>
          <div className="relative w-16 h-16 rounded-2xl bg-linear-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white text-3xl shadow-xl shadow-cyan-500/40 border border-cyan-300">
            📍
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-black uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
            <span>GPS de Alta Precisión</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Fijar Ubicación de Entrega Exacta
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed px-2">
            Para que el motorizado llegue directamente a la puerta de tu casa o trabajo sin pérdidas, necesitamos sincronizar tu posición en el mapa.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={requestCurrentLocationWithCalibration}
            className="w-full py-4.5 px-6 rounded-2xl bg-linear-to-r from-cyan-500 via-blue-600 to-cyan-500 hover:brightness-110 text-white font-black text-base sm:text-lg flex items-center justify-center gap-3 shadow-xl shadow-cyan-500/40 transition-all cursor-pointer active:scale-95 border-2 border-cyan-400"
          >
            <Navigation className="w-5 h-5 fill-current" />
            <span>🛰️ Activar GPS y Fijar Ubicación</span>
          </button>

          <button
            type="button"
            onClick={() => setScreenState('map')}
            className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-bold text-xs transition-colors cursor-pointer"
          >
            🗺️ Abrir Mapa y Buscar por Dirección Manualmente
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // PANTALLA 2: CARGANDO Y CALIBRANDO GPS CON SATÉLITES
  // =========================================================================
  if (screenState === 'loading_gps') {
    return (
      <div className="p-8 sm:p-10 rounded-3xl bg-slate-900 border-2 border-cyan-500/40 shadow-2xl space-y-6 text-center animate-fadeIn max-w-lg mx-auto">
        <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-cyan-500/30 border-t-cyan-400 animate-spin"></div>
          <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-300 text-3xl animate-bounce">
            🛰️
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-lg font-black text-white">
            Obteniendo Posición Satelital...
          </h4>
          <p className="text-xs sm:text-sm text-cyan-300 font-mono font-bold animate-pulse">
            {gpsCalibratingStep}
          </p>
          <p className="text-[11px] text-slate-400">
            Estamos triangulando tu ubicación con precisión de pocos metros para cargar el mapa en tu dirección actual.
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // PANTALLA 3: MAPA COMPLETO CON AUTOCOMPLETADOR Y BÚSQUEDA
  // =========================================================================
  return (
    <div className="space-y-3 animate-fadeIn w-full">
      
      {/* Aviso de permiso GPS si fue denegado */}
      {locationPermissionDenied && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2.5 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Permiso de GPS no concedido. Puedes buscar tu dirección en la barra o mover el mapa.</span>
          </div>
          <button
            type="button"
            onClick={handleCenterOnUserGps}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs transition-colors shrink-0 cursor-pointer"
          >
            Reintentar GPS
          </button>
        </div>
      )}

      {/* MAPA MOTORIZADO CON ALTURA OPTIMIZADA */}
      <div className="relative w-full h-120 sm:h-135 min-h-110 rounded-3xl overflow-hidden border-2 border-white/20 bg-slate-950 shadow-2xl">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* ═══ BARRA SUPERIOR FLOTANTE DE BÚSQUEDA Y AUTOCOMPLETADOR ═══ */}
        <div className="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 z-400 space-y-2">
          
          {/* Caja de Búsqueda con Autocompletado */}
          <div className="relative">
            <div className="flex items-center rounded-2xl bg-slate-950/95 backdrop-blur-2xl border-2 border-cyan-500/50 shadow-2xl p-1.5 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-400/25 transition-all">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 ml-1">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </div>
              
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearchInputChange(e.target.value)}
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
                onClick={handleCenterOnUserGps}
                disabled={isLocating}
                className="px-3 py-2 rounded-xl bg-cyan-500/25 hover:bg-cyan-500/35 text-cyan-300 text-xs font-black flex items-center gap-1.5 border border-cyan-500/40 transition-all cursor-pointer shadow-md shrink-0 active:scale-95"
                title="Centrar en mi ubicación GPS exacta"
              >
                <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                <span className="hidden xs:inline sm:inline">{isLocating ? 'GPS...' : 'Mi GPS'}</span>
              </button>
            </div>

            {/* Menú Desplegable de Sugerencias de Autocompletado */}
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

          {/* Banner con Dirección Detectada en Tiempo Real */}
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
                  {detectedAddress || statusMessage || 'Mueve o toca el mapa en la puerta de entrega...'}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Controles Flotantes de Zoom & GPS */}
        <div className="absolute right-3.5 bottom-24 z-400 flex flex-col gap-2">
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
