import React, { useState } from 'react';
import { MapPin, Navigation, Compass, CheckCircle2 } from 'lucide-react';

interface Props {
  address: string;
  onAddressChange: (address: string, lat?: number, lng?: number) => void;
  lat?: number;
  lng?: number;
}

const COMMON_DISTRICTS = [
  { name: 'Miraflores, Lima (Parque Kennedy)', lat: -12.1215, lng: -77.0298 },
  { name: 'San Isidro, Lima (Av. Javier Prado)', lat: -12.0950, lng: -77.0345 },
  { name: 'Surco, Lima (Centro Comercial Chacarilla)', lat: -12.1320, lng: -76.9940 },
  { name: 'Jesús María, Lima (Av. Brasil / San Felipe)', lat: -12.0867, lng: -77.0494 },
  { name: 'Los Olivos, Lima (Mega Plaza / Panamericana)', lat: -11.9880, lng: -77.0620 },
  { name: 'San Miguel, Lima (Plaza San Miguel)', lat: -12.0772, lng: -77.0815 },
];

export const PlacesMapPicker: React.FC<Props> = ({ address, onAddressChange, lat = -12.1215, lng = -77.0298 }) => {
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({ lat, lng });
  const [isLocating, setIsLocating] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleUseCurrentLocation = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLat = position.coords.latitude;
          const newLng = position.coords.longitude;
          setCurrentCoords({ lat: newLat, lng: newLng });
          onAddressChange(`Ubicación GPS (${newLat.toFixed(4)}, ${newLng.toFixed(4)})`, newLat, newLng);
          setIsLocating(false);
        },
        () => {
          // Fallback if denied
          const fallbackLat = -12.1215;
          const fallbackLng = -77.0298;
          setCurrentCoords({ lat: fallbackLat, lng: fallbackLng });
          onAddressChange('Av. Larco 812, Miraflores, Lima', fallbackLat, fallbackLng);
          setIsLocating(false);
        },
        { timeout: 5000 }
      );
    } else {
      setIsLocating(false);
    }
  };

  const handleSelectSuggestion = (item: typeof COMMON_DISTRICTS[0]) => {
    setCurrentCoords({ lat: item.lat, lng: item.lng });
    onAddressChange(item.name, item.lat, item.lng);
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-3">
      
      {/* Address Input */}
      <div className="relative">
        <div className="relative flex items-center">
          <MapPin className="absolute left-3.5 w-4 h-4 text-pink-400" />
          <input
            type="text"
            required
            value={address}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => onAddressChange(e.target.value, currentCoords.lat, currentCoords.lng)}
            placeholder="Escribe tu calle, número y distrito en Lima..."
            className="w-full pl-10 pr-28 py-3 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-sm text-white focus:outline-none focus:border-pink-500 transition-colors shadow-inner"
          />
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            className="absolute right-2 px-2.5 py-1.5 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 text-pink-400 text-xs font-semibold flex items-center gap-1 border border-pink-500/30 transition-colors"
            title="Ubicar con GPS"
          >
            <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'GPS...' : 'Mi GPS'}</span>
          </button>
        </div>

        {/* Quick Suggestion Dropdown */}
        {showSuggestions && (
          <div className="absolute z-20 top-full mt-1.5 w-full bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden animate-fadeIn">
            <div className="p-2 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">Zonas frecuentes de entrega:</span>
              <button
                type="button"
                onClick={() => setShowSuggestions(false)}
                className="text-pink-400 hover:underline"
              >
                Cerrar
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {COMMON_DISTRICTS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSuggestion(item)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-pink-500/10 text-xs text-slate-200 border-b border-slate-800/40 last:border-0 flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5 text-pink-400" />
                    {item.name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {item.lat.toFixed(2)}, {item.lng.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Visual Map Card */}
      <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner group">
        
        {/* Mock Map Grid Background with Radar Sweep */}
        <div className="absolute inset-0 bg-[radial-gradient(#ec4899_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
        
        {/* Map roads simulation */}
        <svg className="absolute inset-0 w-full h-full stroke-slate-800/70" strokeWidth="2" fill="none">
          <path d="M -20,60 Q 150,90 400,30 T 800,120" strokeWidth="4" className="stroke-slate-700/60" />
          <path d="M 120,-20 L 160,200" strokeWidth="3" className="stroke-slate-800" />
          <path d="M 280,-20 L 250,200" strokeWidth="4" className="stroke-pink-500/20" />
          <path d="M 0,140 Q 200,100 500,160" strokeWidth="2" />
        </svg>

        {/* Pulse radar rings at point */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
          <div className="w-24 h-24 rounded-full bg-pink-500/10 animate-ping opacity-75" />
          <div className="absolute w-12 h-12 rounded-full bg-pink-500/20 border border-pink-500/40" />
          
          {/* Animated Pin */}
          <div className="absolute -top-7 flex flex-col items-center animate-bounce">
            <div className="p-2 rounded-xl bg-pink-500 text-white shadow-lg shadow-pink-500/50 flex items-center justify-center">
              <MapPin className="w-5 h-5 fill-current" />
            </div>
            <div className="w-2 h-2 rotate-45 bg-pink-500 -mt-1" />
          </div>
        </div>

        {/* Floating badge info on top of map */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 p-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 truncate text-slate-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate text-[11px] font-medium">
              {address || 'Punto fijado en mapa para motorizado'}
            </span>
          </div>
          <span className="shrink-0 text-[10px] font-mono text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-lg border border-pink-500/20">
            Motorizado Local 🛵
          </span>
        </div>

      </div>

    </div>
  );
};
