import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Pedido, TallerConfig } from '../../types/database.types';
import { downloadShalomExcel, extractShalomDni, extractShalomPhone, extractShalomDestino, extractShalomOrigen } from '../../utils/shalomExcelExporter';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Package,
  ShieldCheck,
  Building2,
  Filter
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
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const origen = extractShalomOrigen(tallerConfig) || 'CENTRAL';

  // 1. Validación: Máximo 50 envíos por archivo
  const totalCount = pedidos.length;
  const isCountValid = totalCount > 0 && totalCount <= 50;

  // 2. Validación: Hasta 10 encomiendas por destinatario
  const recipientCounts = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    for (const p of pedidos) {
      const doc = extractShalomDni(p) || p.usuario?.nombre_completo || 'Desconocido';
      if (!counts[doc]) {
        counts[doc] = { name: p.usuario?.nombre_completo || doc, count: 0 };
      }
      counts[doc].count += 1;
    }
    return counts;
  }, [pedidos]);

  const maxRecipientCount = useMemo(() => {
    return Math.max(0, ...Object.values(recipientCounts).map(r => r.count));
  }, [recipientCounts]);

  const hasExcessiveRecipient = maxRecipientCount > 10;
  const excessiveRecipient = useMemo(() => {
    return Object.values(recipientCounts).find(r => r.count > 10);
  }, [recipientCounts]);

  // Can submit only if all checks pass
  const canRegister = isCountValid && !hasExcessiveRecipient;

  const motorizadoFilteredOut = totalSelectedCount - pedidos.length;

  const handleConfirm = async () => {
    if (!canRegister) return;
    try {
      downloadShalomExcel(pedidos, tallerConfig);
      await onRegistered(pedidos.map(p => p.id));
      onClose();
    } catch (err) {
      console.error('Error al generar Excel de Shalom:', err);
      alert('Ocurrió un error al generar el archivo Excel.');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn" data-no-print="true">
      <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border border-cyan-500/40 p-5 sm:p-7 shadow-2xl shadow-cyan-500/15 space-y-4 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-500/20">
              <FileSpreadsheet className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                ¿Seguro que deseas registrar en Shalom?
              </h3>
              <p className="text-xs text-cyan-300 font-medium">
                Generador de Plantilla Masiva Oficial • {totalCount} {totalCount === 1 ? 'pedido Shalom' : 'pedidos Shalom'}
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

        {/* Notificación de pedidos de motorizado filtrados automáticamente */}
        {motorizadoFilteredOut > 0 && (
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2 shrink-0">
            <Filter className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Se destildaron automáticamente <strong>{motorizadoFilteredOut} {motorizadoFilteredOut === 1 ? 'pedido' : 'pedidos'}</strong> de <strong>Motorizado</strong> (solo se registran envíos Shalom).
            </span>
          </div>
        )}

        {/* Validation Warnings Card (Sin el recuadro 3) */}
        <div className="space-y-2 bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl shrink-0">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Requisitos Oficiales de Shalom para Carga Masiva</span>
          </h4>

          <div className="space-y-2 text-xs">
            
            {/* Regla 1: Máximo 50 envíos por archivo */}
            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
              isCountValid
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                {isCountValid ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                <span className="font-bold">Máximo 50 envíos por archivo</span>
              </div>
              <span className="font-mono font-black text-xs">
                {totalCount} / 50 {isCountValid ? '✓' : '(Excedido)'}
              </span>
            </div>

            {/* Regla 2: Hasta 10 encomiendas por destinatario */}
            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
              !hasExcessiveRecipient
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                {!hasExcessiveRecipient ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                <span className="font-bold">Hasta 10 encomiendas por destinatario</span>
              </div>
              <span className="font-mono font-black text-xs">
                {!hasExcessiveRecipient ? `Máx. ${maxRecipientCount} ✓` : `${excessiveRecipient?.name}: ${excessiveRecipient?.count} ❌`}
              </span>
            </div>

          </div>
        </div>

        {/* Info bar con Agencia Origen CENTRAL y Medidas 0 */}
        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-slate-300">
            <Building2 className="w-4 h-4 text-cyan-400" />
            <span>Agencia Origen:</span>
            <strong className="text-cyan-300 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
              {origen}
            </strong>
          </div>
          <span className="text-[11px] text-amber-300 font-bold">
            Medidas: 0 (Sin especificar)
          </span>
        </div>

        {/* Scrollable Order List Summary (UI limpia, espaciada y responsiva) */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-40 custom-scrollbar">
          <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 sticky top-0 bg-slate-900 py-1 z-10">
            <Package className="w-3.5 h-3.5 text-cyan-400" />
            <span>Pedidos Shalom a Registrar ({pedidos.length})</span>
          </h5>

          {pedidos.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800">
              No hay pedidos de Shalom seleccionados.
            </div>
          ) : (
            pedidos.map((p, i) => {
              const dni = extractShalomDni(p);
              const phone = extractShalomPhone(p);
              const destino = extractShalomDestino(p.destino_detalle);

              return (
                <div
                  key={p.id}
                  className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 hover:border-cyan-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 flex items-center justify-center text-xs font-black shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <h5 className="text-xs font-bold text-white truncate">
                        {p.usuario?.nombre_completo || 'Cliente'}
                      </h5>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                        <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded text-slate-300">
                          DNI/CE: <strong className="text-cyan-400 font-bold">{dni || 'N/A'}</strong>
                        </span>
                        <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded text-slate-300">
                          Cel: <strong className="text-slate-200">{phone || 'Sin cel'}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                    <div className="flex flex-col sm:items-end justify-between sm:justify-center gap-1 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-white/5 shrink-0 max-w-full sm:max-w-xs text-left sm:text-right">
                      <span className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 inline-block w-fit sm:ml-auto">
                        📍 {destino}
                      </span>
                      <p className="text-[10px] text-slate-400 truncate max-w-xs leading-tight">
                        {p.destino_detalle?.replace(/^Agencia Shalom:\s*/i, '')}
                      </p>
                    </div>
                </div>
              );
            })
          )}
        </div>



        {/* Action Buttons */}
        <div className="pt-3 border-t border-white/10 flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-1/3 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          
          <button
            type="button"
            disabled={!canRegister}
            onClick={handleConfirm}
            className={`w-2/3 py-3 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
              canRegister
                ? 'bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25 cursor-pointer active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-yellow-300" />
            <span>Descargar y Registrar en Shalom ({totalCount})</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
