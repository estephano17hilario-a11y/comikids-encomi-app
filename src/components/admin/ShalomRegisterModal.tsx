import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Pedido, TallerConfig } from '../../types/database.types';
import { downloadShalomExcel, extractShalomDni, extractShalomPhone, extractShalomDestino, extractShalomOrigen } from '../../utils/shalomExcelExporter';
import {
  X,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Package,
  ShieldCheck,
  Building2,
  Users
} from 'lucide-react';

interface Props {
  pedidos: Pedido[];
  tallerConfig: TallerConfig;
  onClose: () => void;
  onRegistered: (registeredOrderIds: string[]) => Promise<void>;
}

export const ShalomRegisterModal: React.FC<Props> = ({ pedidos, tallerConfig, onClose, onRegistered }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const origen = extractShalomOrigen(tallerConfig);

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn" data-no-print="true">
      <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border border-cyan-500/40 p-5 sm:p-7 shadow-2xl shadow-cyan-500/15 space-y-5 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-500/20">
              <FileSpreadsheet className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                ¿Seguro que deseas registrar en Shalom?
              </h3>
              <p className="text-xs text-cyan-300 font-medium">
                Generador de Plantilla Masiva Oficial • {totalCount} {totalCount === 1 ? 'pedido' : 'pedidos'}
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

        {/* Validation Warnings Card */}
        <div className="space-y-3 bg-slate-950/80 border border-slate-800 p-4 rounded-2xl shrink-0">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
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
                {isCountValid ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
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
                {!hasExcessiveRecipient ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                <span className="font-bold">Hasta 10 encomiendas por destinatario</span>
              </div>
              <span className="font-mono font-black text-xs">
                {!hasExcessiveRecipient ? `Máx. ${maxRecipientCount} ✓` : `${excessiveRecipient?.name}: ${excessiveRecipient?.count} ❌`}
              </span>
            </div>

            {/* Regla 3: Los datos deben coincidir con el formato */}
            <div className="p-2.5 rounded-xl border bg-cyan-500/10 border-cyan-500/30 text-cyan-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                <span className="font-bold">Los datos deben coincidir con el formato</span>
              </div>
              <span className="text-[11px] font-mono">13 cols • PAQUETE XXS • 0</span>
            </div>

          </div>
        </div>

        {/* Config Summary Info */}
        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-slate-300">
            <Building2 className="w-4 h-4 text-purple-400" />
            <span>Agencia Origen:</span>
            <strong className="text-white font-bold">{origen}</strong>
          </div>
          <span className="text-[11px] text-amber-300 font-bold">
            Medidas: 0 (Sin especificar)
          </span>
        </div>

        {/* Scrollable Order List Summary */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[140px]">
          <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 sticky top-0 bg-slate-900 py-1">
            <Package className="w-3.5 h-3.5 text-cyan-400" />
            <span>Pedidos a incluir en la plantilla ({pedidos.length})</span>
          </h5>

          {pedidos.map((p, i) => {
            const dni = extractShalomDni(p);
            const phone = extractShalomPhone(p);
            const destino = extractShalomDestino(p.destino_detalle);

            return (
              <div
                key={p.id}
                className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <strong className="text-white font-bold block truncate">
                      {p.usuario?.nombre_completo || 'Cliente'}
                    </strong>
                    <span className="text-[10px] text-slate-400 font-mono">
                      DNI: {dni} • Cel: {phone || 'Sin cel'}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {destino}
                  </span>
                </div>
              </div>
            );
          })}
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
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25 cursor-pointer active:scale-95'
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
