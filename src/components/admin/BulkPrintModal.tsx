import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pedido, TallerConfig } from '../../types/database.types';
import { X, Printer, Download, CheckCircle, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface Props {
  pedidos: Pedido[];
  tallerConfig: TallerConfig;
  onClose: () => void;
  onPrintComplete?: (printedOrderIds: string[]) => void;
}

export const BulkPrintModal: React.FC<Props> = ({ pedidos, tallerConfig: _tallerConfig, onClose, onPrintComplete }) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Deduplica pedidos por ID para evitar duplicaciones
  const uniquePedidos = Array.from(new Map(pedidos.map(p => [p.id, p])).values());

  const handlePrint = () => {
    window.print();
    if (onPrintComplete) {
      onPrintComplete(uniquePedidos.map(p => p.id));
    }
  };

  // Generador de PDF multi-página A4
  const handleDownloadPdf = async () => {
    const pageElements = document.querySelectorAll<HTMLElement>('.a4-print-page');
    if (!pageElements || pageElements.length === 0) {
      alert('No se encontraron rótulos para generar el PDF.');
      return;
    }

    setDownloading(true);
    setDownloadProgress('Preparando PDF...');

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < pageElements.length; i++) {
        setDownloadProgress(`Procesando hoja ${i + 1} de ${pageElements.length}...`);
        const el = pageElements[i];

        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        if (i > 0) {
          pdf.addPage('a4', 'portrait');
        }

        // Ajustar imagen a tamaño A4 con margen de 5mm
        const margin = 5;
        const availableW = pdfWidth - (margin * 2);
        const availableH = pdfHeight - (margin * 2);
        const imgRatio = canvas.height / canvas.width;
        let renderW = availableW;
        let renderH = renderW * imgRatio;

        if (renderH > availableH) {
          renderH = availableH;
          renderW = renderH / imgRatio;
        }

        const posX = margin + (availableW - renderW) / 2;
        const posY = margin + (availableH - renderH) / 2;

        pdf.addImage(imgData, 'JPEG', posX, posY, renderW, renderH);
      }

      setDownloadProgress('Descargando archivo...');
      const dateStr = new Date().toISOString().slice(0, 10);
      pdf.save(`Rotulos_Encomi_ComiKids_${dateStr}_(${uniquePedidos.length}pedidos).pdf`);

      if (onPrintComplete) {
        onPrintComplete(uniquePedidos.map(p => p.id));
      }

      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 4000);
    } catch (err) {
      console.error('Error generando PDF de rótulos:', err);
      alert('Hubo un problema al generar el PDF. Puedes usar la opción de Imprimir.');
    } finally {
      setDownloading(false);
      setDownloadProgress('');
    }
  };

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
    if (pedido.usuario?.dni && pedido.usuario.dni.length === 8 && !pedido.usuario.dni.startsWith('9')) {
      return pedido.usuario.dni;
    }
    if (pedido.usuario?.dni_default) {
      return pedido.usuario.dni_default;
    }
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
    <div className="bulk-print-overlay fixed inset-0 z-9999 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      
      {/* Contenedor Principal en Pantalla */}
      <div className="bulk-print-modal-box w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-white/15 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Header de Controles (No imprimible) */}
        <div className="print:hidden p-3.5 sm:p-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-slate-950/95 shrink-0" data-no-print="true">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-lg font-bold border border-cyan-500/30 shrink-0">
              📄
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2 flex-wrap">
                <span>Rótulos A4 Oficiales</span>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {uniquePedidos.length} {uniquePedidos.length === 1 ? 'rótulo' : 'rótulos'} • {pages.length} {pages.length === 1 ? 'hoja A4' : 'hojas A4'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Logo ComiKids • Shalom / Motorizado • Formato A4 Blanco y Negro
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Botón Descargar PDF (Funciona en Celulares y PC) */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 active:scale-95 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{downloadProgress || 'Generando PDF...'}</span>
                </>
              ) : successMsg ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-300" />
                  <span>¡PDF Guardado!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Descargar PDF A4 ({uniquePedidos.length})</span>
                </>
              )}
            </button>

            {/* Botón Imprimir Nativo */}
            <button
              type="button"
              onClick={handlePrint}
              className="py-2.5 px-3.5 rounded-xl bg-white hover:bg-slate-200 active:scale-95 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
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

        {/* Área de Visualización y Rótulos Imprimibles */}
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto bg-slate-950 print:bg-white print:p-0 print:m-0 print:overflow-visible">
          
          {pages.map((pageOrders, pageIndex) => (
            <div
              key={pageIndex}
              className="a4-print-page grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-white text-black p-3 print:p-0 rounded-2xl print:rounded-none shadow-xl print:shadow-none mb-6 print:mb-0"
            >
              {pageOrders.map((pedido) => {
                const isShalom = pedido.metodo_envio_codigo === 'shalom';
                const clientDni = getClientDni(pedido);
                const shalomAgency = getShalomAgencyOnly(pedido.destino_detalle);
                const clientPhone = pedido.usuario?.telefono_default || (pedido.usuario?.dni?.length === 9 ? pedido.usuario.dni : '');

                return (
                  <div
                    key={pedido.id}
                    className="a4-rotulo-card border-2 border-dashed border-black rounded-xl p-3 bg-white text-black flex flex-col justify-between break-inside-avoid relative overflow-hidden min-h-[220px]"
                  >
                    {/* Header: Logo Oficial ComiKids Grande & Slogan & Badge con Logo Shalom / Moto */}
                    <div className="flex items-center justify-between border-b-2 border-black pb-1.5 shrink-0">
                      <div className="flex items-center gap-2.5">
                        <img 
                          src="/Comikids.png" 
                          alt="ComiKids" 
                          className="w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0" 
                        />
                        <div>
                          <strong className="text-base sm:text-lg font-black tracking-tight uppercase block leading-none">
                            ComiKids
                          </strong>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 leading-none">
                          ENCOMI
                        </span>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border-2 border-black bg-slate-100 mt-1 leading-none">
                          {isShalom ? (
                            <>
                              <img 
                                src="/Shalom-Courier-Logo.webp" 
                                alt="Shalom" 
                                className="h-4 w-auto object-contain shrink-0"
                              />
                              <span className="text-[10px] font-black uppercase tracking-wider text-black">
                                SHALOM
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-base leading-none">🛵</span>
                              <span className="text-[10px] font-black uppercase tracking-wider text-black">
                                MOTORIZADO
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Essential Shipment Details */}
                    <div className="flex-1 flex flex-col justify-around py-1 space-y-1 overflow-hidden">
                      
                      {/* Destinatario */}
                      <div className="border-b border-dashed border-slate-300 pb-0.5">
                        <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-widest block leading-none">
                          DESTINATARIO:
                        </span>
                        <strong className="text-base sm:text-[17px] font-black text-black block leading-tight pt-0.5 line-clamp-2 uppercase">
                          {pedido.usuario?.nombre_completo || 'Cliente'}
                        </strong>
                      </div>

                      {/* DNI (Shalom) or WhatsApp Phone (Motorizado) */}
                      {isShalom ? (
                        <div className="border-b border-dashed border-slate-300 pb-0.5">
                          <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-widest block leading-none">
                            DNI / DOCUMENTO RECOJO:
                          </span>
                          <strong className="text-base sm:text-lg font-mono font-black text-black block leading-tight pt-0.5">
                            {clientDni}
                          </strong>
                        </div>
                      ) : (
                        <div className="border-b border-dashed border-slate-300 pb-0.5">
                          <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-widest block leading-none">
                            TELÉFONO / WHATSAPP:
                          </span>
                          <strong className="text-base sm:text-lg font-mono font-black text-black block leading-tight pt-0.5">
                            {clientPhone ? `+51 ${clientPhone}` : 'No registrado'}
                          </strong>
                        </div>
                      )}

                      {/* Agencia Shalom Completa o Dirección Motorizado */}
                      <div className="pt-0.5">
                        <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-widest block leading-none">
                          {isShalom ? 'SUCURSAL / AGENCIA SHALOM:' : 'DIRECCIÓN DE ENTREGA:'}
                        </span>
                        <p className="text-xs sm:text-[14px] font-black text-black leading-snug pt-0.5 line-clamp-3">
                          {isShalom ? shalomAgency : pedido.destino_detalle}
                        </p>
                      </div>

                    </div>

                    {/* Footer */}
                    <div className="pt-1.5 border-t-2 border-black flex items-center justify-between text-[9.5px] font-black text-slate-700 leading-none shrink-0">
                      <div className="flex items-center gap-1">
                        <span>📦</span>
                        <span>Paquete de Despacho Seguro</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>★ ★ ★</span>
                        <span>Encomi Envíos</span>
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
