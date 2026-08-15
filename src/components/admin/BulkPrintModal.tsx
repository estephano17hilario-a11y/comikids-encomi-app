import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  // Deduplica pedidos por ID para evitar duplicaciones
  const uniquePedidos = Array.from(new Map(pedidos.map(p => [p.id, p])).values());

  // Divide en grupos exactos de 6 pedidos por cada hoja A4 (2 columnas x 3 filas)
  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const pages = chunkArray(uniquePedidos, 6);

  const getShalomAgencyOnly = (fullDestino: string) => {
    let clean = fullDestino || '';
    clean = clean.replace(/Agencia Shalom:\s*/i, '');
    clean = clean.replace(/\(DNI\/CE.*?\)/i, '').trim();
    return clean;
  };

  const getClientDni = (pedido: Pedido) => {
    // 1. DNI directo del usuario si no es celular
    if (pedido.usuario?.dni && pedido.usuario.dni.length === 8 && !pedido.usuario.dni.startsWith('9')) {
      return pedido.usuario.dni;
    }
    if (pedido.usuario?.dni_default) {
      return pedido.usuario.dni_default;
    }
    // 2. Extraer del texto de destino e.g. "DNI/CE Recojo: 74561234"
    if (pedido.destino_detalle) {
      const match = pedido.destino_detalle.match(/(?:DNI|CE|Recojo)[\s:]*([0-9A-Za-z]{7,12})/i);
      if (match && match[1] && match[1].toLowerCase() !== 'recojo') {
        return match[1];
      }
    }
    if (pedido.usuario?.dni && pedido.usuario.dni.toLowerCase() !== 'recojo') {
      return pedido.usuario.dni;
    }
    return 'No registrado';
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn" data-no-print="true">
      
      {/* Contenedor Principal en Pantalla */}
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-white/15 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Header de Controles (No imprimible) */}
        <div className="print:hidden p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/90 shrink-0" data-no-print="true">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 text-white flex items-center justify-center text-xl font-bold border border-white/20">
              📄
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>Rótulos A4 Blanco y Negro (6 por Hoja)</span>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-white/10 text-slate-200 border border-white/20">
                  {uniquePedidos.length} {uniquePedidos.length === 1 ? 'rótulo' : 'rótulos'} • {pages.length} {pages.length === 1 ? 'hoja A4' : 'hojas A4'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Formato 2x3 • 6 rótulos exactos por hoja • Sin saltos de página ni duplicaciones
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="py-2.5 px-4 sm:px-5 rounded-2xl bg-white hover:bg-slate-200 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir en Hoja A4 ({uniquePedidos.length})</span>
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
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto bg-slate-950 print:bg-white print:p-0 print:m-0 print:overflow-visible">
          
          {pages.map((pageOrders, pageIndex) => (
            <div
              key={pageIndex}
              className="a4-print-page grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white text-black p-3 print:p-0 rounded-2xl print:rounded-none shadow-xl print:shadow-none mb-6 print:mb-0"
            >
              {pageOrders.map((pedido) => {
                const isShalom = pedido.metodo_envio_codigo === 'shalom';
                const clientDni = getClientDni(pedido);
                const shalomAgency = getShalomAgencyOnly(pedido.destino_detalle);
                const clientPhone = pedido.usuario?.telefono_default || (pedido.usuario?.dni?.length === 9 ? pedido.usuario.dni : '');

                return (
                  <div
                    key={pedido.id}
                    className="a4-rotulo-card border-2 border-dashed border-black rounded-xl p-2.5 bg-white text-black flex flex-col justify-between break-inside-avoid relative overflow-hidden"
                  >
                    {/* Header: ComiKids & Slogan "Crea tu propia historia" & Encomi */}
                    <div className="flex items-center justify-between border-b-2 border-black pb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base leading-none">🧸</span>
                        <div>
                          <strong className="text-sm sm:text-[15px] font-black tracking-tight uppercase block leading-none">
                            ComiKids
                          </strong>
                          <span className="text-[8.5px] font-black text-slate-800 tracking-wide block pt-0.5 leading-none">
                            ✨ Crea tu propia historia ✨
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end">
                        <span className="text-[9.5px] font-black uppercase tracking-widest text-slate-900 leading-none">
                          ENCOMI
                        </span>
                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase border border-black bg-slate-100 mt-0.5 leading-none">
                          {isShalom ? 'SHALOM' : 'MOTORIZADO'}
                        </span>
                      </div>
                    </div>

                    {/* Essential Shipment Details (Aprovechando todo el espacio disponible) */}
                    <div className="space-y-1 text-xs flex-1 flex flex-col justify-around py-1">
                      
                      {/* Destinatario (Grande y en 2 líneas si es necesario) */}
                      <div className="border-b border-dashed border-slate-300 pb-0.5">
                        <span className="text-[8.5px] font-black text-slate-600 uppercase tracking-wider block leading-none">
                          DESTINATARIO:
                        </span>
                        <strong className="text-sm sm:text-[15px] font-black text-black block leading-tight pt-0.5 line-clamp-2 uppercase">
                          {pedido.usuario?.nombre_completo || 'Cliente'}
                        </strong>
                      </div>

                      {/* DNI (Shalom) or WhatsApp Phone (Motorizado) */}
                      {isShalom ? (
                        <div className="border-b border-dashed border-slate-300 pb-0.5">
                          <span className="text-[8.5px] font-black text-slate-600 uppercase tracking-wider block leading-none">
                            DNI / DOCUMENTO RECOJO:
                          </span>
                          <strong className="text-sm font-mono font-black text-black block leading-tight pt-0.5">
                            {clientDni}
                          </strong>
                        </div>
                      ) : (
                        <div className="border-b border-dashed border-slate-300 pb-0.5">
                          <span className="text-[8.5px] font-black text-slate-600 uppercase tracking-wider block leading-none">
                            TELÉFONO / WHATSAPP:
                          </span>
                          <strong className="text-sm font-mono font-black text-black block leading-tight pt-0.5">
                            {clientPhone ? `+51 ${clientPhone}` : 'No registrado'}
                          </strong>
                        </div>
                      )}

                      {/* Agencia Shalom Completa o Dirección Motorizado */}
                      <div className="pt-0.5">
                        <span className="text-[8.5px] font-black text-slate-600 uppercase tracking-wider block leading-none">
                          {isShalom ? 'SUCURSAL / AGENCIA SHALOM:' : 'DIRECCIÓN DE ENTREGA:'}
                        </span>
                        <p className="text-xs sm:text-[12.5px] font-black text-black leading-tight pt-0.5 line-clamp-3">
                          {isShalom ? shalomAgency : pedido.destino_detalle}
                        </p>
                      </div>

                    </div>

                    {/* Footer: Disney Line-Art Amigable */}
                    <div className="pt-1 border-t border-black flex items-center justify-between text-[8px] font-bold text-slate-700 leading-none">
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

    </div>,
    document.body
  );
};
