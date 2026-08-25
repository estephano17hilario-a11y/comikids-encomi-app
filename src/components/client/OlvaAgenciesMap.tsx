import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OlvaAgency } from '../../types/database.types';
import { UserCoordinates, cleanOlvaAddressText } from '../../hooks/useOlvaAgencies';
import { Crosshair, Compass, X, Search } from 'lucide-react';

interface Props {
  agencies: OlvaAgency[];
  selectedAgency: OlvaAgency | null;
  onSelectAgency: (agency: OlvaAgency) => void;
  userLocation: UserCoordinates | null;
  onRequestLocation?: () => void;
  isLocating?: boolean;
  onClose?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

// Icono minimalista estilo Cupertino / Olva Courier (Ámbar / Amarillo Dorado)
const createOlvaAgencyIcon = (isSelected: boolean, tipo?: string) => {
  const bg = isSelected
    ? 'background: #f59e0b; border: 2.5px solid #ffffff; box-shadow: 0 0 16px rgba(245, 158, 11, 0.9);'
    : 'background: rgba(15, 23, 42, 0.95); border: 1.5px solid rgba(251, 191, 36, 0.7); box-shadow: 0 4px 12px rgba(0,0,0,0.5);';

  const iconEmoji = tipo?.includes('AGENTE') ? '🏪' : '🚚';

  const iconSvg = `
    <div style="
      width: 32px; 
      height: 32px; 
      border-radius: 50% 50% 50% 0; 
      transform: rotate(-45deg); 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      cursor: pointer;
      transition: all 0.2s ease;
      ${bg}
    ">
      <div style="transform: rotate(45deg); font-size: 14px;">
        ${iconEmoji}
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'apple-map-marker',
    html: iconSvg,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Icono para la ubicación del usuario (Cupertino Blue Dot)
const createUserLocationIcon = () => {
  const html = `
    <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 30px; height: 30px; border-radius: 50%; background: rgba(245, 158, 11, 0.35); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: relative; width: 16px; height: 16px; border-radius: 50%; background: #f59e0b; border: 2.5px solid #ffffff; box-shadow: 0 0 14px rgba(245, 158, 11, 0.9);"></div>
    </div>
  `;

  return L.divIcon({
    className: 'apple-user-marker',
    html,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
};

export const OlvaAgenciesMap: React.FC<Props> = ({
  agencies,
  selectedAgency,
  onSelectAgency,
  userLocation,
  onRequestLocation,
  isLocating = false,
  onClose,
  searchQuery = '',
  onSearchChange
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const validAgencies = useMemo(() => {
    return agencies.filter(
      a =>
        a.latitude !== null &&
        a.latitude !== undefined &&
        !isNaN(Number(a.latitude)) &&
        a.longitude !== null &&
        a.longitude !== undefined &&
        !isNaN(Number(a.longitude))
    );
  }, [agencies]);

  // Inicializar mapa de Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Coordenadas default de Perú (Lima)
    const defaultCenter: [number, number] = userLocation
      ? [userLocation.latitude, userLocation.longitude]
      : selectedAgency && selectedAgency.latitude && selectedAgency.longitude
      ? [Number(selectedAgency.latitude), Number(selectedAgency.longitude)]
      : [-12.046374, -77.042793]; // Lima

    const defaultZoom = userLocation || selectedAgency ? 14 : 6;

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: false,
      attributionControl: false
    });

    // CartoDB Dark Matter Tiles (Modo Oscuro Premium estilo Apple Maps Dark)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // Grupo de capas para marcadores de agencias
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    mapInstanceRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Actualizar marcador del usuario cuando cambia la ubicación
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    if (userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLocation.latitude, userLocation.longitude]);
      } else {
        const userMarker = L.marker([userLocation.latitude, userLocation.longitude], {
          icon: createUserLocationIcon(),
          zIndexOffset: 1000
        }).addTo(map);
        userMarkerRef.current = userMarker;
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
  }, [userLocation, mapReady]);

  // Actualizar marcadores de agencias en el mapa
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !mapReady) return;
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;

    layer.clearLayers();

    const bounds = L.latLngBounds([]);

    validAgencies.forEach(agency => {
      const isSelected = selectedAgency?.id === agency.id;
      const lat = Number(agency.latitude);
      const lng = Number(agency.longitude);

      const marker = L.marker([lat, lng], {
        icon: createOlvaAgencyIcon(isSelected, agency.tipo),
        title: agency.nombre || agency.name
      });

      const distText = agency.distance_meters !== undefined
        ? agency.distance_meters < 1000
          ? `${Math.round(agency.distance_meters)} m de ti`
          : `${(agency.distance_meters / 1000).toFixed(1)} km de ti`
        : '';

      const cleanAddr = cleanOlvaAddressText(agency.direccion || agency.address, agency.provincia, agency.departamento);

      const popupContent = `
        <div style="
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
          min-width: 200px;
          max-width: 280px;
          color: #0f172a;
          padding: 4px;
        ">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #d97706; letter-spacing: 0.5px; margin-bottom: 2px;">
            OLVA COURIER • ${agency.tipo || 'AGENCIA'}
          </div>
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 4px; line-height: 1.2;">
            ${agency.distrito || agency.district || agency.nombre}
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 6px; line-height: 1.3;">
            ${cleanAddr || 'Dirección disponible en sede'}
          </div>
          ${distText ? `
            <div style="display: inline-block; font-size: 10px; font-weight: 700; background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 6px; margin-bottom: 8px;">
              📍 A ${distText}
            </div>
          ` : ''}
          ${agency.horario ? `
            <div style="font-size: 10px; color: #64748b; margin-bottom: 8px;">
              🕒 ${agency.horario}
            </div>
          ` : ''}
          <button id="btn-select-olva-${agency.id}" style="
            width: 100%;
            background: #f59e0b;
            color: #ffffff;
            border: none;
            padding: 7px 12px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
            transition: all 0.2s ease;
          ">
            ${isSelected ? '✓ Seleccionada' : 'Seleccionar esta Agencia Olva'}
          </button>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: 'apple-map-popup',
        closeButton: true,
        autoPan: true
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-select-olva-${agency.id}`);
        if (btn) {
          btn.onclick = () => {
            onSelectAgency(agency);
            map.closePopup();
          };
        }
      });

      marker.on('click', () => {
        marker.openPopup();
      });

      layer.addLayer(marker);
      bounds.extend([lat, lng]);
    });

    if (userLocation) {
      bounds.extend([userLocation.latitude, userLocation.longitude]);
    }

    if (validAgencies.length > 0 && !selectedAgency && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [validAgencies, selectedAgency, userLocation, mapReady, onSelectAgency]);

  // Centrar en la agencia seleccionada
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedAgency || !mapReady) return;
    if (selectedAgency.latitude && selectedAgency.longitude) {
      mapInstanceRef.current.setView(
        [Number(selectedAgency.latitude), Number(selectedAgency.longitude)],
        15,
        { animate: true }
      );
    }
  }, [selectedAgency, mapReady]);

  const handleCenterOnUser = () => {
    if (userLocation && mapInstanceRef.current) {
      mapInstanceRef.current.setView(
        [userLocation.latitude, userLocation.longitude],
        15,
        { animate: true }
      );
    } else if (onRequestLocation) {
      onRequestLocation();
    }
  };

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  return (
    <div className="relative w-full h-[360px] sm:h-[440px] rounded-2xl overflow-hidden shadow-2xl border border-amber-500/30 bg-slate-950 flex flex-col">
      {/* Barra Superior Flotante: Búsqueda y Filtros */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center gap-2 pointer-events-auto">
        {onSearchChange && (
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filtrar agencias Olva en el mapa (ej. Miraflores, Trujillo, Arequipa)..."
              className="w-full bg-slate-900/90 backdrop-blur-md text-xs text-white placeholder-slate-400 pl-9 pr-8 py-2.5 rounded-xl border border-slate-700/70 shadow-lg focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-full hover:bg-slate-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md text-slate-300 hover:text-white border border-slate-700/70 shadow-lg transition-all cursor-pointer shrink-0"
            title="Cerrar minimapa"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Contenedor del Mapa Leaflet */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Controles Flotantes Inferiores Derechos (Estilo iOS) */}
      <div className="absolute bottom-4 right-3 z-[1000] flex flex-col gap-2 pointer-events-auto">
        {/* Botón Mi Ubicación GPS */}
        <button
          type="button"
          onClick={handleCenterOnUser}
          disabled={isLocating}
          className={`p-3 rounded-2xl backdrop-blur-md border shadow-xl transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
            userLocation
              ? 'bg-amber-500 text-white border-amber-400 shadow-amber-500/30'
              : 'bg-slate-900/90 text-slate-200 border-slate-700/80 hover:bg-slate-800 hover:text-white'
          }`}
          title="Centrar en mi ubicación GPS actual"
        >
          {isLocating ? (
            <Compass className="w-5 h-5 animate-spin text-amber-300" />
          ) : (
            <Crosshair className="w-5 h-5" />
          )}
        </button>

        {/* Controles de Zoom */}
        <div className="flex flex-col rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-xl overflow-hidden">
          <button
            type="button"
            onClick={handleZoomIn}
            className="px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/80 text-sm font-bold border-b border-slate-800 transition-colors cursor-pointer active:bg-slate-700"
            title="Acercar"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/80 text-sm font-bold transition-colors cursor-pointer active:bg-slate-700"
            title="Alejar"
          >
            −
          </button>
        </div>
      </div>

      {/* Badge Flotante Inferior Izquierdo: Contador de Agencias Visibles */}
      <div className="absolute bottom-4 left-3 z-[1000] pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md border border-amber-500/30 px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span className="text-[11px] font-bold text-amber-200">
            {validAgencies.length} Agencias Olva en Mapa
          </span>
        </div>
      </div>
    </div>
  );
};
