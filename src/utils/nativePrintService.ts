import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import jsPDF from 'jspdf';

/**
 * Servicio unificado para Compartir e Imprimir PDFs tanto en Web como en Android (Capacitor)
 */

/**
 * Comparte el documento PDF mediante la hoja nativa de compartir del sistema (Android / Web Share).
 * Permite enviar el PDF por WhatsApp, Telegram, Gmail, Drive o cualquier app instalada.
 */
export const sharePdfFile = async (
  pdf: jsPDF,
  fileName: string,
  title: string = 'Rótulo de Envío ComiKids'
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

      // 2. Abrir selector nativo de compartir
      await Share.share({
        title: title,
        files: [savedFile.uri],
        dialogTitle: 'Compartir Documento PDF'
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
        });
        return { success: true, mode: 'web_share' };
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') {
          return { success: true, mode: 'web_share' };
        }
        console.warn('Web Share API falló, procediendo a descarga directa:', shareErr);
      }
    }

    // 4. Fallback Web: Descargar PDF
    pdf.save(fileName);
    return { success: true, mode: 'web_download' };
  } catch (err) {
    console.error('[nativePrintService] Error al compartir PDF:', err);
    pdf.save(fileName);
    return { success: false, mode: 'web_download' };
  }
};

/**
 * Imprime el documento PDF:
 * - En Android (Capacitor): Como WebView no soporta window.print(), genera el PDF en caché y abre el diálogo para imprimirlo con cualquier servicio/impresora.
 * - En Web de Escritorio: Ejecuta window.print() directamente con los estilos de impresión CSS.
 */
export const printPdfDirect = async (
  onGeneratePdf: () => Promise<jsPDF | null>,
  fileName: string = 'Rotulos_ComiKids.pdf'
): Promise<void> => {
  if (Capacitor.isNativePlatform()) {
    const pdf = await onGeneratePdf();
    if (pdf) {
      await sharePdfFile(pdf, fileName, 'Imprimir Rótulos ComiKids');
    }
  } else {
    window.print();
  }
};

// Aliases para compatibilidad con código existente
export const shareOrPrintPdf = sharePdfFile;
export const triggerNativePrint = printPdfDirect;
