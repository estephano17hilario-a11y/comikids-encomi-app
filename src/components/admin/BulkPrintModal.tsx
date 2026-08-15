import React from 'react';
import { Pedido, TallerConfig } from '../../types/database.types';
import { X, Printer, Package, Truck } from 'lucide-react';

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
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
              🖨️
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                Impresión Masiva de Rótulos ({pedidos.length} paquetes)
              </h3>
              <p className="text-xs text-slate-400">
                Guías y etiquetas oficiales listas para imprimir en Shalom o Motorizado
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="py-2.5 px-5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Todo ({pedidos.length})</span>
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3">
            {pedidos.map((pedido, idx) => {
              const isShalom = pedido.metodo_envio_codigo === 'shalom';
              
              return (
                <div
                  key={pedido.id}
                  className="rounded-2xl border-2 border-dashed border-slate-700 p-5 bg-slate-900/90 print:bg-white print:border-black print:text-black space-y-4 break-inside-avoid shadow-lg"
                >
                  {/* Top Bar Rótulo */}
                  <div className="flex items-center justify-between border-b pb-3 border-slate-800 print:border-black">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📦</span>
                      <strong className="text-xs sm:text-sm font-black tracking-tight text-white print:text-black uppercase">
                        {tallerConfig.nombre_taller || 'ComiKids Bordados'}
                      </strong>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 print:bg-slate-200 print:text-black print:border-black">
                      {isShalom ? 'AGENCIA SHALOM' : 'MOTORIZADO LIMA'}
                    </span>
                  </div>

                  {/* Número de Seguimiento & Barra */}
                  <div className="text-center py-2 bg-slate-950/70 rounded-xl border border-slate-800 print:bg-slate-100 print:border-black">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 print:text-slate-600">
                      CÓDIGO DE SEGUIMIENTO
                    </p>
                    <p className="text-base sm:text-lg font-black font-mono tracking-widest text-cyan-400 print:text-black">
                      {pedido.codigo_seguimiento}
                    </p>
                  </div>

                  {/* Datos del Destinatario */}
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-bold text-slate-400 print:text-slate-700 block text-[10px] uppercase">
                        DESTINATARIO:
                      </span>
                      <strong className="text-sm font-black text-white print:text-black">
                        {pedido.usuario?.nombre_completo || 'Cliente ComiKids'}
                      </strong>
                      {pedido.usuario?.dni && (
                        <span className="ml-2 font-mono text-slate-300 print:text-black">
                          (DNI: {pedido.usuario.dni})
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="font-bold text-slate-400 print:text-slate-700 block text-[10px] uppercase">
                        {isShalom ? 'AGENCIA DE DESTINO:' : 'DIRECCIÓN DE ENTREGA:'}
                      </span>
                      <p className="font-semibold text-slate-200 print:text-black leading-snug">
                        {pedido.destino_detalle}
                      </p>
                    </div>

                    {pedido.observaciones_cliente && (
                      <div>
                        <span className="font-bold text-slate-400 print:text-slate-700 block text-[10px] uppercase">
                          REFERENCIA / NOTAS:
                        </span>
                        <p className="text-slate-300 print:text-slate-800 italic">
                          {pedido.observaciones_cliente}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer Remitente */}
                  <div className="pt-3 border-t border-slate-800 print:border-black text-[10px] text-slate-400 print:text-slate-600 flex items-center justify-between">
                    <span>Remitente: {tallerConfig.celular_taller || 'ComiKids'}</span>
                    <span className="font-mono">Paquete #{idx + 1} de {pedidos.length}</span>
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
