import React, { useState } from 'react';
import { useOrders } from '../../context/OrderContext';
import { ShalomAgency, MotorizadoDistrictConfig } from '../../types/database.types';
import {
  Layers,
  MapPin,
  Truck,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Search,
  Building,
  Clock,
  DollarSign
} from 'lucide-react';

export const ShippingAgenciesManager: React.FC = () => {
  const {
    customShalomAgencies,
    saveCustomShalomAgency,
    deleteCustomShalomAgency,
    motorizadoDistricts,
    saveMotorizadoDistrict,
  } = useOrders();

  const [activeSubTab, setActiveSubTab] = useState<'shalom' | 'motorizado'>('shalom');
  const [searchTerm, setSearchTerm] = useState('');

  // Shalom Form State
  const [showAddShalom, setShowAddShalom] = useState(false);
  const [shalomName, setShalomName] = useState('');
  const [shalomDept, setShalomDept] = useState('LIMA');
  const [shalomProv, setShalomProv] = useState('LIMA');
  const [shalomDist, setShalomDist] = useState('');
  const [shalomAddress, setShalomAddress] = useState('');
  const [shalomPhone, setShalomPhone] = useState('');

  // Motorizado Form State
  const [showAddMoto, setShowAddMoto] = useState(false);
  const [motoDistrito, setMotoDistrito] = useState('');
  const [motoZona, setMotoZona] = useState<MotorizadoDistrictConfig['zona']>('lima_centro');
  const [motoHoras, setMotoHoras] = useState(3);
  const [motoTarifa, setMotoTarifa] = useState(15);

  // Handle Add Shalom Agency
  const handleSaveShalom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shalomName.trim() || !shalomAddress.trim()) return;

    const newAgency: ShalomAgency = {
      id: 'custom-' + Date.now().toString(36),
      nombre: shalomName.trim(),
      departamento: shalomDept.trim().toUpperCase(),
      provincia: shalomProv.trim().toUpperCase(),
      distrito: shalomDist.trim().toUpperCase() || 'LIMA',
      direccion: shalomAddress.trim(),
      telefono: shalomPhone.trim() || undefined,
      is_active: true,
    };

    saveCustomShalomAgency(newAgency);
    setShalomName('');
    setShalomAddress('');
    setShalomDist('');
    setShalomPhone('');
    setShowAddShalom(false);
  };

  // Handle Add Motorizado District
  const handleSaveMoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!motoDistrito.trim()) return;

    const newDistrict: MotorizadoDistrictConfig = {
      id: 'mot-' + Date.now().toString(36),
      distrito: motoDistrito.trim(),
      zona: motoZona,
      tiempo_estimado_horas: Number(motoHoras) || 3,
      tarifa_sugerida: Number(motoTarifa) || 15,
      activo: true,
    };

    saveMotorizadoDistrict(newDistrict);
    setMotoDistrito('');
    setShowAddMoto(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      
      {/* Header & Sub-tabs */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white text-xl shadow-lg shadow-pink-500/20">
            🚚
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Gestor de Agencias & Rutas de Envío
            </h2>
            <p className="text-xs text-slate-400">
              Configura sedes oficiales de Shalom Nacional y distritos de Motorizado Local
            </p>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveSubTab('shalom')}
            className={`py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeSubTab === 'shalom'
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>📦</span>
            <span>Agencias Shalom ({customShalomAgencies.length} personalizadas)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('motorizado')}
            className={`py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeSubTab === 'motorizado'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🛵</span>
            <span>Motorizado Lima ({motorizadoDistricts.length} distritos)</span>
          </button>
        </div>
      </div>

      {/* SHALOM SUB-TAB */}
      {activeSubTab === 'shalom' && (
        <div className="space-y-6">
          
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-rose-400" />
              <span>Sedes Shalom Personalizadas de la Empresa</span>
            </h3>

            <button
              onClick={() => setShowAddShalom(true)}
              className="py-2.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-rose-600/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Nueva Sede Shalom</span>
            </button>
          </div>

          {/* Add Agency Modal/Box */}
          {showAddShalom && (
            <div className="p-6 rounded-3xl bg-slate-900 border border-rose-500/30 shadow-2xl space-y-4 animate-slideDown">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h4 className="text-sm font-black text-white">Nueva Agencia Shalom</h4>
                <button onClick={() => setShowAddShalom(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveShalom} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Nombre de la Sede / Agencia</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Shalom - Gamarra Taller Central"
                    value={shalomName}
                    onChange={e => setShalomName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Dirección Exacta</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Av. 28 de Julio 1050, La Victoria"
                    value={shalomAddress}
                    onChange={e => setShalomAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Distrito / Ciudad</label>
                  <input
                    type="text"
                    placeholder="Ej. La Victoria"
                    value={shalomDist}
                    onChange={e => setShalomDist(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Teléfono de Contacto (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej. 01 500-1234"
                    value={shalomPhone}
                    onChange={e => setShalomPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowAddShalom(false)}
                    className="py-2.5 px-4 rounded-xl bg-white/5 text-slate-300 text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black"
                  >
                    Guardar Agencia
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List of Custom Agencies */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customShalomAgencies.length === 0 ? (
              <div className="col-span-full glass-panel p-8 text-center rounded-3xl border border-white/10 space-y-2">
                <p className="text-3xl">📦</p>
                <h4 className="text-sm font-bold text-white">No tienes agencias Shalom agregadas manualmente</h4>
                <p className="text-xs text-slate-400">
                  La app utiliza el directorio nacional oficial de Shalom (+450 agencias integradas por geolocalización). Puedes agregar sedes especiales del taller aquí.
                </p>
              </div>
            ) : (
              customShalomAgencies.map(agency => (
                <div
                  key={agency.id}
                  className="rounded-3xl glass-panel border border-rose-500/20 p-5 space-y-3 shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-black text-white">{agency.nombre}</h4>
                      <span className="text-[10px] font-bold text-rose-400 uppercase">
                        {agency.distrito}, {agency.departamento}
                      </span>
                    </div>

                    <button
                      onClick={() => deleteCustomShalomAgency(agency.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Eliminar Sede"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-300 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span>{agency.direccion}</span>
                  </p>

                  {agency.telefono && (
                    <p className="text-[11px] font-mono text-slate-400">
                      📞 {agency.telefono}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* MOTORIZADO SUB-TAB */}
      {activeSubTab === 'motorizado' && (
        <div className="space-y-6">
          
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-cyan-400" />
              <span>Distritos y Tarifas de Motorizado Lima</span>
            </h3>

            <button
              onClick={() => setShowAddMoto(true)}
              className="py-2.5 px-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Distrito Motorizado</span>
            </button>
          </div>

          {/* Add District Box */}
          {showAddMoto && (
            <div className="p-6 rounded-3xl bg-slate-900 border border-cyan-500/30 shadow-2xl space-y-4 animate-slideDown">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h4 className="text-sm font-black text-white">Nuevo Distrito para Motorizado</h4>
                <button onClick={() => setShowAddMoto(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveMoto} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Nombre del Distrito</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Magdalena del Mar"
                    value={motoDistrito}
                    onChange={e => setMotoDistrito(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Zona de Lima</label>
                  <select
                    value={motoZona}
                    onChange={e => setMotoZona(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="lima_centro">Lima Centro</option>
                    <option value="lima_norte">Lima Norte</option>
                    <option value="lima_sur">Lima Sur</option>
                    <option value="lima_este">Lima Este</option>
                    <option value="callao">Callao</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Tiempo Estimado (Horas)</label>
                  <input
                    type="number"
                    min="1"
                    max="48"
                    value={motoHoras}
                    onChange={e => setMotoHoras(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Tarifa Sugerida (S/.)</label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={motoTarifa}
                    onChange={e => setMotoTarifa(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="sm:col-span-4 flex justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowAddMoto(false)}
                    className="py-2.5 px-4 rounded-xl bg-white/5 text-slate-300 text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black"
                  >
                    Guardar Distrito
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Motorizado Districts Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {motorizadoDistricts.map(dist => (
              <div
                key={dist.id}
                className="rounded-3xl glass-panel border border-cyan-500/20 p-5 space-y-3 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-white">{dist.distrito}</h4>
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    {dist.zona.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Tiempo:
                    </span>
                    <strong className="text-xs text-white font-bold">{dist.tiempo_estimado_horas} hrs</strong>
                  </div>

                  <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Tarifa:
                    </span>
                    <strong className="text-xs text-emerald-400 font-bold">S/. {dist.tarifa_sugerida}.00</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className={`text-[10px] font-bold ${dist.activo ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {dist.activo ? '● Ruta Activa' : '○ En Pausa'}
                  </span>
                  
                  <button
                    onClick={() => saveMotorizadoDistrict({ ...dist, activo: !dist.activo })}
                    className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300"
                  >
                    {dist.activo ? 'Pausar' : 'Activar'}
                  </button>
                </div>

              </div>
            ))}
          </div>

        </div>
      )}

    </div>
  );
};
