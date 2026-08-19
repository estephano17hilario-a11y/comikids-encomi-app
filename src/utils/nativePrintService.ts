import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import jsPDF from 'jspdf';

/**
 * Servicio unificado para Compartir e Imprimir PDFs tanto en Web como en Android (Capacitor)
 * Abre directamente la hoja de compartir nativa para conectar con Epson iPrint, HP Smart, Google Drive o Impresión del Sistema.
 */
export const shareOrPrintPdf = async (
  pdf: jsPDF,
  fileName: string,
  title: string = 'Rótulo de Envío',
  description: string = 'Imprimir con Epson iPrint, HP Smart o servicio de impresión.'
): Promise<{ success: boolean; mode: 'native_share' | 'web_share' | 'web_download' }> => {
  try {
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      // 1. En Capacitor Android: Convertir a Base64 y guardar en Caché
      const base64Data = pdf.output('datauristring').split(',')[1];
      
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true
      });

      // 2. Abrir selector nativo de compartir para Epson, HP, Bluetooth o Impresora
      await Share.share({
        title: title,
        text: description,
        url: savedFile.uri,
        dialogTitle: 'Selecciona tu app de impresora (Epson, HP, etc.)'
      });

      return { success: true, mode: 'native_share' };
    }

    // 3. En Navegador Web (PC o Móvil)
    const pdfBlob = pdf.output('blob');
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: title,
          text: description,
        });
        return { success: true, mode: 'web_share' };
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') {
          return { success: true, mode: 'web_share' };
        }
        console.warn('Web Share API falló, procediendo a descarga directa:', shareErr);
      }
    }

    // 4. Fallback Web: Descargar PDF y abrir vista previa de impresión
    pdf.save(fileName);
    const blobUrl = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(blobUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
    }

    return { success: true, mode: 'web_download' };
  } catch (err) {
    console.error('[nativePrintService] Error al compartir/imprimir:', err);
    // Fallback de emergencia
    pdf.save(fileName);
    return { success: false, mode: 'web_download' };
  }
};

/**
 * Dispara la impresión nativa:
 * - En Android (Capacitor): Genera PDF y lo envía al visor/impresora del sistema mediante Share.
 * - En Web Desktop: Ejecuta window.print().
 */
export const triggerNativePrint = async (
  onGeneratePdf: () => Promise<jsPDF | null>,
  fallbackFileName: string = 'Rotulo.pdf'
): Promise<void> => {
  if (Capacitor.isNativePlatform()) {
    const pdf = await onGeneratePdf();
    if (pdf) {
      await shareOrPrintPdf(pdf, fallbackFileName, 'Imprimir Rótulos', 'Enviar a impresora');
    }
  } else {
    window.print();
  }
};
