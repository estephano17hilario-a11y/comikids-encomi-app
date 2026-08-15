import React, { useState, useEffect } from 'react';
import { Pedido, EstadoEnvio, EstadoProduccion } from '../../types/database.types';
import { X, Save, Package, MapPin, User, FileText } from 'lucide-react';

interface Props {
  pedido: Pedido;
  onClose: () => void;
  onSave: (pedidoId: string, updates: Partial<Pedido>) => Promise<void>;
}

export const EditOrderModal: React.FC<Props> = ({ pedido, onClose, onSave }) => {
  const [destinoDetalle, setDestinoDetalle] = useState(pedido.destino_detalle || '');
  const [detallesBordado, setDetallesBordado] = useState(pedido.detalles_bordado || '');
  const [observaciones, setObservaciones] = useState(pedido.observaciones_cliente || '');
  const [estadoEnvio, setEstadoEnvio] = useState<EstadoEnvio>(pedido.estado_envio);
  const [estadoProduccion, setEstadoProduccion] = useState<EstadoProduccion>(pedido.estado_produccion);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(pedido.id, {
        destino_detalle: destinoDetalle.trim(),
        detalles_bordado: detallesBordado.trim(),
        observaciones_cliente: observaciones.trim(),
        estado_envio: estadoEnvio,
        estado_produccion: estadoProduccion,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-white/10 p-6 sm:p-8 shadow-2xl shadow-cyan-500/10 space-y-6 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Editar Pedido</h3>
              <p className="text-xs text-slate-400 font-mono">{pedido.codigo_seguimiento}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              Destino / Agencia / Dirección Exacta
            </label>
            <textarea
              required
              rows={3}
              value={destinoDetalle}
              onChange={e => setDestinoDetalle(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-purple-400" />
              Detalles de Destinatario / Paquete
            </label>
            <input
              type="text"
              required
              value={detallesBordado}
              onChange={e => setDetallesBordado(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              Observaciones / Referencia
            </label>
            <input
              type="text"
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              placeholder="Referencia o notas adicionales..."
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Estado de Producción / Embalaje
              </label>
              <select
                value={estadoProduccion}
                onChange={e => setEstadoProduccion(e.target.value as EstadoProduccion)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="en_cola">En Cola de Almacén</option>
                <option value="bordando">Embalando / Preparando</option>
                <option value="completado">Listo para Despacho</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Estado de Envío
              </label>
              <select
                value={estadoEnvio}
                onChange={e => setEstadoEnvio(e.target.value as EstadoEnvio)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="pendiente">Pendiente en Taller</option>
                <option value="en_camino">En Camino / En Agencia</option>
                <option value="entregado">Entregado al Cliente</option>
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-2/3 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
