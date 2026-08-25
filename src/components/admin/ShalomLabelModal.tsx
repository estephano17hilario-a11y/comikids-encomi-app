import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pedido, TallerConfig } from '../../types/database.types';
import { ShalomLabelPrint } from './ShalomLabelPrint';
import { X, Printer, FileText } from 'lucide-react';
import { printElement } from '../../utils/nativePrintService';

interface Props {
  pedido: Pedido;
  tallerConfig: TallerConfig;
  onClose: () => void;
}

export const ShalomLabelModal: React.FC<Props> = ({ pedido, tallerConfig, onClose }) => {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await printElement('shalom-print-area', `Rotulo_${pedido.codigo_seguimiento}`);
    } catch (err) {
      console.error('Error al imprimir:', err);
      window.print();
    } finally {
      setPrinting(false);
    }
  };

  const clientName = pedido.usuario?.nombre_completo || 'Cliente';
  const isShalom = pedido.metodo_envio_codigo === 'shalom' || pedido.destino_detalle?.toLowerCase().includes('shalom');

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl glass-panel p-5 sm:p-6 border border-cyan-500/40 shadow-2xl shadow-cyan-500/10 my-8">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 mb-3.5 print:hidden" data-no-print="true">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {isShalom ? 'Rótulo Oficial de Envío Shalom' : 'Rótulo Oficial de Despacho Motorizado'}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Pedido: #{pedido.codigo_seguimiento} • {clientName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Label Preview */}
        <div className="mb-4 p-3 bg-slate-950/90 rounded-2xl border border-slate-800 flex justify-center overflow-x-auto print:p-0 print:m-0 print:border-none print:bg-white">
          <ShalomLabelPrint pedido={pedido} tallerConfig={tallerConfig} />
        </div>

        {/* ÚNICO BOTÓN PRINCIPAL PARA IMPRIMIR */}
        <div className="print:hidden pt-2" data-no-print="true">
          <button
            type="button"
            onClick={handlePrint}
            disabled={printing}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-400 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-base flex items-center justify-center gap-3 shadow-xl shadow-cyan-500/30 transition-all active:scale-[0.98] cursor-pointer group disabled:opacity-50"
          >
            <Printer className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
            <span>{printing ? 'Enviando a impresora...' : 'IMPRIMIR RÓTULO'}</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};

