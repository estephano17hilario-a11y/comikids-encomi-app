import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pedido, TallerConfig } from '../../types/database.types';
import { X, Printer, Layers, Droplet } from 'lucide-react';
import { printMultipleElements } from '../../utils/nativePrintService';
import { InkSavingLevel, INK_SAVING_LEVELS, getInkSavingStyles } from '../../utils/inkSavingService';

interface Props {
  pedidos: Pedido[];
  tallerConfig: TallerConfig;
  onClose: () => void;
  onPrintComplete?: (printedOrderIds: string[]) => void;
}

export const BulkPrintModal: React.FC<Props> = ({ pedidos, tallerConfig: _tallerConfig, onClose, onPrintComplete }) => {
  const [printing, setPrinting] = useState(false);
  const [inkSavingLevel, setInkSavingLevel] = useState<InkSavingLevel>(0);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Deduplicación estricta por ID y código de seguimiento para evitar cualquier repetición
  const uniquePedidos = Array.from(
    new Map(pedidos.map(p => [p.id || p.codigo_seguimiento, p])).values()
  );

  // Imprimir Rótulos
  const handlePrintDirect = async () => {
    setPrinting(true);
    try {
      await printMultipleElements(
        '.a4-print-page',
        `Rotulos_ComiKids_${uniquePedidos.length}pedidos_Eco${inkSavingLevel}`
      );

      if (onPrintComplete) {
        onPrintComplete(uniquePedidos.map(p => p.id));
      }
    } catch (err) {
      console.error('Error al imprimir rótulos:', err);
      window.print();
    } finally {
      setPrinting(false);
    }
  };

  // Divide en grupos de exactamente 6 pedidos por cada hoja A4 (2 columnas x 3 filas)
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
    if (pedido.usuario?.dni && pedido.usuario.dni.length >= 8 && !pedido.usuario.dni.startsWith('9')) {
      return pedido.usuario.dni;
    }
    if (pedido.usuario?.dni_default) {
      return pedido.usuario.dni_default;
    }
    if (pedido.destino_detalle) {
      const match = pedido.destino_detalle.match(/(?:DNI|CE|Doc)[\s:]*([0-9A-Za-z]{7,12})/i);
      if (match && match[1]) {
        return match[1];
      }
    }
    return pedido.usuario?.dni || 'No registrado';
  };

  const eco = getInkSavingStyles(inkSavingLevel);

  return createPortal(
    <div className="bulk-print-overlay fixed inset-0 z-9999 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      
      {/* Contenedor Principal en Pantalla */}
      <div className="bulk-print-modal-box w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-white/15 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Header de Controles (No imprimible) */}
        <div className="print:hidden p-3.5 sm:p-4 border-b border-white/10 flex flex-col gap-3 bg-slate-950/95 shrink-0" data-no-print="true">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-lg font-bold border border-cyan-500/30 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2 flex-wrap">
                  <span>Rótulos de Despacho (6 por Hoja A4)</span>
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {uniquePedidos.length} {uniquePedidos.length === 1 ? 'rótulo' : 'rótulos'} • {pages.length} {pages.length === 1 ? 'hoja A4' : 'hojas A4'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 truncate">
                  DNI Grande & Recorte exacto 2x3 • Sin hojas en blanco intermedias
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Único botón: Imprimir Rótulos */}
              <button
                type="button"
                onClick={handlePrintDirect}
                disabled={printing}
                className="py-2.5 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-400 hover:from-cyan-400 hover:to-blue-500 active:scale-[0.98] text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-cyan-500/30 transition-all cursor-pointer disabled:opacity-50"
                title="Imprimir rótulos en tu impresora"
              >
                <Printer className="w-4 h-4 text-white" />
                <span>{printing ? 'Enviando a impresora...' : 'IMPRIMIR RÓTULOS'}</span>
              </button>

              {/* Botón Cerrar */}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* BARRA DE AHORRO DE TINTA / ECO-PRINT (0%, 25%, 50%, 75%, 90%) */}
          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-300">
              <Droplet className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ahorro de Tinta:</span>
            </div>

            <div className="flex items-center gap-1">
              {(Object.keys(INK_SAVING_LEVELS) as unknown as InkSavingLevel[]).map((lvl) => {
                const opt = INK_SAVING_LEVELS[lvl];
                const isSelected = inkSavingLevel === Number(lvl);
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setInkSavingLevel(Number(lvl) as InkSavingLevel)}
                    className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    {opt.level}%
                  </button>
                );
              })}
            </div>

            <span className="text-[10px] text-slate-400 font-medium">
              💡 {INK_SAVING_LEVELS[inkSavingLevel].description}
            </span>
          </div>
        </div>

        {/* Área de Visualización y Rótulos Imprimibles */}
        <div className="flex-1 p-2 sm:p-4 overflow-y-auto bg-slate-950 print:bg-white print:p-0 print:m-0 print:overflow-visible flex flex-col items-center">
          
          {pages.map((pageOrders, pageIndex) => (
            <div
              key={pageIndex}
              className="a4-print-page bg-white text-black p-3 print:p-0 rounded-2xl print:rounded-none shadow-2xl print:shadow-none mb-6 print:mb-0 box-border"
              style={{
                width: '100%',
                maxWidth: '794px',
                minHeight: 'auto',
                boxSizing: 'border-box',
                fontFamily: eco.fontFamily,
              }}
            >
              <div className="grid grid-cols-2 grid-rows-3 gap-2.5 w-full h-full">
                {pageOrders.map((pedido) => {
                  const isShalom = pedido.metodo_envio_codigo === 'shalom' || pedido.destino_detalle?.toLowerCase().includes('shalom');
                  const isOlva = pedido.metodo_envio_codigo === 'olva' || pedido.destino_detalle?.toLowerCase().includes('olva');
                  const clientDni = getClientDni(pedido);
                  const shalomAgency = getShalomAgencyOnly(pedido.destino_detalle);
                  const clientPhone = pedido.usuario?.telefono_default || (pedido.usuario?.dni?.length === 9 ? pedido.usuario.dni : '');

                  return (
                    <div
                      key={pedido.id}
                      className={`a4-rotulo-card rounded-xl p-2.5 bg-white text-black flex flex-col justify-between break-inside-avoid relative overflow-hidden box-border h-[345px] max-h-[345px] ${
                        inkSavingLevel >= 75
                          ? 'border border-dashed border-slate-700'
                          : 'border-2 border-dashed border-black'
                      }`}
                    >
                      {/* Header: Logo Oficial ComiKids & Badge Shalom / Olva / Moto */}
                      <div className="flex items-center justify-between border-b-2 border-black pb-1.5 shrink-0">
                        <div className="flex items-center gap-2">
                          <img 
                            src="/Comikids.png" 
                            alt="ComiKids" 
                            className={`w-8 h-8 object-contain shrink-0 ${inkSavingLevel >= 75 ? 'grayscale' : ''}`}
                          />
                          <div>
                            <strong className="text-xs sm:text-sm font-black tracking-tight uppercase block leading-none text-black">
                              ComiKids
                            </strong>
                            <span className="text-[8.5px] font-black uppercase tracking-widest text-slate-600 block mt-0.5">
                              ENCOMI ENVÍOS
                            </span>
                          </div>
                        </div>

                        <div className="text-right flex flex-col items-end">
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded border border-black leading-none ${
                            inkSavingLevel >= 50
                              ? 'bg-white text-black'
                              : isOlva ? 'bg-yellow-300' : 'bg-slate-100'
                          }`}>
                            {isOlva ? (
                              <>
                                <img 
                                  src="/Olva-Courier-Logo.svg" 
                                  alt="Olva" 
                                  className="h-3 w-auto object-contain shrink-0" 
                                />
                                <span className="text-[8.5px] font-black uppercase tracking-wider text-black">
                                  OLVA COURIER
                                </span>
                              </>
                            ) : isShalom ? (
                              <>
                                <img 
                                  src="/Shalom-Courier-Logo.webp" 
                                  alt="Shalom" 
                                  className="h-3 w-auto object-contain shrink-0" 
                                />
                                <span className="text-[8.5px] font-black uppercase tracking-wider text-black">
                                  SHALOM
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-xs leading-none">🛵</span>
                                <span className="text-[8.5px] font-black uppercase tracking-wider text-black">
                                  MOTORIZADO
                                </span>
                              </>
                            )}
                          </div>
                          <span className="font-mono text-[9.5px] font-black text-slate-900 mt-0.5">
                            #{pedido.codigo_seguimiento}
                          </span>
                        </div>
                      </div>

                      {/* Shipment Details */}
                      <div className="flex-1 flex flex-col justify-around py-1 space-y-1 overflow-hidden">
                        
                        {/* Destinatario */}
                        <div className="border-b border-dashed border-slate-300 pb-1">
                          <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest block leading-none">
                            DESTINATARIO:
                          </span>
                          <strong className="text-base sm:text-lg font-black text-black block leading-tight pt-0.5 line-clamp-1 uppercase tracking-tight">
                            {pedido.usuario?.nombre_completo || 'Cliente'}
                          </strong>
                        </div>

                        {/* DNI GIGANTE (REQ: DNI MAS GRANDE EN EL ROTULADO Y SIN TELÉFONO EN SHALOM) */}
                        <div className={`p-1.5 rounded border flex items-center ${isShalom ? 'justify-center py-2' : 'justify-between'} ${
                          inkSavingLevel >= 75
                            ? 'bg-white border-black'
                            : 'bg-slate-100 border-slate-400'
                        }`}>
                          <div className={isShalom ? 'text-center w-full' : ''}>
                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block leading-none mb-0.5">
                              🪪 DNI RECOJO:
                            </span>
                            <span className="text-xl sm:text-2xl font-mono font-black text-black tracking-widest block leading-tight">
                              {clientDni}
                            </span>
                          </div>
                          {!isShalom && (
                            <div className="text-right">
                              <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block leading-none">
                                TELÉFONO:
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-900 block leading-tight">
                                {clientPhone ? `+51 ${clientPhone}` : (pedido.usuario?.telefono_default || '-')}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Agencia o Dirección Completa */}
                        <div className="pt-0.5">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block leading-none">
                            {isShalom ? 'SUCURSAL / AGENCIA SHALOM:' : 'DIRECCIÓN DE ENTREGA:'}
                          </span>
                          <p className="text-[10px] font-black text-black leading-tight pt-0.5 break-words">
                            {isShalom ? shalomAgency : pedido.destino_detalle}
                          </p>
                        </div>

                      </div>

                      {/* Footer */}
                      <div className="pt-1 border-t-2 border-black flex items-center justify-between text-[8px] font-black text-slate-700 leading-none shrink-0">
                        <div className="flex items-center gap-1">
                          <span>📦</span>
                          <span>Paquete de Despacho Seguro</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>★ ComiKids ★</span>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          ))}

        </div>

      </div>

    </div>,
    document.body
  );
};
