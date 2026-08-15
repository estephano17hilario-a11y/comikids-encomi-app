import React from 'react';
import { PackagePlus, ClipboardList, Trophy, Sparkles } from 'lucide-react';

export type ClientSection = 'crear_pedido' | 'mis_pedidos' | 'mis_logros' | 'encomi_ai';

interface Props {
  activeSection: ClientSection;
  onSectionChange: (section: ClientSection) => void;
  ordersCount?: number;
}

export const ClientBottomNav: React.FC<Props> = ({
  activeSection,
  onSectionChange,
  ordersCount = 0
}) => {
  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 p-2.5 bg-slate-950/90 backdrop-blur-2xl border-t border-white/10">
      <div className="flex items-center justify-around gap-1.5">
        
        {/* Crear Pedido */}
        <button
          onClick={() => onSectionChange('crear_pedido')}
          className={`flex-1 py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
            activeSection === 'crear_pedido'
              ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <PackagePlus className="w-4 h-4" />
          <span className="text-[10px] font-black">Nuevo</span>
        </button>

        {/* Mis Pedidos */}
        <button
          onClick={() => onSectionChange('mis_pedidos')}
          className={`flex-1 py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all relative ${
            activeSection === 'mis_pedidos'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span className="text-[10px] font-black">Envíos</span>
          {ordersCount > 0 && (
            <span className="absolute top-1.5 right-2 px-1 py-0.2 rounded-full text-[8px] font-black bg-white text-purple-600 shadow">
              {ordersCount}
            </span>
          )}
        </button>

        {/* Mis Logros */}
        <button
          onClick={() => onSectionChange('mis_logros')}
          className={`flex-1 py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
            activeSection === 'mis_logros'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span className="text-[10px] font-black">Logros</span>
        </button>

        {/* Encomi AI (4ta Sección) */}
        <button
          onClick={() => onSectionChange('encomi_ai')}
          className={`flex-1 py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all relative ${
            activeSection === 'encomi_ai'
              ? 'bg-linear-to-r from-purple-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/30'
              : 'text-cyan-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span className="text-[10px] font-black">Encomi AI</span>
        </button>

      </div>
    </div>
  );
};
