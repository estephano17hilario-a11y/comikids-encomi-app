/**
 * Google Maps API Dynamic Loader con Parámetros Regionales de Perú
 * - region=PE (Perú)
 * - language=es (Español)
 * - libraries=places,geometry
 */

let googleMapsPromise: Promise<typeof google.maps | null> | null = null;

export function loadGoogleMapsScript(apiKey?: string): Promise<typeof google.maps | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  // Si ya está cargado en el objeto global
  if ((window as any).google?.maps) {
    return Promise.resolve((window as any).google.maps);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  const key = apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  googleMapsPromise = new Promise((resolve) => {
    // Si no hay API key definida, resolver con null para usar el motor de respaldo
    if (!key) {
      console.info('Google Maps API Key no configurada. Usando motor cartográfico regional de alta precisión.');
      resolve(null);
      return;
    }

    // Verificar si ya existe la etiqueta script
    const existingScript = document.getElementById('google-maps-sdk-script');
    if (existingScript) {
      if ((window as any).google?.maps) {
        resolve((window as any).google.maps);
      } else {
        existingScript.addEventListener('load', () => resolve((window as any).google.maps));
        existingScript.addEventListener('error', () => resolve(null));
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-sdk-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&v=weekly&libraries=places,geometry,marker&region=PE&language=es&loading=async`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if ((window as any).google?.maps) {
        resolve((window as any).google.maps);
      } else {
        resolve(null);
      }
    };

    script.onerror = (err) => {
      console.warn('Fallo al cargar Google Maps SDK. Activando motor de respaldo.', err);
      resolve(null);
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
