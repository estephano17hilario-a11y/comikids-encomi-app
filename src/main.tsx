import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import 'mapbox-gl/dist/mapbox-gl.css'
import './index.css'
import App from './App.tsx'

// Marca la app nativa (Android) para reservar el espacio de la barra de estado en los encabezados
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('is-native')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
