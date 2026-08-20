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
  Truck
} from 'lucide-react';

interface Props {
  pedidos: Pedido[];
  totalSelectedCount: number;
  tallerConfig: TallerConfig;
  onClose: () => void;
  onRegistered: (registeredOrderIds: string[]) => Promise<void>;
}

export const ShalomRegisterModal: React.FC<Props> = ({
  pedidos,
  totalSelectedCount,
  tallerConfig,
  onClose,
  onRegistered
}) => {
  // Estado de edición de datos por pedido
  const [editedData, setEditedData] = useState<Record<string, { dni: string; phone: string; name: string }>>({});
  const [activeTab, setActiveTab] = useState<'audit' | 'dispatching' | 'finished'>('audit');
  
  // Estados de despacho
  const [dispatchResults, setDispatchResults] = useState<Record<string, ShalomDispatchResult>>({});
  const [isDispatching, setIsDispatching] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  
  // Estados de WhatsApp sync
  const [isSyncingWhatsApp, setIsSyncingWhatsApp] = useState(false);
  const [whatsAppSyncDone, setWhatsAppSyncDone] = useState(false);
  const [whatsAppSyncCount, setWhatsAppSyncCount] = useState(0);

  // Modo tradicional Excel fallback
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Inicializar mapa de edición
  useEffect(() => {
    const initial: Record<string, { dni: string; phone: string; name: string }> = {};
    for (const p of pedidos) {
      initial[p.id] = {
        dni: extractShalomDni(p) || '',
        phone: extractShalomPhone(p) || '',
        name: p.usuario?.nombre_completo || 'Cliente',
      };

    }
    setEditedData(initial);
  }, [pedidos]);

  const origen = extractShalomOrigen(tallerConfig) || 'AV MEXICO CO';
  const totalCount = pedidos.length;
  const motorizadoFilteredOut = totalSelectedCount - pedidos.length;

  // Validación de datos por fila
  const auditedRows = useMemo(() => {
    return pedidos.map(p => {
      const row = editedData[p.id] || {
        dni: extractShalomDni(p) || '',
        phone: extractShalomPhone(p) || '',
        name: p.usuario?.nombre_completo || 'Cliente',
      };
      const destino = extractShalomDestino(p.destino_detalle);
      const isDniValid = row.dni.length >= 8 && row.dni.length <= 12 && !row.dni.startsWith('9') && !row.dni.includes('000000');
      const isPhoneValid = row.phone.replace(/\D/g, '').length === 9;
      const isComplete = Boolean(row.name && isDniValid && isPhoneValid && destino);

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
  const hasCredentials = Boolean(tallerConfig.shalom_email && tallerConfig.shalom_password);

  const handleDataChange = (id: string, field: 'dni' | 'phone' | 'name', value: string) => {
    setEditedData(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { dni: '', phone: '', name: '' }),
        [field]: value,
      },
    }));
  };

  // 1. DESPACHO AUTOMÁTICO VÍA API
  const handleStartApiDispatch = async () => {
    if (isDispatching) return;
    setIsDispatching(true);
    setActiveTab('dispatching');
    setProgressIndex(0);

    const auth = {
      email: tallerConfig.shalom_email || '',
      password: tallerConfig.shalom_password || '',
    };

    const resultsMap: Record<string, ShalomDispatchResult> = {};
    const successfulIds: string[] = [];

    for (let i = 0; i < auditedRows.length; i++) {
      const row = auditedRows[i];
      setProgressIndex(i + 1);

      const payload = {
        pedidoId: row.pedido.id,
        codigoSeguimiento: row.pedido.codigo_seguimiento,
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
        resultsMap[row.pedido.id] = res;
        if (res.success) {
          successfulIds.push(row.pedido.id);
        }
      } catch (err: any) {
        resultsMap[row.pedido.id] = {
          pedidoId: row.pedido.id,
          codigoSeguimiento: row.pedido.codigo_seguimiento,
          success: false,
          errorMessage: err.message || 'Error de conexión',
          customerPhone: row.data.phone,
          customerName: row.data.name,
          agencyName: row.destino,
        };
      }
      setDispatchResults({ ...resultsMap });
    }

    setIsDispatching(false);
    setActiveTab('finished');

    if (successfulIds.length > 0) {
      await onRegistered(successfulIds);
    }
  };

  // 2. SINCRONIZACIÓN DE WHATSAPP BUSINESS CRM TRAS EL DESPACHO
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
    }));

    try {
      const syncRes = await ShalomApiService.syncDispatchedWhatsApp(ordersToSync);
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
      await onRegistered(pedidos.map(p => p.id));
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                      : `${failedList.length} pedidos requirieron revisión de datos.`}
                  </p>
                </div>
              </div>
            </div>

            {/* Listado de Resultados y Descarga de Rótulos */}
            <div className="space-y-2">
              {Object.values(dispatchResults).map(res => (
                <div
                  key={res.pedidoId}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    res.success
                      ? 'bg-slate-950/70 border-emerald-500/30'
                      : 'bg-rose-950/20 border-rose-500/40'
                  }`}
                >
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
                      </div>
                      {res.success ? (
                        <p className="text-[11px] text-cyan-300">
                          Guía Oficial: <strong>{res.guideNumber}</strong> • OSE #{res.oseId}
                        </p>
                      ) : (
                        <p className="text-[11px] text-rose-300">
                          Motivo: {res.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  {res.success && res.oseId && (
                    <button
                      onClick={() =>
                        ShalomApiService.downloadLabelPdf(
                          res.oseId!,
                          { email: tallerConfig.shalom_email || '', password: tallerConfig.shalom_password || '' }
                        )
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Rótulo PDF</span>
                    </button>
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
                      <h4 className="text-xs font-bold text-white">Sincronización WhatsApp CRM</h4>
                      <p className="text-[11px] text-emerald-300">
                        Etiqueta "Despachando en Shalom" y aviso automático con número de guía
                      </p>
                    </div>
                  </div>
                  {whatsAppSyncDone && (
                    <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      ✓ {whatsAppSyncCount} Notificados
                    </span>
                  )}
                </div>

                {!whatsAppSyncDone ? (
                  <button
                    onClick={handleSyncWhatsApp}
                    disabled={isSyncingWhatsApp}
                    className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isSyncingWhatsApp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sincronizando WhatsApp...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Notificar a {successfulList.length} Clientas por WhatsApp</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-200 text-xs text-center font-medium">
                    🎉 ¡Mensajes de seguimiento enviados y etiquetas actualizadas correctamente!
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
                disabled={!allValid || !hasCredentials || isDispatching}
                className="px-5 py-2.5 rounded-xl bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Truck className="w-4 h-4" />
                <span>Despachar Automáticamente vía API</span>
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
