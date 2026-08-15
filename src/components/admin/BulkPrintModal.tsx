import React from 'react';
import { Pedido, TallerConfig } from '../../types/database.types';
import { X, Printer, Sparkles, Heart, Star, Package, Truck } from 'lucide-react';

interface Props {
  pedidos: Pedido[];
  tallerConfig: TallerConfig;
  onClose: () => void;
}

export const BulkPrintModal: React.FC<Props> = ({ pedidos, tallerConfig, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      
      {/* Contenedor no imprimible de controles */}
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Header no imprimible */}
        <div className="print:hidden p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-pink-500 to-yellow-400 text-white flex items-center justify-center text-xl font-bold shadow-lg shadow-pink-500/20">
              ✨
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>Rótulos Mágicos ComiKids • Edición Cómics</span>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-pink-500/20 text-pink-300 border border-pink-500/30">
                  {pedidos.length} {pedidos.length === 1 ? 'paquete' : 'paquetes'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Diseño exclusivo Disney/Comics de alta calidad para despacho en Shalom y Motorizado
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="py-2.5 px-5 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 hover:opacity-95 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-pink-500/25 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Rótulos ({pedidos.length})</span>
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Área de Rótulos Imprimibles */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-950 print:bg-white print:p-0 print:m-0 print:space-y-4 print:overflow-visible">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 print:grid-cols-2 print:gap-3">
            {pedidos.map((pedido, idx) => {
              const isShalom = pedido.metodo_envio_codigo === 'shalom';
              
              return (
                <div
                  key={pedido.id}
                  className="rounded-3xl border-4 border-dashed border-pink-400/60 p-5 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 print:bg-white print:border-black print:text-black space-y-3.5 break-inside-avoid shadow-2xl relative overflow-hidden"
                >
                  {/* Decorative Comic Background Elements */}
                  <div className="absolute top-2 right-2 text-2xl opacity-20 pointer-events-none select-none print:opacity-100 print:text-black">
                    🎈 ✨ 🚀
                  </div>

                  {/* Top Bar Marca ComiKids */}
                  <div className="flex items-center justify-between border-b-2 border-dashed pb-3 border-pink-500/40 print:border-black">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-pink-500 text-white flex items-center justify-center text-lg font-black shadow-md print:border print:border-black print:text-black print:bg-white">
                        🧸
                      </div>
                      <div>
                        <strong className="text-sm font-black tracking-tight text-white print:text-black uppercase block">
                          {tallerConfig.nombre_taller || 'ComiKids Bordados & Estilo'}
                        </strong>
                        <span className="text-[10px] text-pink-300 print:text-black font-bold flex items-center gap-1">
                          <span>✨ ¡Llegó tu Magia ComiKids!</span>
                          <span>💖</span>
                        </span>
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-pink-500 text-white border border-pink-400 shadow-md print:bg-black print:text-white print:border-black">
                      {isShalom ? '📦 AGENCIA SHALOM' : '🛵 MOTORIZADO LIMA'}
                    </span>
                  </div>

                  {/* Número de Seguimiento & Comic Bubble */}
                  <div className="text-center py-2.5 px-3 bg-pink-500/10 rounded-2xl border-2 border-pink-400/40 print:bg-slate-100 print:border-black">
                    <p className="text-[10px] uppercase font-black tracking-widest text-pink-300 print:text-black flex items-center justify-center gap-1.5">
                      <span>⭐</span>
                      <span>CÓDIGO DE SEGUIMIENTO</span>
                      <span>⭐</span>
                    </p>
                    <p className="text-lg sm:text-xl font-black font-mono tracking-widest text-white print:text-black pt-0.5">
                      {pedido.codigo_seguimiento}
                    </p>
                  </div>

                  {/* Datos del Destinatario */}
                  <div className="space-y-2.5 text-xs">
                    
                    <div className="p-2.5 bg-slate-950/70 rounded-xl border border-slate-800 print:bg-white print:border-black">
                      <span className="font-black text-pink-400 print:text-black block text-[10px] uppercase tracking-wider">
                        👤 DESTINATARIO VIP:
                      </span>
                      <div className="flex items-center justify-between pt-0.5">
                        <strong className="text-sm font-black text-white print:text-black">
                          {pedido.usuario?.nombre_completo || 'Cliente ComiKids'}
                        </strong>
                        {pedido.usuario?.dni && (
                          <span className="font-mono font-bold text-cyan-300 print:text-black">
                            DNI: {pedido.usuario.dni}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-950/70 rounded-xl border border-slate-800 print:bg-white print:border-black">
                      <span className="font-black text-cyan-400 print:text-black block text-[10px] uppercase tracking-wider">
                        📍 {isShalom ? 'AGENCIA SHALOM DE DESTINO:' : 'DIRECCIÓN DE ENTREGA:'}
                      </span>
                      <p className="font-bold text-slate-100 print:text-black text-xs leading-snug pt-0.5">
                        {pedido.destino_detalle}
                      </p>
                    </div>

                    {pedido.observaciones_cliente && (
                      <div className="p-2 bg-slate-950/70 rounded-xl border border-slate-800 print:bg-white print:border-black">
                        <span className="font-bold text-amber-400 print:text-black block text-[10px] uppercase">
                          💬 REFERENCIA / NOTAS:
                        </span>
                        <p className="text-slate-300 print:text-black text-[11px] italic">
                          {pedido.observaciones_cliente}
                        </p>
                      </div>
                    )}

                  </div>

                  {/* Barcode Simulator & Disney Comic Seal */}
                  <div className="pt-2 border-t-2 border-dashed border-slate-800 print:border-black flex items-center justify-between text-[10px]">
                    <div className="space-y-0.5">
                      <div className="font-mono text-[10px] tracking-widest text-slate-400 print:text-black select-none">
                        ||||| ||||||| ||| |||||||| ||||
                      </div>
                      <span className="text-[9px] text-slate-400 print:text-black block">
                        Taller: {tallerConfig.celular_taller || 'ComiKids'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 print:bg-white print:text-black print:border-black">
                        ★ 100% Amor & Estilo ★
                      </span>
                      <span className="text-[9px] text-slate-500 print:text-black block pt-0.5">
                        Paquete #{idx + 1} de {pedidos.length}
                      </span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

        </div>

      </div>

    </div>
  );
};
