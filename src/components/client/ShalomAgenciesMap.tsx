import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ShalomAgency } from '../../types/database.types';
import { UserCoordinates, cleanAddressText } from '../../hooks/useShalomAgencies';
import { Crosshair, Compass, X, Search } from 'lucide-react';

interface Props {
  agencies: ShalomAgency[];
  selectedAgency: ShalomAgency | null;
  onSelectAgency: (agency: ShalomAgency) => void;
  userLocation: UserCoordinates | null;
  onRequestLocation?: () => void;
  isLocating?: boolean;
  onClose?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

// Icono minimalista estilo Cupertino para Agencias Shalom
const createAgencyIcon = (isSelected: boolean) => {
  const bg = isSelected
    ? 'background: #0ea5e9; border: 2.5px solid #ffffff; box-shadow: 0 0 16px rgba(14, 165, 233, 0.9);'
    : 'background: rgba(15, 23, 42, 0.95); border: 1.5px solid rgba(255, 255, 255, 0.5); box-shadow: 0 4px 12px rgba(0,0,0,0.5);';

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
        📦
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
      <div style="position: absolute; width: 30px; height: 30px; border-radius: 50%; background: rgba(59, 130, 246, 0.35); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: relative; width: 16px; height: 16px; border-radius: 50%; background: #0ea5e9; border: 2.5px solid #ffffff; box-shadow: 0 0 14px rgba(14, 165, 233, 0.9);"></div>
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

export const ShalomAgenciesMap: React.FC<Props> = ({
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

  // Inicializar mapa de Leaflet con Tiles claros / Voyager de alta definición
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = userLocation?.latitude || selectedAgency?.latitude || -12.0464;
    const initialLng = userLocation?.longitude || selectedAgency?.longitude || -77.0428;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: userLocation ? 13 : 11,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    mapInstanceRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // Actualizar marcador del usuario GPS
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLocation.latitude, userLocation.longitude]);
      } else {
        const marker = L.marker([userLocation.latitude, userLocation.longitude], {
          icon: createUserLocationIcon(),
          zIndexOffset: 1000,
        }).addTo(map);

        marker.bindPopup(`
          <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; font-weight: 700; color: #0f172a; padding: 4px;">
            📍 Tu ubicación actual
          </div>
        `);

        userMarkerRef.current = marker;
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
  }, [userLocation, mapReady]);

  // Actualizar marcadores de agencias en el mapa
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;

    layer.clearLayers();

    if (validAgencies.length === 0) return;

    const bounds = L.latLngBounds([]);

    validAgencies.forEach((agency) => {
      const lat = Number(agency.latitude);
      const lng = Number(agency.longitude);
      const isSelected = selectedAgency?.id === agency.id;

      bounds.extend([lat, lng]);

      const marker = L.marker([lat, lng], {
        icon: createAgencyIcon(isSelected),
        zIndexOffset: isSelected ? 900 : 100,
      });

      const cleanAddr = cleanAddressText(agency.direccion, agency.provincia, agency.departamento);
      const distanceText = agency.distance_meters !== undefined
        ? (agency.distance_meters < 1000 ? `${Math.round(agency.distance_meters)} m` : `${(agency.distance_meters / 1000).toFixed(1)} km`)
        : '';

      const popupContent = document.createElement('div');
      popupContent.style.fontFamily = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif';
      popupContent.style.padding = '6px';
      popupContent.style.minWidth = '240px';
      popupContent.innerHTML = `
        <div style="border-bottom: 1px solid rgba(0,0,0,0.08); padding-bottom: 8px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
            <span style="font-size: 11px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px;">
              Agencia Shalom
            </span>
            ${distanceText ? `<span style="font-size: 11px; font-weight: 700; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 9999px;">📍 ${distanceText}</span>` : ''}
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 3px; line-height: 1.25;">
            ${agency.distrito || agency.nombre}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 1px;">
            ${agency.departamento || ''} • ${agency.provincia || ''}
          </div>
        </div>

        <div style="font-size: 12px; color: #334155; margin-bottom: 6px; line-height: 1.35;">
          ${cleanAddr || 'Dirección de la sede'}
        </div>

        ${agency.horario ? `
          <div style="font-size: 11px; color: #64748b; margin-bottom: 10px;">
            🕒 ${agency.horario}
          </div>
        ` : ''}

        <button id="btn-select-agency-${agency.id}" style="
          width: 100%; 
          padding: 9px 14px; 
          background: #0ea5e9; 
          color: #ffffff; 
          font-size: 13px; 
          font-weight: 700; 
          border: none; 
          border-radius: 12px; 
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.35);
        ">
          ${isSelected ? '✓ Seleccionada' : 'Seleccionar esta Agencia'}
        </button>
      `;

      marker.bindPopup(popupContent, { maxWidth: 300 });
      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-select-agency-${agency.id}`);
        if (btn) {
          btn.onclick = (e) => {
            e.stopPropagation();
            onSelectAgency(agency);
            marker.closePopup();
            if (onClose) onClose();
          };
        }
      });

      marker.on('click', () => {
        onSelectAgency(agency);
      });

      layer.addLayer(marker);
    });

    if (selectedAgency && selectedAgency.latitude && selectedAgency.longitude) {
      map.setView([Number(selectedAgency.latitude), Number(selectedAgency.longitude)], Math.max(map.getZoom(), 14), {
        animate: true,
      });
    } else if (validAgencies.length > 0 && validAgencies.length <= 10) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [validAgencies, selectedAgency, onSelectAgency, mapReady, onClose]);

  const handleRecenterUser = () => {
    if (!mapInstanceRef.current) return;
    if (userLocation) {
      mapInstanceRef.current.setView([userLocation.latitude, userLocation.longitude], 14, { animate: true });
    } else if (onRequestLocation) {
      onRequestLocation();
    }
  };

  const handleFitAll = () => {
    if (!mapInstanceRef.current || validAgencies.length === 0) return;
    const bounds = L.latLngBounds([]);
    if (userLocation) bounds.extend([userLocation.latitude, userLocation.longitude]);
    validAgencies.forEach(a => bounds.extend([Number(a.latitude), Number(a.longitude)]));
    mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  };

  return (
    <div className="space-y-3">
      
      {/* Barra de Búsqueda Sincronizada en el Mapa (Cupertino Style) */}
      {onSearchChange && (
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Filtrar agencias en el mapa (ej. Gamarra, San Isidro, Trujillo)..."
            className="w-full pl-12 pr-10 py-3.5 bg-slate-950/90 border border-white/15 rounded-2xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20 transition-all shadow-inner font-medium"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="w-7 h-7 rounded-full bg-white/10 text-slate-400 hover:text-white flex items-center justify-center absolute right-3 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Contenedor del Mapa Leaflet Amplio en el Eje Y */}
      <div className="relative w-full h-[500px] sm:h-[600px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-slate-950">
        
        {/* Contenedor del Mapa */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Barra Flotante Superior */}
        <div className="absolute top-3 left-3 right-3 z-[400] flex items-center justify-between pointer-events-none gap-2">
          <div className="bg-slate-900/90 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 shadow-lg text-xs flex items-center gap-2 pointer-events-auto">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-semibold text-white text-xs">
              {validAgencies.length} sedes disponibles
            </span>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={handleFitAll}
              className="p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-white/10 shadow-lg transition-all cursor-pointer"
              title="Encuadrar todas las sedes"
            >
              <Compass className="w-4 h-4 text-cyan-400" />
            </button>

            <button
              type="button"
              onClick={handleRecenterUser}
              disabled={isLocating}
              className="px-4 py-2 rounded-2xl bg-slate-900/90 hover:bg-slate-800 backdrop-blur-xl text-white text-xs font-bold flex items-center gap-2 border border-white/15 shadow-lg transition-all cursor-pointer"
              title="Ubicar mi GPS"
            >
              <Crosshair className={`w-4 h-4 text-cyan-400 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'Buscando...' : 'Mi GPS'}</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/10 shadow-lg transition-all cursor-pointer"
                title="Cerrar mapa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
