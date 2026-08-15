import React, { useEffect } from 'react';
import { Pedido, TallerConfig } from '../../types/database.types';
import { X, Printer } from 'lucide-react';

interface Props {
  pedidos: Pedido[];
  tallerConfig: TallerConfig;
  onClose: () => void;
}

export const BulkPrintModal: React.FC<Props> = ({ pedidos, tallerConfig, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  // Chunk orders in groups of 4 for A4 pages (2x2 grid per page)
  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const pages = chunkArray(pedidos, 4);

  // Helper to extract clean Shalom agency or Motorizado address without noise
  const getShalomAgencyOnly = (fullDestino: string) => {
    // If it has "Agencia Shalom: ... (DNI/CE...)", extract the clean agency name
    let clean = fullDestino;
    clean = clean.replace(/Agencia Shalom:\s*/i, '');
    clean = clean.replace(/\(DNI\/CE.*?\)/i, '').trim();
    return clean;
  };

  const getClientDni = (pedido: Pedido) => {
    if (pedido.usuario?.dni && pedido.usuario.dni.length === 8) {
      return pedido.usuario.dni;
    }
    if (pedido.usuario?.dni_default) {
      return pedido.usuario.dni_default;
    }
    // Extract from destino_detalle if exists e.g. "(DNI/CE Recojo: 74561234)"
    const match = pedido.destino_detalle?.match(/DNI\/CE.*?:?\s*([A-Za-z0-9]+)/i);
    if (match && match[1]) {
      return match[1];
    }
    return pedido.usuario?.dni || 'No registrado';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      
      {/* Contenedor Principal */}
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Header no imprimible */}
        <div className="print:hidden p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/90 shrink-0" data-no-print="true">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 text-white flex items-center justify-center text-xl font-bold border border-white/20">
              📄
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>Rótulos A4 Blanco y Negro (4 por Hoja)</span>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-white/10 text-slate-200 border border-white/20">
                  {pedidos.length} {pedidos.length === 1 ? 'rótulo' : 'rótulos'} • {pages.length} {pages.length === 1 ? 'hoja A4' : 'hojas A4'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Formato estándar hoja Bond A4 • Blanco y negro ahorrador de tinta • Líneas de corte
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="py-2 px-4 sm:px-5 rounded-2xl bg-white hover:bg-slate-200 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir en Hoja A4 ({pedidos.length})</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Área de Visualización y Rótulos Imprimibles */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-950 print:bg-white print:p-0 print:m-0 print:overflow-visible printable-a4-sheet">
          
          {pages.map((pageOrders, pageIndex) => (
            <div
              key={pageIndex}
              className={`grid grid-cols-1 sm:grid-cols-2 gap-3 print:grid-cols-2 print:gap-3 bg-white text-black p-4 print:p-2 rounded-2xl print:rounded-none shadow-xl print:shadow-none mb-6 print:mb-0 ${
                pageIndex < pages.length - 1 ? 'page-break' : ''
              }`}
              style={{
                minHeight: 'auto',
              }}
            >
              {pageOrders.map((pedido) => {
                const isShalom = pedido.metodo_envio_codigo === 'shalom';
                const clientDni = getClientDni(pedido);
                const shalomAgency = getShalomAgencyOnly(pedido.destino_detalle);
                const clientPhone = pedido.usuario?.telefono_default || (pedido.usuario?.dni?.length === 9 ? pedido.usuario.dni : '');

                return (
                  <div
                    key={pedido.id}
                    className="border-2 border-dashed border-black rounded-xl p-3.5 bg-white text-black flex flex-col justify-between break-inside-avoid relative overflow-hidden"
                    style={{
                      minHeight: '125mm',
                      maxHeight: '135mm',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Header: ComiKids & Encomi */}
                    <div className="flex items-center justify-between border-b-2 border-black pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">🧸</span>
                        <div>
                          <strong className="text-sm font-black tracking-tight uppercase block leading-none">
                            ComiKids
                          </strong>
                          <span className="text-[9px] font-bold text-slate-700 tracking-wider">
                            ✨ TALLER DE BORDADOS
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">
                          ENCOMI
                        </span>
                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase border border-black bg-slate-100">
                          {isShalom ? 'SHALOM' : 'MOTORIZADO'}
                        </span>
                      </div>
                    </div>

                    {/* Tracking Code & Simulated Barcode */}
                    <div className="my-2 py-1.5 px-2 bg-slate-50 rounded border border-black text-center">
                      <div className="flex items-center justify-center gap-1 text-[8px] font-bold text-slate-600 tracking-wider uppercase">
                        <span>★</span>
                        <span>CÓDIGO DE ENVÍO</span>
                        <span>★</span>
                      </div>
                      <p className="text-base font-black font-mono tracking-widest text-black">
                        {pedido.codigo_seguimiento}
                      </p>
                      
                      {/* Barcode line pattern (B&W ink-saver) */}
                      <div className="flex justify-center items-center gap-[2px] h-5 mt-1">
                        {[3, 1, 4, 2, 5, 2, 1, 3, 2, 4, 1, 2, 3, 4, 2, 3, 1, 5, 2, 3, 1, 4, 2, 3, 2, 4, 1, 2, 3, 1, 4].map((w, i) => (
                          <div
                            key={i}
                            className="bg-black h-full"
                            style={{ width: `${w}px` }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Essential Shipment Details (ONLY WHAT IS NEEDED) */}
                    <div className="space-y-2 text-xs flex-1 flex flex-col justify-center">
                      
                      {/* Destinatario */}
                      <div className="border-b border-dashed border-slate-300 pb-1.5">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider block">
                          DESTINATARIO:
                        </span>
                        <strong className="text-sm font-black text-black block leading-tight">
                          {pedido.usuario?.nombre_completo || 'Cliente'}
                        </strong>
                      </div>

                      {/* DNI (Shalom) or WhatsApp Phone (Motorizado) */}
                      {isShalom ? (
                        <div className="border-b border-dashed border-slate-300 pb-1.5">
                          <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider block">
                            DNI / DOCUMENTO RECOJO:
                          </span>
                          <strong className="text-sm font-mono font-black text-black">
                            {clientDni}
                          </strong>
                        </div>
                      ) : (
                        <div className="border-b border-dashed border-slate-300 pb-1.5">
                          <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider block">
                            TELÉFONO / WHATSAPP:
                          </span>
                          <strong className="text-sm font-mono font-black text-black">
                            {clientPhone ? `+51 ${clientPhone}` : 'No registrado'}
                          </strong>
                        </div>
                      )}

                      {/* Agencia Shalom Completa o Dirección Motorizado */}
                      <div>
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider block">
                          {isShalom ? 'SUCURSAL / AGENCIA SHALOM:' : 'DIRECCIÓN DE ENTREGA:'}
                        </span>
                        <p className="text-xs font-black text-black leading-snug">
                          {isShalom ? shalomAgency : pedido.destino_detalle}
                        </p>
                      </div>

                    </div>

                    {/* Footer: Disney Line-Art Amigable en Blanco y Negro */}
                    <div className="pt-2 border-t border-black flex items-center justify-between text-[8px] font-bold text-slate-600">
                      <div className="flex items-center gap-1">
                        <span>✨</span>
                        <span>¡Paquete con Magia y Amor!</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>★ ★ ★</span>
                        <span>ComiKids 2026</span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          ))}

        </div>

      </div>

    </div>
  );
};
