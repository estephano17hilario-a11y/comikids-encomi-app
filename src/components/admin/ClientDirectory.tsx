import React, { useState } from 'react';
import { useOrders } from '../../context/OrderContext';
import { Usuario, Pedido } from '../../types/database.types';
import { formatDate } from '../../utils/formatters';
import { calculateLevel } from '../../data/achievementsList';
import {
  Users,
  Search,
  MessageCircle,
  Package,
  X
} from 'lucide-react';

export const ClientDirectory: React.FC = () => {
  const { pedidos, tallerConfig } = useOrders();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Usuario | null>(null);

  // Extract unique clients from orders or service
  const clientsMap = new Map<string, Usuario>();
  pedidos.forEach(p => {
    if (p.usuario) {
      clientsMap.set(p.usuario.id, p.usuario);
    }
  });
  const clientsList = Array.from(clientsMap.values());

  const filteredClients = clientsList.filter(c => 
    c.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.dni.includes(searchTerm)
  );

  const getClientOrders = (userId: string): Pedido[] => {
    return pedidos.filter(p => p.usuario_id === userId);
  };

  return (
    <div className="space-y-6">
      
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-3xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">
              Agenda & Directorio de Clientas
            </h3>
            <p className="text-xs text-slate-400">
              {clientsList.length} clientas registradas con pedidos
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o DNI..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => {
          const clientOrders = getClientOrders(client.id);
          const levelInfo = calculateLevel(client.puntos_xp || 0);
          const whatsappUrl = `https://wa.me/${tallerConfig.whatsapp_pedidos}?text=${encodeURIComponent(`¡Hola ${client.nombre_completo}! Te saluda el taller Comikids / Incomi ✨`)}`;

          return (
            <div
              key={client.id}
              className="rounded-2xl glass-card border border-slate-800 p-5 hover:border-cyan-500/40 transition-all space-y-4 shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={client.avatar_url}
                      alt={client.nombre_completo}
                      className="w-12 h-12 rounded-2xl object-cover border border-pink-500/30"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-white leading-tight">
                        {client.nombre_completo}
                      </h4>
                      <span className="text-[10px] text-pink-400 font-semibold">
                        {levelInfo.nombre}
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {client.puntos_xp || 0} XP
                  </span>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                  <p className="flex items-center justify-between">
                    <span className="text-slate-400">🆔 DNI:</span>
                    <span className="font-mono font-bold text-white">{client.dni}</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-slate-400">🎂 Edad:</span>
                    <span>{client.edad ? `${client.edad} años` : '-'}</span>
                  </p>
                  <p className="flex items-center justify-between border-t border-slate-800 pt-1.5 mt-1.5">
                    <span className="text-slate-400">🛍️ Pedidos:</span>
                    <span className="font-bold text-pink-400">{clientOrders.length} pedidos</span>
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp</span>
                </a>

                <button
                  onClick={() => setSelectedClient(client)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                  title="Ver historial de pedidos"
                >
                  <Package className="w-4 h-4" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Orders History Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl glass-panel p-6 border border-cyan-500/30 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <img
                  src={selectedClient.avatar_url}
                  alt={selectedClient.nombre_completo}
                  className="w-10 h-10 rounded-xl object-cover"
                />
                <div>
                  <h3 className="text-base font-bold text-white">{selectedClient.nombre_completo}</h3>
                  <p className="text-xs text-slate-400 font-mono">DNI: {selectedClient.dni}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {getClientOrders(selectedClient.id).length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-500">Sin pedidos registrados.</p>
              ) : (
                getClientOrders(selectedClient.id).map(p => (
                  <div key={p.id} className="p-3.5 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-pink-400">#{p.codigo_seguimiento}</span>
                      <span className="text-[11px] text-slate-400">{formatDate(p.created_at)}</span>
                    </div>
                    <p className="text-slate-200 font-semibold">"{p.detalles_bordado}"</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Destino: {p.destino_detalle}</span>
                      <span className="capitalize text-cyan-300 font-bold">{p.estado_produccion}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
