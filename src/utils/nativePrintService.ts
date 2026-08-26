import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * MOTOR DE IMPRESIÓN DIRECTO Y ULTRA CONFIABLE (WEB & ANDROID)
 * Imprime directamente el elemento visual sin errores de sandbox ni dependencias complejas.
 */

/**
 * Imprime directamente un elemento por su ID o referencia DOM
 */
export const printElement = async (
  elementIdOrEl: string | HTMLElement,
  title: string = 'Imprimir Rótulo'
): Promise<void> => {
  const el = typeof elementIdOrEl === 'string'
    ? document.getElementById(elementIdOrEl)
    : elementIdOrEl;

  if (!el) {
    window.print();
    return;
  }

  const isNative = Capacitor.isNativePlatform();

  // En Android nativo (Capacitor), generar PDF con canvas y abrir menú de impresión del sistema
  if (isNative) {
    try {
      const canvas = await html2canvas(el, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      pdf.addImage(imgData, 'JPEG', 10, 10, 190, (canvas.height * 190) / canvas.width);
      const base64Data = pdf.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: 'Rotulo_Impresion.pdf',
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });

      await Share.share({
        title: title,
        files: [savedFile.uri],
        dialogTitle: 'Enviar a Impresora o Compartir',
      });
      return;
    } catch (e) {
      console.error('Error nativo Android print:', e);
    }
  }

  // En Web: Crear iframe invisible para impresión aislada e instantánea
  try {
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
    if (doc) {
      const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map(s => s.outerHTML)
        .join('\n');

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${title}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            ${styles}
            <style>
              @page { size: auto; margin: 4mm !important; }
              *, *::before, *::after { box-sizing: border-box; }
              html, body {
                background: #ffffff !important;
                color: #000000 !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
              }
              .print-container {
                width: 100%;
                max-width: 500px;
                margin: 0 auto;
              }
              @media print {
                body {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              }
            </style>
          </head>
          <body>
            <div class="print-container">
              ${el.outerHTML}
            </div>
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          window.print();
        } finally {
          setTimeout(() => {
            try {
              if (iframe.parentNode) document.body.removeChild(iframe);
            } catch {}
          }, 30000);
        }
      }, 350);
      return;
    }
  } catch (err) {
    console.warn('[Print Engine] Error con iframe, ejecutando window.print() directo:', err);
  }

  // Fallback directo a window.print()
  window.print();
};

/**
 * Imprime múltiples páginas (ej. lote A4)
 */
export const printMultipleElements = async (
  selector: string = '.a4-print-page',
  title: string = 'Imprimir Rótulos A4'
): Promise<void> => {
  const elements = document.querySelectorAll<HTMLElement>(selector);
  if (!elements || elements.length === 0) {
    window.print();
    return;
  }

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      for (let i = 0; i < elements.length; i++) {
        const canvas = await html2canvas(elements[i], {
          scale: 2.5,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 794,
          windowHeight: 1123,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        if (i > 0) pdf.addPage('a4', 'portrait');
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      const base64Data = pdf.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: 'Lote_Rotulos.pdf',
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });

      await Share.share({
        title: title,
        files: [savedFile.uri],
        dialogTitle: 'Enviar Lote de Rótulos a Impresora',
      });
      return;
    } catch (e) {
      console.error('Error nativo Android multi print:', e);
    }
  }

  // En Web: Crear iframe con todas las páginas A4
  try {
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
    if (doc) {
      const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map(s => s.outerHTML)
        .join('\n');

      const pagesHtml = Array.from(elements).map(el => el.outerHTML).join('\n');

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${title}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            ${styles}
            <style>
              @page { size: A4 portrait; margin: 4mm !important; }
              *, *::before, *::after { box-sizing: border-box; }
              html, body {
                background: #ffffff !important;
                color: #000000 !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                height: auto !important;
              }
              .a4-print-page {
                display: block !important;
                width: 100% !important;
                max-width: 200mm !important;
                height: auto !important;
                max-height: 268mm !important;
                margin: 0 auto !important;
                padding: 0 !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                page-break-after: always !important;
                break-after: page !important;
              }
              .a4-print-page:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
              }
              .a4-print-page > div.grid {
                display: grid !important;
                grid-template-columns: repeat(2, 1fr) !important;
                grid-template-rows: repeat(3, 85mm) !important;
                gap: 2.5mm !important;
                width: 100% !important;
                height: auto !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
              }
              .a4-rotulo-card {
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                height: 85mm !important;
                max-height: 85mm !important;
                box-sizing: border-box !important;
                padding: 2mm 3mm !important;
                overflow: hidden !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              @media print {
                body {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              }
            </style>
          </head>
          <body>
            ${pagesHtml}
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          window.print();
        } finally {
          setTimeout(() => {
            try {
              if (iframe.parentNode) document.body.removeChild(iframe);
            } catch {}
          }, 30000);
        }
      }, 350);
      return;
    }
  } catch (err) {
    console.warn('[Print Engine] Error multi-page iframe, fallback:', err);
  }

  window.print();
};

// Aliases para compatibilidad
export const printPdfDirect = printElement;
export const sharePdfFile = printElement;
export const printImagesDirect = printElement;
export const triggerNativePrint = printElement;


