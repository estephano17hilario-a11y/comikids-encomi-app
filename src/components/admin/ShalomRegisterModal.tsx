import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Pedido, TallerConfig } from '../../types/database.types';
import { downloadShalomExcel, extractShalomDni, extractShalomPhone, extractShalomDestino, extractShalomOrigen } from '../../utils/shalomExcelExporter';
import { ShalomApiService, ShalomDispatchResult } from '../../services/shalomApiService';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Package,
  ShieldCheck,
  Building2,
  Filter,
  Loader2,
  Send,
  Download,
  MessageSquare,
  Check,
  AlertTriangle,
  RefreshCw,
  Edit2,
  ExternalLink,
  Truck,
  KeyRound
} from 'lucide-react';


interface Props {
  pedidos: Pedido[];
  totalSelectedCount: number;
  tallerConfig: TallerConfig;
  onClose: () => void;
  onRegistered: (results: Array<{ pedidoId: string; oseId?: string; guideNumber?: string }>) => Promise<void>;
}

export const ShalomRegisterModal: React.FC<Props> = ({
  pedidos,
  totalSelectedCount,
  tallerConfig,
  onClose,
  onRegistered
}) => {
  // Estado de edición de datos por pedido
  const [editedData, setEditedData] = useState<Record<string, { dni: string; phone: string; name: string; pickupCode?: string }>>({});
  const [activeTab, setActiveTab] = useState<'audit' | 'dispatching' | 'finished'>('audit');
  
  // Estados de despacho
  const [dispatchResults, setDispatchResults] = useState<Record<string, ShalomDispatchResult>>({});
  const [isDispatching, setIsDispatching] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [retryingIds, setRetryingIds] = useState<Record<string, boolean>>({});
  
  // Estados de WhatsApp sync
  const [isSyncingWhatsApp, setIsSyncingWhatsApp] = useState(false);
  const [whatsAppSyncDone, setWhatsAppSyncDone] = useState(false);
  const [whatsAppSyncCount, setWhatsAppSyncCount] = useState(0);

  // Clave de recojo temporal para Shalom
  const [pickupCode, setPickupCode] = useState('0808');

  // Modo tradicional Excel fallback
  const [isExportingExcel, setIsExportingExcel] = useState(false);


  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Inicializar mapa de edición una sola vez al abrir el modal
  const initializedRef = React.useRef(false);
  useEffect(() => {
    if (!initializedRef.current && pedidos.length > 0) {
      initializedRef.current = true;
      const initial: Record<string, { dni: string; phone: string; name: string; pickupCode?: string }> = {};
      for (const p of pedidos) {
        initial[p.id] = {
          dni: extractShalomDni(p) || '',
          phone: extractShalomPhone(p) || '',
          name: p.usuario?.nombre_completo || 'Cliente',
        };
      }
      setEditedData(initial);
    }
  }, [pedidos]);


  const origen = extractShalomOrigen(tallerConfig) || 'AV MEXICO CO';
  const totalCount = pedidos.length;
  const motorizadoFilteredOut = totalSelectedCount - pedidos.length;

  const [dismissDateWarning, setDismissDateWarning] = useState(false);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Pedidos con fecha programada diferente a hoy
  const differentDateOrders = useMemo(() => {
    return pedidos.filter(p => {
      if (!p.fecha_limite) return false;
      const orderDate = p.fecha_limite.split('T')[0];
      return orderDate !== todayStr;
    });
  }, [pedidos, todayStr]);

  // Validación de datos por fila
  const auditedRows = useMemo(() => {
    return pedidos.map(p => {
      const row = editedData[p.id] || {
        dni: extractShalomDni(p) || '',
        phone: extractShalomPhone(p) || '',
        name: p.usuario?.nombre_completo || 'Cliente',
      };
      const destino = extractShalomDestino(p.destino_detalle);
      const cleanDni = row.dni.replace(/\D/g, '');
      const cleanPhone = row.phone.replace(/\D/g, '');
      const isDniValid = cleanDni.length >= 6 || row.dni.length >= 6;
      const isPhoneValid = cleanPhone.length >= 7 || row.phone.length >= 7;
      const isComplete = Boolean(row.name && destino);

      return {
        pedido: p,
        data: row,
        destino,
        isDniValid,
        isPhoneValid,
        isComplete,
      };
    });
  }, [pedidos, editedData]);

  const allValid = auditedRows.every(r => r.isComplete);

  const handleDataChange = (id: string, field: 'dni' | 'phone' | 'name' | 'pickupCode', value: string) => {
    setEditedData(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { dni: '', phone: '', name: '' }),
        [field]: value,
      },
    }));
  };

  // Reintento individual para un paquete específico con clave personalizada
  const handleRetrySingleOrder = async (pedidoId: string) => {
    const row = auditedRows.find(r => r.pedido.id === pedidoId);
    if (!row) return;

    setRetryingIds(prev => ({ ...prev, [pedidoId]: true }));

    const auth = {
      email: tallerConfig.shalom_email || 'milagrosjanetamis@gmail.com',
      password: tallerConfig.shalom_password || '986398Mi$',
    };

    const rowPickupCode = row.data.pickupCode || pickupCode;

    const payload = {
      pedidoId: row.pedido.id,
      codigoSeguimiento: row.pedido.codigo_seguimiento,
      pickup_code: rowPickupCode,
      remitente: {
        nombre: tallerConfig.nombre_taller || 'ENCOMI TALLER',
        documento: tallerConfig.ruc_dni || '20000000001',
        telefono: tallerConfig.celular_taller || '999999999',
        agenciaOrigen: origen,
      },
      destinatario: {
        nombre: row.data.name,
        documento: row.data.dni,
        telefono: row.data.phone,
        agenciaDestino: row.destino,
        direccionFisica: row.pedido.destino_detalle,
      },
      paquete: {
        descripcion: row.pedido.detalles_bordado || 'PRENDAS DE TEXTIL / ENCOMIENDA',
        cantidadBultos: 1,
        tipoEnvio: 'PAGADO' as const,
      },
    };

    try {
      const res = await ShalomApiService.registerOrder(payload, auth);
      res.pickupCode = rowPickupCode;

      if (res.success && (res.oseId || res.guideNumber || res.trackingCode)) {
        try {
          const pdfKey = String(res.oseId || res.guideNumber || res.trackingCode || row.data.phone);
          const pdfBase64 = await ShalomApiService.fetchVoucherPdfBase64(pdfKey, auth);
          if (pdfBase64 && pdfBase64.length > 100) {
            res.pdfBase64 = pdfBase64;
          }
        } catch (pdfErr) {
          console.warn('[FETCH SHALOM VOUCHER PDF AFTER RETRY WARN]', pdfErr);
        }

        try {
          await onRegistered([{
            pedidoId: row.pedido.id,
            oseId: res.oseId ? String(res.oseId) : undefined,
            guideNumber: res.guideNumber,
          }]);
        } catch (onRegErr) {
          console.warn('[ON REGISTERED RETRY WARN]', onRegErr);
        }
      }

      setDispatchResults(prev => ({ ...prev, [pedidoId]: res }));
    } catch (err: any) {
      setDispatchResults(prev => ({
        ...prev,
        [pedidoId]: {
          pedidoId: row.pedido.id,
          codigoSeguimiento: row.pedido.codigo_seguimiento,
          success: false,
          errorMessage: err.message || 'Error de conexión',
          customerPhone: row.data.phone,
          customerName: row.data.name,
          agencyName: row.destino,
          pickupCode: rowPickupCode,
        },
      }));
    } finally {
      setRetryingIds(prev => ({ ...prev, [pedidoId]: false }));
    }
  };


  // 1. DESPACHO AUTOMÁTICO VÍA API CON RATE LIMITING (Máximo 50 req/min)
  const handleStartApiDispatch = async () => {
    if (isDispatching) return;
    setIsDispatching(true);
    setActiveTab('dispatching');
    setProgressIndex(0);

    const auth = {
      email: tallerConfig.shalom_email || 'milagrosjanetamis@gmail.com',
      password: tallerConfig.shalom_password || '986398Mi$',
    };



    const resultsMap: Record<string, ShalomDispatchResult> = {};
    const successfulIds: string[] = [];

    for (let i = 0; i < auditedRows.length; i++) {
      const row = auditedRows[i];
      setProgressIndex(i + 1);

      // Rate Limiting: Pausa de 1.2s entre peticiones a la API de Shalom para no exceder 60 req/min
      if (i > 0) {
        await new Promise(r => setTimeout(r, 1200));
      }

      const rowPickupCode = row.data.pickupCode || pickupCode;

      const payload = {
        pedidoId: row.pedido.id,
        codigoSeguimiento: row.pedido.codigo_seguimiento,
        pickup_code: rowPickupCode,
        remitente: {
          nombre: tallerConfig.nombre_taller || 'ENCOMI TALLER',
          documento: tallerConfig.ruc_dni || '20000000001',
          telefono: tallerConfig.celular_taller || '999999999',
          agenciaOrigen: origen,
        },
        destinatario: {
          nombre: row.data.name,
          documento: row.data.dni,
          telefono: row.data.phone,
          agenciaDestino: row.destino,
          direccionFisica: row.pedido.destino_detalle,
        },
        paquete: {
          descripcion: row.pedido.detalles_bordado || 'PRENDAS DE TEXTIL / ENCOMIENDA',
          cantidadBultos: 1,
          tipoEnvio: 'PAGADO' as const,
        },
      };

      try {
        const res = await ShalomApiService.registerOrder(payload, auth);
        res.pickupCode = rowPickupCode;
        
        // Descargar inmediatamente el Ticket Shalom Oficial (formato físico POS con QR)
        if (res.success && (res.oseId || res.guideNumber || res.trackingCode)) {
          successfulIds.push(row.pedido.id);
          try {
            const pdfKey = String(res.oseId || res.guideNumber || res.trackingCode || row.data.phone);
            let pdfBase64 = await ShalomApiService.fetchVoucherPdfBase64(pdfKey, auth);
            if (!pdfBase64 || pdfBase64.length < 100) {
              pdfBase64 = await ShalomApiService.fetchLabelPdfBase64(pdfKey, auth);
            }
            if (pdfBase64 && pdfBase64.length > 100) {
              res.pdfBase64 = pdfBase64;
            }
          } catch (pdfErr) {
            console.warn('[FETCH SHALOM VOUCHER PDF AFTER REGISTRATION WARN]', pdfErr);
          }
        }

        resultsMap[row.pedido.id] = res;
      } catch (err: any) {
        resultsMap[row.pedido.id] = {
          pedidoId: row.pedido.id,
          codigoSeguimiento: row.pedido.codigo_seguimiento,
          success: false,
          errorMessage: err.message || 'Error de conexión',
          customerPhone: row.data.phone,
          customerName: row.data.name,
          agencyName: row.destino,
          pickupCode: rowPickupCode,
        };
      }

      setDispatchResults({ ...resultsMap });
    }

    setIsDispatching(false);
    setActiveTab('finished');

    if (successfulIds.length > 0) {
      try {
        const successResults = successfulIds.map(id => {
          const res = resultsMap[id];
          return {
            pedidoId: id,
            oseId: res?.oseId ? String(res.oseId) : undefined,
            guideNumber: res?.guideNumber,
          };
        });
        await onRegistered(successResults);
      } catch (err) {
        console.warn('[ON REGISTERED WARN]', err);
      }
    }
  };

  // 2. SINCRONIZACIÓN DE WHATSAPP BUSINESS CRM TRAS EL DESPACHO CON PDF ADJUNTO
  const handleSyncWhatsApp = async () => {
    if (isSyncingWhatsApp) return;
    setIsSyncingWhatsApp(true);

    const successfulDispatches = Object.values(dispatchResults).filter(r => r.success);
    const ordersToSync = successfulDispatches.map(res => ({
      phone: res.customerPhone || '',
      customerName: res.customerName || 'Clienta',
      trackingCode: res.trackingCode || res.codigoSeguimiento,
      guideNumber: res.guideNumber || `SH-${res.oseId || ''}`,
      agencyName: res.agencyName || 'Agencia Shalom',
      orderCode: res.codigoSeguimiento,
      pdfBase64: res.pdfBase64,
      pickupCode: res.pickupCode || pickupCode,
    }));

    try {
      const syncRes = await ShalomApiService.syncDispatchedWhatsApp(ordersToSync, pickupCode);
      setWhatsAppSyncDone(true);
      setWhatsAppSyncCount(syncRes.notifiedCount || ordersToSync.length);
    } catch (err) {
      console.error('[WHATSAPP DISPATCH ERROR]', err);
    } finally {
      setIsSyncingWhatsApp(false);
    }
  };



  // 3. DESCARGA TRADICIONAL EXCEL (FALLBACK)
  const handleExportExcelFallback = async () => {
    if (isExportingExcel) return;
    setIsExportingExcel(true);
    try {
      await downloadShalomExcel(pedidos, tallerConfig);
      await onRegistered(pedidos.map(p => ({ pedidoId: p.id })));
      onClose();
    } catch (err) {
      console.error('[EXCEL FALLBACK ERROR]', err);
      alert('Ocurrió un error al generar el archivo Excel.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const successfulList = Object.values(dispatchResults).filter(r => r.success);
  const failedList = Object.values(dispatchResults).filter(r => !r.success);

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn" data-no-print="true">
      <div className="relative w-full max-w-3xl rounded-3xl bg-slate-900 border border-cyan-500/40 p-5 sm:p-6 shadow-2xl shadow-cyan-500/20 space-y-4 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-cyan-500/30">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white leading-tight flex items-center gap-2">
                <span>Centro de Despacho Shalom API Pro</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {totalCount} {totalCount === 1 ? 'paquete' : 'paquetes'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Origen: <strong className="text-cyan-300">{origen}</strong> • Registro Automático y Notificación WhatsApp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notificación de motorizados filtrados */}
        {motorizadoFilteredOut > 0 && (
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2 shrink-0">
            <Filter className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Se excluyeron <strong>{motorizadoFilteredOut} pedidos</strong> de motorizado local.
            </span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FASE 1: AUDITORÍA Y EDICIÓN DE DATOS EN VIVO                             */}
        {/* ========================================================================= */}
        {activeTab === 'audit' && (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            {/* Clave de Recojo Temporal Editable */}
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md shadow-amber-950/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">Clave de Recojo / PIN Shalom:</span>
                    <span className="text-[10px] text-amber-300 font-mono bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30 font-bold">
                      PIN: {pickupCode}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Modifica esta clave solo si Shalom te pide una distinta hoy (se usará en el registro y en el mensaje de WhatsApp).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <label className="text-[11px] font-bold text-slate-300">Clave:</label>
                <input
                  type="text"
                  maxLength={6}
                  value={pickupCode}
                  onChange={(e) => setPickupCode(e.target.value.replace(/[^0-9A-Za-z]/g, ''))}
                  placeholder="0808"
                  className="w-24 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-amber-500/50 text-amber-300 font-mono font-bold text-center text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>Auditoría de Datos Requeridos para Shalom (DNI, Teléfono y Destino)</span>
              </div>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                allValid ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {allValid ? '✓ Todo Listo' : '⚠ Campos por Corregir'}
              </span>
            </div>


            {/* Advertencia de Pedidos con Fecha Programada Diferente a Hoy */}
            {differentDateOrders.length > 0 && !dismissDateWarning && (
              <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 space-y-1.5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Aviso de Fechas de Envío:</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/25 text-[10px] font-mono font-bold">
                      {differentDateOrders.length} {differentDateOrders.length === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDismissDateWarning(true)}
                    className="text-[11px] font-bold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/40 px-2.5 py-1 rounded-lg border border-amber-500/30 cursor-pointer transition-colors"
                  >
                    ✓ Despachar hoy
                  </button>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  Hay {differentDateOrders.length} pedidos con fecha programada distinta a hoy ({differentDateOrders.map(p => `#${p.codigo_seguimiento}`).join(', ')}). Al procesar vía API de Shalom, se generará su registro para despacho inmediato.
                </p>
              </div>
            )}


            {/* Listado de Pedidos en Auditoría */}
            <div className="space-y-2.5">

              {auditedRows.map((row, idx) => (
                <div
                  key={row.pedido.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    row.isComplete
                      ? 'bg-slate-950/60 border-slate-800 hover:border-cyan-500/40'
                      : 'bg-rose-950/20 border-rose-500/40'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-800 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-mono text-xs font-bold text-white">
                        #{row.pedido.codigo_seguimiento}
                      </span>
                      <span className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
                        {row.pedido.usuario?.nombre_completo || 'Cliente'}
                      </span>
                    </div>

                    <div className="text-[11px] font-bold text-cyan-300 bg-cyan-950/50 px-2.5 py-1 rounded-lg border border-cyan-800/50 truncate max-w-[280px]">
                      📍 {row.destino}
                    </div>
                  </div>

                  {/* Inputs de Edición Rápida */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Nombre Destinatario</label>
                      <input
                        type="text"
                        value={row.data.name}
                        onChange={e => handleDataChange(row.pedido.id, 'name', e.target.value)}
                        className="w-full px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5 flex items-center justify-between">
                        <span>DNI / CE (8-12 dígitos)</span>
                        {!row.isDniValid && <span className="text-rose-400 font-bold">Inválido</span>}
                      </label>
                      <input
                        type="text"
                        value={row.data.dni}
                        onChange={e => handleDataChange(row.pedido.id, 'dni', e.target.value.trim())}
                        placeholder="Ej: 72345678"
                        className={`w-full px-2.5 py-1 bg-slate-900 border rounded-lg text-xs font-mono text-white focus:outline-none ${
                          row.isDniValid ? 'border-slate-700 focus:border-cyan-500' : 'border-rose-500/80 bg-rose-950/30'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5 flex items-center justify-between">
                        <span>Celular (9 dígitos)</span>
                        {!row.isPhoneValid && <span className="text-rose-400 font-bold">Inválido</span>}
                      </label>
                      <input
                        type="text"
                        value={row.data.phone}
                        onChange={e => handleDataChange(row.pedido.id, 'phone', e.target.value.trim())}
                        placeholder="Ej: 987654321"
                        className={`w-full px-2.5 py-1 bg-slate-900 border rounded-lg text-xs font-mono text-white focus:outline-none ${
                          row.isPhoneValid ? 'border-slate-700 focus:border-cyan-500' : 'border-rose-500/80 bg-rose-950/30'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5 flex items-center justify-between">
                        <span>Clave PIN</span>
                        <span className="text-amber-400 text-[9px] font-mono">Indiv.</span>
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={row.data.pickupCode || ''}
                        onChange={e => handleDataChange(row.pedido.id, 'pickupCode', e.target.value.replace(/[^0-9A-Za-z]/g, ''))}
                        placeholder={pickupCode}
                        className="w-full px-2.5 py-1 bg-slate-900 border border-amber-500/40 rounded-lg text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400 text-center"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FASE 2: PROGRESO DE DESPACHO EN VIVO                                     */}
        {/* ========================================================================= */}
        {activeTab === 'dispatching' && (
          <div className="space-y-5 py-6 flex flex-col items-center justify-center flex-1">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 animate-ping" />
              <div className="w-16 h-16 rounded-full bg-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/50">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-base font-bold text-white">Despachando pedidos en Shalom Pro API...</h4>
              <p className="text-xs text-cyan-300">
                Procesando orden {progressIndex} de {totalCount}
              </p>
            </div>

            <div className="w-full max-w-md bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-cyan-400 h-full transition-all duration-300 ease-out"
                style={{ width: `${(progressIndex / totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FASE 3 & 4: RESULTADOS, RÓTULOS PDF Y WHATSAPP CRM SYNC                   */}
        {/* ========================================================================= */}
        {activeTab === 'finished' && (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            
            {/* Banner Resumen */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              failedList.length === 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}>
              <div className="flex items-center gap-3">
                {failedList.length === 0 ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                )}
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {successfulList.length} de {totalCount} pedidos despachados con éxito
                  </h4>
                  <p className="text-xs text-slate-300">
                    {failedList.length === 0
                      ? 'Todas las órdenes fueron registradas en la plataforma de Shalom Pro.'
                      : `${failedList.length} pedidos tuvieron error. Puedes cambiar su clave individualmente abajo y reintentar.`}
                  </p>
                </div>
              </div>
            </div>

            {/* Listado de Resultados y Descarga de Rótulos / Reintentos */}
            <div className="space-y-2.5">
              {Object.values(dispatchResults).map(res => (
                <div
                  key={res.pedidoId}
                  className={`p-3.5 rounded-xl border flex flex-col gap-2.5 ${
                    res.success
                      ? 'bg-slate-950/70 border-emerald-500/30'
                      : 'bg-rose-950/20 border-rose-500/40'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      {res.success ? (
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white">
                            #{res.codigoSeguimiento}
                          </span>
                          <span className="text-xs text-slate-300">
                            {res.customerName} (+{res.customerPhone})
                          </span>
                          <span className="text-[10px] text-amber-300 font-mono bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30 font-bold">
                            PIN: {res.pickupCode || editedData[res.pedidoId]?.pickupCode || pickupCode}
                          </span>
                        </div>
                        {res.success ? (
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <p className="text-[11px] text-cyan-300">
                              Guía Oficial: <strong>{String(res.guideNumber || 'Generada')}</strong> • OSE #{String(res.oseId || '')}
                            </p>
                            {res.pdfBase64 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                📎 Ticket Shalom con QR Listo
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-rose-300 mt-0.5">
                            <strong>Motivo:</strong> {typeof res.errorMessage === 'string' ? res.errorMessage : JSON.stringify(res.errorMessage || 'Error en registro')}
                          </p>
                        )}
                      </div>
                    </div>

                    {res.success && (res.pdfBase64 || res.oseId) && (
                      <button
                        onClick={() => {
                          if (res.pdfBase64) {
                            const blob = new Blob([Uint8Array.from(atob(res.pdfBase64), c => c.charCodeAt(0))], { type: 'application/pdf' });
                            const blobUrl = URL.createObjectURL(blob);
                            window.open(blobUrl, '_blank');
                          } else if (res.oseId) {
                            ShalomApiService.downloadVoucherPdf(
                              res.oseId!,
                              { email: tallerConfig.shalom_email || '', password: tallerConfig.shalom_password || '' }
                            );
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 self-end sm:self-center"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Ticket Shalom (QR) PDF</span>
                      </button>
                    )}
                  </div>

                  {/* Recuadro de Corrección y Reintento Individual para órdenes fallidas */}
                  {!res.success && (
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-[11px] font-bold text-amber-200">
                          Nueva Clave de Recojo para este paquete:
                        </span>
                        <input
                          type="text"
                          maxLength={6}
                          value={editedData[res.pedidoId]?.pickupCode || ''}
                          onChange={(e) => handleDataChange(res.pedidoId, 'pickupCode', e.target.value.replace(/[^0-9A-Za-z]/g, ''))}
                          placeholder={pickupCode}
                          className="w-20 px-2 py-1 rounded-lg bg-slate-950 border border-amber-500/50 text-amber-300 font-mono font-bold text-center text-xs focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRetrySingleOrder(res.pedidoId)}
                        disabled={retryingIds[res.pedidoId]}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 shrink-0"
                      >
                        {retryingIds[res.pedidoId] ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Reintentando registro...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Reintentar este paquete</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>


            {/* Sincronización con WhatsApp Business */}
            {successfulList.length > 0 && (
              <div className="p-4 rounded-2xl bg-linear-to-r from-emerald-950/40 to-teal-950/40 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Envío de Guía de Remisión Oficial en PDF</h4>
                      <p className="text-[11px] text-emerald-300">
                        Envía a cada clienta su mensaje con su Guía PDF oficial adjunta y clave <strong className="text-amber-300 font-mono font-bold">{pickupCode}</strong>
                      </p>

                    </div>
                  </div>
                  {whatsAppSyncDone && (
                    <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      ✓ {whatsAppSyncCount} Notificados con PDF
                    </span>
                  )}
                </div>

                {!whatsAppSyncDone ? (
                  <button
                    onClick={handleSyncWhatsApp}
                    disabled={isSyncingWhatsApp}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    {isSyncingWhatsApp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enviando Guías en PDF por WhatsApp (+51 927 781 412)...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Enviar Mensaje con Guía PDF a {successfulList.length} Clientas por WhatsApp</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-200 text-xs text-center font-medium border border-emerald-500/30">
                    🎉 ¡Guías Oficiales en PDF enviadas y mensajes de seguimiento entregados con éxito!
                  </div>
                )}
              </div>
            )}


          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            {activeTab === 'finished' ? 'Cerrar' : 'Cancelar'}
          </button>

          {activeTab === 'audit' && (
            <div className="flex items-center gap-2">
              {/* Fallback a Excel tradicional */}
              <button
                onClick={handleExportExcelFallback}
                disabled={isExportingExcel}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Generar Excel masivo si no deseas usar la API"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-yellow-400" />
                <span>Solo Excel</span>
              </button>

              {/* Botón Principal API Dispatch */}
              <button
                onClick={handleStartApiDispatch}
                disabled={isDispatching}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-98"
              >
                {isDispatching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Despachando...</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4" />
                    <span>Despachar Automáticamente vía API</span>
                  </>
                )}
              </button>

            </div>
          )}

          {activeTab === 'finished' && (
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 transition-all cursor-pointer"
            >
              Completar y Finalizar
            </button>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
};
