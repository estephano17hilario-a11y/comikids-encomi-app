import React from 'react';
import { PackagePlus, ClipboardList, Trophy, Sparkles } from 'lucide-react';

export type ClientSection = 'crear_pedido' | 'mis_pedidos' | 'mis_logros' | 'encomi_ai';

interface Props {
  activeSection: ClientSection;
  onSectionChange: (section: ClientSection) => void;
  ordersCount?: number;
}

const ITEMS: { id: ClientSection; label: string; icon: React.ElementType; active: string }[] = [
  { id: 'crear_pedido', label: 'Nuevo envío', icon: PackagePlus, active: 'text-cyan-300' },
  { id: 'mis_pedidos', label: 'Mis envíos', icon: ClipboardList, active: 'text-purple-300' },
  { id: 'mis_logros', label: 'Logros', icon: Trophy, active: 'text-amber-300' },
  { id: 'encomi_ai', label: 'Ayuda IA', icon: Sparkles, active: 'text-cyan-300' },
];

export const ClientBottomNav: React.FC<Props> = ({
  activeSection,
  onSectionChange,
  ordersCount = 0
}) => {
  return (
    <nav
      aria-label="Navegación principal"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 px-2 pt-1.5 pb-safe bg-slate-950/95 backdrop-blur-2xl border-t border-white/10"
    >
      <div className="flex items-stretch justify-around gap-1">
        {ITEMS.map(item => {
          const isActive = activeSection === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex-1 min-h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? `bg-white/10 ${item.active}` : 'text-slate-400 active:bg-white/5'
              }`}
            >
              <span className={`absolute top-0 h-0.5 w-8 rounded-full transition-opacity ${isActive ? 'opacity-100 bg-current' : 'opacity-0'}`} />
              <span className="relative">
                <Icon className="w-5 h-5" />
                {item.id === 'mis_pedidos' && ordersCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full text-[10px] leading-4 font-black bg-purple-500 text-white text-center">
                    {ordersCount > 99 ? '99+' : ordersCount}
                  </span>
                )}
              </span>
              <span className="text-[11px] font-bold leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
