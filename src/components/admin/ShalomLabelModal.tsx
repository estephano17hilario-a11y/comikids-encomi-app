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
  FileText
} from 'lucide-react';

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

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const printArea = document.getElementById('shalom-print-area');
    if (!printArea) return;

    setDownloading(true);
    try {
      const canvas = await html2canvas(printArea, {
        scale: 2,
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
      pdf.save(`Rotulo_Shalom_${pedido.codigo_seguimiento}.pdf`);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Error generando PDF:', err);
      alert('No se pudo generar el PDF directamente. Puedes usar el botón de Imprimir.');
    } finally {
      setDownloading(false);
    }
  };

  const handleShareToPrinterApp = async () => {
    const printArea = document.getElementById('shalom-print-area');
    if (!printArea) return;

    setDownloading(true);
    try {
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
      const pdfBlob = pdf.output('blob');
      const fileName = `Rotulo_${pedido.codigo_seguimiento}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Rótulo #${pedido.codigo_seguimiento}`,
          text: 'Imprimir rótulo de envío con app de impresora (Epson, HP, etc.)',
        });
      } else {
        pdf.save(fileName);
        alert('Se descargó el PDF del rótulo.');
      }
    } catch (err) {
      console.error('Error al compartir con app:', err);
    } finally {
      setDownloading(false);
    }
  };

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
          
          <button
            type="button"
            onClick={handleShareToPrinterApp}
            disabled={downloading}
            className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-emerald-600/30 cursor-pointer"
            title="Abrir con Epson iPrint, HP Smart o servicio de impresión del celular"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>App Epson/HP</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-all active:scale-95 shadow-md cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-400" />
            <span>Nativo / PC</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-cyan-600/30 cursor-pointer"
          >
            {downloading ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{downloadSuccess ? '¡Listo!' : 'PDF A6'}</span>
          </button>

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
