import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * MOTOR DE IMPRESIÓN Y COMPARTICIÓN UNIFICADO 2026 (Web & Capacitor Android)
 * Totalmente compatible con Chrome, Safari, Firefox, Edge, iOS y Android APK.
 */

/**
 * Imprime directamente una o varias imágenes (dataURLs en alta resolución)
 * utilizando un iframe aislado same-origin en Web o Share nativo en Android.
 */
export const printImagesDirect = async (
  images: string[],
  fileName: string = 'Rotulos_ComiKids.pdf',
  title: string = 'Imprimir Rótulos de Envío'
): Promise<{ success: boolean; mode: string }> => {
  if (!images || images.length === 0) {
    throw new Error('No hay imágenes para imprimir.');
  }

  const isNative = Capacitor.isNativePlatform();

  // 1. MODO ANDROID NATIVO (CAPACITOR)
  if (isNative) {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    images.forEach((imgData, idx) => {
      if (idx > 0) pdf.addPage('a4', 'portrait');
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    });

    const base64Data = pdf.output('datauristring').split(',')[1];
    const savedFile = await Filesystem.writeFile({
      path: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });

    await Share.share({
      title: title,
      text: 'Rótulo listo para imprimir en tu impresora.',
      files: [savedFile.uri],
      dialogTitle: 'Selecciona tu Servicio de Impresión o Impresora',
    });

    return { success: true, mode: 'android_native_print' };
  }

  // 2. MODO WEB (PC / Mac / Navegadores Móviles)
  return new Promise<{ success: boolean; mode: string }>((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      window.print();
      return resolve({ success: true, mode: 'window_print_fallback' });
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            @page {
              size: auto;
              margin: 0mm !important;
            }
            *, *::before, *::after {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              width: 100%;
              height: 100%;
              background: #ffffff !important;
              color: #000000 !important;
            }
            .print-page {
              width: 100%;
              display: flex;
              justify-content: center;
              align-items: center;
              page-break-inside: avoid;
              break-inside: avoid;
              page-break-after: always;
              break-after: page;
            }
            .print-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            img {
              max-width: 100%;
              height: auto;
              display: block;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          ${images.map(img => `<div class="print-page"><img src="${img}" alt="Rótulo" /></div>`).join('')}
        </body>
      </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    const imgElements = doc.querySelectorAll('img');
    let loadedCount = 0;

    const executePrint = () => {
      setTimeout(() => {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            resolve({ success: true, mode: 'iframe_direct_print' });
          } else {
            window.print();
            resolve({ success: true, mode: 'window_print_fallback' });
          }
        } catch (err) {
          console.warn('[Print Engine] Error en iframe.print(), fallback a window.print()', err);
          window.print();
          resolve({ success: true, mode: 'window_print_fallback' });
        } finally {
          setTimeout(() => {
            try {
              if (iframe.parentNode) {
                document.body.removeChild(iframe);
              }
            } catch {}
          }, 60000);
        }
      }, 300);
    };

    if (imgElements.length === 0) {
      executePrint();
    } else {
      imgElements.forEach((img) => {
        if (img.complete) {
          loadedCount++;
          if (loadedCount === imgElements.length) executePrint();
        } else {
          img.onload = () => {
            loadedCount++;
            if (loadedCount === imgElements.length) executePrint();
          };
          img.onerror = () => {
            loadedCount++;
            if (loadedCount === imgElements.length) executePrint();
          };
        }
      });
    }

    // Safety timeout
    setTimeout(() => {
      if (loadedCount < imgElements.length) {
        executePrint();
      }
    }, 2000);
  });
};

/**
 * Captura uno o más elementos HTML e imprime directamente con la máxima fidelidad y resolución
 */
export const printHtmlElementsDirect = async (
  elements: HTMLElement[],
  fileName: string = 'Rotulos_ComiKids.pdf',
  title: string = 'Imprimir Rótulos de Envío'
): Promise<{ success: boolean; mode: string }> => {
  if (!elements || elements.length === 0) {
    throw new Error('No se encontraron elementos para imprimir.');
  }

  const images: string[] = [];
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const canvas = await html2canvas(el, {
      scale: 2.5,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    images.push(canvas.toDataURL('image/jpeg', 0.98));
  }

  return printImagesDirect(images, fileName, title);
};

/**
 * Imprime un documento PDF de forma directa, confiable y sin romper la UI.
 */
export const printPdfDirect = async (
  onGeneratePdf: () => Promise<jsPDF | null> | jsPDF | null,
  fileName: string = 'Rotulos_ComiKids.pdf'
): Promise<{ success: boolean; mode: string }> => {
  try {
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      const pdf = await onGeneratePdf();
      if (!pdf) throw new Error('No se pudo generar el documento PDF para imprimir.');

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

    // En Web: Generar PDF y abrir ventana de impresión
    const pdf = await onGeneratePdf();
    if (!pdf) throw new Error('No se pudo generar el documento PDF para imprimir.');

    const blob = pdf.output('blob');
    const blobUrl = URL.createObjectURL(blob);

    // Intentar abrir el PDF en pestaña para impresión inmediata
    const printWindow = window.open(blobUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
      return { success: true, mode: 'popup_print' };
    }

    // Fallback si el navegador bloquea popups: descargar
    pdf.save(fileName);
    return { success: true, mode: 'download_fallback' };

  } catch (err: any) {
    console.error('[Print Engine Error]', err);
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

