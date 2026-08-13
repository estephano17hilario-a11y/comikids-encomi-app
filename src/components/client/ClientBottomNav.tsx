import React from 'react';
import { PackagePlus, ClipboardList, Trophy } from 'lucide-react';

export type ClientSection = 'crear_pedido' | 'mis_pedidos' | 'mis_logros';

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
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-slate-950/85 backdrop-blur-2xl border-t border-white/10">
      <div className="flex items-center justify-around gap-2">
        
        {/* Crear Pedido */}
        <button
          onClick={() => onSectionChange('crear_pedido')}
          className={`flex-1 py-3 px-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
            activeSection === 'crear_pedido'
              ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <PackagePlus className="w-5 h-5" />
          <span className="text-[11px] font-black">Nuevo Envío</span>
        </button>

        {/* Mis Pedidos */}
        <button
          onClick={() => onSectionChange('mis_pedidos')}
          className={`flex-1 py-3 px-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all relative ${
            activeSection === 'mis_pedidos'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ClipboardList className="w-5 h-5" />
          <span className="text-[11px] font-black">Mis Envíos</span>
          {ordersCount > 0 && (
            <span className="absolute top-2 right-4 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-white text-purple-600 shadow">
              {ordersCount}
            </span>
          )}
        </button>

        {/* Mis Logros */}
        <button
          onClick={() => onSectionChange('mis_logros')}
          className={`flex-1 py-3 px-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
            activeSection === 'mis_logros'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[11px] font-black">Mis Logros</span>
        </button>

      </div>
    </div>
  );
};
