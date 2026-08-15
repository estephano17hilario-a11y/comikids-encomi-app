import React, { useState, useEffect } from 'react';
import { useOrders } from '../../context/OrderContext';
import { ordersService } from '../../services/ordersService';
import { useShalomAgencies, formatFullAgencyName } from '../../hooks/useShalomAgencies';
import {
  X,
  PlusCircle,
  Scissors,
  Store,
  MapPin,
  Search
} from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const QuickOrderModal: React.FC<Props> = ({ onClose }) => {
  const { createPedido, activeShippingMethods } = useOrders();
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [detallesBordado, setDetallesBordado] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState(activeShippingMethods[0]?.id || 'met-shalom');

  // Shalom Hook & Search
  const {
    agencies: shalomAgenciesList,
    selectedDepartment,
    setSelectedDepartment,
    searchQuery: agencySearchQuery,
    setSearchQuery: setAgencySearchQuery,
    availableDepartments
  } = useShalomAgencies({ initialDepartment: 'LIMA' });

  const [selectedAgencyId, setSelectedAgencyId] = useState<string | number>('');
  const [direccionSimple, setDireccionSimple] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [fechaLimite, setFechaLimite] = useState(
    new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (shalomAgenciesList.length > 0 && !selectedAgencyId) {
      const central = shalomAgenciesList.find(a => a.nombre?.toUpperCase().includes('CENTRAL') || a.direccion?.toUpperCase().includes('CENTRAL'));
      setSelectedAgencyId(central ? central.id : shalomAgenciesList[0].id);
    }
  }, [shalomAgenciesList, selectedAgencyId]);

  const selectedMethod = activeShippingMethods.find(m => m.id === selectedMethodId) || activeShippingMethods[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !dni.trim() || !detallesBordado.trim()) return;

    setSubmitting(true);
    try {
      const reg = await ordersService.registerUser(nombre.trim(), dni.trim(), 20, '1234');
      const user = reg.user || (await ordersService.loginUser(dni.trim(), '1234')).user;

      let destinoDetalle = '';
      if (selectedMethod?.tipo_formulario === 'shalom') {
        const agencyObj = shalomAgenciesList.find(a => String(a.id) === String(selectedAgencyId)) || shalomAgenciesList[0];
        const agencyName = agencyObj ? agencyObj.nombre : 'Agencia Central';
        const agencyDist = agencyObj ? agencyObj.distrito : selectedDepartment;
        destinoDetalle = `Agencia Shalom ${selectedDepartment} - ${agencyName} (${agencyDist})`;
      } else {
        destinoDetalle = direccionSimple.trim() || 'Entrega acordada en taller';
      }

      if (user) {
        await createPedido({
          usuario_id: user.id,
          usuario: user,
          detalles_bordado: detallesBordado.trim(),
          metodo_envio_codigo: selectedMethod?.codigo || 'shalom',
          metodo_envio_nombre: selectedMethod?.nombre || 'Envío',
          destino_detalle: destinoDetalle,
          observaciones_cliente: observaciones.trim() || 'Venta directa en taller',
          fecha_limite: fechaLimite,
        });
      }

      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Registrar Pedido Rápido</h3>
              <p className="text-xs text-slate-400">Venta directa en taller o WhatsApp</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre Clienta *</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej. Sofía Benavides"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">DNI Clienta *</label>
              <input
                type="text"
                required
                value={dni}
                onChange={e => setDni(e.target.value)}
                placeholder="76543210"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Detalles de Bordado *</label>
            <textarea
              required
              rows={2}
              value={detallesBordado}
              onChange={e => setDetallesBordado(e.target.value)}
              placeholder="Texto, colores de hilo, ubicación..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Método de Envío</label>
              <select
                value={selectedMethodId}
                onChange={e => setSelectedMethodId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              >
                {activeShippingMethods.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Fecha Límite</label>
              <input
                type="date"
                value={fechaLimite}
                onChange={e => setFechaLimite(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          {selectedMethod?.tipo_formulario === 'shalom' ? (
            <div className="space-y-2.5 bg-slate-950 p-3 rounded-2xl border border-cyan-500/30">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Agencia Shalom (Total: 546 sedes)
                </label>
                {agencySearchQuery && (
                  <span className="text-[10px] font-bold text-cyan-400">
                    {shalomAgenciesList.length} encontrada{shalomAgenciesList.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={agencySearchQuery}
                  onChange={e => setAgencySearchQuery(e.target.value)}
                  placeholder="🔍 Escribe para buscar (ej. Gamarra, San Isidro, Trujillo)..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>

              {/* Lista Scrolleable Completa (Sin cortes) */}
              <div className="max-h-48 overflow-y-auto space-y-1 p-1 rounded-xl bg-slate-900/90 border border-slate-800">
                {shalomAgenciesList.length === 0 ? (
                  <p className="text-center text-[11px] text-slate-400 py-3">
                    No se encontraron agencias
                  </p>
                ) : (
                  shalomAgenciesList.map(a => {
                    const isSelected = String(selectedAgencyId) === String(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedAgencyId(a.id)}
                        className={`w-full text-left p-2 rounded-lg text-[11px] transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/25 border border-cyan-500/50 text-cyan-200 font-bold'
                            : 'hover:bg-white/6 text-slate-300'
                        }`}
                      >
                        <p className={`font-bold truncate ${isSelected ? 'text-cyan-300' : 'text-white'}`}>
                          {formatFullAgencyName(a)}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Agencia seleccionada preview */}
              {(() => {
                const sel = shalomAgenciesList.find(a => String(a.id) === String(selectedAgencyId));
                if (!sel) return null;
                return (
                  <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-[11px] text-cyan-200 space-y-1">
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      {formatFullAgencyName(sel)}
                    </p>
                    {sel.horario && <p className="text-slate-400 text-[10px]">⏰ {sel.horario}</p>}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Dirección / Destino</label>
              <input
                type="text"
                value={direccionSimple}
                onChange={e => setDireccionSimple(e.target.value)}
                placeholder="Dirección o indicaciones..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 rounded-xl bg-linear-to-r from-pink-500 to-rose-600 text-white font-black text-xs shadow-lg shadow-pink-500/20 hover:opacity-95 transition-opacity flex items-center justify-center gap-2 mt-2"
          >
            {submitting ? 'Guardando...' : '💾 Registrar Pedido en Taller'}
          </button>

        </form>

      </div>
    </div>
  );
};
