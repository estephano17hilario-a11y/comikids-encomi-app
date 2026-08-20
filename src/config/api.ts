/**
 * Configuración centralizada de endpoints de Backend y Anti-CORS / Anti-Mixed Content
 */
export const getApiBaseUrl = (): string => {
  // En producción Web HTTPS (ej: https://encomi.vercel.app), usar el reverse proxy same-origin de Vercel
  // para evitar bloqueos de "Mixed Content" (HTTPS -> HTTP).
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    !window.location.hostname.includes('localhost') &&
    !window.location.hostname.includes('127.0.0.1')
  ) {
    return '/api/proxy';
  }

  // En entorno local de desarrollo o APK nativo de Capacitor (Android/iOS)
  const envBackend = import.meta.env.VITE_BACKEND_URL;
  if (envBackend) {
    const clean = envBackend.replace(/\/+$/, '');
    return clean.endsWith('/api') ? clean : `${clean}/api`;
  }

  return 'http://89.117.73.97:3000/api';
};
