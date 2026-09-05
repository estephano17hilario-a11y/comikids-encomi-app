import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ordersService } from '../services/ordersService';
import { EmpresaAccount } from '../types/database.types';
import {
  ShieldCheck,
  Building2,
  KeyRound,
  Eye,
  EyeOff,
  Plus,
  Edit3,
  Trash2,
  History,
  Clock,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Search,
  Copy,
  Check,
  Smartphone,
  X,
  RefreshCw
} from 'lucide-react';

export const MatrixPortal: React.FC = () => {
  const { logout, impersonateEmpresa } = useAuth();
  const [empresas, setEmpresas] = useState<EmpresaAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<EmpresaAccount | null>(null);
  const [auditEmpresa, setAuditEmpresa] = useState<EmpresaAccount | null>(null);

  // Formulario
  const [formNombre, setFormNombre] = useState('');
  const [formNumero, setFormNumero] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  const [formActivo, setFormActivo] = useState(true);
  const [formError, setFormError] = useState('');

  const loadEmpresas = () => {
    const list = ordersService.getEmpresas();
    setEmpresas(list);
  };

  useEffect(() => {
    loadEmpresas();
  }, []);

  const handleTogglePassword = (empId: string) => {
    setVisiblePasswords(prev => ({ ...prev, [empId]: !prev[empId] }));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const openCreateModal = () => {
    setEditingEmpresa(null);
    setFormNombre('');
    setFormNumero('');
    setFormPassword('');
    setFormTelefono('');
    setFormActivo(true);
    setFormError('');
    setShowCreateModal(true);
  };

  const openEditModal = (emp: EmpresaAccount) => {
    setEditingEmpresa(emp);
    setFormNombre(emp.nombre);
    setFormNumero(emp.numero_entrada);
    setFormPassword(emp.password_hash);
    setFormTelefono(emp.telefono_contacto || '');
    setFormActivo(emp.activo);
    setFormError('');
    setShowCreateModal(true);
  };

  const handleSaveEmpresa = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    try {
      if (editingEmpresa) {
        ordersService.updateEmpresa(editingEmpresa.id, {
          nombre: formNombre.trim(),
          numero_entrada: formNumero.trim(),
          password_hash: formPassword.trim(),
          telefono_contacto: formTelefono.trim() || undefined,
          activo: formActivo
        });
      } else {
        ordersService.createEmpresa({
          nombre: formNombre.trim(),
          numero_entrada: formNumero.trim(),
          password_hash: formPassword.trim(),
          telefono_contacto: formTelefono.trim() || undefined,
          activo: formActivo
        });
      }
      loadEmpresas();
      setShowCreateModal(false);
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar la empresa');
    }
  };

  const handleDeleteEmpresa = (emp: EmpresaAccount) => {
    if (confirm(`¿Estás seguro de eliminar la cuenta de empresa "${emp.nombre}"?`)) {
      try {
        ordersService.deleteEmpresa(emp.id);
        loadEmpresas();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleToggleActivo = (emp: EmpresaAccount) => {
    ordersService.updateEmpresa(emp.id, { activo: !emp.activo });
    loadEmpresas();
  };

  const formatFechaHora = (isoStr?: string): string => {
    if (!isoStr) return 'Nunca ha ingresado';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return 'Nunca ha ingresado';
      return d.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  const formatRelativeTime = (isoStr?: string): string => {
    if (!isoStr) return 'Sin ingresos aún';
    try {
      const d = new Date(isoStr);
      const diffMs = Date.now() - d.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'Hace unos segundos';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `Hace ${diffMin} min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `Hace ${diffHours} h`;
      const diffDays = Math.floor(diffHours / 24);
      return `Hace ${diffDays} días`;
    } catch {
      return '';
    }
  };

  const filteredEmpresas = empresas.filter(e =>
    e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.numero_entrada.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalIngresosTodos = empresas.reduce((acc, curr) => acc + (curr.total_ingresos || 0), 0);
  const totalActivas = empresas.filter(e => e.activo).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white pb-24">
      
      {/* Top Cyberpunk Matrix Glow Banner */}
      <div className="border-b border-emerald-500/20 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 px-4 sm:px-8 py-3.5 shadow-2xl shadow-emerald-950/40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 font-black text-xl animate-pulse">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-widest uppercase text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  SUPER ADMIN MATRIX
                </span>
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                  Acceso: 963097777
                </span>
              </div>
              <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                <span>Panel Central Matrix</span>
                <span className="text-slate-500 text-sm font-normal">• Control Multitenant</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Crear Nueva Empresa</span>
              <span className="sm:hidden">Nueva</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 transition-colors cursor-pointer"
              title="Cerrar Sesión Matrix"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-6">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-3xl bg-slate-900/80 border border-white/10 shadow-lg relative overflow-hidden">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-cyan-400" />
              <span>Empresas Registradas</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1">
              {empresas.length}
            </div>
            <span className="text-[10px] text-emerald-400 font-bold">
              {totalActivas} activas en el sistema
            </span>
          </div>

          <div className="p-4 rounded-3xl bg-slate-900/80 border border-white/10 shadow-lg relative overflow-hidden">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-emerald-400" />
              <span>Total Ingresos Auditados</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-300 mt-1 font-mono">
              {totalIngresosTodos}
            </div>
            <span className="text-[10px] text-slate-400">
              Inicios de sesión verificados
            </span>
          </div>

          <div className="p-4 rounded-3xl bg-slate-900/80 border border-white/10 shadow-lg relative overflow-hidden">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>Cuenta Maestra Matrix</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-white mt-1.5 truncate">
              963097777
            </div>
            <span className="text-[10px] text-purple-300 font-bold">
              Clave: matrix4012
            </span>
          </div>

          <div className="p-4 rounded-3xl bg-slate-900/80 border border-white/10 shadow-lg relative overflow-hidden">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Estado del Sistema</span>
            </div>
            <div className="text-sm font-black text-emerald-400 mt-2 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>Operativo 100%</span>
            </div>
            <span className="text-[10px] text-slate-400">
              Multitenancy Matrix 2026
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/60 border border-white/10">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o número..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="text-xs text-slate-400 font-bold flex items-center gap-2">
            <span>Mostrando {filteredEmpresas.length} de {empresas.length} empresas</span>
            <button
              type="button"
              onClick={loadEmpresas}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
              title="Recargar datos"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Empresas Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmpresas.map(emp => {
            const isPasswordVisible = Boolean(visiblePasswords[emp.id]);
            const lastAccess = emp.ultimo_acceso;
            const historyCount = emp.historial_accesos?.length || 0;

            return (
              <div
                key={emp.id}
                className={`p-5 rounded-3xl border transition-all space-y-4 relative ${
                  emp.activo
                    ? 'bg-slate-900/80 border-white/10 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-950/30'
                    : 'bg-slate-950/80 border-rose-500/30 opacity-75'
                }`}
              >
                {/* Header de la tarjeta */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center font-black text-cyan-300 text-lg shrink-0">
                      {emp.nombre.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-white text-base tracking-tight truncate">
                          {emp.nombre}
                        </h3>
                        {emp.id === 'empresa-master-comikids' && (
                          <span className="text-[9px] font-black text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full shrink-0">
                            BASE
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold ${emp.activo ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {emp.activo ? '● Activa' : '○ Inactiva / Suspendida'}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Activo / Inactivo */}
                  <button
                    type="button"
                    onClick={() => handleToggleActivo(emp)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${
                      emp.activo
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                        : 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
                    }`}
                    title="Alternar estado activo/inactivo"
                  >
                    {emp.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>

                {/* Credenciales de Acceso */}
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/5 space-y-2 text-xs">
                  {/* Número de Entrada */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 font-medium text-[11px] flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                      Número de Entrada:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-white text-sm bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
                        {emp.numero_entrada}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(emp.numero_entrada, `num-${emp.id}`)}
                        className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Copiar número de entrada"
                      >
                        {copiedKey === `num-${emp.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Contraseña / Clave */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 font-medium text-[11px] flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      Clave de Entrada:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-amber-300 bg-amber-950/50 px-2 py-0.5 rounded-lg border border-amber-500/30">
                        {isPasswordVisible ? emp.password_hash : '••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleTogglePassword(emp.id)}
                        className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title={isPasswordVisible ? 'Ocultar clave' : 'Ver clave'}
                      >
                        {isPasswordVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Auditoría: Cuándo se entra (Último Acceso e Historial) */}
                <div className="p-3 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-cyan-300 font-bold text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Cuándo se entra:</span>
                    </div>
                    <span className="text-[10px] text-cyan-200/80 font-mono font-bold">
                      {formatRelativeTime(lastAccess)}
                    </span>
                  </div>

                  <p className="text-[11px] font-mono text-slate-300 leading-tight">
                    {formatFechaHora(lastAccess)}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-cyan-500/10 text-[10px] text-slate-400">
                    <span>{emp.total_ingresos || 0} ingresos registrados</span>
                    <button
                      type="button"
                      onClick={() => setAuditEmpresa(emp)}
                      className="text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer flex items-center gap-1"
                    >
                      <History className="w-3 h-3" />
                      <span>Ver Historial ({historyCount})</span>
                    </button>
                  </div>
                </div>

                {/* Acciones Rápidas */}
                <div className="flex items-center gap-2 pt-1">
                  {/* Entrar como esta empresa (Impersonar) */}
                  <button
                    type="button"
                    onClick={() => impersonateEmpresa(emp)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 active:scale-98 transition-all cursor-pointer"
                    title={`Abrir panel operativo de ${emp.nombre}`}
                  >
                    <span>⚡ Entrar a esta Empresa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(emp)}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer"
                    title="Editar clave, número o datos"
                  >
                    <Edit3 className="w-4 h-4 text-cyan-400" />
                  </button>

                  {emp.id !== 'empresa-master-comikids' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteEmpresa(emp)}
                      className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                      title="Eliminar empresa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </main>

      {/* MODAL CREAR / EDITAR EMPRESA */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-emerald-500/40 p-6 sm:p-7 shadow-2xl shadow-emerald-950/50 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    {editingEmpresa ? 'Editar Cuenta de Empresa' : 'Crear Nueva Cuenta de Empresa'}
                  </h3>
                  <p className="text-xs text-slate-400">Asigna nombre, número y clave de entrada</p>
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

            <form onSubmit={handleSaveEmpresa} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nombre de la Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={formNombre}
                  onChange={e => setFormNombre(e.target.value)}
                  placeholder="Ej. Ropa Infantil Perú SAC"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                    Número de Entrada *
                  </label>
                  <input
                    type="text"
                    required
                    value={formNumero}
                    onChange={e => setFormNumero(e.target.value)}
                    placeholder="Ej. 987654321 o 071829"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono font-bold text-cyan-300 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Con este número ingresarán al sistema</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    Contraseña / Clave *
                  </label>
                  <input
                    type="text"
                    required
                    value={formPassword}
                    onChange={e => setFormPassword(e.target.value)}
                    placeholder="Ej. empresa2026"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono font-bold text-amber-300 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Clave para validar el acceso</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  WhatsApp Oficial de Pedidos (Opcional)
                </label>
                <input
                  type="text"
                  value={formTelefono}
                  onChange={e => setFormTelefono(e.target.value)}
                  placeholder="Ej. 51927781412"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkActivo"
                  checked={formActivo}
                  onChange={e => setFormActivo(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="chkActivo" className="text-xs font-bold text-slate-300 cursor-pointer select-none">
                  Empresa activa y habilitada para recibir pedidos y acceder
                </label>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

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
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs transition-all shadow-lg shadow-emerald-950/50 cursor-pointer"
                >
                  {editingEmpresa ? 'Guardar Cambios' : 'Crear Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL DE ACCESOS (VER CUÁNDO SE ENTRA) */}
      {auditEmpresa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border border-cyan-500/40 p-6 sm:p-7 shadow-2xl shadow-cyan-950/50 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    Historial de Inicios de Sesión
                  </h3>
                  <p className="text-xs text-slate-400">
                    Empresa: <strong className="text-cyan-300 font-bold">{auditEmpresa.nombre}</strong> ({auditEmpresa.numero_entrada})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuditEmpresa(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {auditEmpresa.historial_accesos && auditEmpresa.historial_accesos.length > 0 ? (
                auditEmpresa.historial_accesos.map(item => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
                      item.exitoso
                        ? 'bg-emerald-950/20 border-emerald-500/25 text-slate-200'
                        : 'bg-rose-950/20 border-rose-500/25 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.exitoso ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <span className="font-mono font-bold block">
                          {formatFechaHora(item.fecha)}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate max-w-xs sm:max-w-md">
                          {item.userAgent || 'Navegador Web'}
                        </span>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${
                      item.exitoso
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {item.exitoso ? 'Ingreso Exitoso' : 'Clave Incorrecta'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-slate-400 space-y-2">
                  <Clock className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-sm font-bold">No hay inicios de sesión registrados aún</p>
                  <p className="text-xs text-slate-500">Cada vez que ingresen con su clave aparecerá aquí</p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-white/10 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setAuditEmpresa(null)}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
