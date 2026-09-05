import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Pedido, TallerConfig, MetodoEnvio } from '../../types/database.types';
import { ShalomLabelPrint } from './ShalomLabelPrint';
import { X, Printer, FileText, Droplet } from 'lucide-react';
import { printElement } from '../../utils/nativePrintService';
import { InkSavingLevel, INK_SAVING_LEVELS } from '../../utils/inkSavingService';
import { ordersService } from '../../services/ordersService';
import { resolveOrderShippingMethod } from '../../utils/shippingMethodMatcher';

interface Props {
  pedido: Pedido;
  tallerConfig: TallerConfig;
  onClose: () => void;
}

export const ShalomLabelModal: React.FC<Props> = ({ pedido, tallerConfig, onClose }) => {
  const [printing, setPrinting] = useState(false);
  const [inkSavingLevel, setInkSavingLevel] = useState<InkSavingLevel>(0);
  const [methods, setMethods] = useState<MetodoEnvio[]>(() => ordersService.getShippingMethods());

  useEffect(() => {
    const handleUpdate = () => {
      setMethods(ordersService.getShippingMethods());
    };
    window.addEventListener('incomi_shipping_methods_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('incomi_shipping_methods_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const agencyMethod = useMemo(() => {
    return resolveOrderShippingMethod(pedido, methods);
  }, [pedido, methods]);

  const [orientacion, setOrientacion] = useState<'horizontal' | 'vertical'>(
    () => agencyMethod?.config_rotulado?.orientacion || 'horizontal'
  );

  useEffect(() => {
    if (agencyMethod?.config_rotulado?.orientacion) {
      setOrientacion(agencyMethod.config_rotulado.orientacion);
    }
  }, [agencyMethod?.id, agencyMethod?.config_rotulado?.orientacion]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await printElement('shalom-print-area', `Rotulo_${pedido.codigo_seguimiento}_Eco${inkSavingLevel}_${orientacion}`);
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
                {agencyMethod?.nombre ? `Rótulo: ${agencyMethod.nombre}` : (isShalom ? 'Rótulo Oficial Shalom' : 'Rótulo Oficial de Despacho')}
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

        {/* SELECTOR DE ORIENTACIÓN: ECHADO (HORIZONTAL) VS PARADO (VERTICAL) */}
        <div className="mb-3 p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2 print:hidden" data-no-print="true">
          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <span>📐</span>
            <span>Orientación:</span>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOrientacion('horizontal')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                orientacion === 'horizontal'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black shadow-md shadow-cyan-500/20 scale-[1.02]'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>🖼️</span>
              <span>Echado (Horizontal)</span>
            </button>
            <button
              type="button"
              onClick={() => setOrientacion('vertical')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                orientacion === 'vertical'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-black shadow-md shadow-purple-500/20 scale-[1.02]'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>📄</span>
              <span>Parado (Vertical)</span>
            </button>
          </div>
        </div>

        {/* SELECTOR DE AHORRO DE TINTA / ECO-PRINT (0%, 25%, 50%, 75%, 90%) */}
        <div className="mb-3.5 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 print:hidden" data-no-print="true">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-slate-200 flex items-center gap-1.5">
              <Droplet className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ahorro de Tinta Inteligente:</span>
            </span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {INK_SAVING_LEVELS[inkSavingLevel].badge}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {(Object.keys(INK_SAVING_LEVELS) as unknown as InkSavingLevel[]).map((lvl) => {
              const opt = INK_SAVING_LEVELS[lvl];
              const isSelected = inkSavingLevel === Number(lvl);
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setInkSavingLevel(Number(lvl) as InkSavingLevel)}
                  className={`py-1.5 px-1 rounded-xl text-center transition-all cursor-pointer text-xs font-bold ${
                    isSelected
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25 scale-[1.02]'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80 border border-slate-700/60'
                  }`}
                >
                  <span className="block text-[11px] font-black">{opt.level}%</span>
                  <span className="block text-[8px] opacity-80 leading-none truncate">
                    {opt.level === 0 ? 'Normal' : opt.level === 90 ? 'Ultra' : 'Eco'}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 leading-tight">
            💡 {INK_SAVING_LEVELS[inkSavingLevel].description}
          </p>
        </div>

        {/* Label Preview (Live dynamic Eco preview) */}
        <div className="mb-4 p-3 bg-slate-950/90 rounded-2xl border border-slate-800 flex justify-center overflow-x-auto print:p-0 print:m-0 print:border-none print:bg-white">
          <ShalomLabelPrint
            pedido={pedido}
            tallerConfig={tallerConfig}
            inkSavingLevel={inkSavingLevel}
            orientacionOverride={orientacion}
            customMethodOverride={agencyMethod}
            estiloRotuloOverride={agencyMethod?.config_rotulado?.estilo_rotulo}
          />
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


