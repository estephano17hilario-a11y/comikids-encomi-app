import React from 'react';
import {
  KanbanSquare,
  Scissors,
  Package,
  BarChart3,
  Users,
  Settings,
  Plus
} from 'lucide-react';

export type AdminTab = 'kanban' | 'embroidery' | 'metrics' | 'clients' | 'settings';

interface Props {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onOpenQuickOrder: () => void;
  pendingCount?: number;
  embroideryCount?: number;
}

export const AdminBottomNav: React.FC<Props> = ({
  activeTab,
  onTabChange,
  onOpenQuickOrder,
  pendingCount = 0,
  embroideryCount = 0
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-slate-800/80 px-2 py-2 sm:hidden pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl">
      <div className="flex items-center justify-around relative">
        
        {/* Tab 1: Kanban Board */}
        <button
          onClick={() => onTabChange('kanban')}
          className={`flex flex-col items-center py-1 px-2 rounded-2xl transition-all relative ${
            activeTab === 'kanban' ? 'text-pink-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <KanbanSquare className="w-5 h-5" />
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                {pendingCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1">Tablero</span>
        </button>

        {/* Tab 2: Embroidery Queue */}
        <button
          onClick={() => onTabChange('embroidery')}
          className={`flex flex-col items-center py-1 px-2 rounded-2xl transition-all relative ${
            activeTab === 'embroidery' ? 'text-purple-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Scissors className="w-5 h-5" />
            {embroideryCount > 0 && (
              <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-purple-500 text-white text-[9px] font-black flex items-center justify-center">
                {embroideryCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1">Alistamiento</span>
        </button>

        {/* Center Quick Order FAB */}
        <button
          onClick={onOpenQuickOrder}
          className="-mt-5 w-12 h-12 rounded-full bg-linear-to-tr from-pink-500 via-rose-500 to-amber-400 text-white shadow-xl shadow-pink-500/40 flex items-center justify-center border-2 border-slate-950 active:scale-95 transition-transform"
          title="Agregar Pedido Presencial"
        >
          <Plus className="w-6 h-6 stroke-[3]" />
        </button>

        {/* Tab 3: Metrics */}
        <button
          onClick={() => onTabChange('metrics')}
          className={`flex flex-col items-center py-1 px-2 rounded-2xl transition-all ${
            activeTab === 'metrics' ? 'text-amber-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] mt-1">Métricas</span>
        </button>

        {/* Tab 4: Clients */}
        <button
          onClick={() => onTabChange('clients')}
          className={`flex flex-col items-center py-1 px-2 rounded-2xl transition-all ${
            activeTab === 'clients' ? 'text-cyan-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] mt-1">Agenda</span>
        </button>

      </div>
    </nav>
  );
};
