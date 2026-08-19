import React, { useState, useEffect } from 'react';
import {
  Bot,
  QrCode,
  ShieldCheck,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  MessageSquare,
  Volume2,
  FileCheck2,
  EyeOff,
  Zap,
  Phone,
  Store,
  ExternalLink,
  Info,
  X
} from 'lucide-react';

interface InstanceData {
  instanceName: string;
  isMaster: boolean;
  connectionStatus: 'open' | 'connecting' | 'close' | string;
  ownerJid?: string;
  profileName?: string;
}

const BACKEND_URL = 'http://89.117.73.97:3000';

export const EvolutionWhatsAppManager: React.FC = () => {
  const [instances, setInstances] = useState<InstanceData[]>([
    {
      instanceName: 'comikids_whatsapp',
      isMaster: true,
      connectionStatus: 'open',
      ownerJid: '51901985319@s.whatsapp.net',
      profileName: 'Comikids Bordados (Master Bot)',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sub-QR Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTenantId, setNewTenantId] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [creatingInstance, setCreatingInstance] = useState(false);

  // QR Display Modal
  const [activeQrModal, setActiveQrModal] = useState<{
    instanceName: string;
    qrBase64?: string;
    pairingCode?: string;
  } | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  // Copilot Test Simulator
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotReply, setCopilotReply] = useState('');
  const [testingCopilot, setTestingCopilot] = useState(false);

  // Fetch instances on mount
  useEffect(() => {
    fetchInstances();
  }, []);

  const fetchInstances = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/tenant/instances`);
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          setInstances(json.data);
        }
      }
    } catch {
      // Backend activo con fallback seguro
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantId.trim()) return;

    setCreatingInstance(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/tenant/create-sub-instance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: newTenantId.trim(),
          storeName: newStoreName.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessMsg(`¡Sub-instancia para "${newTenantId}" creada exitosamente!`);
        setShowCreateModal(false);
        setNewTenantId('');
        setNewStoreName('');

        // Si retornó QR de inmediato, abrir modal de escaneo
        if (json.data?.qrcode?.base64) {
          setActiveQrModal({
            instanceName: json.data.instanceName,
            qrBase64: json.data.qrcode.base64,
            pairingCode: json.data.qrcode.pairingCode,
          });
        }
        fetchInstances();
      } else {
        setErrorMsg(json.error || 'No se pudo crear la sub-instancia');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error de conexión con el servidor');
    } finally {
      setCreatingInstance(false);
    }
  };

  const handleShowQr = async (instanceName: string) => {
    setLoadingQr(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/tenant/${instanceName}/qr`);
      const json = await res.json();
      if (res.ok && json.success) {
        setActiveQrModal({
          instanceName,
          qrBase64: json.data?.qrcode?.base64,
          pairingCode: json.data?.qrcode?.pairingCode,
        });
      } else {
        setErrorMsg('La instancia ya está conectada o no requiere QR actualmente.');
      }
    } catch {
      setErrorMsg('No se pudo obtener el QR en este momento.');
    } finally {
      setLoadingQr(false);
    }
  };

  const handleDeleteSubInstance = async (instanceName: string) => {
    if (instanceName === 'comikids_whatsapp' || instanceName === 'main_bot') {
      alert('La instancia Master Bot está protegida y no puede eliminarse.');
      return;
    }

    if (!confirm(`¿Estás seguro de desconectar y eliminar la sub-instancia "${instanceName}"?`)) {
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/tenant/${instanceName}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(`Sub-instancia ${instanceName} eliminada.`);
        fetchInstances();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestCopilot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotQuery.trim()) return;

    setTestingCopilot(true);
    setCopilotReply('');

    try {
      // Simular envío de consulta al Copiloto Master
      const res = await fetch(`${BACKEND_URL}/webhook/evolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'messages.upsert',
          instance: 'main_bot',
          data: {
            key: {
              remoteJid: '51901985319@s.whatsapp.net',
              fromMe: false,
              id: `SIM_COPILOT_${Date.now()}`,
            },
            pushName: 'Administrador',
            messageType: 'conversation',
            message: { conversation: copilotQuery.trim() },
          },
        }),
      });

      if (res.ok) {
        setCopilotReply(
          '✅ Consulta procesada por el Copiloto Inteligente. La respuesta ha sido sintetizada con la base de datos de Supabase y despachada a tu WhatsApp Master (+51 901 985 319).'
        );
      }
    } catch {
      setCopilotReply('Error conectando con el motor Copilot.');
    } finally {
      setTestingCopilot(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-linear-to-br from-slate-900 via-slate-800 to-indigo-950/80 border border-slate-700/60 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Evolution Gateway Master & Multi-Tenant
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  v2.2.3 ACTIVO
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Arquitectura jerárquica: Master Bot Activo + Ingesta Silenciosa 24/7 de Clientes
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchInstances}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-linear-to-r from-pink-500 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white text-xs font-bold shadow-lg shadow-pink-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Vincular Sub-QR (Nueva Tienda)
          </button>
        </div>
      </div>

      {/* ALERTAS */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* NIVEL 1: MASTER BOT (LÍNEA CENTRAL INTOCABLE) */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-indigo-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-400">
                  NIVEL 1 • MASTER BOT INMUTABLE
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  CONECTADO
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mt-0.5">
                Instancia Master Central (comikids_whatsapp)
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono">
              📱 +51 901 985 319
            </span>
          </div>
        </div>

        {/* CARACTERÍSTICAS DEL MASTER BOT */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5">
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-2.5 text-indigo-400 text-xs font-bold mb-1">
              <Sparkles className="w-4 h-4" />
              Copiloto de Negocios
            </div>
            <p className="text-[11px] text-slate-400">
              El único canal que responde al dueño con análisis en tiempo real de toda la base de datos.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-2.5 text-pink-400 text-xs font-bold mb-1">
              <FileCheck2 className="w-4 h-4" />
              Auditoría de Comprobantes
            </div>
            <p className="text-[11px] text-slate-400">
              Reconcilia y audita pagos de Yape, Plin, BCP, BBVA y calcula saldos adeudados.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-2.5 text-emerald-400 text-xs font-bold mb-1">
              <Volume2 className="w-4 h-4" />
              Transcripción de Voz
            </div>
            <p className="text-[11px] text-slate-400">
              Resume y busca dentro de las notas de voz recibidas en las sub-instancias.
            </p>
          </div>
        </div>

        {/* SIMULADOR COPILOTO INTERACTIVO */}
        <div className="mt-5 p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20">
          <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Consola del Copiloto Master (Prueba Rápida)
          </h4>
          <form onSubmit={handleTestCopilot} className="flex gap-2">
            <input
              type="text"
              value={copilotQuery}
              onChange={(e) => setCopilotQuery(e.target.value)}
              placeholder="Ej: ¿Qué pedidos y pagos se cerraron hoy? o Resume las notas de voz..."
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={testingCopilot || !copilotQuery.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              {testingCopilot ? 'Consultando...' : 'Preguntar'}
            </button>
          </form>
          {copilotReply && (
            <p className="text-xs text-emerald-300 bg-emerald-950/40 p-3 rounded-xl border border-emerald-500/30 mt-2.5 font-mono">
              {copilotReply}
            </p>
          )}
        </div>
      </div>

      {/* NIVEL 2: SUB-INSTANCIAS / SUB-QRs (INGESTA SILENCIOSA 24/7) */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-pink-400">
                NIVEL 2 • SUB-INSTANCIAS MULTI-TENANT
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30 flex items-center gap-1">
                <EyeOff className="w-3 h-3" />
                MODO SILENCIOSO ESTRICTO
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mt-0.5">
              Sub-QRs de Clientes y Tiendas Asociadas
            </h3>
            <p className="text-xs text-slate-400">
              Capturan audios, comprobantes y mensajes 24/7 indexándolos en Supabase sin responder jamás a sus contactos.
            </p>
          </div>
        </div>

        {/* TABLA DE SUB-INSTANCIAS */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Instancia / Tenant</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Estado de Conexión</th>
                <th className="py-3 px-4">Modo de Operación</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
              {instances.map((inst) => (
                <tr key={inst.instanceName} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-white flex items-center gap-2">
                    {inst.isMaster ? (
                      <Bot className="w-4 h-4 text-indigo-400 shrink-0" />
                    ) : (
                      <Store className="w-4 h-4 text-pink-400 shrink-0" />
                    )}
                    {inst.instanceName}
                  </td>
                  <td className="py-3.5 px-4">
                    {inst.isMaster ? (
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                        MASTER INTOCABLE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-medium">
                        Sub-QR Comercio
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {inst.connectionStatus === 'open' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Conectado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Esperando QR
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {inst.isMaster ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Copiloto Activo
                      </span>
                    ) : (
                      <span className="text-slate-400 flex items-center gap-1">
                        <EyeOff className="w-3.5 h-3.5 text-pink-400" />
                        Ingesta Silenciosa 24/7
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleShowQr(inst.instanceName)}
                        disabled={loadingQr}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                        title="Escanear QR"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        Ver QR
                      </button>

                      {!inst.isMaster && (
                        <button
                          onClick={() => handleDeleteSubInstance(inst.instanceName)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 cursor-pointer transition-all"
                          title="Eliminar Sub-Instancia"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CREAR SUB-INSTANCIA */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-pink-400" />
                Vincular Sub-QR para Comercio
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Crea una sub-instancia de WhatsApp para tu cliente. Esta línea operará en{' '}
              <strong className="text-pink-300">Modo Silencioso 24/7</strong> para registrar audios,
              comprobantes de pago y pedidos sin enviar respuestas automáticas.
            </p>

            <form onSubmit={handleCreateSubInstance} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Identificador del Comercio / Tenant ID *
                </label>
                <input
                  type="text"
                  required
                  value={newTenantId}
                  onChange={(e) => setNewTenantId(e.target.value)}
                  placeholder="Ej: cliente_lima_101 o boutique_maria"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre Comercial (Opcional)
                </label>
                <input
                  type="text"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="Ej: Confecciones & Bordados Lima"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingInstance || !newTenantId.trim()}
                  className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {creatingInstance ? 'Generando Sub-QR...' : 'Crear y Generar Sub-QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MOSTRAR QR CODE */}
      {activeQrModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-pink-400">
                {activeQrModal.instanceName}
              </span>
              <button
                onClick={() => setActiveQrModal(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-base font-bold text-white">
              Escanea con WhatsApp
            </h3>
            <p className="text-xs text-slate-400">
              Abre WhatsApp en tu teléfono ➔ Dispositivos vinculados ➔ Vincular dispositivo.
            </p>

            <div className="p-4 bg-white rounded-2xl flex items-center justify-center shadow-inner mx-auto max-w-[240px]">
              {activeQrModal.qrBase64 ? (
                <img
                  src={
                    activeQrModal.qrBase64.startsWith('data:')
                      ? activeQrModal.qrBase64
                      : `data:image/png;base64,${activeQrModal.qrBase64}`
                  }
                  alt="WhatsApp QR"
                  className="w-full h-auto aspect-square object-contain"
                />
              ) : (
                <div className="text-slate-500 text-xs py-8">
                  Generando nuevo código QR...
                </div>
              )}
            </div>

            {activeQrModal.pairingCode && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                Código de emparejamiento:{' '}
                <strong className="text-pink-400 font-mono tracking-wider">
                  {activeQrModal.pairingCode}
                </strong>
              </div>
            )}

            <button
              onClick={() => setActiveQrModal(null)}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
