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
  X,
  Phone,
  Shield,
  Briefcase,
  Heart,
  Store,
  Calendar,
  MapPin,
  ExternalLink
} from 'lucide-react';

export const ClientDirectory: React.FC = () => {
  const { pedidos } = useOrders();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Usuario | null>(null);

  // Extract unique clients from orders and stored users
  const clientsMap = new Map<string, Usuario>();
  pedidos.forEach(p => {
    if (p.usuario) {
      clientsMap.set(p.usuario.id, p.usuario);
    }
  });
  const clientsList = Array.from(clientsMap.values());

  const filteredClients = clientsList.filter(c => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return true;
    const nameMatch = c.nombre_completo.toLowerCase().includes(query);
    const dniMatch = c.dni.toLowerCase().includes(query);
    const phoneMatch = (c.telefono_default || '').toLowerCase().includes(query);
    return nameMatch || dniMatch || phoneMatch;
  });

  const getClientOrders = (userId: string): Pedido[] => {
    return pedidos.filter(p => p.usuario_id === userId);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      
      {/* Search & Header Bar */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white text-xl shadow-lg shadow-purple-500/20">
            👥
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Agendas & Directorio 360° de Caseras
            </h2>
            <p className="text-xs text-slate-400">
              Búsqueda por Nombre, DNI o WhatsApp con perfil demográfico e historial completo
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por Nombre, DNI o WhatsApp..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-900/90 border border-slate-800 rounded-2xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition-colors shadow-inner"
          />
        </div>
      </div>

      {/* Clients Cards Grid */}
      {filteredClients.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-3xl border border-white/10 space-y-3">
          <p className="text-4xl">🔍</p>
          <h3 className="text-lg font-bold text-white">No se encontraron clientas con ese criterio</h3>
          <p className="text-xs text-slate-400">Prueba buscando por número de celular, DNI o nombre completo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const clientOrders = getClientOrders(client.id);
            const levelInfo = calculateLevel(client.puntos_xp || 0);

            // Determinar teléfono y DNI de manera inteligente
            const isPhoneDni = client.dni && client.dni.length === 9 && client.dni.startsWith('9');
            const displayPhone = client.telefono_default || (isPhoneDni ? client.dni : '');

            let displayDni = client.dni_default || (!isPhoneDni ? client.dni : '');
            if (!displayDni) {
              const matchedOrder = clientOrders.find(o => o.destino_detalle && o.destino_detalle.includes('DNI/CE Recojo:'));
              if (matchedOrder) {
                const match = matchedOrder.destino_detalle.match(/DNI\/CE Recojo:\s*([A-Za-z0-9]+)/i);
                if (match && match[1]) {
                  displayDni = match[1];
                }
              }
            }

            const rawPhone = (displayPhone || '').replace(/\D/g, '');
            const whatsappChatUrl = rawPhone.length >= 9
              ? `https://wa.me/51${rawPhone.slice(-9)}?text=${encodeURIComponent(`¡Hola ${client.nombre_completo}! 👋 Te saluda ComiKids. ¿Cómo podemos ayudarte hoy con tus pedidos?`)}`
              : `https://wa.me/message/FSEGUIYKFKYKA1`;

            const purchaseReasonLabel = client.motivo_compra === 'emprender'
              ? '💼 Para Venta / Negocio'
              : client.motivo_compra === 'empresa'
              ? '🏢 Empresa / Institución'
              : '💖 Uso Personal';

            return (
              <div
                key={client.id}
                className="rounded-3xl glass-panel border border-white/10 p-5 hover:border-purple-500/40 transition-all space-y-4 shadow-xl flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  
                  {/* Top Avatar & Level */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 via-indigo-600 to-cyan-500 p-0.5 shadow-md shadow-purple-500/20 shrink-0">
                        <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-white font-black text-base">
                          {(client.nombre_completo || 'C').charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white leading-tight">
                          {client.nombre_completo}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-bold text-purple-400">
                            {levelInfo.nombre}
                          </span>
                          <span className="text-[10px] text-slate-500">•</span>
                          <span className="text-[10px] font-mono text-amber-400 font-bold">
                            {client.puntos_xp || 0} XP
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-mono font-black bg-purple-500/15 text-purple-300 border border-purple-500/30">
                      {clientOrders.length} {clientOrders.length === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  </div>

                  {/* Demographic & Contact Pills */}
                  <div className="p-3 bg-slate-950/70 rounded-2xl border border-slate-800/80 space-y-2 text-xs">
                    
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">📱 WhatsApp:</span>
                      <strong className="font-mono text-cyan-300 font-bold">
                        {displayPhone ? `+51 ${displayPhone}` : 'No registrado'}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">🆔 DNI / Doc:</span>
                      <strong className="font-mono text-white font-bold">
                        {displayDni || 'No registrado'}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                      <span className="text-slate-400 text-[11px]">🎯 Motivo:</span>
                      <span className="text-[11px] font-bold text-slate-200">{purchaseReasonLabel}</span>
                    </div>

                    {client.edad && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">🎂 Edad:</span>
                        <span className="text-[11px] font-bold text-slate-300">{client.edad} años</span>
                      </div>
                    )}

                  </div>

                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedClient(client)}
                    className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Package className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Ver Ficha 360°</span>
                  </button>

                  <a
                    href={whatsappChatUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5 fill-current" />
                    <span>WhatsApp</span>
                  </a>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* 360° Profile Modal */}
      {selectedClient && (() => {
        const clientOrders = getClientOrders(selectedClient.id);
        const isPhoneDni = selectedClient.dni && selectedClient.dni.length === 9 && selectedClient.dni.startsWith('9');
        const modalPhone = selectedClient.telefono_default || (isPhoneDni ? selectedClient.dni : '');
        let modalDni = selectedClient.dni_default || (!isPhoneDni ? selectedClient.dni : '');
        if (!modalDni) {
          const matchedOrder = clientOrders.find(o => o.destino_detalle && o.destino_detalle.includes('DNI/CE Recojo:'));
          if (matchedOrder) {
            const match = matchedOrder.destino_detalle.match(/DNI\/CE Recojo:\s*([A-Za-z0-9]+)/i);
            if (match && match[1]) {
              modalDni = match[1];
            }
          }
        }

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
            <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border border-white/15 p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-cyan-500 flex items-center justify-center text-white text-xl font-black shadow-lg">
                    {(selectedClient.nombre_completo || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">{selectedClient.nombre_completo}</h3>
                    <p className="text-xs text-purple-400 font-bold">
                      {calculateLevel(selectedClient.puntos_xp || 0).nombre} • {selectedClient.puntos_xp || 0} XP
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Profile 360 Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">WhatsApp Oficial</span>
                  <p className="text-sm font-mono font-bold text-cyan-300">
                    {modalPhone ? `+51 ${modalPhone}` : 'No registrado'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">DNI / Documento</span>
                  <p className="text-sm font-mono font-bold text-white">
                    {modalDni || 'No registrado'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Motivo de Compra</span>
                  <p className="text-xs font-bold text-slate-200">
                    {selectedClient.motivo_compra === 'emprender'
                      ? '💼 Para Venta / Negocio'
                      : selectedClient.motivo_compra === 'empresa'
                      ? '🏢 Empresa'
                      : '💖 Uso Personal'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Edad Registrada</span>
                  <p className="text-xs font-bold text-slate-200">
                    {selectedClient.edad ? `${selectedClient.edad} años` : 'No especificada'}
                  </p>
                </div>
              </div>

            {/* Historical Orders */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-cyan-400" />
                <span>Historial de Despachos ({getClientOrders(selectedClient.id).length})</span>
              </h4>

              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {getClientOrders(selectedClient.id).length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-500">Sin despachos registrados.</p>
                ) : (
                  getClientOrders(selectedClient.id).map(p => (
                    <div key={p.id} className="p-4 bg-slate-950/90 rounded-2xl border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-cyan-400">{p.codigo_seguimiento}</span>
                        <span className="text-[10px] text-slate-400">{formatDate(p.created_at)}</span>
                      </div>
                      <p className="text-slate-200 font-semibold">{p.destino_detalle}</p>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80">
                        <span className="text-slate-400 capitalize">{p.metodo_envio_codigo === 'shalom' ? '📦 Shalom' : '🛵 Motorizado'}</span>
                        <span className="font-bold text-emerald-400 capitalize">{p.estado_envio}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};
