import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { LOGO_WATERMARK_APP, LOGO_WATERMARK_FAINT } from '../assets/logoWatermark';
import { formatPrintedPhotosSummary } from './api';

/**
 * Formatea fechas a formato legible colombiano (ej: Sábado, 3 de octubre de 2026 - 3:10 p. m.)
 */
function formatReadableDateTime(dateTimeStr) {
  if (!dateTimeStr) return 'Fecha por coordinar';
  try {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return String(dateTimeStr);
    const dateFormatted = d.toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeFormatted = d.toLocaleTimeString('es-CO', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    // Capitalizar primer letra del día
    const capitalized = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);
    return `${capitalized} • ${timeFormatted}`;
  } catch (e) {
    return String(dateTimeStr);
  }
}

/**
 * Generador Maestro de Comprobantes PDF Oficiales de Alta Definición
 * para Sebastian G Photography.
 *
 * Incluye:
 * - Emblema oficial en alta definición con diseño editorial de lujo
 * - Marca de agua simétrica 1:1 proporcional en el fondo
 * - Tarjetas de cliente y sesión con alto contraste y colores cálidos (sin fondos oscuros erróneos)
 * - Desglose financiero completo (Total, Abono, Saldo restante)
 * - Cláusula contractual y garantía de clima
 * - Código QR de verificación electrónica en tiempo real (sebastiang.app)
 * - Sello de validez digital y firma institucional
 */
export async function generateLuxuryReceiptPdf({
  booking,
  paidAmount = null,
  paymentMethod = 'Nequi',
  notes = '',
  auditHash = null
}) {
  if (!booking) return null;

  const total = Number(booking.totalPrice || 0);
  const actualPaid = paidAmount !== null
    ? Number(paidAmount)
    : (booking.status === 'completed' ? total : Math.round(total * 0.5));
  const balance = Math.max(0, total - actualPaid);
  const isFull = balance === 0;

  const voucherNum = `REC-${String(booking.id || '001').replace(/\D/g, '').slice(-5).padStart(5, '0')}`;
  const clientName = (booking.clientName || 'Cliente Titular').trim();
  const clientPhone = (booking.clientWhatsApp || '').trim() || 'No registrado';
  const clientEmail = (booking.clientEmail || '').trim();
  const location = booking.specificLocation || (booking.locationType === 'outside' ? 'Locación Especial / Fuera' : 'San Antero & Coveñas');
  const packageName = booking.packageName || 'Sesión Fotográfica';
  const formattedDateTime = formatReadableDateTime(booking.dateTime);
  const emissionDate = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

  const verifyUrl = `https://sebastiang.app/#recibo=${booking.id}&paid=${actualPaid}&method=${encodeURIComponent(paymentMethod)}`;
  const displayHash = auditHash || `SG-${String(booking.id).slice(-6)}-${Date.now().toString(36).toUpperCase()}`;

  // 1. Generar Código QR nítido
  let qrDataUrl = null;
  try {
    qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 250,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.warn('Error generando QR para comprobante:', err);
  }

  // 2. Inicializar jsPDF en formato A4 vertical
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;

  // ===== FONDO & MARCO DE LUJO =====
  // Marco exterior dorado fino
  pdf.setDrawColor(217, 119, 6); // amber-600
  pdf.setLineWidth(0.65);
  pdf.roundedRect(margin - 4, margin - 4, pageWidth - (margin * 2) + 8, pageHeight - (margin * 2) + 8, 4, 4, 'S');

  // Marco interior de línea tenue
  pdf.setDrawColor(254, 243, 199); // amber-100
  pdf.setLineWidth(0.3);
  pdf.roundedRect(margin - 2, margin - 2, pageWidth - (margin * 2) + 4, pageHeight - (margin * 2) + 4, 3, 3, 'S');

  // Barra superior decorativa
  pdf.setFillColor(15, 23, 42); // slate-900
  pdf.rect(margin - 4, margin - 4, pageWidth - (margin * 2) + 8, 3.5, 'F');
  pdf.setFillColor(217, 119, 6); // amber-600 gold
  pdf.rect(margin - 4, margin - 0.5, pageWidth - (margin * 2) + 8, 1.2, 'F');

  // Marca de agua oficial en el fondo (estricta relación 1:1 cuadrada)
  try {
    if (LOGO_WATERMARK_FAINT) {
      const wmW = 100;
      const wmH = 100;
      const wmX = (pageWidth - wmW) / 2;
      const wmY = 95;
      pdf.addImage(LOGO_WATERMARK_FAINT, 'PNG', wmX, wmY, wmW, wmH, undefined, 'FAST');
    }
  } catch (wmErr) {
    console.warn('Error al estampar marca de agua de fondo:', wmErr);
  }

  // ===== ENCABEZADO CORPORATIVO =====
  // Logotipo oficial en el encabezado izquierdo
  try {
    if (LOGO_WATERMARK_APP) {
      pdf.addImage(LOGO_WATERMARK_APP, 'PNG', margin, 16.5, 18, 18, undefined, 'FAST');
    }
  } catch (logoErr) {
    console.warn('Error agregando logo de encabezado:', logoErr);
  }

  // Textos de Marca junto al logo
  const textLeftX = margin + 22;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(15, 23, 42);
  pdf.text('SEBASTIAN G', textLeftX, 23);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(180, 83, 9); // amber-700
  pdf.text('ESTUDIO DE FOTOGRAFÍA & RETOQUE PROFESIONAL', textLeftX, 28);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139); // slate-500
  pdf.text('San Antero & Coveñas, Colombia • WhatsApp: +57 324 472 5167 • sebastiang.app', textLeftX, 33);

  // Insignia de Número de Comprobante (Derecha)
  const badgeW = 60;
  const badgeH = 18.5;
  const badgeX = pageWidth - margin - badgeW;
  pdf.setFillColor(254, 243, 199); // amber-100
  pdf.setDrawColor(245, 158, 11); // amber-500
  pdf.setLineWidth(0.5);
  pdf.roundedRect(badgeX, 16.5, badgeW, badgeH, 2.5, 2.5, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(146, 64, 14); // amber-800
  pdf.text('COMPROBANTE OFICIAL DE RESERVA', badgeX + (badgeW / 2), 21.5, { align: 'center' });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(180, 83, 9); // amber-700
  pdf.text(voucherNum, badgeX + (badgeW / 2), 28, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(120, 53, 15);
  pdf.text(`Emisión: ${emissionDate}`, badgeX + (badgeW / 2), 32.5, { align: 'center' });

  // Línea divisoria elegante
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.4);
  pdf.line(margin, 38.5, pageWidth - margin, 38.5);

  // ===== SECCIÓN 1: DATOS DEL CLIENTE Y CITA (2 COLUMNAS) =====
  let currentY = 43;
  const colGap = 8;
  const colWidth = (pageWidth - (margin * 2) - colGap) / 2;
  const colHeight = 36;

  // 1.1 Tarjeta Izquierda: CLIENTE TITULAR
  pdf.setFillColor(248, 250, 252); // slate-50 fondo limpio
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(margin, currentY, colWidth, colHeight, 3, 3, 'FD');

  // Pastilla de encabezado
  pdf.setFillColor(254, 243, 199);
  pdf.roundedRect(margin + 4, currentY + 4, 38, 5, 1.5, 1.5, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.setTextColor(180, 83, 9);
  pdf.text('CLIENTE TITULAR', margin + 6, currentY + 7.5);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text(clientName, margin + 4, currentY + 15);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(51, 65, 85);
  pdf.text(`WhatsApp: ${clientPhone}`, margin + 4, currentY + 21);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text(clientEmail ? `Correo: ${clientEmail}` : 'Canal de entrega: WhatsApp Directo', margin + 4, currentY + 26.5);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(4, 120, 87);
  pdf.text('● Registro Verificado en el Sistema Oficial', margin + 4, currentY + 32);

  // 1.2 Tarjeta Derecha: DETALLES DE LA CITA
  // Nota: Establecemos explícitamente el color de fondo para evitar cualquier bug de pantalla negra
  const rightColX = margin + colWidth + colGap;
  pdf.setFillColor(248, 250, 252); // Fondo claro idéntico
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(rightColX, currentY, colWidth, colHeight, 3, 3, 'FD');

  // Pastilla de encabezado
  pdf.setFillColor(254, 243, 199);
  pdf.roundedRect(rightColX + 4, currentY + 4, 38, 5, 1.5, 1.5, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.setTextColor(180, 83, 9);
  pdf.text('DETALLES DE LA CITA', rightColX + 6, currentY + 7.5);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text(formattedDateTime, rightColX + 4, currentY + 15);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(51, 65, 85);
  pdf.text(`Locación: ${location}`, rightColX + 4, currentY + 21);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(51, 65, 85);
  pdf.text(`Paquete: ${packageName}`, rightColX + 4, currentY + 26.5);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(180, 83, 9);
  pdf.text('● Cupo y Horario Reservados en Agenda', rightColX + 4, currentY + 32);

  // ===== SECCIÓN 2: SERVICIOS CONTRATADOS & COBERTURA =====
  currentY += colHeight + 6;
  const tableWidth = pageWidth - (margin * 2);

  pdf.setFillColor(241, 245, 249); // slate-100
  pdf.rect(margin, currentY, tableWidth, 7.5, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(51, 65, 85);
  pdf.text('CONCEPTO / SERVICIOS CONTRATADOS', margin + 4, currentY + 5);
  pdf.text('VALOR PACTADO', pageWidth - margin - 4, currentY + 5, { align: 'right' });

  currentY += 7.5;
  pdf.setDrawColor(226, 232, 240);
  pdf.line(margin, currentY, pageWidth - margin, currentY);

  // Fila Principal: Sesión
  currentY += 2;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text(`Sesión Fotográfica Profesional (${packageName})`, margin + 4, currentY + 5);
  pdf.text(`$${total.toLocaleString('es-CO')} COP`, pageWidth - margin - 4, currentY + 5, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Dirección de poses, iluminación profesional, locación acordada y entrega digital en Full HD sin compresión.', margin + 4, currentY + 9.5);
  currentY += 13;
  pdf.line(margin, currentY, pageWidth - margin, currentY);

  // Fila Opcional: Fotos impresas de regalo / paquete / cuadros y ampliaciones
  let printedText = booking.printedPhotosSummary || formatPrintedPhotosSummary(booking);
  if (!printedText) {
    const c10 = Number(booking.printedPhotos10x15Count || (booking.printedPhotosCount && !booking.printedPhotos15x20Count ? booking.printedPhotosCount : 0));
    const c15 = Number(booking.printedPhotos15x20Count || 0);
    printedText = (c10 > 0 && c15 > 0)
      ? `+ ${c10} Fotos impresas (10x15) y + ${c15} Fotos impresas (15x20)`
      : c15 > 0
        ? `+ ${c15} Fotos impresas tamaño (15x20)`
        : c10 > 0
          ? `+ ${c10} Fotos impresas tamaño (10x15)`
          : Number(booking.printedPhotosCount) > 0
            ? `+ ${booking.printedPhotosCount} Fotos impresas en papel fotográfico profesional`
            : '';
  }

  if (printedText) {
    currentY += 1.5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text(printedText, margin + 4, currentY + 4.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(4, 120, 87);
    pdf.text('Incluido', pageWidth - margin - 4, currentY + 4.5, { align: 'right' });
    currentY += 8;
    pdf.line(margin, currentY, pageWidth - margin, currentY);
  }

  // ===== SECCIÓN 3: LEDGER FINANCIERO =====
  currentY += 1.5;
  // Fila Total Pactado
  pdf.setFillColor(248, 250, 252);
  pdf.rect(margin, currentY, tableWidth, 8.5, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('TOTAL PACTADO:', margin + 4, currentY + 5.5);
  pdf.text(`$${total.toLocaleString('es-CO')} COP`, pageWidth - margin - 4, currentY + 5.5, { align: 'right' });
  currentY += 8.5;
  pdf.line(margin, currentY, pageWidth - margin, currentY);

  // Fila Monto Recibido
  pdf.setFillColor(236, 253, 245); // emerald-50
  pdf.rect(margin, currentY, tableWidth, 9, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(4, 120, 87); // emerald-700
  pdf.text(`VALOR RECIBIDO / ABONADO (${paymentMethod}):`, margin + 4, currentY + 6);
  pdf.text(`$${actualPaid.toLocaleString('es-CO')} COP`, pageWidth - margin - 4, currentY + 6, { align: 'right' });
  currentY += 9;
  pdf.line(margin, currentY, pageWidth - margin, currentY);

  // Fila Saldo Pendiente
  pdf.setFillColor(255, 251, 235); // amber-50
  pdf.rect(margin, currentY, tableWidth, 9, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(180, 83, 9); // amber-700
  pdf.text('SALDO PENDIENTE POR PAGAR EN LA SESIÓN:', margin + 4, currentY + 6);
  pdf.text(`$${balance.toLocaleString('es-CO')} COP`, pageWidth - margin - 4, currentY + 6, { align: 'right' });
  currentY += 9;
  pdf.line(margin, currentY, pageWidth - margin, currentY);

  // ===== SECCIÓN 4: GARANTÍAS Y CLÁUSULAS OFICIALES =====
  currentY += 5;
  const guaranteeH = 20;
  pdf.setFillColor(254, 252, 243);
  pdf.setDrawColor(245, 158, 11);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(margin, currentY, tableWidth, guaranteeH, 2.5, 2.5, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(180, 83, 9);
  pdf.text(`⛅ GARANTÍA OFICIAL DE CLIMA EN ${location.toUpperCase()}:`, margin + 4, currentY + 5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`• En caso de lluvia o clima adverso en ${location}, tu sesión se reprograma para una nueva fecha sin costo adicional.`, margin + 4, currentY + 10);
  pdf.text('• Tu anticipo y cupo quedan 100% protegidos y garantizados en agenda. Documento electrónico emitido en sebastiang.app.', margin + 4, currentY + 14.5);

  currentY += guaranteeH + 6;

  // ===== SECCIÓN 5: QR DE VERIFICACIÓN, SELLO DIGITAL Y FIRMA =====
  const authBoxH = 46;
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(margin, currentY, tableWidth, authBoxH, 3, 3, 'FD');

  // 5.1 Código QR en la izquierda
  if (qrDataUrl) {
    pdf.addImage(qrDataUrl, 'PNG', margin + 4, currentY + 3.5, 34, 34);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text('ESCANEA PARA VERIFICAR', margin + 21, currentY + 41, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Autenticidad en sebastiang.app', margin + 21, currentY + 44, { align: 'center' });
  }

  // 5.2 Sello Oficial de Estado en el centro
  const stampX = margin + 43;
  const stampW = 74;
  const stampH = 12;

  pdf.setFillColor(isFull ? 209 : 254, isFull ? 250 : 243, isFull ? 229 : 199);
  pdf.setDrawColor(isFull ? 16 : 245, isFull ? 185 : 158, isFull ? 129 : 11);
  pdf.roundedRect(stampX, currentY + 6, stampW, stampH, 6, 6, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(isFull ? 6 : 146, isFull ? 95 : 64, isFull ? 70 : 14);
  const stampTitle = isFull ? '✓ SESIÓN SALDADA (PAGADO 100%)' : '✓ ABONO CONFIRMADO (50% CUPO)';
  pdf.text(stampTitle, stampX + (stampW / 2), currentY + 13.5, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(71, 85, 105);
  pdf.text('Este documento electrónico acredita que el cupo y fecha están', stampX, currentY + 23);
  pdf.text('debidamente registrados en la agenda oficial de Sebastian G.', stampX, currentY + 27);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Hash de Seguridad: ${displayHash}`, stampX, currentY + 33);

  // 5.3 Firma Oficial en la derecha
  const sigX = pageWidth - margin - 28;
  pdf.setFont('times', 'bolditalic');
  pdf.setFontSize(16);
  pdf.setTextColor(180, 83, 9);
  pdf.text('Sebastian G', sigX, currentY + 18, { align: 'center' });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Sebastian Garcés G.', sigX, currentY + 25, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Fotógrafo Titular & Director', sigX, currentY + 29, { align: 'center' });
  pdf.text('San Antero & Coveñas', sigX, currentY + 33, { align: 'center' });

  // ===== PIE DE PÁGINA =====
  const footerY = pageHeight - margin - 2;
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  pdf.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(148, 163, 184);
  pdf.text(
    'Documento Electrónico Oficial • Sebastian G • sebastiang.app • Línea de Atención: +57 324 472 5167',
    pageWidth / 2,
    footerY - 1.5,
    { align: 'center' }
  );
  pdf.text(
    'Conserva este comprobante digital como soporte de reserva. La sesión incluye garantía climática y entrega privada.',
    pageWidth / 2,
    footerY + 1.5,
    { align: 'center' }
  );

  return {
    pdf,
    voucherNum,
    clientName,
    verifyUrl,
    displayHash,
    getBlob: () => pdf.output('blob'),
    getBase64: () => pdf.output('datauristring'),
    getRawBase64: () => {
      const dataUri = pdf.output('datauristring');
      return dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
    },
    save: (filename) => {
      const name = filename || `Comprobante-SebastianG-${voucherNum}.pdf`;
      pdf.save(name);
    }
  };
}
