import React, { useState } from 'react';
import { ordersService } from '../../services/ordersService';
import { MetodoEnvio, CampoPersonalizadoAgencia } from '../../types/database.types';
import {
  Building2,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  Lock,
  Tag,
  FileText,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Truck,
  Package,
  MapPin,
  HelpCircle,
  Send,
  Eye,
  Sliders,
  Sparkles,
  RefreshCw,
  Hash
} from 'lucide-react';

export const CompanyAgenciesTab: React.FC = () => {
  const [methods, setMethods] = useState<MetodoEnvio[]>(() => ordersService.getShippingMethods());
  const [editingMethod, setEditingMethod] = useState<MetodoEnvio | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Estados para formulario de edición de campos
  const [camposList, setCamposList] = useState<CampoPersonalizadoAgencia[]>([]);
  const [mensajeComprobacion, setMensajeComprobacion] = useState('');
  const [nombreMetodo, setNombreMetodo] = useState('');
  const [descripcionMetodo, setDescripcionMetodo] = useState('');
  const [iconoMetodo, setIconoMetodo] = useState('Truck');

  // Nuevo campo a agregar
  const [newCampoLabel, setNewCampoLabel] = useState('');
  const [newCampoPlaceholder, setNewCampoPlaceholder] = useState('');
  const [newCampoTipo, setNewCampoTipo] = useState<'texto' | 'telefono' | 'numero' | 'textarea'>('texto');
  const [newCampoRequerido, setNewCampoRequerido] = useState(false);
  const [newCampoRotulado, setNewCampoRotulado] = useState(true);
  const [newCampoComprobante, setNewCampoComprobante] = useState(true);

  // Recargar métodos
  const reloadMethods = () => {
    const list = ordersService.getShippingMethods();
    setMethods(list);
  };

  const notifySuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const notifyError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 4000);
  };

  // Abrir modal de configuración
  const handleOpenEdit = (m: MetodoEnvio) => {
    setEditingMethod(m);
    setNombreMetodo(m.nombre);
    setDescripcionMetodo(m.descripcion || '');
    setIconoMetodo(m.icono || 'Truck');
    setCamposList(m.campos_personalizados || []);
    setMensajeComprobacion(m.mensaje_comprobacion || '');
  };

  // Guardar cambios en el método
  const handleSaveMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMethod) return;

    try {
      const rotuladoVisibles = camposList
        .filter(c => c.mostrar_en_rotulado)
        .map(c => c.id);

      ordersService.updateShippingMethod(editingMethod.id, {
        nombre: nombreMetodo.trim() || editingMethod.nombre,
        descripcion: descripcionMetodo.trim(),
        icono: iconoMetodo,
        campos_personalizados: camposList,
        mensaje_comprobacion: mensajeComprobacion.trim() || undefined,
        config_rotulado: {
          incluir_campos_personalizados: true,
          campos_visibles: rotuladoVisibles,
        }
      });

      reloadMethods();
      setEditingMethod(null);
      notifySuccess(`¡Agencia "${nombreMetodo}" actualizada correctamente!`);
    } catch (err: any) {
      notifyError(err.message || 'Error al guardar la agencia');
    }
  };

  // Crear nueva agencia
  const handleCreateNewAgency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreMetodo.trim()) {
      notifyError('Ingresa un nombre para la nueva agencia.');
      return;
    }

    try {
      const newM = ordersService.addShippingMethod({
        codigo: 'agencia_' + Date.now().toString(36),
        nombre: nombreMetodo.trim(),
        descripcion: descripcionMetodo.trim() || 'Servicio de entrega y despacho',
        icono: iconoMetodo,
        tipo_formulario: 'personalizado',
        activo: true,
        orden: methods.length + 1,
        es_sistema: false,
        campos_personalizados: [
          {
            id: 'c-nom-' + Date.now().toString(36),
            label: 'Nombres y Apellidos de quien recibe',
            placeholder: 'Ej: María Ramos',
            tipo: 'texto',
            requerido: true,
            mostrar_en_rotulado: true,
            mostrar_en_comprobante: true,
            sistema: false,
          },
          {
            id: 'c-tel-' + Date.now().toString(36),
            label: 'Teléfono de contacto / WhatsApp',
            placeholder: '9 dígitos',
            tipo: 'telefono',
            requerido: true,
            mostrar_en_rotulado: true,
            mostrar_en_comprobante: true,
            sistema: false,
          },
          {
            id: 'c-dir-' + Date.now().toString(36),
            label: 'Dirección o Agencia de Destino',
            placeholder: 'Indica la sede o dirección',
            tipo: 'texto',
            requerido: true,
            mostrar_en_rotulado: true,
            mostrar_en_comprobante: true,
            sistema: false,
          }
        ],
        config_rotulado: {
          incluir_campos_personalizados: true,
          campos_visibles: []
        }
      });

      reloadMethods();
      setShowCreateModal(false);
      setNombreMetodo('');
      setDescripcionMetodo('');
      notifySuccess(`¡Nueva agencia "${newM.nombre}" creada con éxito!`);
    } catch (err: any) {
      notifyError(err.message || 'Error al crear la agencia');
    }
  };

  // Alternar estado activo
  const handleToggleActivo = (m: MetodoEnvio) => {
    ordersService.updateShippingMethod(m.id, { activo: !m.activo });
    reloadMethods();
    notifySuccess(`Agencia "${m.nombre}" ${!m.activo ? 'activada' : 'desactivada'}.`);
  };

  // Eliminar agencia (bloqueado para Shalom y Olva)
  const handleDeleteMethod = (m: MetodoEnvio) => {
    if (m.es_sistema || m.id === 'met-shalom' || m.id === 'met-olva' || m.codigo === 'shalom' || m.codigo === 'olva') {
      alert('⚠️ Seguridad del Sistema: Las agencias base oficiales (Shalom y Olva) no se pueden eliminar ni alterar en su estructura fundamental.');
      return;
    }

    if (confirm(`¿Estás seguro de eliminar la agencia "${m.nombre}"?`)) {
      ordersService.deleteShippingMethod(m.id);
      reloadMethods();
      notifySuccess(`Agencia "${m.nombre}" eliminada.`);
    }
  };

  // Agregar campo personalizado a la agencia en edición
  const handleAddCampo = () => {
    if (!newCampoLabel.trim()) {
      alert('Ingresa el nombre del dato que solicitarás a la clienta (ej: Usuario de TikTok, Referencia, etc.)');
      return;
    }

    const nuevo: CampoPersonalizadoAgencia = {
      id: 'c-' + Date.now().toString(36),
      label: newCampoLabel.trim(),
      placeholder: newCampoPlaceholder.trim() || undefined,
      tipo: newCampoTipo,
      requerido: newCampoRequerido,
      mostrar_en_rotulado: newCampoRotulado,
      mostrar_en_comprobante: newCampoComprobante,
      sistema: false,
    };

    setCamposList(prev => [...prev, nuevo]);
    setNewCampoLabel('');
    setNewCampoPlaceholder('');
    setNewCampoTipo('texto');
    setNewCampoRequerido(false);
    setNewCampoRotulado(true);
    setNewCampoComprobante(true);
  };

  // Eliminar campo de la lista en edición
  const handleDeleteCampo = (campoId: string) => {
    const target = camposList.find(c => c.id === campoId);
    if (target?.sistema) {
      alert('Este dato es obligatorio y base para el funcionamiento del sistema en esta agencia.');
      return;
    }
    setCamposList(prev => prev.filter(c => c.id !== campoId));
  };

  // Alternar visibilidad de rotulado de un campo
  const handleToggleRotuladoCampo = (campoId: string) => {
    setCamposList(prev => prev.map(c => {
      if (c.id === campoId) {
        return { ...c, mostrar_en_rotulado: !c.mostrar_en_rotulado };
      }
      return c;
    }));
  };

  // Alternar visibilidad en comprobante
  const handleToggleComprobanteCampo = (campoId: string) => {
    setCamposList(prev => prev.map(c => {
      if (c.id === campoId) {
        return { ...c, mostrar_en_comprobante: !c.mostrar_en_comprobante };
      }
      return c;
    }));
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      
      {/* Header del Espacio Agencias */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-white/10 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Configuración Total de Agencias y Métodos de Envío
              </h2>
              <p className="text-xs text-slate-400">
                Personaliza qué datos se pedirán a las clientas, el rotulado inteligente, mensajes de WhatsApp y crea agencias personalizadas.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={reloadMethods}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all cursor-pointer"
            title="Recargar agencias"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setNombreMetodo('');
              setDescripcionMetodo('');
              setIconoMetodo('Truck');
              setShowCreateModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-950/40 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Nueva Agencia</span>
          </button>
        </div>
      </div>

      {/* Alertas */}
      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid de Agencias */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {methods.map((m) => {
          const isSystem = Boolean(m.es_sistema || m.id === 'met-shalom' || m.id === 'met-olva' || m.codigo === 'shalom' || m.codigo === 'olva');
          const totalCampos = m.campos_personalizados?.length || 0;
          const totalRotulado = m.campos_personalizados?.filter(c => c.mostrar_en_rotulado)?.length || 0;

          return (
            <div
              key={m.id}
              className={`p-5 rounded-3xl border transition-all space-y-4 relative flex flex-col justify-between ${
                m.activo
                  ? 'bg-slate-900/80 border-white/10 hover:border-cyan-500/50 shadow-lg'
                  : 'bg-slate-950/80 border-white/5 opacity-60'
              }`}
            >
              <div className="space-y-3">
                {/* Header de la tarjeta */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold border ${
                      m.codigo === 'shalom'
                        ? 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                        : m.codigo === 'olva'
                        ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                        : 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
                    }`}>
                      {m.codigo === 'shalom' ? <Package className="w-6 h-6" /> : <Truck className="w-6 h-6" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-white text-base leading-tight">
                          {m.nombre}
                        </h3>
                      </div>
                      <span className={`text-[10px] font-bold ${m.activo ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {m.activo ? '● Habilitado para clientes' : '○ Desactivado'}
                      </span>
                    </div>
                  </div>

                  {/* Badge Sistema vs Personalizada */}
                  <div className="shrink-0">
                    {isSystem ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full" title="Agencia base del sistema (Protegida contra eliminación)">
                        <Lock className="w-2.5 h-2.5" />
                        <span>SISTEMA</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                        <span>PERSONALIZADA</span>
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                  {m.descripcion || 'Sin descripción configurada.'}
                </p>

                {/* Métricas de Datos & Rotulado Inteligente */}
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-medium flex items-center gap-1">
                      <Sliders className="w-3 h-3 text-cyan-400" />
                      Datos pedidos a la clienta:
                    </span>
                    <span className="font-bold text-white bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
                      {totalCampos} campos
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-medium flex items-center gap-1">
                      <Tag className="w-3 h-3 text-purple-400" />
                      En Rótulo Inteligente:
                    </span>
                    <span className="font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">
                      {totalRotulado} impresos en rótulo
                    </span>
                  </div>

                  {m.mensaje_comprobacion && (
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
                      <span className="text-slate-400 font-medium flex items-center gap-1">
                        <Send className="w-3 h-3 text-emerald-400" />
                        Comprobante WhatsApp:
                      </span>
                      <span className="text-[10px] font-bold text-emerald-300">
                        ✓ Personalizado
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Acciones de la Tarjeta */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(m)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-950/40 active:scale-95 transition-all cursor-pointer"
                  title="Configurar campos que se pedirán, rotulado inteligente y mensaje"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Configurar Agencia</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleActivo(m)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    m.activo
                      ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  }`}
                  title={m.activo ? 'Desactivar método' : 'Activar método'}
                >
                  {m.activo ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                </button>

                {!isSystem ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteMethod(m)}
                    className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
                    title="Eliminar esta agencia"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <span
                    className="p-2.5 rounded-xl bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed"
                    title="Agencia protegida del sistema. No se puede borrar."
                  >
                    <Lock className="w-4 h-4" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL CONFIGURACIÓN DE AGENCIA (CAMPOS, ROTULADO, MENSAJE) */}
      {editingMethod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-3xl rounded-3xl bg-slate-900 border border-cyan-500/40 p-6 sm:p-7 shadow-2xl shadow-cyan-950/50 space-y-5 max-h-[92vh] flex flex-col">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <span>Configurar {editingMethod.nombre}</span>
                    {editingMethod.es_sistema && (
                      <span className="text-[10px] font-black text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                        Oficial Protegida
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Define qué datos se pedirán a la clienta, qué aparecerá en el rótulo y el mensaje de WhatsApp.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingMethod(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario con Scroll */}
            <form onSubmit={handleSaveMethod} className="flex-1 overflow-y-auto space-y-6 pr-1 text-xs">
              
              {/* SECCIÓN 1: DATOS BÁSICOS DE LA AGENCIA */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  <span>Información General de la Agencia</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Nombre Público de la Agencia / Modalidad *
                    </label>
                    <input
                      type="text"
                      required
                      value={nombreMetodo}
                      onChange={e => setNombreMetodo(e.target.value)}
                      placeholder="Ej. Motorizado Express o Transportes Flores"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Descripción breve para la clienta
                    </label>
                    <input
                      type="text"
                      value={descripcionMetodo}
                      onChange={e => setDescripcionMetodo(e.target.value)}
                      placeholder="Ej. Entrega a domicilio o en sede central"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: DATOS PERSONALIZADOS A PEDIR A LA CLIENTA + ROTULADO INTELIGENTE */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-purple-400" />
                      <span>Datos a Pedir a la Clienta & Rotulado Inteligente</span>
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Personaliza cada dato solicitado. Marca si debe imprimirse en el rótulo del paquete y en el comprobante.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2.5 py-1 rounded-full shrink-0">
                    {camposList.length} datos configurados
                  </span>
                </div>

                {/* Lista de Campos Configurados */}
                <div className="space-y-2">
                  {camposList.map((campo) => (
                    <div
                      key={campo.id}
                      className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        campo.sistema
                          ? 'bg-slate-900/90 border-amber-500/30 text-white'
                          : 'bg-slate-900/60 border-white/10 text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-black text-xs shrink-0">
                          {campo.tipo === 'telefono' ? <Smartphone className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{campo.label}</span>
                            {campo.sistema && (
                              <span className="text-[9px] font-black text-amber-300 bg-amber-500/15 px-1.5 py-0.2 rounded border border-amber-500/30">
                                Base Sistema
                              </span>
                            )}
                            {campo.requerido && (
                              <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
                                Obligatorio
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            Tipo: {campo.tipo} {campo.placeholder ? `• Ejemplo: "${campo.placeholder}"` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Switches de Control: Rotulado y Comprobante */}
                      <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                        {/* Switch: Mostrar en Rótulo Inteligente */}
                        <button
                          type="button"
                          onClick={() => handleToggleRotuladoCampo(campo.id)}
                          className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                            campo.mostrar_en_rotulado
                              ? 'bg-purple-500/20 text-purple-200 border-purple-400/40 hover:bg-purple-500/30'
                              : 'bg-white/5 text-slate-500 border-white/10 hover:text-slate-300'
                          }`}
                          title="Hacer que este dato se imprima en la etiqueta / rótulo de despacho"
                        >
                          <Tag className="w-3 h-3" />
                          <span>{campo.mostrar_en_rotulado ? '✓ En Rótulo' : 'Sin Rótulo'}</span>
                        </button>

                        {/* Switch: Mostrar en Comprobante */}
                        <button
                          type="button"
                          onClick={() => handleToggleComprobanteCampo(campo.id)}
                          className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                            campo.mostrar_en_comprobante
                              ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40 hover:bg-cyan-500/30'
                              : 'bg-white/5 text-slate-500 border-white/10 hover:text-slate-300'
                          }`}
                          title="Mostrar este dato en el comprobante que recibe la clienta"
                        >
                          <Eye className="w-3 h-3" />
                          <span>{campo.mostrar_en_comprobante ? '✓ Comprobante' : 'Oculto'}</span>
                        </button>

                        {/* Eliminar campo si no es de sistema */}
                        {!campo.sistema ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteCampo(campo.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                            title="Eliminar este dato"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="p-1.5 text-slate-600 cursor-not-allowed" title="Campo protegido del sistema">
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Formulario para añadir nuevo dato a pedir */}
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-purple-500/30 space-y-3 mt-3">
                  <div className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir Nuevo Dato a Solicitar (ej: Usuario de TikTok, DNI, Referencia, etc.)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        Nombre del Dato (Pregunta) *
                      </label>
                      <input
                        type="text"
                        value={newCampoLabel}
                        onChange={e => setNewCampoLabel(e.target.value)}
                        placeholder="Ej. Usuario de TikTok o Link de Perfil"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-purple-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        Tipo de Dato
                      </label>
                      <select
                        value={newCampoTipo}
                        onChange={e => setNewCampoTipo(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-purple-400 cursor-pointer"
                      >
                        <option value="texto">Texto Simple</option>
                        <option value="telefono">Teléfono / Celular</option>
                        <option value="numero">Número / DNI</option>
                        <option value="textarea">Texto Largo / Referencia</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 text-[11px] select-none">
                        <input
                          type="checkbox"
                          checked={newCampoRequerido}
                          onChange={e => setNewCampoRequerido(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-purple-500 cursor-pointer"
                        />
                        <span>Obligatorio</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-purple-300 text-[11px] select-none font-bold">
                        <input
                          type="checkbox"
                          checked={newCampoRotulado}
                          onChange={e => setNewCampoRotulado(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-purple-500 cursor-pointer"
                        />
                        <span>Imprimir en Rótulo</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-cyan-300 text-[11px] select-none font-bold">
                        <input
                          type="checkbox"
                          checked={newCampoComprobante}
                          onChange={e => setNewCampoComprobante(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-cyan-500 cursor-pointer"
                        />
                        <span>Ver en Comprobante</span>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddCampo}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 shadow transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Dato</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 3: MENSAJE DE COMPROBACIÓN EDITABLE POR AGENCIA (SIN BLOQUE ENCOMI) */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Send className="w-4 h-4 text-emerald-400" />
                    <span>Mensaje de Comprobación para esta Agencia (WhatsApp)</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                    Solo Cuerpo Editable
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-[11px] text-cyan-200 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Variables inteligentes que puedes usar en el texto:</span>
                  </p>
                  <p className="font-mono text-[10px] text-cyan-300">
                    {`{cliente} • {dni} • {telefono} • {modalidad} • {destino} • {fecha} • {orden} • {campos_adicionales}`}
                  </p>
                  <p className="text-[10px] text-slate-400 italic pt-0.5">
                    * El bloque publicitario y el link oficial de Encomi se adjuntarán automáticamente al pie de este mensaje al enviarlo por WhatsApp.
                  </p>
                </div>

                <textarea
                  rows={6}
                  value={mensajeComprobacion}
                  onChange={e => setMensajeComprobacion(e.target.value)}
                  placeholder={`¡Hola {cliente}! ✨ Te confirmamos tu pedido de despacho por ${editingMethod.nombre}.\n\n🏷️ Orden: {orden}\n👤 Destinatario: {cliente}\n🪪 DNI: {dni}\n📱 Teléfono: {telefono}\n📍 Destino: {destino}\n📅 Fecha de Envío: {fecha}\n\n{campos_adicionales}`}
                  className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 leading-relaxed"
                />

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Deja en blanco para utilizar la plantilla estándar oficial del sistema.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMensajeComprobacion(`✨ *COMPROBANTE DE ENVÍO - ${editingMethod.nombre.toUpperCase()}* 📦\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏷️ *Orden:* {orden}\n👤 *Cliente:* {cliente}\n🪪 *DNI / Doc:* {dni}\n📱 *WhatsApp:* {telefono}\n🚚 *Modalidad:* {modalidad}\n📅 *Fecha de Envío:* {fecha}\n\n📍 *Destino Oficial:*\n{destino}\n\n{campos_adicionales}`);
                    }}
                    className="text-cyan-400 hover:text-cyan-300 underline font-bold cursor-pointer"
                  >
                    Restaurar Plantilla Sugerida
                  </button>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex gap-3 pt-3 border-t border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingMethod(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs transition-all shadow-lg shadow-cyan-950/50 cursor-pointer"
                >
                  Guardar Configuración de Agencia
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR NUEVA AGENCIA */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-cyan-500/40 p-6 sm:p-7 shadow-2xl shadow-cyan-950/50 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    Crear Nueva Agencia de Envío
                  </h3>
                  <p className="text-xs text-slate-400">Añade transportes o couriers adicionales</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewAgency} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nombre de la Agencia o Servicio *
                </label>
                <input
                  type="text"
                  required
                  value={nombreMetodo}
                  onChange={e => setNombreMetodo(e.target.value)}
                  placeholder="Ej. Transportes Flores o Marvisur"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Descripción para los clientes
                </label>
                <input
                  type="text"
                  value={descripcionMetodo}
                  onChange={e => setDescripcionMetodo(e.target.value)}
                  placeholder="Ej. Despachos interprovinciales por terminal terrestre"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 text-[11px] leading-relaxed">
                ℹ️ La nueva agencia se creará con campos predeterminados (Nombre, Teléfono y Destino). Luego podrás agregarle campos como "Usuario de TikTok", seleccionar qué va al rótulo inteligente y personalizar su comprobante.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs transition-all shadow-lg shadow-cyan-950/50 cursor-pointer"
                >
                  Crear Agencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
