import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pedido, TallerConfig } from '../../types/database.types';
import { X, Printer, Download, CheckCircle, Loader2, Share2 } from 'lucide-react';
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

  // Deduplica pedidos por ID
  const uniquePedidos = Array.from(new Map(pedidos.map(p => [p.id, p])).values());

  const handlePrintNative = () => {
    window.print();
    if (onPrintComplete) {
      onPrintComplete(uniquePedidos.map(p => p.id));
    }
  };

  // Helper para generar el objeto jsPDF con todas las páginas renderizadas
  const generatePdfInstance = async (): Promise<jsPDF | null> => {
    const pageElements = document.querySelectorAll<HTMLElement>('.a4-print-page');
    if (!pageElements || pageElements.length === 0) {
      alert('No se encontraron rótulos para procesar.');
      return null;
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < pageElements.length; i++) {
      setDownloadProgress(`Renderizando hoja ${i + 1} de ${pageElements.length}...`);
      const el = pageElements[i];

      const canvas = await html2canvas(el, {
        scale: 2.2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }

      // Márgenes mínimos para aprovechar el 98% de la hoja A4 sin espacios muertos
      const margin = 4;
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

    return pdf;
  };

  // Imprimir con Apps de Impresoras (Epson iPrint, HP Smart, Mopria, etc.)
  const handleShareToPrinterApp = async () => {
    setDownloading(true);
    setDownloadProgress('Preparando para app de impresora...');

    try {
      const pdf = await generatePdfInstance();
      if (!pdf) return;

      const pdfBlob = pdf.output('blob');
      const fileName = `Rotulos_ComiKids_${uniquePedidos.length}pedidos.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Rótulos ComiKids A4',
          text: 'Imprimir con Epson iPrint, HP Smart o servicio de impresión.',
        });
      } else {
        pdf.save(fileName);
        alert('Se descargó el PDF oficial. Puedes abrirlo directamente con tu aplicación de Epson, HP o visor de impresión.');
      }

      if (onPrintComplete) {
        onPrintComplete(uniquePedidos.map(p => p.id));
      }

      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 4000);
    } catch (err) {
      console.error('Error al enviar a app de impresora:', err);
    } finally {
      setDownloading(false);
      setDownloadProgress('');
    }
  };

  // Descargar PDF A4 completo
  const handleDownloadPdf = async () => {
    setDownloading(true);
    setDownloadProgress('Generando PDF A4...');

    try {
      const pdf = await generatePdfInstance();
      if (!pdf) return;

      setDownloadProgress('Guardando archivo...');
      const dateStr = new Date().toISOString().slice(0, 10);
      pdf.save(`Rotulos_Encomi_ComiKids_${dateStr}_(${uniquePedidos.length}pedidos).pdf`);

      if (onPrintComplete) {
        onPrintComplete(uniquePedidos.map(p => p.id));
      }

      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 4000);
    } catch (err) {
      console.error('Error generando PDF de rótulos:', err);
      alert('Hubo un problema al generar el PDF. Puedes usar la opción de Impresión Nativa.');
    } finally {
      setDownloading(false);
      setDownloadProgress('');
    }
  };

  // Divide en grupos de 6 pedidos por cada hoja A4 (2x3)
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
                <span>Rótulos Oficiales ComiKids</span>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {uniquePedidos.length} {uniquePedidos.length === 1 ? 'rótulo' : 'rótulos'} • {pages.length} {pages.length === 1 ? 'hoja' : 'hojas'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Optimizado A4 & Carta • Centrado sin bordes muertos • 6 rótulos por hoja
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Opción 1: Imprimir con App (Epson / HP / Mopria) */}
            <button
              type="button"
              onClick={handleShareToPrinterApp}
              disabled={downloading}
              className="py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 active:scale-95 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
              title="Abrir con Epson iPrint, HP Smart o servicio de impresión del celular"
            >
              <Share2 className="w-4 h-4" />
              <span>Imprimir con App (Epson/HP)</span>
            </button>

            {/* Opción 2: Descargar PDF A4 */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 active:scale-95 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{downloadProgress || 'Procesando...'}</span>
                </>
              ) : successMsg ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-300" />
                  <span>¡PDF Listo!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Descargar PDF</span>
                </>
              )}
            </button>

            {/* Opción 3: Impresión Nativa (Navegador / PC) */}
            <button
              type="button"
              onClick={handlePrintNative}
              className="py-2.5 px-3.5 rounded-xl bg-white hover:bg-slate-200 active:scale-95 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              title="Impresión directa del navegador o PC"
            >
              <Printer className="w-4 h-4" />
              <span>Impresión Nativa</span>
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
        <div className="flex-1 p-2 sm:p-4 overflow-y-auto bg-slate-950 print:bg-white print:p-0 print:m-0 print:overflow-visible">
          
          {pages.map((pageOrders, pageIndex) => (
            <div
              key={pageIndex}
              className="a4-print-page grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white text-black p-2 sm:p-3 print:p-0 rounded-2xl print:rounded-none shadow-xl print:shadow-none mb-4 print:mb-0"
            >
              {pageOrders.map((pedido) => {
                const isShalom = pedido.metodo_envio_codigo === 'shalom';
                const clientDni = getClientDni(pedido);
                const shalomAgency = getShalomAgencyOnly(pedido.destino_detalle);
                const clientPhone = pedido.usuario?.telefono_default || (pedido.usuario?.dni?.length === 9 ? pedido.usuario.dni : '');

                return (
                  <div
                    key={pedido.id}
                    className="a4-rotulo-card border-2 border-dashed border-black rounded-xl p-2.5 sm:p-3 bg-white text-black flex flex-col justify-between break-inside-avoid relative overflow-hidden min-h-[210px]"
                  >
                    {/* Header: Logo Oficial ComiKids Grande & Slogan & Badge con Logo Shalom / Moto */}
                    <div className="flex items-center justify-between border-b-2 border-black pb-1 shrink-0">
                      <div className="flex items-center gap-2">
                        <img 
                          src="/Comikids.png" 
                          alt="ComiKids" 
                          className="w-10 h-10 sm:w-12 sm:h-12 object-contain shrink-0" 
                        />
                        <div>
                          <strong className="text-sm sm:text-base font-black tracking-tight uppercase block leading-none">
                            ComiKids
                          </strong>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-900 leading-none">
                          ENCOMI
                        </span>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded border-2 border-black bg-slate-100 mt-0.5 leading-none">
                          {isShalom ? (
                            <>
                              <img 
                                src="/Shalom-Courier-Logo.webp" 
                                alt="Shalom" 
                                className="h-3.5 w-auto object-contain shrink-0"
                              />
                              <span className="text-[9px] font-black uppercase tracking-wider text-black">
                                SHALOM
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-xs leading-none">🛵</span>
                              <span className="text-[9px] font-black uppercase tracking-wider text-black">
                                MOTORIZADO
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Essential Shipment Details */}
                    <div className="flex-1 flex flex-col justify-around py-1 space-y-0.5 overflow-hidden">
                      
                      {/* Destinatario */}
                      <div className="border-b border-dashed border-slate-300 pb-0.5">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block leading-none">
                          DESTINATARIO:
                        </span>
                        <strong className="text-sm sm:text-base font-black text-black block leading-tight pt-0.5 line-clamp-2 uppercase">
                          {pedido.usuario?.nombre_completo || 'Cliente'}
                        </strong>
                      </div>

                      {/* DNI (Shalom) or WhatsApp Phone (Motorizado) */}
                      {isShalom ? (
                        <div className="border-b border-dashed border-slate-300 pb-0.5">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block leading-none">
                            DNI / DOCUMENTO RECOJO:
                          </span>
                          <strong className="text-sm sm:text-base font-mono font-black text-black block leading-tight pt-0.5">
                            {clientDni}
                          </strong>
                        </div>
                      ) : (
                        <div className="border-b border-dashed border-slate-300 pb-0.5">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block leading-none">
                            TELÉFONO / WHATSAPP:
                          </span>
                          <strong className="text-sm sm:text-base font-mono font-black text-black block leading-tight pt-0.5">
                            {clientPhone ? `+51 ${clientPhone}` : 'No registrado'}
                          </strong>
                        </div>
                      )}

                      {/* Agencia Shalom Completa o Dirección Motorizado */}
                      <div className="pt-0.5">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block leading-none">
                          {isShalom ? 'SUCURSAL / AGENCIA SHALOM:' : 'DIRECCIÓN DE ENTREGA:'}
                        </span>
                        <p className="text-xs sm:text-[13px] font-black text-black leading-snug pt-0.5 line-clamp-3">
                          {isShalom ? shalomAgency : pedido.destino_detalle}
                        </p>
                      </div>

                    </div>

                    {/* Footer */}
                    <div className="pt-1 border-t-2 border-black flex items-center justify-between text-[9px] font-black text-slate-700 leading-none shrink-0">
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
