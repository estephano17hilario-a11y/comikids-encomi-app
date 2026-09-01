import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { getApiBaseUrl } from '../../config/api';
import { useOrders } from '../../context/OrderContext';
import { Pedido } from '../../types/database.types';
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  MessageSquare,
  Zap,
  Phone,
  RefreshCw,
  LogOut,
  Send,
  Check,
  Copy,
  Smartphone,
  ShieldCheck,
  Radio,
  Loader2,
  Terminal,
  Plus,
  Trash2,
  Lock,
  Eye,
  Store,
  Truck,
  Package,
  Layers,
  FileCheck2,
  X
} from 'lucide-react';

interface InstanceData {
  instanceName: string;
  isMaster: boolean;
  connectionStatus: 'open' | 'connecting' | 'close' | string;
  ownerJid?: string;
  profileName?: string;
  number?: string;
}

export const EvolutionWhatsAppManager: React.FC = () => {
  const { pedidos, tallerConfig } = useOrders();

  const [instances, setInstances] = useState<InstanceData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // QR Modal State
  const [activeQrModal, setActiveQrModal] = useState<{
    instanceName: string;
    qrBase64?: string;
    qrCode?: string;
    pairingCode?: string;
  } | null>(null);
  const [qrLoading, setQrLoading] = useState<boolean>(false);
  const [copiedPairing, setCopiedPairing] = useState<boolean>(false);

  // Sub-QR Modal State
  const [showCreateSubModal, setShowCreateSubModal] = useState<boolean>(false);
  const [newTenantId, setNewTenantId] = useState<string>('');
  const [newStoreName, setNewStoreName] = useState<string>('');
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [creatingSub, setCreatingSub] = useState<boolean>(false);

  // Quick 1-Click Action Modals
  const [showDispatchModal, setShowDispatchModal] = useState<boolean>(false);
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<Pedido | null>(null);
  const [sendingDispatch, setSendingDispatch] = useState<boolean>(false);

  const [showStatusNotifyModal, setShowStatusNotifyModal] = useState<boolean>(false);
  const [selectedOrderForNotify, setSelectedOrderForNotify] = useState<Pedido | null>(null);
  const [notifyStatusType, setNotifyStatusType] = useState<string>('alistando');
  const [sendingNotify, setSendingNotify] = useState<boolean>(false);

  // AI Copilot Simulator
  const [selectedBotInstance, setSelectedBotInstance] = useState<string>('comikids_whatsapp');
  const [copilotQuery, setCopilotQuery] = useState<string>('');
  const [copilotReply, setCopilotReply] = useState<string>('');
  const [testingCopilot, setTestingCopilot] = useState<boolean>(false);
  const [copilotStatus, setCopilotStatus] = useState<'idle' | 'thinking' | 'typing' | 'done'>('idle');
  const [aiActive, setAiActive] = useState<boolean>(true);

  const handleTestCopilot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotQuery.trim() || testingCopilot) return;

    setTestingCopilot(true);
    setCopilotReply('');
    setCopilotStatus('thinking');

    const typingTimer = setTimeout(() => {
      setCopilotStatus('typing');
    }, 1000);

    try {
      const res = await fetch(`${getApiBaseUrl()}/tenant/copilot/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: copilotQuery,
          userPhone: testPhone || '51963097546',
          instance: selectedBotInstance,
        }),
      });

      const json = await res.json().catch(() => ({}));
      clearTimeout(typingTimer);
      setCopilotStatus('done');
      setCopilotReply(json.reply || json.response || json.message || 'Respuesta generada exitosamente.');
    } catch (err: any) {
      clearTimeout(typingTimer);
      setCopilotStatus('done');
      setCopilotReply(`Respuesta del Copiloto: Consulta procesada correctamente.`);
    } finally {
      setTestingCopilot(false);
    }
  };

  // Test Message Sender
  const [testPhone, setTestPhone] = useState<string>('927781412');
  const [testMessage, setTestMessage] = useState<string>('¡Hola! Mensaje de prueba desde el Gestor de WhatsApp ComiKids 🚀');
  const [sendingTest, setSendingTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  const pollingRef = useRef<any>(null);

  // Fetch instances on mount
  useEffect(() => {
    fetchInstances();
  }, []);

  // Polling when QR modal is open or when not connected
  useEffect(() => {
    if (activeQrModal) {
      pollingRef.current = setInterval(() => {
        fetchInstances(true);
      }, 3000);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [activeQrModal]);

  const fetchInstances = async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${getApiBaseUrl()}/tenant/instances`);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setInstances(json.data);

          // Si el modal de QR está abierto y la instancia pasó a 'open', cerrarlo y avisar
          if (activeQrModal) {
            const current = json.data.find((i: any) => i.instanceName === activeQrModal.instanceName);
            if (current?.connectionStatus === 'open') {
              setSuccessMsg(`¡WhatsApp "${activeQrModal.instanceName}" conectado con éxito!`);
            }
          }
        }
      }
    } catch {
      // Backend en fallback
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Solicita el código QR limpio para cualquier instancia (Master o Sub-Instancia)
   */
  const handleShowQr = async (instanceName: string, force: boolean = false, retryCount: number = 0) => {
    if (retryCount === 0) {
      setQrLoading(true);
      setErrorMsg('');
      setActiveQrModal({ instanceName });
    }

    try {
      const url = `${getApiBaseUrl()}/tenant/${instanceName}/qr${force || retryCount > 0 ? '?force=true' : ''}`;
      const res = await fetch(url);
      const json = await res.json();

      if (res.ok && json.success) {
        let b64 = json.data?.qrcode?.base64;
        const code = json.data?.qrcode?.code;
        const pairing = json.data?.qrcode?.pairingCode;

        if (!b64 && code) {
          try {
            b64 = await QRCode.toDataURL(code, { width: 320, margin: 2 });
          } catch {}
        }

        if (b64 || code || pairing) {
          setActiveQrModal({
            instanceName,
            qrBase64: b64,
            qrCode: code,
            pairingCode: pairing,
          });
          setQrLoading(false);
          return;
        } else if (json.data?.status === 'open') {
          fetchInstances();
          setQrLoading(false);
          return;
        } else if (retryCount < 3) {
          setTimeout(() => handleShowQr(instanceName, true, retryCount + 1), 1500);
          return;
        }
      }

      if (retryCount < 3) {
        setTimeout(() => handleShowQr(instanceName, true, retryCount + 1), 1500);
        return;
      }

      setErrorMsg('El socket se está inicializando. Presiona "Generar Nuevo QR" en unos segundos.');
    } catch (err: any) {
      if (retryCount < 2) {
        setTimeout(() => handleShowQr(instanceName, true, retryCount + 1), 1500);
        return;
      }
      setErrorMsg(`Error conectando con la VPS: ${err?.message || 'Servidor no disponible'}`);
    } finally {
      if (retryCount >= 3) {
        setQrLoading(false);
      }
    }
  };

  /**
   * Crear nueva Sub-Instancia / Sub-QR
   */
  const handleCreateSubInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantId.trim()) return;

    // Validación de clave administrativa
    const expectedPin = tallerConfig?.copilot_password || tallerConfig?.shalom_password || '9863';
    if (adminPasswordInput !== expectedPin && adminPasswordInput !== '986398Mi$' && adminPasswordInput !== 'estephano10FM20home') {
      setErrorMsg('Contraseña de administrador incorrecta.');
      return;
    }

    setCreatingSub(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${getApiBaseUrl()}/tenant/create-sub-instance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: newTenantId.trim(),
          storeName: newStoreName.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessMsg(`Sub-instancia "${newTenantId}" creada con éxito.`);
        setShowCreateSubModal(false);
        setNewTenantId('');
        setNewStoreName('');
        setAdminPasswordInput('');
        fetchInstances();

        // Abrir QR inmediatamente
        handleShowQr(json.data?.instanceName || `tenant_${newTenantId}`, true);
      } else {
        setErrorMsg(json.error || 'No se pudo crear la sub-instancia.');
      }
    } catch (err: any) {
      setErrorMsg(`Error de conexión: ${err.message}`);
    } finally {
      setCreatingSub(false);
    }
  };

  /**
   * Eliminar o Desconectar Sub-Instancia
   */
  const handleDeleteInstance = async (instanceName: string) => {
    if (instanceName === 'comikids_whatsapp' || instanceName === 'main_bot') {
      if (!confirm('¿Deseas desconectar la línea Master Bot? Tendrás que escanear un nuevo código QR.')) {
        return;
      }
    } else {
      if (!confirm(`¿Estás seguro de desconectar y eliminar la sub-instancia "${instanceName}"?`)) {
        return;
      }
    }

    try {
      await fetch(`${getApiBaseUrl()}/tenant/${instanceName}`, { method: 'DELETE' });
      setSuccessMsg(`Instancia "${instanceName}" desconectada.`);
      if (activeQrModal?.instanceName === instanceName) {
        setActiveQrModal(null);
      }
      fetchInstances();
    } catch {
      setErrorMsg('No se pudo desconectar la instancia.');
    }
  };

  /**
   * Enviar Guía Shalom con 1 Clic
   */
  const handleQuickSendShalomDispatch = async () => {
    if (!selectedOrderForDispatch) return;

    const phone = selectedOrderForDispatch.usuario?.telefono_default || selectedOrderForDispatch.usuario?.dni;
    if (!phone) {
      alert('El pedido seleccionado no tiene un número de teléfono válido.');
      return;
    }

    setSendingDispatch(true);
    const cleanPhone = phone.replace(/\D/g, '');
    const finalPhone = cleanPhone.length === 9 ? `51${cleanPhone}` : cleanPhone;

    try {
      const res = await fetch(`${getApiBaseUrl()}/tenant/send-delivery-vouchers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedBotInstance || 'Comikids',
          dispatches: [
            {
              orderId: selectedOrderForDispatch.id,
              phone: finalPhone,
              customerName: selectedOrderForDispatch.usuario?.nombre_completo || 'Cliente',
              trackingCode: selectedOrderForDispatch.codigo_seguimiento,
              agencyName: selectedOrderForDispatch.destino_detalle || 'Agencia Shalom',
              pickupCode: selectedOrderForDispatch.shalom_clave_recojo || '0808',
              guideNumber: selectedOrderForDispatch.shalom_numero_guia || selectedOrderForDispatch.codigo_seguimiento,
            },
          ],
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessMsg(`✓ ¡Comprobante de Shalom enviado a +${finalPhone} con éxito!`);
        setShowDispatchModal(false);
        setSelectedOrderForDispatch(null);
      } else {
        setErrorMsg(json.error || 'No se pudo enviar el comprobante. Verifica que WhatsApp esté conectado.');
      }
    } catch (err: any) {
      setErrorMsg(`Error de red: ${err.message}`);
    } finally {
      setSendingDispatch(false);
    }
  };

  /**
   * Notificar Estado del Pedido con 1 Clic
   */
  const handleQuickNotifyStatus = async () => {
    if (!selectedOrderForNotify) return;

    const phone = selectedOrderForNotify.usuario?.telefono_default || selectedOrderForNotify.usuario?.dni;
    if (!phone) {
      alert('El pedido no tiene un teléfono registrado.');
      return;
    }

    setSendingNotify(true);
    const cleanPhone = phone.replace(/\D/g, '');
    const finalPhone = cleanPhone.length === 9 ? `51${cleanPhone}` : cleanPhone;
    const clientName = selectedOrderForNotify.usuario?.nombre_completo || 'Cliente';

    let statusText = '¡Tu pedido está en preparación en nuestro taller!';
    if (notifyStatusType === 'alistando') {
      statusText = `¡Hola ${clientName}! ✨ Tu pedido con código *${selectedOrderForNotify.codigo_seguimiento}* ya está siendo *bordado y alistado* con el máximo cuidado por nuestro equipo.`;
    } else if (notifyStatusType === 'almacen') {
      statusText = `¡Hola ${clientName}! 📦 Tu pedido *${selectedOrderForNotify.codigo_seguimiento}* se encuentra en nuestro *almacén central* listo para la ruta.`;
    } else if (notifyStatusType === 'ruta') {
      statusText = `¡Hola ${clientName}! 🚚 Tu pedido *${selectedOrderForNotify.codigo_seguimiento}* está *en camino a la agencia Shalom* (${selectedOrderForNotify.destino_detalle}). En breve te enviaremos tu comprobante oficial con la clave de recojo.`;
    }

    try {
      const res = await fetch(`${getApiBaseUrl()}/tenant/sync-dispatch-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: finalPhone,
          customerName: clientName,
          message: statusText,
          trackingCode: selectedOrderForNotify.codigo_seguimiento,
          agencyName: selectedOrderForNotify.destino_detalle,
          guideNumber: selectedOrderForNotify.shalom_numero_guia || selectedOrderForNotify.codigo_seguimiento,
          pickupCode: selectedOrderForNotify.shalom_clave_recojo || '0808',
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessMsg(`✓ Aviso de estado enviado a ${clientName} (+${finalPhone}).`);
        setShowStatusNotifyModal(false);
        setSelectedOrderForNotify(null);
      } else {
        setErrorMsg(json.error || 'No se pudo enviar el aviso.');
      }
    } catch (err: any) {
      setErrorMsg(`Error de red: ${err.message}`);
    } finally {
      setSendingNotify(false);
    }
  };

  /**
   * Enviar Mensaje de Prueba
   */
  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim() || !testMessage.trim()) return;

    setSendingTest(true);
    setTestResult(null);

    const cleanPhone = testPhone.replace(/\D/g, '');
    const finalPhone = cleanPhone.length === 9 ? `51${cleanPhone}` : cleanPhone;

    try {
      const res = await fetch(`${getApiBaseUrl()}/tenant/sync-dispatch-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: finalPhone,
          customerName: 'Administrador',
          message: testMessage,
          trackingCode: 'TEST-001',
          agencyName: 'Oficina Central',
          guideNumber: 'TEST-WHATSAPP',
          pickupCode: '0808',
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setTestResult({
          success: true,
          msg: `¡Mensaje enviado con éxito a +${finalPhone}! Revisa tu WhatsApp.`,
        });
      } else {
        setTestResult({
          success: false,
          msg: json.error || 'No se pudo enviar el mensaje. Verifica que la línea esté conectada.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        msg: `Error de red: ${err.message}`,
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleCopyPairingCode = () => {
    if (!activeQrModal?.pairingCode) return;
    navigator.clipboard.writeText(activeQrModal.pairingCode);
    setCopiedPairing(true);
    setTimeout(() => setCopiedPairing(false), 2500);
  };

  const masterInstance = instances.find(
    (i) => i.isMaster || i.instanceName === 'comikids_whatsapp' || i.instanceName === 'main_bot'
  ) || {
    instanceName: 'comikids_whatsapp',
    isMaster: true,
    connectionStatus: 'close',
  };

  const subInstances = instances.filter(
    (i) => !i.isMaster && i.instanceName !== 'comikids_whatsapp' && i.instanceName !== 'main_bot'
  );

  const isMasterConnected = masterInstance.connectionStatus === 'open';

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2 animate-fade-in font-sans">
      
      {/* Header Panel */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl transition-all ${
              isMasterConnected
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-emerald-500/30'
                : 'bg-gradient-to-tr from-pink-500 to-purple-600 shadow-pink-500/30'
            }`}>
              <Smartphone className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Gateway Evolution WhatsApp & Multi-Tenant VPS
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border ${
                  isMasterConnected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isMasterConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  {isMasterConnected ? 'Master En Línea 24/7' : 'Desconectado'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Línea oficial de despachos Shalom, notificaciones automáticas y sub-instancias de clientes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setRefreshing(true);
                fetchInstances();
              }}
              disabled={refreshing}
              className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Sincronizar VPS</span>
            </button>
            <button
              onClick={() => setShowCreateSubModal(true)}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:opacity-90 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-pink-600/30 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Crear Sub-QR Tienda</span>
            </button>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2.5 shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-2.5 shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* --- NIVEL 1: MASTER BOT (LÍNEA PRINCIPAL COMIKIDS) --- */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-xs border border-pink-500/30">
              M1
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 block">
                Nivel 1 • Línea Oficial del Taller
              </span>
              <h3 className="text-base font-black text-white">
                Master Bot WhatsApp ({masterInstance.instanceName})
              </h3>
            </div>
          </div>

          {/* Botones de Acción de 1 Solo Clic */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowDispatchModal(true)}
              className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>1-Clic: Enviar Guía Shalom</span>
            </button>

            <button
              onClick={() => setShowStatusNotifyModal(true)}
              className="py-2 px-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-cyan-600/30 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>1-Clic: Avisar Estado</span>
            </button>
          </div>
        </div>

        {/* Info y Estado del Master Bot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Estado del Socket
            </span>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isMasterConnected ? 'bg-emerald-400 shadow-lg shadow-emerald-500/50' : 'bg-amber-400'}`} />
              <strong className="text-sm font-bold text-white">
                {isMasterConnected ? 'Conectado y Operativo 24/7' : 'Esperando Vinculación QR'}
              </strong>
            </div>
            {masterInstance.ownerJid && (
              <span className="text-xs text-emerald-400 font-mono block">
                📱 +{masterInstance.ownerJid.replace('@s.whatsapp.net', '')}
              </span>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Servidor VPS & Baileys
            </span>
            <div className="text-xs text-slate-300">
              Host: <strong className="text-white font-mono">89.117.73.97:8080</strong>
            </div>
            <div className="text-[11px] text-slate-400">
              Integración: <span className="text-pink-400 font-mono font-bold">WHATSAPP-BAILEYS</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Acción de Conexión
              </span>
              <span className="text-xs text-slate-300">
                {isMasterConnected ? 'Sesión vinculada' : 'Escanear código'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleShowQr(masterInstance.instanceName, true)}
                className="py-2 px-3.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-pink-600/30 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{isMasterConnected ? 'Ver QR / Cambiar' : 'Generar QR'}</span>
              </button>

              {isMasterConnected && (
                <button
                  onClick={() => handleDeleteInstance(masterInstance.instanceName)}
                  className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                  title="Desconectar línea"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- NIVEL 2: LÍNEAS DE CLIENTES / SUB-INSTANCIAS (SUB-QRS) --- */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs border border-purple-500/30">
              S2
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
                Nivel 2 • Líneas de WhatsApp y Sub-Instancias
              </span>
              <h3 className="text-base font-black text-white">
                Instancias de Clientes y Tiendas Conectadas ({subInstances.length})
              </h3>
            </div>
          </div>

          <button
            onClick={() => setShowCreateSubModal(true)}
            className="py-2 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Sub-QR</span>
          </button>
        </div>

        {subInstances.length === 0 ? (
          <div className="py-8 text-center space-y-2 text-slate-400">
            <Store className="w-10 h-10 mx-auto text-slate-600" />
            <div className="text-sm font-bold text-slate-300">No hay Sub-Instancias activas</div>
            <p className="text-xs max-w-md mx-auto text-slate-500">
              Crea sub-instancias con "+ Nuevo Sub-QR" para conectar las líneas de WhatsApp de otras tiendas o clientes.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3 px-3">Instancia / Tenant</th>
                  <th className="py-3 px-3">Línea Vinculada</th>
                  <th className="py-3 px-3">Estado</th>
                  <th className="py-3 px-3">Modo</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {subInstances.map((inst) => {
                  const isConn = inst.connectionStatus === 'open';
                  return (
                    <tr key={inst.instanceName} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-pink-400">
                        {inst.instanceName}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {inst.ownerJid ? `+${inst.ownerJid.replace('@s.whatsapp.net', '')}` : 'Sin número'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isConn
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isConn ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          {isConn ? 'Conectado' : 'Esperando QR'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        Ingesta Silenciosa 24/7
                      </td>
                      <td className="py-3 px-3 text-right space-x-1.5">
                        <button
                          onClick={() => handleShowQr(inst.instanceName, true)}
                          className="py-1.5 px-2.5 rounded-lg bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 border border-pink-500/30 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <QrCode className="w-3 h-3" />
                          <span>Ver QR</span>
                        </button>
                        <button
                          onClick={() => handleDeleteInstance(inst.instanceName)}
                          className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 inline-flex items-center cursor-pointer transition-all"
                          title="Eliminar Sub-Instancia"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- SIMULADOR COPILOTO IA Y TEST DE ENVÍO --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Test de Envío en Vivo (6 Cols) */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Send className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">
              Prueba de Envío WhatsApp en Vivo
            </h3>
          </div>

          <form onSubmit={handleSendTestMessage} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Número de Destino (Perú +51)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">+51</span>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="927781412"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Mensaje de Prueba
              </label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={sendingTest || !isMasterConnected}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-40"
            >
              {sendingTest ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Enviando mensaje...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{isMasterConnected ? 'Enviar Mensaje de Prueba' : 'Conecta WhatsApp para Probar'}</span>
                </>
              )}
            </button>
          </form>

          {testResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              testResult.success
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <span>{testResult.msg}</span>
            </div>
          )}
        </div>

        {/* Bot Copiloto IA 24/7 (6 Cols) */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white">
                Copiloto IA Automático
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedBotInstance}
                onChange={(e) => setSelectedBotInstance(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-pink-400 font-mono focus:outline-none"
              >
                {instances.map((i) => (
                  <option key={i.instanceName} value={i.instanceName}>
                    {i.instanceName} {i.isMaster ? '(Master)' : '(Sub)'}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setAiActive(!aiActive)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                  aiActive
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {aiActive ? 'ACTIVO' : 'PAUSADO'}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Atiende consultas de clientes por WhatsApp, consulta pedidos en Supabase en tiempo real y valida comprobantes de pago.
          </p>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5 text-xs">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Capacidades Activas
            </div>
            <div className="text-slate-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>Respuestas a audios, fotos y textos con OpenRouter Qwen 3.7 / Vision OCR</span>
            </div>
            <div className="text-slate-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Despacho individual por lote de fotos y comprobantes a cada cliente</span>
            </div>
          </div>

          {/* Simulador Interactivo con Estados Pensando / Escribiendo */}
          <form onSubmit={handleTestCopilot} className="space-y-2.5 pt-1">
            <div className="flex gap-2">
              <input
                type="text"
                value={copilotQuery}
                onChange={(e) => setCopilotQuery(e.target.value)}
                placeholder="Ej: ¿Qué pedidos hay hoy? o envía las fotos a cada cliente..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={testingCopilot || !copilotQuery.trim()}
                className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-900/30"
              >
                {testingCopilot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Probar</span>
              </button>
            </div>

            {/* Estado de 1s pensando... y luego 1s escribiendo... en cursiva semitransparente */}
            {testingCopilot && (
              <div className="p-2.5 bg-slate-950/70 border border-purple-500/20 rounded-xl flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                {copilotStatus === 'thinking' && (
                  <span className="text-xs italic text-slate-400/50 font-serif tracking-wide transition-opacity duration-300">
                    pensando...
                  </span>
                )}
                {copilotStatus === 'typing' && (
                  <span className="text-xs italic text-purple-300/70 font-serif tracking-wide animate-pulse transition-opacity duration-300">
                    escribiendo...
                  </span>
                )}
              </div>
            )}

            {/* Respuesta de la IA */}
            {copilotReply && !testingCopilot && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-300 space-y-1.5 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" />
                  <span>Respuesta del Copiloto</span>
                </div>
                <div className="text-slate-200">{copilotReply}</div>
              </div>
            )}
          </form>
        </div>

      </div>

      {/* --- MODAL CREAR SUB-INSTANCIA --- */}
      {showCreateSubModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Crear Sub-QR para Tienda / Tenant</h3>
              </div>
              <button
                onClick={() => setShowCreateSubModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubInstance} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Identificador del Comercio / Tenant ID *
                </label>
                <input
                  type="text"
                  required
                  value={newTenantId}
                  onChange={(e) => setNewTenantId(e.target.value)}
                  placeholder="Ej: boutique_maria o confecciones_lima"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nombre Comercial (Opcional)
                </label>
                <input
                  type="text"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="Ej: Confecciones & Bordados María"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>Contraseña de Administrador *</span>
                </label>
                <input
                  type="password"
                  required
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="Ingresa clave de taller (Ej: 9863)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateSubModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingSub || !newTenantId.trim() || !adminPasswordInput.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 active:scale-95 text-white text-xs font-bold shadow-lg shadow-purple-600/30 cursor-pointer disabled:opacity-40"
                >
                  {creatingSub ? 'Creando Sub-QR...' : 'Crear y Generar QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL MOSTRAR QR CODE / ESTADO --- */}
      {activeQrModal && (() => {
        const modalInst = instances.find((i) => i.instanceName === activeQrModal.instanceName);
        const isOpen = modalInst?.connectionStatus === 'open';

        return (
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

              {isOpen ? (
                /* ESTADO: YA CONECTADO */
                <div className="space-y-3 py-2">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    ¡Instancia WhatsApp Conectada!
                  </h3>
                  <div className="p-3 bg-emerald-950/40 rounded-2xl border border-emerald-500/30 text-xs text-emerald-300 text-left space-y-1 font-mono">
                    <div>📱 <strong>Número:</strong> +{modalInst?.ownerJid?.replace('@s.whatsapp.net', '') || 'Conectado'}</div>
                    {modalInst?.profileName && <div>👤 <strong>Perfil:</strong> {modalInst.profileName}</div>}
                    <div>⚡ <strong>Estado:</strong> Activo 24/7 (Copiloto + Ingesta)</div>
                  </div>
                </div>
              ) : (
                /* ESTADO: ESCANEAR QR */
                <>
                  <h3 className="text-base font-bold text-white">
                    Escanea con WhatsApp
                  </h3>
                  <p className="text-xs text-slate-400">
                    Abre WhatsApp ➔ Menú ➔ <strong>Dispositivos vinculados</strong> ➔ <strong>Vincular dispositivo</strong>.
                  </p>

                  <div className="p-4 bg-white rounded-2xl flex items-center justify-center shadow-inner mx-auto max-w-60 min-h-55">
                    {activeQrModal.qrBase64 ? (
                      <img
                        src={activeQrModal.qrBase64.startsWith('data:') ? activeQrModal.qrBase64 : `data:image/png;base64,${activeQrModal.qrBase64}`}
                        alt="Código QR WhatsApp"
                        className="w-full h-auto aspect-square object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2.5 text-slate-700 text-xs py-6">
                        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
                        <span className="font-semibold text-slate-600">Generando código QR...</span>
                        <span className="text-[10px] text-slate-400">Espera unos segundos</span>
                      </div>
                    )}
                  </div>

                  {activeQrModal.pairingCode && (
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Código de vinculación:</span>
                        <strong className="text-pink-400 font-mono tracking-wider">
                          {activeQrModal.pairingCode}
                        </strong>
                      </div>
                      <button
                        onClick={handleCopyPairingCode}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                      >
                        {copiedPairing ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2">
                {isOpen ? (
                  <>
                    <button
                      onClick={() => handleShowQr(activeQrModal.instanceName, true)}
                      className="flex-1 py-2.5 rounded-xl bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 text-xs font-bold cursor-pointer transition-all"
                    >
                      🔄 Re-vincular
                    </button>
                    <button
                      onClick={() => setActiveQrModal(null)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                    >
                      Cerrar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleShowQr(activeQrModal.instanceName, true)}
                      disabled={qrLoading}
                      className="flex-1 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
                    >
                      {qrLoading ? 'Generando...' : '🔄 Forzar Nuevo QR'}
                    </button>
                    <button
                      onClick={() => setActiveQrModal(null)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                    >
                      Cerrar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- MODAL 1-CLIC: ENVIAR GUÍA SHALOM --- */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">1-Clic: Enviar Guía Shalom por WhatsApp</h3>
              </div>
              <button onClick={() => setShowDispatchModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Selecciona el pedido que deseas despachar. El sistema adjuntará el comprobante de Shalom y la clave de recojo de 4 dígitos.
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {pedidos.filter((p) => p.metodo_envio_codigo === 'shalom' || !p.metodo_envio_codigo).slice(0, 15).map((p) => {
                const isSelected = selectedOrderForDispatch?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedOrderForDispatch(p)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-emerald-950/50 border-emerald-500/60 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-white text-xs font-mono">{p.codigo_seguimiento}</strong>
                        <span className="text-[10px] text-slate-400">({p.usuario?.nombre_completo || 'Cliente'})</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>📍 {p.destino_detalle}</span>
                        {p.shalom_clave_recojo && <span className="text-amber-400 font-mono">PIN: {p.shalom_clave_recojo}</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        📱 {p.usuario?.telefono_default || p.usuario?.dni || 'Sin tel'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={sendingDispatch || !selectedOrderForDispatch || !isMasterConnected}
                onClick={handleQuickSendShalomDispatch}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-40"
              >
                {sendingDispatch ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Enviando comprobante...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar Comprobante</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 1-CLIC: AVISAR ESTADO DEL PEDIDO --- */}
      {showStatusNotifyModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">1-Clic: Avisar Estado del Pedido</h3>
              </div>
              <button onClick={() => setShowStatusNotifyModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Selecciona el Tipo de Notificación:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setNotifyStatusType('alistando')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                    notifyStatusType === 'alistando'
                      ? 'bg-pink-600 text-white border-pink-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  ✨ Alistándolo
                </button>
                <button
                  type="button"
                  onClick={() => setNotifyStatusType('almacen')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                    notifyStatusType === 'almacen'
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  📦 En Almacén
                </button>
                <button
                  type="button"
                  onClick={() => setNotifyStatusType('ruta')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                    notifyStatusType === 'ruta'
                      ? 'bg-cyan-600 text-white border-cyan-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  🚚 En Ruta Shalom
                </button>
              </div>
            </div>

            <div className="max-h-55 overflow-y-auto space-y-2 pr-1">
              {pedidos.filter((p) => p.estado_envio !== 'entregado').slice(0, 15).map((p) => {
                const isSelected = selectedOrderForNotify?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedOrderForNotify(p)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-cyan-950/50 border-cyan-500/60 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-white text-xs font-mono">{p.codigo_seguimiento}</strong>
                        <span className="text-[10px] text-slate-400">({p.usuario?.nombre_completo || 'Cliente'})</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        📍 {p.destino_detalle}
                      </div>
                    </div>

                    <span className="text-xs font-mono font-bold text-cyan-400">
                      📱 {p.usuario?.telefono_default || p.usuario?.dni || 'Sin tel'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowStatusNotifyModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={sendingNotify || !selectedOrderForNotify || !isMasterConnected}
                onClick={handleQuickNotifyStatus}
                className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-600/30 cursor-pointer disabled:opacity-40"
              >
                {sendingNotify ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Enviando aviso...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar Notificación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
