import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { getApiBaseUrl } from '../../config/api';
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
  X
} from 'lucide-react';

interface WhatsAppInstanceStatus {
  instanceName: string;
  connectionStatus: 'open' | 'connecting' | 'close' | 'refused';
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
  number?: string;
}

export const EvolutionWhatsAppManager: React.FC = () => {
  const [status, setStatus] = useState<WhatsAppInstanceStatus>({
    instanceName: 'comikids_whatsapp',
    connectionStatus: 'close',
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [qrCodeData, setQrCodeData] = useState<{
    base64?: string;
    code?: string;
    pairingCode?: string;
  } | null>(null);
  const [qrLoading, setQrLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [copiedPairing, setCopiedPairing] = useState<boolean>(false);

  // Test Message Sender
  const [testPhone, setTestPhone] = useState<string>('927781412');
  const [testMessage, setTestMessage] = useState<string>('¡Hola! Mensaje de prueba desde el Gestor de WhatsApp ComiKids 🚀');
  const [sendingTest, setSendingTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // AI Copilot Simulator
  const [copilotQuery, setCopilotQuery] = useState<string>('');
  const [copilotReply, setCopilotReply] = useState<string>('');
  const [testingCopilot, setTestingCopilot] = useState<boolean>(false);
  const [aiActive, setAiActive] = useState<boolean>(true);

  const pollingIntervalRef = useRef<any>(null);

  // 1. Cargar estado inicial al montar
  useEffect(() => {
    checkConnectionStatus();
  }, []);

  // 2. Polling activo solo mientras no esté conectado ('open')
  useEffect(() => {
    if (status.connectionStatus === 'open') {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Polling cada 3 segundos para detectar cuando el usuario escanee el QR
    pollingIntervalRef.current = setInterval(() => {
      checkConnectionStatus(true);
    }, 3000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [status.connectionStatus]);

  /**
   * Consulta el estado de conexión de la instancia en Evolution API
   */
  const checkConnectionStatus = async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${getApiBaseUrl()}/tenant/instances`);
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json.data) ? json.data : [];
        const main = list.find((i: any) => 
          i.instanceName === 'comikids_whatsapp' || 
          i.instanceName === 'main_bot' || 
          i.instanceName === 'tenant_Comikids' ||
          i.isMaster
        ) || list[0];

        if (main) {
          const rawPhone = main.ownerJid?.replace('@s.whatsapp.net', '') || main.number || '';
          setStatus({
            instanceName: main.instanceName || 'comikids_whatsapp',
            connectionStatus: main.connectionStatus === 'open' ? 'open' : 'close',
            ownerJid: main.ownerJid,
            profileName: main.profileName,
            number: rawPhone,
          });

          // Si ya está abierto, limpiar QR
          if (main.connectionStatus === 'open') {
            setQrCodeData(null);
          }
        } else {
          setStatus({
            instanceName: 'comikids_whatsapp',
            connectionStatus: 'close',
          });
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
   * Solicita un nuevo código QR limpio y fresco desde Evolution API
   */
  const handleRequestQr = async (force: boolean = false) => {
    setQrLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const inst = status.instanceName || 'comikids_whatsapp';
      const url = `${getApiBaseUrl()}/tenant/${inst}/qr${force ? '?force=true' : ''}`;
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
          setQrCodeData({
            base64: b64,
            code: code,
            pairingCode: pairing,
          });
          setSuccessMsg('Código QR generado. Escanéalo en tu WhatsApp.');
        } else if (json.data?.status === 'open') {
          // Ya estaba conectado
          setStatus(prev => ({ ...prev, connectionStatus: 'open' }));
          setQrCodeData(null);
        } else {
          // Reintentar forzando recreate
          if (!force) {
            setTimeout(() => handleRequestQr(true), 1000);
            return;
          }
          setErrorMsg('No se pudo generar el código QR. Intenta presionar "Reintentar".');
        }
      } else {
        setErrorMsg(json.error || 'Error al solicitar el código QR.');
      }
    } catch (err: any) {
      setErrorMsg(`Error de conexión con la VPS: ${err?.message || 'Servidor no disponible'}`);
    } finally {
      setQrLoading(false);
    }
  };

  /**
   * Cierra la sesión activa y limpia la instancia para vincular un nuevo número
   */
  const handleDisconnect = async () => {
    if (!confirm('¿Deseas desconectar esta línea de WhatsApp? Tendrás que escanear un nuevo código QR.')) {
      return;
    }

    setLoading(true);
    try {
      const inst = status.instanceName || 'comikids_whatsapp';
      await fetch(`${getApiBaseUrl()}/tenant/${inst}`, { method: 'DELETE' });
      setStatus({
        instanceName: 'comikids_whatsapp',
        connectionStatus: 'close',
      });
      setQrCodeData(null);
      setSuccessMsg('Sesión cerrada correctamente.');
      // Solicitar QR nuevo inmediatamente
      setTimeout(() => handleRequestQr(true), 1000);
    } catch {
      setErrorMsg('No se pudo desconectar la sesión.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Envía un mensaje de WhatsApp de prueba a cualquier teléfono
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
          customerName: 'Administrador de Pruebas',
          message: testMessage,
          trackingCode: 'TEST-001',
          agencyName: 'Oficina Central',
          guideNumber: 'TEST-WHATSAPP',
          pickupCode: '1234',
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
        msg: `Error de red al enviar mensaje: ${err.message}`,
      });
    } finally {
      setSendingTest(false);
    }
  };

  /**
   * Copiar código de emparejamiento al portapapeles
   */
  const handleCopyPairingCode = () => {
    if (!qrCodeData?.pairingCode) return;
    navigator.clipboard.writeText(qrCodeData.pairingCode);
    setCopiedPairing(true);
    setTimeout(() => setCopiedPairing(false), 2500);
  };

  const isConnected = status.connectionStatus === 'open';

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2 animate-fade-in font-sans">
      
      {/* Header Panel */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-white shadow-xl transition-all ${
              isConnected
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-emerald-500/30'
                : 'bg-gradient-to-tr from-pink-500 to-purple-600 shadow-pink-500/30'
            }`}>
              <Smartphone className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                  Control Central de WhatsApp VPS
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border ${
                  isConnected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  {isConnected ? 'En Línea 24/7' : 'Desconectado'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Conecta tu WhatsApp escaneando el código QR para enviar guías Shalom, avisos y bot inteligente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setRefreshing(true);
                checkConnectionStatus();
              }}
              disabled={refreshing}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Actualizar Estado</span>
            </button>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 shadow-lg">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 shadow-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid Principal: Estado de Conexión & QR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Columna Izquierda: Tarjeta de Conexión & QR (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2">
                <Radio className={`w-4 h-4 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  {isConnected ? 'Línea de WhatsApp Vinculada' : 'Vincular Teléfono WhatsApp'}
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                Instancia: {status.instanceName}
              </span>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
                <span className="text-xs font-semibold">Consultando estado con el servidor VPS...</span>
              </div>
            ) : isConnected ? (
              /* ESTADO: CONECTADO */
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        WhatsApp Conectado
                      </div>
                      <div className="text-base sm:text-lg font-black text-white font-mono">
                        +{status.number || '51 927 781 412'}
                      </div>
                      {status.profileName && (
                        <div className="text-xs text-slate-400">
                          Perfil: <strong className="text-slate-200">{status.profileName}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Socket Seguro
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Canal de Envíos Shalom:</span>
                    <span className="text-emerald-400 font-bold">Activo (PDFs + Claves)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Copiloto IA Automático:</span>
                    <span className="text-cyan-400 font-bold">Respondiendo 24/7</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Servidor VPS:</span>
                    <span className="text-slate-400 font-mono">89.117.73.97</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={handleDisconnect}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Desconectar / Cambiar Número</span>
                  </button>
                </div>
              </div>
            ) : (
              /* ESTADO: DESCONECTADO (MOSTRAR QR O BOTÓN DE GENERAR) */
              <div className="space-y-4">
                {qrCodeData?.base64 ? (
                  <div className="flex flex-col items-center text-center space-y-3.5 py-2">
                    <div className="p-3.5 bg-white rounded-3xl shadow-2xl border-4 border-slate-800">
                      <img
                        src={qrCodeData.base64.startsWith('data:') ? qrCodeData.base64 : `data:image/png;base64,${qrCodeData.base64}`}
                        alt="Código QR de WhatsApp"
                        className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">
                        Escanea el código con tu WhatsApp
                      </h4>
                      <p className="text-xs text-slate-400 max-w-xs">
                        Abre WhatsApp en tu teléfono ➔ Menú (3 puntos o Ajustes) ➔ <strong>Dispositivos vinculados</strong> ➔ <strong>Vincular dispositivo</strong>.
                      </p>
                    </div>

                    {qrCodeData.pairingCode && (
                      <div className="w-full max-w-xs p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="text-slate-500 block text-[10px]">Código de vinculación:</span>
                          <strong className="text-pink-400 font-mono text-sm tracking-widest">
                            {qrCodeData.pairingCode}
                          </strong>
                        </div>
                        <button
                          onClick={handleCopyPairingCode}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Copiar código"
                        >
                          {copiedPairing ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleRequestQr(true)}
                        disabled={qrLoading}
                        className="py-2 px-4 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-pink-600/30 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${qrLoading ? 'animate-spin' : ''}`} />
                        <span>Generar Nuevo QR</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-pink-500/15 border border-pink-500/30 text-pink-400 flex items-center justify-center">
                      <QrCode className="w-8 h-8" />
                    </div>

                    <div className="space-y-1 max-w-sm">
                      <h4 className="text-base font-bold text-white">
                        Sin WhatsApp Vinculado Actualmente
                      </h4>
                      <p className="text-xs text-slate-400">
                        Haz clic en el botón de abajo para generar tu código QR en tiempo real y conectar tu línea oficial.
                      </p>
                    </div>

                    <button
                      onClick={() => handleRequestQr(false)}
                      disabled={qrLoading}
                      className="py-3 px-6 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:opacity-90 active:scale-95 text-white font-black text-sm flex items-center gap-2 shadow-xl shadow-pink-500/30 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {qrLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Generando Código QR...</span>
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4" />
                          <span>Generar Código QR de Conexión</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Test de Envío & Copiloto IA (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Card 1: Enviar Mensaje de Prueba */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
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
                disabled={sendingTest || !isConnected}
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
                    <span>{isConnected ? 'Enviar Mensaje de Prueba' : 'Conecta WhatsApp para Probar'}</span>
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

          {/* Card 2: Estado del Bot Copiloto IA */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">
                  Bot Copiloto IA 24/7
                </h3>
              </div>
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

            <p className="text-xs text-slate-400 leading-relaxed">
              El Copiloto IA atiende a tus clientas por WhatsApp, consulta el estado de sus pedidos en tiempo real y les entrega su clave de recojo.
            </p>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5 text-xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Comportamiento
              </div>
              <div className="text-slate-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>Atención automática a audios y textos</span>
              </div>
              <div className="text-slate-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Validación de comprobantes de pago Yape/Plin</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
