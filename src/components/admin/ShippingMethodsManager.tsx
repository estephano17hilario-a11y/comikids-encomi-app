import React, { useState } from 'react';
import { useOrders } from '../../context/OrderContext';
import { MetodoEnvio, TipoFormularioEnvio } from '../../types/database.types';
import {
  Package,
  Truck,
  Plus,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Layers
} from 'lucide-react';

export const ShippingMethodsManager: React.FC = () => {
  const { shippingMethods, addShippingMethod, updateShippingMethod, deleteShippingMethod } = useOrders();
  
  const [isAdding, setIsAdding] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipoFormulario, setTipoFormulario] = useState<TipoFormularioEnvio>('texto_simple');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    const codigo = nombre.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36);
    addShippingMethod({
      codigo,
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || 'Método configurado por Comikids',
      icono: 'Package',
      tipo_formulario: tipoFormulario,
      activo: true,
      orden: shippingMethods.length + 1
    });

    setNombre('');
    setDescripcion('');
    setIsAdding(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="minimal-card p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
            <Layers className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white">
              Destinos & Métodos de Envío
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Personaliza a dónde pueden enviar las clientas (Shalom, Motorizado, Marvisur, Olva, etc.)
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-6 py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-white font-black text-xs sm:text-sm shadow-xl shadow-cyan-500/25 active:scale-95 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>{isAdding ? 'Cancelar' : 'Agregar Nuevo Destino'}</span>
        </button>
      </div>

      {/* Add Form */}
      {isAdding && (
        <form onSubmit={handleAddSubmit} className="minimal-card p-6 sm:p-8 space-y-5 animate-fadeIn">
          <h4 className="text-base font-black text-white">Nuevo Método de Transporte</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">Nombre del Método *</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej. Olva Courier Express"
                className="big-input text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">Tipo de Selector</label>
              <select
                value={tipoFormulario}
                onChange={e => setTipoFormulario(e.target.value as TipoFormularioEnvio)}
                className="big-input text-sm cursor-pointer"
              >
                <option value="shalom" className="bg-slate-900 text-white">Agencias Shalom (Selector de provincias y sedes)</option>
                <option value="mapa_direccion" className="bg-slate-900 text-white">Motorizado (43 distritos de Lima y mapa)</option>
                <option value="texto_simple" className="bg-slate-900 text-white">Texto Simple (Indicaciones libres)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">Descripción Breve</label>
            <input
              type="text"
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej. Entrega a domicilio en 24 horas"
              className="big-input text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-5 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-black shadow-lg shadow-cyan-500/30"
            >
              Guardar Destino
            </button>
          </div>
        </form>
      )}

      {/* Methods Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {shippingMethods.map((method) => {
          const isShalom = method.tipo_formulario === 'shalom';
          return (
            <div
              key={method.id}
              className={`minimal-card p-6 space-y-4 transition-all shadow-lg ${
                method.activo ? 'border-cyan-500/30' : 'opacity-50'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
                    {isShalom ? <Package className="w-7 h-7" /> : <Truck className="w-7 h-7" />}
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white">{method.nombre}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{method.descripcion}</p>
                  </div>
                </div>

                <button
                  onClick={() => updateShippingMethod(method.id, { activo: !method.activo })}
                  className={`p-1.5 rounded-xl transition-colors ${
                    method.activo ? 'text-cyan-400 hover:text-cyan-300' : 'text-slate-500'
                  }`}
                  title={method.activo ? 'Desactivar' : 'Activar'}
                >
                  {method.activo ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9" />}
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-white/[0.08] pt-3 text-xs">
                <span className="px-3 py-1 rounded-xl text-[11px] font-mono bg-white/[0.04] text-slate-300 border border-white/10">
                  Tipo: {method.tipo_formulario}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const newName = prompt('Nuevo nombre:', method.nombre);
                      if (newName && newName.trim()) {
                        updateShippingMethod(method.id, { nombre: newName.trim() });
                      }
                    }}
                    className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white transition-colors"
                    title="Editar nombre"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {method.codigo !== 'shalom' && method.codigo !== 'motorizado' && (
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar método "${method.nombre}"?`)) {
                          deleteShippingMethod(method.id);
                        }
                      }}
                      className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 transition-colors"
                      title="Eliminar método"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
