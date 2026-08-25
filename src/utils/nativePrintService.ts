import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import jsPDF from 'jspdf';

/**
 * MOTOR DE IMPRESIÓN Y COMPARTICIÓN UNIFICADO 2026 (Web & Capacitor Android)
 * Reconstruido desde 0 para garantizar 100% de compatibilidad en todos los navegadores y dispositivos.
 */

/**
 * Imprime un documento PDF de forma directa, confiable y sin romper la UI.
 * - En Web (Chrome/Edge/Safari/Firefox): Usa un iframe oculto dedicado con el Blob PDF o abre visor de impresión.
 * - En Android (Capacitor): Guarda en caché nativa y abre el selector de impresión / compartir del sistema operativo.
 */
export const printPdfDirect = async (
  onGeneratePdf: () => Promise<jsPDF | null> | jsPDF | null,
  fileName: string = 'Rotulos_ComiKids.pdf'
): Promise<{ success: boolean; mode: string }> => {
  try {
    const pdf = await onGeneratePdf();
    if (!pdf) {
      throw new Error('No se pudo generar el documento PDF para imprimir.');
    }

    const isNative = Capacitor.isNativePlatform();

    // 1. MODO ANDROID / CAPACITOR
    if (isNative) {
      const base64Data = pdf.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });

      await Share.share({
        title: 'Imprimir Rótulos de Envío',
        text: 'Documento listo para enviar a tu impresora o compartir.',
        files: [savedFile.uri],
        dialogTitle: 'Selecciona tu Impresora o Servicio de Impresión',
      });

      return { success: true, mode: 'android_native_print' };
    }

    // 2. MODO WEB (PC, Mac, iPhone, Android Web)
    const blob = pdf.output('blob');
    const blobUrl = URL.createObjectURL(blob);

    return new Promise<{ success: boolean; mode: string }>((resolve) => {
      let resolved = false;

      // Crear un iframe invisible y aislado para imprimir exclusivamente el PDF
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      iframe.src = blobUrl;

      const cleanup = () => {
        try {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
          URL.revokeObjectURL(blobUrl);
        } catch {
          // ignore
        }
      };

      iframe.onload = () => {
        setTimeout(() => {
          try {
            if (iframe.contentWindow) {
              iframe.contentWindow.focus();
              iframe.contentWindow.print();
              if (!resolved) {
                resolved = true;
                resolve({ success: true, mode: 'iframe_direct_print' });
              }
            } else {
              throw new Error('No window context');
            }
          } catch (e) {
            console.warn('[Print Engine] Iframe print falló o fue bloqueado, abriendo pestaña de impresión...', e);
            // Fallback: abrir en pestaña nueva con visor nativo
            window.open(blobUrl, '_blank');
            if (!resolved) {
              resolved = true;
              resolve({ success: true, mode: 'tab_fallback_print' });
            }
          } finally {
            setTimeout(cleanup, 120000); // 2 minutos para dar tiempo a la cola del spooler
          }
        }, 300);
      };

      iframe.onerror = () => {
        console.warn('[Print Engine] Error al cargar iframe, abriendo visor directo...');
        window.open(blobUrl, '_blank');
        cleanup();
        if (!resolved) {
          resolved = true;
          resolve({ success: true, mode: 'tab_fallback_print' });
        }
      };

      document.body.appendChild(iframe);

      // Timeout de seguridad en caso de navegadores lentos
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ success: true, mode: 'timeout_dispatched' });
        }
      }, 2500);
    });

  } catch (err: any) {
    console.error('[Print Engine Error]', err);
    // Fallback de emergencia: descargar el PDF
    try {
      const pdfFallback = await onGeneratePdf();
      if (pdfFallback) {
        pdfFallback.save(fileName);
        return { success: true, mode: 'download_fallback' };
      }
    } catch {}
    throw err;
  }
};

/**
 * Comparte el documento PDF mediante la hoja nativa de compartir del sistema (Android / Web Share API).
 */
export const sharePdfFile = async (
  pdf: jsPDF,
  fileName: string,
  title: string = 'Rótulos de Envío ComiKids'
): Promise<{ success: boolean; mode: 'native_share' | 'web_share' | 'web_download' }> => {
  try {
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      const base64Data = pdf.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true
      });

      await Share.share({
        title: title,
        files: [savedFile.uri],
        dialogTitle: 'Compartir Documento PDF'
      });

      return { success: true, mode: 'native_share' };
    }

    const pdfBlob = pdf.output('blob');
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
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
      }
    }

    pdf.save(fileName);
    return { success: true, mode: 'web_download' };
  } catch (err) {
    console.error('[nativePrintService] Error al compartir PDF:', err);
    pdf.save(fileName);
    return { success: false, mode: 'web_download' };
  }
};

// Aliases para compatibilidad con toda la aplicación
export const shareOrPrintPdf = sharePdfFile;
export const triggerNativePrint = printPdfDirect;
