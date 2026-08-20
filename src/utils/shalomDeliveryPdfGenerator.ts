import jsPDF from 'jspdf';
import { Pedido, TallerConfig } from '../types/database.types';

export function generateShalomDeliveryPdfBase64(
  order: Pedido,
  tallerConfig?: TallerConfig,
  customGuideNumber?: string
): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5', // Formato compacto profesional tipo guía de remisión (148 x 210 mm)
  });

  const clientName = (order.usuario?.nombre_completo || (order as any).nombre_cliente || 'CLIENTA').toUpperCase();
  const rawPhone = order.usuario?.telefono_default || (order as any).telefono_contacto || (order.usuario as any)?.telefono || '';
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const dni = order.usuario?.dni || order.usuario?.dni_default || (order as any).dni || '42020312';
  const trackingCode = order.codigo_seguimiento || order.id.slice(0, 8);
  const guideNumber = customGuideNumber || (order as any).numero_guia || (order as any).ose_id || `SH-${trackingCode}`;
  const agencyName = (order.destino_detalle || 'AGENCIA SHALOM').toUpperCase();
  const originAgency = (tallerConfig?.agencia_shalom_origen || 'AV MEXICO CO - LIMA').toUpperCase();
  const tallerPhone = tallerConfig?.celular_taller || '+51 927 781 412';

  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()} ${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

  // 1. ENCABEZADO SHALOM
  doc.setFillColor(220, 38, 38); // Rojo Shalom (#DC2626)
  doc.rect(0, 0, 148, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SHALOM ENVÍOS PRO', 10, 11);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('GUÍA DE REMISIÓN / CONSTANCIA DE DESPACHO OFICIAL', 10, 18);
  doc.text('SISTEMA INTEGRADO DE TRANSPORTE NACIONAL', 10, 22);

  // Recuadro de Número de Guía (Header derecho)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(88, 5, 52, 16, 2, 2, 'F');
  doc.setTextColor(220, 38, 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('GUÍA DE REMISIÓN N°', 92, 10);
  doc.setFontSize(10.5);
  doc.text(String(guideNumber), 92, 17);

  // 2. BANNER DE ESTADO Y CLAVE DE RECOJO
  doc.setFillColor(243, 244, 246);
  doc.rect(0, 26, 148, 14, 'F');

  doc.setTextColor(31, 41, 55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ESTADO: ENTREGADO EN AGENCIA SHALOM • EN TRÁNSITO', 10, 34);

  // CLAVE DE RECOJO DESTACADA (0808)
  doc.setFillColor(254, 243, 199); // Amarillo ámbar suave
  doc.roundedRect(95, 28, 45, 10, 2, 2, 'FD');
  doc.setTextColor(180, 83, 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CLAVE RECOJO: 0808', 98, 34.5);

  // 3. DATOS DE ORIGEN Y DESTINO (Cajas comparativas)
  const startY = 44;

  // Caja Remitente (Izquierda)
  doc.setDrawColor(209, 213, 219);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(8, startY, 63, 44, 2, 2, 'FD');

  doc.setFillColor(239, 246, 255);
  doc.rect(8, startY, 63, 7, 'F');
  doc.setTextColor(29, 78, 216);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('1. REMITENTE (ORIGEN)', 11, startY + 5);

  doc.setTextColor(55, 65, 81);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Comikids Envíos Oficial', 11, startY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('RUC: 42020312ENCOMI', 11, startY + 17);
  doc.text(`Tel: ${tallerPhone}`, 11, startY + 22);
  doc.text('Agencia Origen:', 11, startY + 28);
  doc.setFont('helvetica', 'bold');
  doc.text(originAgency, 11, startY + 33);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha: ${dateStr}`, 11, startY + 40);

  // Caja Destinatario (Derecha)
  doc.roundedRect(77, startY, 63, 44, 2, 2, 'FD');

  doc.setFillColor(236, 253, 245);
  doc.rect(77, startY, 63, 7, 'F');
  doc.setTextColor(4, 120, 87);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('2. DESTINATARIO (CLIENTA)', 80, startY + 5);

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(clientName.slice(0, 26), 80, startY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`DNI / CE: ${dni}`, 80, startY + 17);
  doc.text(`Celular: +51 ${cleanPhone.slice(-9)}`, 80, startY + 22);
  doc.text('Agencia Destino:', 80, startY + 28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 38, 38);
  doc.text(agencyName.slice(0, 26), 80, startY + 33);

  // 4. DETALLES DEL PAQUETE & CARGA
  const tableY = 93;
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(8, tableY, 132, 42, 2, 2, 'FD');

  doc.setFillColor(229, 231, 235);
  doc.rect(8, tableY, 132, 7, 'F');
  doc.setTextColor(31, 41, 55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('DESCRIPCIÓN DE LA ENCOMIENDA / PAQUETE', 12, tableY + 5);
  doc.text('BULTOS', 90, tableY + 5);
  doc.text('CONDICIÓN', 110, tableY + 5);

  doc.setTextColor(55, 65, 81);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(order.detalles_bordado || 'Prendas Textiles Comikids / Ropa y Accesorios', 12, tableY + 13);
  doc.text('1 PAQUETE', 90, tableY + 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87);
  doc.text('PAGADO', 110, tableY + 13);

  doc.setDrawColor(229, 231, 235);
  doc.line(8, tableY + 18, 140, tableY + 18);

  doc.setTextColor(55, 65, 81);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Código Seguimiento Interno: #${trackingCode}`, 12, tableY + 25);
  doc.text(`Tipo de Envío: PAGADO`, 12, tableY + 30);
  doc.text('Transportista Autorizado: SHALOM EMPRESARIAL S.A.C.', 12, tableY + 36);

  // 5. SECCIÓN DE SEGURIDAD Y CÓDIGO DE SEGUIMIENTO (Footer Box)
  const footerY = 140;
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(8, footerY, 132, 45, 2, 2, 'FD');

  doc.setTextColor(185, 28, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('INSTRUCCIONES DE RECOJO EN AGENCIA SHALOM', 12, footerY + 7);

  doc.setTextColor(75, 85, 99);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('1. Presentar DNI en ventanilla de la agencia seleccionada.', 12, footerY + 14);
  doc.text('2. Brindar el número de guía oficial y la CLAVE DE RECOJO: 0808.', 12, footerY + 20);
  doc.text('3. Puedes rastrear en vivo el estado del camión en:', 12, footerY + 26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 38, 38);
  doc.text('https://rastrea.shalom.pe', 12, footerY + 32);

  // Código visual simulado tipo código de barras
  doc.setFillColor(31, 41, 55);
  for (let x = 85; x < 135; x += 2.5) {
    const w = (x % 3 === 0) ? 1.5 : 0.8;
    doc.rect(x, footerY + 12, w, 16, 'F');
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(31, 41, 55);
  doc.text(`* ${guideNumber} *`, 94, footerY + 33);

  // Pie de página copyright
  doc.setTextColor(156, 163, 175);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Comikids Envíos • Documento Digital Oficial Generado Automáticamente por Encomi AI', 22, 198);

  // Retornar Base64 puro
  const dataUri = doc.output('datauristring');
  return dataUri.split('base64,')[1];
}
