import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pedido, TallerConfig } from '../../types/database.types';
import { ShalomLabelPrint } from './ShalomLabelPrint';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  X,
  Printer,
  Download,
  MessageCircle,
  FileText,
  Share2
} from 'lucide-react';

import { sharePdfFile, printPdfDirect, printImagesDirect } from '../../utils/nativePrintService';

interface Props {
  pedido: Pedido;
  tallerConfig: TallerConfig;
  onClose: () => void;
}

export const ShalomLabelModal: React.FC<Props> = ({ pedido, tallerConfig, onClose }) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const generateSinglePdf = async (): Promise<jsPDF | null> => {
    const printArea = document.getElementById('shalom-print-area');
    if (!printArea) return null;

    const canvas = await html2canvas(printArea, {
      scale: 2.5,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a6'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    return pdf;
  };

  const handlePrint = async () => {
    setDownloading(true);
    try {
      const printArea = document.getElementById('shalom-print-area');
      if (!printArea) {
        throw new Error('No se encontró el área de impresión.');
      }

      const canvas = await html2canvas(printArea, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      await printImagesDirect(
        [imgData],
        `Rotulo_${pedido.codigo_seguimiento}.pdf`,
        `Rótulo #${pedido.codigo_seguimiento}`
      );
    } catch (err) {
      console.error('Error al imprimir:', err);
      alert('No se pudo enviar a imprimir. Descargando PDF como respaldo...');
      try {
        const pdf = await generateSinglePdf();
        if (pdf) pdf.save(`Rotulo_${pedido.codigo_seguimiento}.pdf`);
      } catch {}
    } finally {
      setDownloading(false);
    }
  };

  const handleSharePdf = async () => {
    setDownloading(true);
    try {
      const pdf = await generateSinglePdf();
      if (!pdf) return;

      const fileName = `Rotulo_${pedido.codigo_seguimiento}.pdf`;
      await sharePdfFile(
        pdf,
        fileName,
        `Rótulo #${pedido.codigo_seguimiento}`
      );
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Error al compartir PDF:', err);
      alert('No se pudo compartir el archivo.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const pdf = await generateSinglePdf();
      if (!pdf) return;

      const fileName = `Rotulo_${pedido.codigo_seguimiento}.pdf`;
      pdf.save(fileName);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Error descargando PDF:', err);
      alert('No se pudo descargar el PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const clientName = pedido.usuario?.nombre_completo || 'Cliente';
  const clientPhone = (pedido.usuario?.telefono_default || pedido.usuario?.dni || '').replace(/\D/g, '');
  const isShalom = pedido.metodo_envio_codigo === 'shalom' || pedido.destino_detalle?.toLowerCase().includes('shalom');
  const whatsappNotifyText = `¡Hola ${clientName}! ✨ Te saluda *Encomi Envíos*.\n\nTu pedido *#${pedido.codigo_seguimiento}* ha sido rotulado para entrega por *${isShalom ? 'Agencia Shalom' : 'Motorizado Local'} (${pedido.destino_detalle})*.\n\n📦 *Destinatario:* ${clientName}\n\nTe adjuntaremos tu comprobante y foto en breve. ¡Muchas gracias por tu preferencia! ✨`;
  const whatsappNotifyUrl = clientPhone.length >= 9
    ? `https://wa.me/51${clientPhone.slice(-9)}?text=${encodeURIComponent(whatsappNotifyText)}`
    : `https://api.whatsapp.com/send?phone=51927781412&text=${encodeURIComponent(whatsappNotifyText)}`;

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn overflow-y-auto" data-no-print="true">
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
            className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Label Preview */}
        <div className="mb-4 p-3 bg-slate-950/90 rounded-2xl border border-slate-800 flex justify-center overflow-x-auto print:p-0 print:m-0 print:border-none print:bg-white">
          <ShalomLabelPrint pedido={pedido} tallerConfig={tallerConfig} />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 print:hidden" data-no-print="true">
          
          {/* Opción 1: Imprimir */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={downloading}
            className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-200 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5 text-slate-950" />
            <span>Imprimir</span>
          </button>

          {/* Opción 2: Compartir PDF */}
          <button
            type="button"
            onClick={handleSharePdf}
            disabled={downloading}
            className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
            title="Compartir PDF por WhatsApp, Telegram, Drive, etc."
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Compartir</span>
          </button>

          {/* Opción 3: Descargar PDF */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-cyan-600/30 cursor-pointer disabled:opacity-50"
          >
            {downloading ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{downloadSuccess ? '¡Listo!' : 'Descargar'}</span>
          </button>

          {/* Opción 4: WhatsApp */}
          <a
            href={whatsappNotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-emerald-600/30 text-center"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </a>

        </div>

      </div>
    </div>,
    document.body
  );

};
