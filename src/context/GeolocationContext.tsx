/**
 * GeolocationContext
 * - Solicita permiso de ubicación al montar la app (en segundo plano)
 * - Cachea lat/lng para que PlacesMapPicker los consuma sin esperar
 * - Re-pide permisos automáticamente cuando el usuario intenta usar el mapa
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface GeolocationContextValue {
  position: GeoPosition | null;
  isLocating: boolean;
  permissionState: PermissionState | 'unknown';
  requestLocation: () => Promise<GeoPosition | null>;
}

const GeolocationContext = createContext<GeolocationContextValue>({
  position: null,
  isLocating: false,
  permissionState: 'unknown',
  requestLocation: async () => null,
});

export const useGeolocation = () => useContext(GeolocationContext);

export const GeolocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState | 'unknown'>('unknown');
  const resolversRef = useRef<((pos: GeoPosition | null) => void)[]>([]);
  const inFlightRef = useRef(false);

  const doGeoRequest = (): Promise<GeoPosition | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      // If already in-flight, queue this resolver
      if (inFlightRef.current) {
        resolversRef.current.push(resolve);
        return;
      }

      inFlightRef.current = true;
      setIsLocating(true);
      resolversRef.current.push(resolve);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geoPos: GeoPosition = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setPosition(geoPos);
          setPermissionState('granted');
          setIsLocating(false);
          inFlightRef.current = false;
          resolversRef.current.forEach((r) => r(geoPos));
          resolversRef.current = [];
        },
        (err) => {
          console.warn('[Geo] Error:', err.message);
          setPermissionState(err.code === 1 ? 'denied' : 'prompt');
          setIsLocating(false);
          inFlightRef.current = false;
          resolversRef.current.forEach((r) => r(null));
          resolversRef.current = [];
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 }
      );
    });
  };

  // Lanza la solicitud en segundo plano al montar la app
  useEffect(() => {
    // Comprueba el estado del permiso primero (sin dialog)
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermissionState(result.state);
        // Si ya fue concedido, pide en silencio para cachear
        if (result.state === 'granted' || result.state === 'prompt') {
          doGeoRequest();
        }
        result.onchange = () => setPermissionState(result.state);
      });
    } else {
      // Browser sin Permissions API: pide directamente
      doGeoRequest();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GeolocationContext.Provider
      value={{
        position,
        isLocating,
        permissionState,
        requestLocation: doGeoRequest,
      }}
    >
      {children}
    </GeolocationContext.Provider>
  );
};
