import React, { useState, useEffect } from 'react';
import { useOrders } from '../../context/OrderContext';
import { ordersService } from '../../services/ordersService';
import { useShalomAgencies, formatFullAgencyName } from '../../hooks/useShalomAgencies';
import { extractShalomDestino } from '../../utils/shalomAgencyResolver';
import { evaluateShippingCutoff, getMinAvailableShippingDate, formatFriendlyTime } from '../../utils/shippingCutoff';
import {
  X,
  PlusCircle,
  Scissors,
  Store,
  MapPin,
  Search,
  Building2,
  Clock
} from 'lucide-react';


interface Props {
  onClose: () => void;
}

export const QuickOrderModal: React.FC<Props> = ({ onClose }) => {
  const { createPedido, activeShippingMethods, tallerConfig } = useOrders();
  const cutoffStatus = evaluateShippingCutoff(tallerConfig);
  const minShippingDate = cutoffStatus.minAvailableDateYMD;

  const [nombre, setNombre] = useState('');
  const [tiktokUsuario, setTiktokUsuario] = useState('');
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
  const [fechaLimite, setFechaLimite] = useState<string>(() => minShippingDate);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (shalomAgenciesList.length > 0 && !selectedAgencyId) {
      const central = shalomAgenciesList.find(a => a.nombre?.toUpperCase().includes('CENTRAL') || a.direccion?.toUpperCase().includes('CENTRAL'));
      setSelectedAgencyId(central ? central.id : shalomAgenciesList[0].id);
    }
  }, [shalomAgenciesList, selectedAgencyId]);

  const [olvaModalidad, setOlvaModalidad] = useState<'domicilio' | 'agencia'>('domicilio');
  const [olvaCorreo, setOlvaCorreo] = useState('');
  const [olvaReferencia, setOlvaReferencia] = useState('');
  const [celularCliente, setCelularCliente] = useState('');

  const selectedMethod = activeShippingMethods.find(m => m.id === selectedMethodId) || activeShippingMethods[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !dni.trim() || !detallesBordado.trim()) return;
    const tiktokClean = tiktokUsuario.trim().replace(/^@/, '');

    setSubmitting(true);
    try {
      const reg = await ordersService.registerUser(nombre.trim(), dni.trim(), undefined, '1234', celularCliente.trim() || undefined);
      const user = reg.user || (await ordersService.loginUser(dni.trim(), '1234')).user;
      // Save user updates if provided
      if (user && (tiktokClean || olvaCorreo.trim() || celularCliente.trim())) {
        await ordersService.updateUserProfile(user.id, {
          ...(tiktokClean ? { tiktok_usuario: tiktokClean } : {}),
          ...(olvaCorreo.trim() ? { email_default: olvaCorreo.trim() } : {}),
          ...(celularCliente.trim() ? { telefono_default: celularCliente.trim() } : {}),
          ...(selectedMethod?.tipo_formulario === 'olva' ? { olva_modalidad_default: olvaModalidad } : {}),
        } as any);
      }

      let destinoDetalle = '';
      if (selectedMethod?.tipo_formulario === 'shalom') {
        const agencyObj = shalomAgenciesList.find(a => String(a.id) === String(selectedAgencyId)) || shalomAgenciesList[0];
        const fullAgencyStr = agencyObj ? formatFullAgencyName(agencyObj) : `AGENCIA SHALOM ${selectedDepartment}`;
        destinoDetalle = `Agencia Shalom: ${fullAgencyStr} (DNI/CE Recojo: ${dni.trim()})`;
      } else if (selectedMethod?.tipo_formulario === 'olva') {
        const mod = olvaModalidad === 'agencia' ? 'Agencia Olva' : 'Domicilio';
        const ref = (olvaModalidad === 'domicilio' && olvaReferencia.trim()) ? ` (Ref: ${olvaReferencia.trim()})` : '';
        destinoDetalle = `Olva Courier (${mod}): ${direccionSimple.trim()}${ref} • DNI: ${dni.trim()} • Tel: ${celularCliente.trim() || 'No especificado'} • Correo: ${olvaCorreo.trim() || 'No especificado'}`;
      } else {
        destinoDetalle = direccionSimple.trim() || 'Entrega acordada en taller';
      }

      if (user) {
        const updatedUser = {
          ...user,
          ...(tiktokClean ? { tiktok_usuario: tiktokClean } : {}),
          ...(olvaCorreo.trim() ? { email: olvaCorreo.trim() } : {}),
        };
        await createPedido({
          usuario_id: user.id,
          usuario: updatedUser,
          detalles_bordado: detallesBordado.trim(),
          metodo_envio_codigo: selectedMethod?.codigo || 'shalom',
          metodo_envio_nombre: selectedMethod?.nombre || 'Envío',
          destino_detalle: destinoDetalle,
          observaciones_cliente: (selectedMethod?.tipo_formulario === 'olva' && olvaModalidad === 'domicilio' && olvaReferencia.trim()) ? olvaReferencia.trim() : (observaciones.trim() || 'Venta directa en taller'),
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nombres y Apellidos *</label>
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

          {/* TikTok username */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Usuario de TikTok 🎵 <span className="text-slate-500 font-normal">(opcional)</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">@</span>
              <input
                type="text"
                value={tiktokUsuario}
                onChange={e => setTiktokUsuario(e.target.value)}
                placeholder="usuario123"
                className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-pink-300 focus:outline-none focus:border-pink-500 font-mono"
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
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">Fecha de Despacho</label>
                {cutoffStatus.isPastCutoff && (
                  <span className="text-[10px] text-amber-400 font-bold">⏰ Corte aplicado</span>
                )}
              </div>
              <input
                type="date"
                min={minShippingDate}
                value={fechaLimite}
                onChange={e => {
                  const val = e.target.value;
                  if (val && val < minShippingDate) {
                    setFechaLimite(minShippingDate);
                  } else {
                    setFechaLimite(val);
                  }
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
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
                const canonicalOfficial = extractShalomDestino(formatFullAgencyName(sel), sel.code);
                return (
                  <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-[11px] text-cyan-200 space-y-1.5">
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      {formatFullAgencyName(sel)}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-rose-300 font-bold bg-rose-950/50 px-2 py-0.5 rounded-lg border border-rose-500/40">
                      <Building2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Sede Oficial: <strong className="text-white font-black">{canonicalOfficial}</strong></span>
                      {sel.code && (
                        <span className="text-[10px] font-mono text-rose-200 bg-rose-900/80 px-1 rounded border border-rose-500/30 font-bold">
                          {sel.code}
                        </span>
                      )}
                    </div>
                    {sel.horario && <p className="text-slate-400 text-[10px]">⏰ {sel.horario}</p>}
                  </div>
                );
              })()}
            </div>
          ) : selectedMethod?.tipo_formulario === 'olva' ? (
            <div className="space-y-3 bg-slate-950 p-3.5 rounded-2xl border border-yellow-500/30">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-yellow-300 flex items-center gap-1.5">
                  <span>🏢</span>
                  <span>Datos Olva Courier (Quien Recibe)</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                  Nacional
                </span>
              </div>

              {/* Selector de Modalidad */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOlvaModalidad('domicilio')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    olvaModalidad === 'domicilio'
                      ? 'bg-yellow-400 text-slate-950 border-yellow-400 shadow-md'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  🏠 Para Domicilio
                </button>
                <button
                  type="button"
                  onClick={() => setOlvaModalidad('agencia')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    olvaModalidad === 'agencia'
                      ? 'bg-yellow-400 text-slate-950 border-yellow-400 shadow-md'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  🏢 Para Agencia
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">📱 Celular Cliente</label>
                  <input
                    type="tel"
                    value={celularCliente}
                    onChange={e => setCelularCliente(e.target.value)}
                    placeholder="987 654 321"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-yellow-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">📧 Correo Cliente</label>
                  <input
                    type="email"
                    value={olvaCorreo}
                    onChange={e => setOlvaCorreo(e.target.value)}
                    placeholder="cliente@gmail.com"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-300 mb-1">
                  {olvaModalidad === 'agencia' ? '🏢 Dirección / Sede Agencia Olva *' : '🏠 Dirección Domicilio *'}
                </label>
                <input
                  type="text"
                  required
                  value={direccionSimple}
                  onChange={e => setDireccionSimple(e.target.value)}
                  placeholder={olvaModalidad === 'agencia' ? 'Ej. Agencia Olva San Isidro (Av. Aramburú 1184)' : 'Ej. Av. Los Fresnos 345, Dpto 302'}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-bold focus:outline-none focus:border-yellow-400"
                />
              </div>

              {olvaModalidad === 'domicilio' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">🏷️ Referencia (Solo para Domicilio)</label>
                  <input
                    type="text"
                    value={olvaReferencia}
                    onChange={e => setOlvaReferencia(e.target.value)}
                    placeholder="Ej. Frente al parque, portón negro"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
              )}
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
