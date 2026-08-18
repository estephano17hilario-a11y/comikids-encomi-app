import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOrders } from '../../context/OrderContext';
import { TallerConfig } from '../../types/database.types';
import { X, Settings, Save, Store, Phone, MapPin, Check } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const TallerConfigModal: React.FC<Props> = ({ onClose }) => {
  const { tallerConfig, updateTallerConfig } = useOrders();
  const [formData, setFormData] = useState<TallerConfig>(tallerConfig);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateTallerConfig(formData);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1500);
  };

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn" data-no-print="true">
      <div className="relative w-full max-w-md rounded-3xl glass-panel p-6 border border-slate-700 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-800 text-pink-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Configuración de Encomi Envíos</h3>
              <p className="text-xs text-slate-400">Datos de Remitente para Guías y Despachos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre Comercial de la Empresa</label>
            <input
              type="text"
              required
              value={formData.nombre_taller}
              onChange={e => setFormData({ ...formData, nombre_taller: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">RUC o DNI Remitente</label>
              <input
                type="text"
                required
                value={formData.ruc_dni}
                onChange={e => setFormData({ ...formData, ruc_dni: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono Remitente</label>
              <input
                type="text"
                required
                value={formData.celular_taller}
                onChange={e => setFormData({ ...formData, celular_taller: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Dirección del Taller (Origen Shalom)</label>
            <input
              type="text"
              required
              value={formData.direccion_taller}
              onChange={e => setFormData({ ...formData, direccion_taller: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Ciudad Origen Shalom</label>
              <input
                type="text"
                required
                value={formData.ciudad_origen || 'LIMA'}
                onChange={e => setFormData({ ...formData, ciudad_origen: e.target.value.toUpperCase() })}
                placeholder="LIMA"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Agencia Shalom Origen</label>
              <input
                type="text"
                required
                value={formData.agencia_shalom_origen || 'AV MEXICO CO'}
                onChange={e => setFormData({ ...formData, agencia_shalom_origen: e.target.value.toUpperCase() })}
                placeholder="AV MEXICO CO"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp para Pedidos y Clientes</label>
            <input
              type="text"
              required
              value={formData.whatsapp_pedidos}
              onChange={e => setFormData({ ...formData, whatsapp_pedidos: e.target.value })}
              placeholder="51987654321"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">Con código de país (Ej: 51987654321)</p>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-lg shadow-pink-600/30 transition-all flex items-center justify-center gap-2 mt-4"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>¡Guardado Correctamente!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar Cambios</span>
              </>
            )}
          </button>
        </form>

      </div>
    </div>,
    document.body
  );
};
