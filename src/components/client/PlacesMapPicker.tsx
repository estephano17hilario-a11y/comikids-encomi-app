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

interface SearchPlaceItem {
  display_name: string;
  lat: string;
  lon: string;
  mainText: string;
  subText: string;
  district: string;
}

// Resaltar coincidencias de búsqueda estilo Shalom
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

// 1. Icono para el PIN de entrega seleccionado (Punta inferior exacta)
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

function cleanStreetName(rawStreet: string, houseNumber?: string, searchQueryHint?: string): string {
  if (!rawStreet) return '';

  let street = rawStreet.trim();

  if (street.toLowerCase().startsWith('ciclovia ') || street.toLowerCase().startsWith('ciclovía ')) {
    street = street.replace(/ciclov[ií]a\s+/i, 'Av. ');
  } else if (street.toLowerCase().startsWith('via auxiliar ') || street.toLowerCase().startsWith('vía auxiliar ')) {
    street = street.replace(/v[ií]a auxiliar\s+/i, 'Av. ');
  }

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

  let num = houseNumber || '';
  if (!num && searchQueryHint) {
    const numMatch = searchQueryHint.match(/\b\d+[a-zA-Z]?\b/);
    if (numMatch) {
      num = numMatch[0];
    }
  }

  if (num && !street.includes(num)) {
    return `${street} ${num}`;
  }

  return street;
}

// Formatear dirección completa ultra-específica
function formatFullDetailedAddress(props: any, lat: number, lng: number, searchQueryHint?: string): { fullAddress: string; district: string } {
  let street = props.street || '';
  let name = props.name || '';
  let houseNumber = props.housenumber || '';
  let locality = props.locality || props.quarter || props.suburb || props.neighbourhood || '';
  let rawDist = props.district || props.city || props.town || props.municipality || 'Lima';

  let mainWay = street;
  let landmark = '';

  if (!mainWay && name) {
    mainWay = name;
  } else if (mainWay && name && name !== mainWay) {
    if (!name.toLowerCase().includes('colegio') && !name.toLowerCase().includes('educativa')) {
      landmark = name;
    }
  }

  let formattedStreet = cleanStreetName(mainWay || 'Ubicación', houseNumber, searchQueryHint);

  let fullAddress = formattedStreet;

  if (locality && !fullAddress.toLowerCase().includes(locality.toLowerCase())) {
    const cleanLoc = locality.replace(/^urb\.?\s*/i, '').trim();
    if (cleanLoc && !cleanLoc.toLowerCase().startsWith('pueblo joven') && !cleanLoc.toLowerCase().startsWith('asociacion')) {
      fullAddress = `${fullAddress}, Urb. ${cleanLoc}`;
    }
  }

  if (landmark && !fullAddress.toLowerCase().includes(landmark.toLowerCase())) {
    fullAddress = `${fullAddress} (${landmark})`;
  }

  const district = findMatchingDistrict(rawDist, locality || props.county || '');

  return {
    fullAddress: fullAddress || `Ubicación GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    district: district || 'Lima'
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
  const isGoogleMapsActiveRef = useRef<boolean>(false);

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
  
  // Búsqueda de direcciones en Perú
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchPlaceItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);

  // Geocodificación Inversa: Implementación de Máxima Precisión (results[0] con region=PE y language=es)
  const fetchAddressFromCoords = useCallback(async (latitude: number, longitude: number) => {
    setIsGeocoding(true);
    setStatusMessage('Consultando calle, numeración y urbanización...');

    // 1. Si Google Maps está disponible, usar Geocoder oficial de Google con results[0]
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
          // results[0] es la dirección más específica (premise, street_address, subpremise)
          const mostSpecific = response[0];
          const fullAddress = mostSpecific.formatted_address || '';

          // Extraer distrito
          let district = '';
          const districtComp = mostSpecific.address_components?.find((c: any) =>
            c.types.includes('sublocality_level_1') ||
            c.types.includes('administrative_area_level_3') ||
            c.types.includes('locality')
          );
          if (districtComp) district = districtComp.long_name;

          // Limpiar sufijos redundantes ", Perú", ", Lima"
          let cleanAddr = fullAddress.replace(/,\s*(Perú|Peru|15\d{3})$/gi, '').trim();

          setDetectedAddress(cleanAddr);
          setDetectedDistrict(findMatchingDistrict(district, cleanAddr));
          setIsGeocoding(false);
          setStatusMessage('');
          return;
        }
      } catch (err) {
        console.warn('Google Geocoder error, usando respaldo:', err);
      }
    }

    // 2. Motor de respaldo de alta velocidad: Photon Komoot (OpenStreetMap Perú)
    let addressResolved = false;
    try {
      const photonRes = await fetch(
        `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (photonRes.ok) {
        const photonData = await photonRes.json();
        const firstFeature = photonData?.features?.[0]?.properties;

        if (firstFeature) {
          const { fullAddress, district } = formatFullDetailedAddress(firstFeature, latitude, longitude);

          if (fullAddress && !fullAddress.startsWith('Ubicación GPS')) {
            setDetectedAddress(fullAddress);
            setDetectedDistrict(district);
            addressResolved = true;
          }
        }
      }
    } catch (err) {
      console.warn('Photon reverse fallback:', err);
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
    setShowSearchResults(false);
    setSearchQuery('');

    // Actualizar marcador Leaflet
    if (deliveryMarkerRef.current) {
      deliveryMarkerRef.current.setLatLng([newLat, newLng]);
    }

    // Actualizar marcador Google Maps
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

  // Buscador Multi-API en vivo
  const handleSearchAddress = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const cleanQuery = query.trim();
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery)}&lat=-12.07&lon=-77.03&limit=8`;
      
      const response = await fetch(photonUrl);
      if (response.ok) {
        const data = await response.json();
        const formattedList: SearchPlaceItem[] = (data?.features || [])
          .filter((feat: any) => {
            const country = feat.properties?.countrycode || '';
            return !country || country.toUpperCase() === 'PE';
          })
          .map((feat: any) => {
            const props = feat.properties || {};
            const coordsArr = feat.geometry?.coordinates || [-77.03, -12.07];
            const lon = coordsArr[0]?.toString();
            const lat = coordsArr[1]?.toString();

            const { fullAddress, district } = formatFullDetailedAddress(props, parseFloat(lat), parseFloat(lon), cleanQuery);
            const sub = `${district}, Lima, Perú`;

            return {
              display_name: `${fullAddress}, ${sub}`,
              lat: lat,
              lon: lon,
              mainText: fullAddress,
              subText: sub,
              district: district,
            };
          });

        if (formattedList.length > 0) {
          setSearchResults(formattedList);
          setShowSearchResults(true);
        }
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

    if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([newLat, newLng], 19, { duration: 1.2 });
    }
    if (googleMapRef.current) {
      googleMapRef.current.panTo({ lat: newLat, lng: newLng });
      googleMapRef.current.setZoom(19);
    }

    updateDeliveryPosition(newLat, newLng, result.mainText, result.district);
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

        setUserGpsCoords({ lat: userLat, lng: userLng });
        setIsLocating(false);
        setLocationPermissionDenied(false);

        // Mover o crear puntito azul en Leaflet
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

        // Centrar en Google Maps
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

  // Inicializar Motor Cartográfico
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let isMounted = true;

    // Intentar inicializar Google Maps SDK con region=PE y language=es
    loadGoogleMapsScript().then((googleMaps) => {
      if (!isMounted || !mapContainerRef.current) return;

      if (googleMaps && !leafletMapRef.current && !googleMapRef.current) {
        try {
          isGoogleMapsActiveRef.current = true;

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
          console.warn('Fallo inicialización Google Maps, activando Leaflet:', err);
        }
      }

      // Motor Leaflet CartoDB Voyager
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
      
      {/* Buscador Único Superior con Coincidencias en Perú */}
      <div className="relative w-full z-30">
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleSearchAddress(e.target.value);
            }}
            placeholder="Buscar calle, jirón, pasaje o avenida (ej. Jr. Huamanga 1586, Av. México 1580)..."
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
            onClick={handleCenterOnUserGps}
            disabled={isLocating}
            className="absolute right-2 px-3.5 py-2.5 rounded-xl bg-cyan-500/25 hover:bg-cyan-500/35 text-cyan-300 text-xs font-black flex items-center gap-1.5 border border-cyan-500/40 transition-all cursor-pointer shadow-md"
            title="Centrar en mi ubicación GPS"
          >
            <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'GPS...' : 'Mi GPS'}</span>
          </button>
        </div>

        {/* Dropdown de Coincidencias en Perú */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-slate-950/98 backdrop-blur-2xl border-2 border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn max-h-72 overflow-y-auto">
            <div className="p-3 border-b border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-cyan-300">Lugares coincidentes en Perú:</span>
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

      {/* MAPA EXTRA-LARGO EN EL EJE Y (620px - 720px) */}
      <div className="relative w-full h-[620px] sm:h-[720px] min-h-[560px] rounded-3xl overflow-hidden border-2 border-white/20 bg-slate-950 shadow-2xl">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Leyenda sutil: Puntito Azul = Tu ubicación física | Pin Rojo/Cian = Punto de entrega */}
        <div className="absolute bottom-28 left-4 z-[400] pointer-events-none hidden sm:flex items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-950/90 backdrop-blur-md border border-white/15 text-[11px] text-slate-300 shadow-xl">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 border border-white shadow-[0_0_8px_rgba(6,182,212,1)] inline-block"></span>
            <span className="font-semibold text-white">Tu ubicación GPS (Puntito)</span>
          </div>
          <span className="text-slate-600">•</span>
          <div className="flex items-center gap-1.5">
            <span>📍</span>
            <span className="font-semibold text-white">Punto de Entrega</span>
          </div>
        </div>

        {/* Controles Flotantes de Zoom & GPS */}
        <div className="absolute right-4 top-4 z-[400] flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (leafletMapRef.current) leafletMapRef.current.zoomIn();
              if (googleMapRef.current) {
                const z = googleMapRef.current.getZoom() || 19;
                googleMapRef.current.setZoom(z + 1);
              }
            }}
            className="w-11 h-11 rounded-2xl bg-slate-900/95 hover:bg-slate-800 text-white font-bold flex items-center justify-center border border-white/20 shadow-2xl transition-all active:scale-95 cursor-pointer text-xl"
            title="Acercar mapa (Zoom In)"
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
            className="w-11 h-11 rounded-2xl bg-slate-900/95 hover:bg-slate-800 text-white font-bold flex items-center justify-center border border-white/20 shadow-2xl transition-all active:scale-95 cursor-pointer text-xl"
            title="Alejar mapa (Zoom Out)"
          >
            -
          </button>
          <button
            type="button"
            onClick={handleCenterOnUserGps}
            className="w-11 h-11 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center shadow-2xl shadow-cyan-600/40 transition-all active:scale-95 cursor-pointer"
            title="Centrar en mi ubicación GPS (Puntito azul)"
          >
            <Crosshair className={`w-5 h-5 ${isLocating ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Banner Superior Flotante: Dirección en Tiempo Real */}
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

        {/* Panel Inferior Flotante: Especificación Exacta de Dirección (Número, Cruce, Dpto) + Botón Confirmar */}
        <div className="absolute bottom-4 left-4 right-4 z-[400] space-y-2.5">
          
          {/* Campo editable de dirección milimétrica exacta */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-950/98 backdrop-blur-2xl border-2 border-cyan-500/40 shadow-2xl space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-black uppercase text-cyan-300 tracking-wider flex items-center gap-1.5">
                📍 Dirección Exacta (Número / Cruce / Dpto):
              </span>
              <span className="text-[10px] text-cyan-400 font-mono font-bold bg-cyan-500/15 px-2 py-0.5 rounded-full border border-cyan-500/30">
                Punto fijado
              </span>
            </div>
            <input
              type="text"
              value={detectedAddress}
              onChange={(e) => setDetectedAddress(e.target.value)}
              placeholder="Ej. Jr. Huamanga 1586, Urb. Matute (Cruce con Av. México)..."
              className="w-full px-4 py-3 bg-white/[0.08] border border-white/20 rounded-xl text-xs sm:text-sm font-bold text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 shadow-inner"
            />
          </div>

          {/* Botón Principal: CONFIRMAR UBICACIÓN */}
          <button
            type="button"
            onClick={handleConfirm}
            className={`w-full py-4.5 sm:py-5 px-6 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-3 shadow-2xl transition-all cursor-pointer active:scale-[0.98] ${
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
