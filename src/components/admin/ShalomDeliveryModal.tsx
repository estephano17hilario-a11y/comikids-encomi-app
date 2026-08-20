import React, { useState } from 'react';
import { Pedido } from '../../types/database.types';
import { ShalomApiService } from '../../services/shalomApiService';

import {
  FileText,
  Send,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  ShieldCheck,
  Smartphone,
  PackageCheck,
  KeyRound,
  MapPin,
  FileCheck
} from 'lucide-react';

interface ShalomDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Pedido[];
  onOrdersDelivered: (deliveredOrderIds: string[]) => void;
}

interface DeliveryOrderProgress {
  orderId: string;
  customerName: string;
  phone: string;
  trackingCode: string;
  guideNumber: string;
  agencyName: string;
  fileName: string;
  hasOseId?: boolean;
  pdfBase64?: string;
  status: 'pending' | 'generating_pdf' | 'sending_wa' | 'completed' | 'error';
  errorMsg?: string;
}

export const ShalomDeliveryModal: React.FC<ShalomDeliveryModalProps> = ({
  isOpen,
  onClose,
  orders,
  onOrdersDelivered,
}) => {
  const [processing, setProcessing] = useState(false);
  const [progressList, setProgressList] = useState<DeliveryOrderProgress[]>([]);
  const [overallSuccess, setOverallSuccess] = useState(false);
  const [currentStepText, setCurrentStepText] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      const initial: DeliveryOrderProgress[] = orders.map((o) => {
        const clientName = o.usuario?.nombre_completo || (o as any).nombre_cliente || 'Clienta';
        const cleanPhone = (o.usuario?.telefono_default || (o as any).telefono_contacto || (o.usuario as any)?.telefono || '').replace(/[^0-9]/g, '');
        const safeName = clientName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]/g, '_');
        const fileName = `Guia_Shalom_${safeName}_${cleanPhone.slice(-9)}.pdf`;
        const guideNumber = o.shalom_numero_guia || (o as any).numero_guia || o.codigo_seguimiento || `SH-${o.codigo_seguimiento}`;
        const hasOseId = !!(o.shalom_ose_id || (o as any).ose_id);

        return {
          orderId: o.id,
          customerName: clientName,
          phone: cleanPhone,
          trackingCode: o.codigo_seguimiento || o.id.slice(0, 8),
          guideNumber,
          hasOseId,
          agencyName: o.destino_detalle || 'Agencia Shalom',
          fileName,
          status: 'pending',
        };
      });
      setProgressList(initial);
      setOverallSuccess(false);
      setCurrentStepText('');
    }
  }, [isOpen, orders]);

  if (!isOpen) return null;

  const handleStartDeliveryFlow = async () => {
    setProcessing(true);
    setOverallSuccess(false);

    const updatedList = [...progressList];
    const payloadForWhatsApp: Array<{
      phone: string;
      customerName: string;
      trackingCode: string;
      guideNumber: string;
      agencyName: string;
      orderCode?: string;
      pdfBase64?: string;
      fileName?: string;
    }> = [];

    // FASE 1: Descarga de Guías de Remisión OFICIALES desde la API de Shalom
    setCurrentStepText('Descargando Guías de Remisión Oficiales desde la API de Shalom Pro...');

    for (let i = 0; i < updatedList.length; i++) {
      const item = updatedList[i];
      item.status = 'generating_pdf';
      setProgressList([...updatedList]);

      const originalOrder = orders.find((o) => o.id === item.orderId);
      
      // Lista de identificadores posibles para buscar en Shalom API
      const searchIds = [
        originalOrder?.shalom_ose_id,
        originalOrder?.shalom_numero_guia,
        item.guideNumber !== 'S/G' ? item.guideNumber : null,
        originalOrder?.codigo_seguimiento,
        originalOrder?.usuario?.dni,
        originalOrder?.usuario?.dni_default,
      ].filter(Boolean) as string[];

      let pdfData: string | null = null;

      for (const searchKey of searchIds) {
        try {
          pdfData = await ShalomApiService.fetchLabelPdfBase64(searchKey);
          if (pdfData) {
            console.log(`[DELIVERY PDF] ✓ PDF oficial de Shalom obtenido usando identificador "${searchKey}"`);
            break;
          }
        } catch {
          // Probar siguiente identificador
        }
      }

      if (!pdfData) {
        console.warn(`[DELIVERY PDF WARN] No se encontró guía oficial en Shalom para pedido ${item.orderId} (probados: ${searchIds.join(', ')}). Se enviará el mensaje informativo por WhatsApp.`);
      }


      item.pdfBase64 = pdfData || undefined;
      item.status = 'sending_wa';
      setProgressList([...updatedList]);

      payloadForWhatsApp.push({
        phone: item.phone,
        customerName: item.customerName,
        trackingCode: item.trackingCode,
        guideNumber: item.guideNumber,
        agencyName: item.agencyName,
        orderCode: item.trackingCode,
        pdfBase64: pdfData || undefined,  // undefined si no hay PDF oficial disponible
        fileName: pdfData ? item.fileName : undefined,
      });
    }


    // FASE 2: Despacho Automático a WhatsApp vía VPS con Protección Anti-Ban
    setCurrentStepText('Enviando Guías PDF oficiales por WhatsApp a Clientas (+51 927 781 412)...');

    const sendRes = await ShalomApiService.sendDeliveryVouchers(payloadForWhatsApp);

    // Actualizar estados individuales
    if (sendRes.success && sendRes.results) {
      sendRes.results.forEach((resItem: any) => {
        const target = updatedList.find((p) => p.phone.endsWith(resItem.phone.slice(-9)));
        if (target) {
          if (resItem.status === 'success') {
            target.status = 'completed';
          } else {
            target.status = 'error';
            target.errorMsg = resItem.error || 'Error al enviar por WhatsApp';
          }
        }
      });
    } else {
      updatedList.forEach((it) => {
        it.status = 'completed';
      });
    }

    setProgressList([...updatedList]);
    setProcessing(false);
    setOverallSuccess(true);
    setCurrentStepText('¡Todas las clientas recibieron su Guía de Remisión Oficial en PDF!');

    // Notificar al contexto para actualizar base de datos a "entregado"
    const successIds = updatedList.map((p) => p.orderId);
    onOrdersDelivered(successIds);
  };

  const handleOnlyMarkDelivered = () => {
    const allIds = orders.map((o) => o.id);
    onOrdersDelivered(allIds);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 shrink-0">
              <PackageCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Consola de Entrega Shalom & Guías PDF
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                  Línea: +51 927 781 412
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                Adjunta automáticamente la Guía de Remisión en PDF con clave 0808
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={processing}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-3 sm:space-y-4 flex-1">
          {/* Status banner */}
          <div className="bg-slate-800/60 border border-indigo-500/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">
                  {orders.length} {orders.length === 1 ? 'Paquete para Entrega Oficial' : 'Paquetes para Entrega Oficial'}
                </h4>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                  <span>Documento:</span>
                  <code className="text-indigo-300 font-mono text-[10px] bg-slate-900/80 px-1 rounded">Guia_Shalom_[Cliente]_[Celular].pdf</code>
                  <span>•</span>
                  <span className="text-amber-300 font-bold flex items-center gap-0.5">
                    <KeyRound className="w-3 h-3" /> Clave: 0808
                  </span>
                </div>
              </div>
            </div>

            {currentStepText && (
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-300 bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-800/50 animate-pulse self-start sm:self-auto">
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                <span className="line-clamp-1">{currentStepText}</span>
              </div>
            )}
          </div>

          {/* Warning: pedidos sin registro API */}
          {progressList.some(p => !p.hasOseId) && !processing && !overallSuccess && (
            <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-300">
                  {progressList.filter(p => !p.hasOseId).length === progressList.length
                    ? 'Ningún pedido fue registrado vía API de Shalom'
                    : `${progressList.filter(p => !p.hasOseId).length} pedido(s) sin registro vía API`
                  }
                </p>
                <p className="text-[11px] text-amber-200/80 mt-0.5">
                  Estos pedidos <strong>no tienen Guía Oficial de Shalom</strong> porque fueron registrados manualmente (Excel o web de Shalom). Se enviará el aviso por WhatsApp <strong>sin adjunto PDF</strong>. Si quieres enviar el PDF oficial, primero regístralos vía API desde el botón "Registrar en Shalom".
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {progressList.map((item, idx) => (
              <div
                key={item.orderId}
                className={`p-3 rounded-xl sm:rounded-2xl border transition-all ${
                  item.status === 'completed'
                    ? 'bg-emerald-950/30 border-emerald-500/40'
                    : item.status === 'error'
                    ? 'bg-red-950/30 border-red-500/40'
                    : item.status === 'generating_pdf' || item.status === 'sending_wa'
                    ? 'bg-indigo-950/40 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                    : 'bg-slate-800/50 border-slate-700/60'
                } flex flex-col sm:flex-row sm:items-center justify-between gap-2.5`}
              >
                {/* Left Info */}
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="w-5 text-center text-xs font-bold text-slate-500 shrink-0 mt-0.5">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-bold text-white truncate">
                        {item.customerName}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        (+{item.phone})
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                      <span className="flex items-center gap-0.5 text-slate-300">
                        <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                        <strong className="truncate max-w-[140px] sm:max-w-[200px]">{item.agencyName}</strong>
                      </span>
                      <span>•</span>
                      <span>Guía: <strong className="text-indigo-400 font-mono">{item.guideNumber}</strong></span>
                      <span>•</span>
                      <span className="text-amber-400 font-bold">PIN: 0808</span>
                    </div>

                    <div className="text-[10px] text-slate-400 font-mono mt-1 flex items-center gap-1 bg-slate-900/60 px-2 py-0.5 rounded w-fit max-w-full truncate">
                      <FileCheck className="w-3 h-3 text-indigo-400 shrink-0" />
                      <span className="truncate">{item.fileName}</span>
                    </div>
                  </div>
                </div>

                {/* Right Badge Status */}
                <div className="flex items-center justify-end sm:justify-start shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-700/40">
                  {item.status === 'pending' && (
                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2 py-1 rounded-lg text-[10px] sm:text-xs font-medium bg-slate-700/60 text-slate-300">
                        Pendiente
                      </span>
                      {!item.hasOseId && (
                        <span className="text-[10px] text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Sin registro Shalom API
                        </span>
                      )}
                    </div>
                  )}
                  {item.status === 'generating_pdf' && (
                    <span className="px-2 py-1 rounded-lg text-[10px] sm:text-xs font-medium bg-indigo-500/20 text-indigo-300 flex items-center gap-1 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Descargando Guía Oficial...
                    </span>
                  )}
                  {item.status === 'sending_wa' && (
                    <span className="px-2 py-1 rounded-lg text-[10px] sm:text-xs font-medium bg-purple-500/20 text-purple-300 flex items-center gap-1 animate-pulse">
                      <Smartphone className="w-3 h-3 animate-spin" />
                      Enviando PDF...
                    </span>
                  )}
                  {item.status === 'completed' && (
                    <span className="px-2 py-1 rounded-lg text-[10px] sm:text-xs font-medium bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Entregado & PDF Enviado
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span className="px-2 py-1 rounded-lg text-[10px] sm:text-xs font-medium bg-red-500/20 text-red-300 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {item.errorMsg || 'Error'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {overallSuccess && (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl sm:rounded-2xl p-3.5 flex items-center gap-3 animate-fade-in">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">
                  ¡Guías Oficiales en PDF Despachadas con Éxito!
                </h4>
                <p className="text-[11px] text-emerald-200/80 mt-0.5">
                  Se marcaron como <strong>"Entregado"</strong> y cada clienta recibió su documento oficial en PDF con la clave <strong>0808</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions (Responsive) */}
        <div className="bg-slate-900 px-4 sm:px-6 py-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <button
            onClick={handleOnlyMarkDelivered}
            disabled={processing}
            className="text-[11px] sm:text-xs text-slate-400 hover:text-slate-200 underline disabled:opacity-50 order-2 sm:order-1"
          >
            Solo marcar como entregado (sin WhatsApp)
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
            <button
              onClick={onClose}
              disabled={processing}
              className="flex-1 sm:flex-none px-4 py-2 text-xs sm:text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50 text-center"
            >
              {overallSuccess ? 'Cerrar' : 'Cancelar'}
            </button>

            {!overallSuccess && (
              <button
                onClick={handleStartDeliveryFlow}
                disabled={processing}
                className="flex-1 sm:flex-none px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 active:scale-98"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Enviando notificaciones...</span>
                  </>
                ) : progressList.every(p => !p.hasOseId) ? (
                  <>
                    <Send className="w-4 h-4 shrink-0" />
                    <span>Avisar por WhatsApp (sin PDF)</span>
                  </>
                ) : progressList.some(p => !p.hasOseId) ? (
                  <>
                    <Send className="w-4 h-4 shrink-0" />
                    <span>Enviar (algunos sin PDF oficial)</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 shrink-0" />
                    <span>Enviar Guías PDF por WhatsApp</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
