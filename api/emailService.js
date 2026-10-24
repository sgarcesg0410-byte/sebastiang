import nodemailer from 'nodemailer';
import { escapeHtml } from './security.js';

// ==============================================================================
// CONFIGURACIÓN SMTP CON ZOHO MAIL
// ==============================================================================
// Las credenciales se leen EXCLUSIVAMENTE desde variables de entorno.
// Si no están configuradas, el sistema funciona en modo degradado (sin correos)
// pero NUNCA expone secretos ni falla catastróficamente.
// ==============================================================================

function getZohoConfig() {
  const host = (process.env.ZOHO_SMTP_HOST || process.env.SMTP_HOST || 'smtp.zoho.com').trim();
  const port = parseInt(process.env.ZOHO_SMTP_PORT || process.env.SMTP_PORT || '587', 10);
  const user = (process.env.ZOHO_SMTP_USER || process.env.SMTP_USER || 'reservas@sebastiang.app').trim();
  const pass = (process.env.ZOHO_SMTP_PASS || process.env.SMTP_PASS || '').trim();

  if (!pass) {
    console.warn(
      '⚠️ [EmailService] Contraseña SMTP de Zoho no configurada (ZOHO_SMTP_PASS). ' +
      'Define ZOHO_SMTP_PASS en tus variables de entorno para habilitar el envío de correos.'
    );
    return null;
  }

  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  };
}

let cachedTransporter = null;
let lastConfigWarning = 0;

function getTransporter() {
  const config = getZohoConfig();
  if (!config) {
    const now = Date.now();
    if (now - lastConfigWarning > 5 * 60 * 1000) {
      lastConfigWarning = now;
    }
    return null;
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport(config);
  }
  return cachedTransporter;
}

// Estilo común para todos los correos de Sebastian G
const BRAND_HEADER = `
  <div style="text-align: center; padding: 25px 20px 20px; border-bottom: 1px solid #292524;">
    <h1 style="margin: 0; color: #f59e0b; font-size: 24px; font-weight: 800; letter-spacing: 1px;">
      📸 SEBASTIAN G
    </h1>
    <p style="margin: 4px 0 0; color: #a8a29e; font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">
      Fotografía & Edición Profesional • Colombia
    </p>
  </div>
`;

const BRAND_FOOTER = `
  <div style="text-align: center; padding: 20px; border-top: 1px solid #292524; margin-top: 30px;">
    <p style="margin: 0 0 6px; color: #a8a29e; font-size: 13px;">
      🌐 <a href="https://sebastiang.app" style="color: #f59e0b; text-decoration: none; font-weight: bold;">sebastiang.app</a> • 
      ✉️ <a href="mailto:reservas@sebastiang.app" style="color: #f59e0b; text-decoration: none;">reservas@sebastiang.app</a>
    </p>
    <p style="margin: 0; color: #78716c; font-size: 11px;">
      © ${new Date().getFullYear()} Sebastian G. Todos los derechos reservados. Colombia.
    </p>
  </div>
`;

function wrapEmailTemplate(contentHtml) {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 20px 10px; background-color: #0c0a09; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #1c1917; border: 1px solid #292524; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <tr>
          <td>
            ${BRAND_HEADER}
            <div style="padding: 25px 25px;">
              ${contentHtml}
            </div>
            ${BRAND_FOOTER}
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * 1. Envía correos al crearse una nueva reserva:
 *    - Notificación a Sebastián (reservas@sebastiang.app)
 *    - Comprobante VIP al cliente (si suministró correo)
 */
export async function sendNewBookingEmails(booking, settings = {}) {
  const transporter = getTransporter();
  const results = { adminSent: false, clientSent: false };

  if (!transporter) {
    console.warn('[EmailService] No se pueden enviar correos: SMTP no configurado.');
    return results;
  }

  const rawName = (booking.clientName || 'Cliente').trim();
  const firstName = escapeHtml(rawName.split(' ')[0] || rawName);
  const isOutside = booking.locationType === 'outside_san_antero' || booking.locationType === 'outside';
  const loc = escapeHtml(booking.specificLocation || (isOutside ? 'Locación con Desplazamiento' : 'Locación Acordada'));
  const priceFormatted = Number(booking.totalPrice || 0).toLocaleString('es-CO');

  // A) Correo para Sebastián G (Notificación de negocio)
  try {
    const adminHtml = wrapEmailTemplate(`
      <div style="background-color: #292524; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 8px; margin-bottom: 20px;">
        <span style="color: #f59e0b; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
          🔔 Nueva Reserva Recibida en la Web
        </span>
      </div>
      <p style="color: #e7e5e4; font-size: 15px; line-height: 1.6; margin-top: 0;">
        ¡Hola Sebastian! Un cliente acaba de agendar una nueva sesión fotográfica a través de <strong>sebastiang.app</strong>:
      </p>
      <table border="0" cellpadding="8" cellspacing="0" width="100%" style="background-color: #0c0a09; border-radius: 12px; margin: 15px 0; border: 1px solid #292524; color: #d6d3d1; font-size: 14px;">
        <tr>
          <td style="color: #a8a29e; width: 35%;">👤 Cliente:</td>
          <td style="color: #ffffff; font-weight: bold;">${escapeHtml(booking.clientName)}</td>
        </tr>
        <tr>
          <td style="color: #a8a29e;">📱 WhatsApp:</td>
          <td><a href="https://wa.me/${(booking.clientWhatsApp || '').replace(/\D/g, '')}" style="color: #34d399; font-weight: bold; text-decoration: none;">${escapeHtml(booking.clientWhatsApp)} (Chatear)</a></td>
        </tr>
        ${booking.clientEmail ? `
        <tr>
          <td style="color: #a8a29e;">✉️ Correo:</td>
          <td style="color: #38bdf8;">${escapeHtml(booking.clientEmail)}</td>
        </tr>` : ''}
        <tr>
          <td style="color: #a8a29e;">📦 Paquete:</td>
          <td style="color: #f59e0b; font-weight: bold;">${escapeHtml(booking.packageName || 'Sesión Fotográfica')}</td>
        </tr>
        <tr>
          <td style="color: #a8a29e;">🗓️ Fecha y Hora:</td>
          <td style="color: #ffffff; font-weight: bold;">${escapeHtml(booking.dateTime)}</td>
        </tr>
        <tr>
          <td style="color: #a8a29e;">📍 Locación:</td>
          <td>${loc}</td>
        </tr>
        <tr>
          <td style="color: #a8a29e;">💵 Valor Total:</td>
          <td style="color: #34d399; font-weight: bold; font-size: 16px;">$${priceFormatted} COP</td>
        </tr>
        ${booking.description ? `
        <tr>
          <td style="color: #a8a29e; vertical-align: top;">📝 Notas:</td>
          <td style="color: #e7e5e4;">${escapeHtml(booking.description)}</td>
        </tr>` : ''}
      </table>
      <div style="text-align: center; margin-top: 25px;">
        <a href="https://sebastiang.app/?mode=admin" style="display: inline-block; background: linear-gradient(135deg, #d97706, #b45309); color: #ffffff; font-weight: bold; font-size: 14px; padding: 12px 26px; border-radius: 10px; text-decoration: none; box-shadow: 0 4px 14px rgba(217, 119, 6, 0.4);">
          ⚡ Abrir Panel de Control
        </a>
      </div>
    `);

    await transporter.sendMail({
      from: '"Sebastian G • Reservas" <reservas@sebastiang.app>',
      to: 'reservas@sebastiang.app',
      subject: `🔔 Nueva Reserva: ${booking.clientName} • ${booking.packageName}`,
      html: adminHtml
    });
    results.adminSent = true;
    console.log('✓ Correo de nueva reserva enviado al fotógrafo (reservas@sebastiang.app)');
  } catch (errAdmin) {
    console.error('Error enviando correo al fotógrafo:', errAdmin);
  }

  // B) Correo de confirmación de recepción para el Cliente (si dejó correo)
  if (booking.clientEmail && booking.clientEmail.includes('@')) {
    try {
      const clientHtml = wrapEmailTemplate(`
        <h2 style="color: #f59e0b; margin-top: 0; font-size: 20px;">
          ¡Hola ${firstName}! ✨
        </h2>
        <p style="color: #e7e5e4; font-size: 15px; line-height: 1.6;">
          Hemos recibido con éxito tu solicitud de reserva para una <strong>Sesión Fotográfica Profesional con Sebastian G</strong>.
        </p>
        <div style="background-color: #0c0a09; border: 1px solid #292524; border-radius: 12px; padding: 18px; margin: 20px 0;">
          <h3 style="color: #f59e0b; font-size: 14px; text-transform: uppercase; margin: 0 0 12px; letter-spacing: 1px;">
            📋 Resumen de tu Cita Agendada:
          </h3>
          <p style="margin: 6px 0; color: #d6d3d1; font-size: 14px;"><strong>Paquete:</strong> ${escapeHtml(booking.packageName)}</p>
          <p style="margin: 6px 0; color: #d6d3d1; font-size: 14px;"><strong>Fecha y Hora:</strong> ${escapeHtml(booking.dateTime)}</p>
          <p style="margin: 6px 0; color: #d6d3d1; font-size: 14px;"><strong>Locación:</strong> ${loc}</p>
          <p style="margin: 6px 0; color: #d6d3d1; font-size: 14px;"><strong>Valor Total:</strong> $${priceFormatted} COP</p>
        </div>
        <div style="background-color: #292524; border-left: 4px solid #34d399; padding: 12px 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #e7e5e4; font-size: 13px; line-height: 1.5;">
            💡 <strong>Próximo paso:</strong> Te contactaremos por WhatsApp al número que registraste (<strong>${escapeHtml(booking.clientWhatsApp)}</strong>) para coordinar detalles de vestuario y confirmar definitivamente tu sesión.
          </p>
        </div>
        <div style="text-align: center; margin-top: 25px;">
          <a href="https://wa.me/573244725167" style="display: inline-block; background-color: #059669; color: #ffffff; font-weight: bold; font-size: 14px; padding: 12px 24px; border-radius: 10px; text-decoration: none;">
            💬 Contactar a Sebastian G por WhatsApp
          </a>
        </div>
      `);

      await transporter.sendMail({
        from: '"Sebastian G • Fotografía" <reservas@sebastiang.app>',
        to: booking.clientEmail.trim(),
        subject: `📸 Recibimos tu Reserva • Sebastian G Fotografía`,
        html: clientHtml
      });
      results.clientSent = true;
      console.log('✓ Correo de bienvenida enviado al cliente:', booking.clientEmail);
    } catch (errClient) {
      console.error('Error enviando correo al cliente:', errClient);
    }
  }

  return results;
}

/**
 * 2. Envía comprobante oficial de pago/abono con PDF adjunto en alta resolución
 * directamente al correo registrado del cliente.
 */
export async function sendPaymentReceiptEmail({
  booking,
  paidAmount = 0,
  paymentMethod = 'Nequi',
  notes = '',
  pdfBase64 = null
}) {
  if (!booking || !booking.clientEmail || !booking.clientEmail.includes('@')) {
    return { sent: false, reason: 'no_email' };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const total = Number(booking.totalPrice || 0);
  const actualPaid = Number(paidAmount || 0);
  const balance = Math.max(0, total - actualPaid);
  const isFull = balance === 0;

  const rawName = (booking.clientName || 'Cliente').trim();
  const firstName = escapeHtml(rawName.split(' ')[0] || rawName);
  const voucherNum = `REC-${String(booking.id || '001').replace(/\\D/g, '').slice(-5).padStart(5, '0')}`;
  const isOutside = booking.locationType === 'outside_san_antero' || booking.locationType === 'outside';
  const loc = escapeHtml(booking.specificLocation || (isOutside ? 'Locación con Desplazamiento' : 'Locación Acordada'));
  const packageName = escapeHtml(booking.packageName || 'Sesión Fotográfica');
  const dateTime = escapeHtml(booking.dateTime || 'Por coordinar');

  const receiptUrl = `https://sebastiang.app/#recibo=${booking.receiptToken || booking.id}&paid=${actualPaid}&method=${encodeURIComponent(paymentMethod)}`;

  const subject = isFull
    ? `🏆 Comprobante Oficial de Pago (Paz y Salvo 100%) • ${voucherNum} • Sebastian G`
    : `🧾 Comprobante Oficial de Abono • Reserva #${voucherNum} (${packageName}) • Sebastian G`;

  const statusBadge = isFull
    ? `<div style="background-color: #064e3b; border: 1px solid #059669; padding: 12px 16px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
        <span style="color: #6ee7b7; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
          ✓ PAGO TOTAL CONFIRMADO • SESIÓN 100% SALDADA
        </span>
      </div>`
    : `<div style="background-color: #78350f; border: 1px solid #d97706; padding: 12px 16px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
        <span style="color: #fde68a; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
          ✦ ABONO DE RESERVA CONFIRMADO • CUPO ASEGURADO EN AGENDA ✦
        </span>
      </div>`;

  const html = wrapEmailTemplate(`
    ${statusBadge}
    <h2 style="color: #f59e0b; margin-top: 0; font-size: 20px;">
      ¡Hola ${firstName}! ✨
    </h2>
    <p style="color: #e7e5e4; font-size: 15px; line-height: 1.6;">
      ${isFull
        ? 'Hemos verificado tu pago total con éxito. Tu sesión fotográfica profesional se encuentra en estado de <strong>PAZ Y SALVO oficial</strong>.'
        : 'Hemos recibido y verificado tu abono con éxito. Tu cupo, fecha y horario quedan <strong>100% reservados y asegurados</strong> en la agenda oficial de Sebastian G.'
      }
    </p>

    <!-- Resumen Financiero Destacado -->
    <div style="background-color: #0c0a09; border: 1px solid #292524; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #f59e0b; font-size: 13px; text-transform: uppercase; margin: 0 0 14px; letter-spacing: 1px;">
        💳 Desglose Financiero Oficial:
      </h3>
      <table border="0" cellpadding="6" cellspacing="0" width="100%" style="color: #d6d3d1; font-size: 14px;">
        <tr>
          <td style="color: #a8a29e;">N° de Comprobante:</td>
          <td style="color: #f59e0b; font-weight: bold; font-family: monospace;">${voucherNum}</td>
        </tr>
        <tr>
          <td style="color: #a8a29e;">Paquete Contratado:</td>
          <td style="color: #ffffff; font-weight: bold;">${packageName}</td>
        </tr>
        <tr>
          <td style="color: #a8a29e;">Valor Total del Contrato:</td>
          <td style="color: #ffffff; font-weight: bold;">$${total.toLocaleString('es-CO')} COP</td>
        </tr>
        <tr style="background-color: #064e3b22;">
          <td style="color: #34d399; font-weight: bold;">Valor Abonado / Recibido (${escapeHtml(paymentMethod)}):</td>
          <td style="color: #34d399; font-weight: 800; font-size: 15px;">$${actualPaid.toLocaleString('es-CO')} COP</td>
        </tr>
        <tr style="background-color: ${isFull ? '#064e3b11' : '#78350f22'};">
          <td style="color: ${isFull ? '#6ee7b7' : '#fbbf24'}; font-weight: bold;">
            ${isFull ? 'Estado Financiero:' : 'Saldo Pendiente para el Día de la Sesión:'}
          </td>
          <td style="color: ${isFull ? '#6ee7b7' : '#fbbf24'}; font-weight: 900; font-size: 16px;">
            ${isFull ? 'PAZ Y SALVO ($0 COP)' : `$${balance.toLocaleString('es-CO')} COP`}
          </td>
        </tr>
      </table>
      ${!isFull ? `
      <p style="margin: 12px 0 0; color: #fde68a; font-size: 12px; line-height: 1.4; border-top: 1px dashed #44403c; padding-top: 8px;">
        📌 <em>Nota: El saldo pendiente de <strong>$${balance.toLocaleString('es-CO')} COP</strong> se cancelará el día de tu sesión fotográfica.</em>
      </p>` : ''}
    </div>

    <!-- Detalles de la Cita -->
    <div style="background-color: #1c1917; border: 1px solid #292524; border-radius: 12px; padding: 16px; margin: 20px 0;">
      <h3 style="color: #f59e0b; font-size: 13px; text-transform: uppercase; margin: 0 0 10px; letter-spacing: 1px;">
        🗓️ Datos de tu Cita en Agenda:
      </h3>
      <p style="margin: 5px 0; color: #d6d3d1; font-size: 13px;"><strong>Fecha y Hora:</strong> ${dateTime}</p>
      <p style="margin: 5px 0; color: #d6d3d1; font-size: 13px;"><strong>Locación:</strong> ${loc}</p>
      <p style="margin: 5px 0; color: #d6d3d1; font-size: 13px;"><strong>WhatsApp Registrado:</strong> ${escapeHtml(booking.clientWhatsApp)}</p>
    </div>

    <!-- Garantía de Clima -->
    <div style="background-color: #292524; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 8px; margin: 20px 0;">
      <span style="color: #f59e0b; font-weight: bold; font-size: 13px;">⛅ Garantía Oficial de Clima en ${loc}:</span>
      <p style="margin: 6px 0 0; color: #e7e5e4; font-size: 12px; line-height: 1.5;">
        Si se presentan lluvias o clima adverso en la locación, tu sesión se reprograma sin ninguna penalidad ni costo adicional. Tu anticipo y cupo quedan 100% protegidos.
      </p>
    </div>

    <!-- Botón de Consulta Web -->
    <div style="text-align: center; margin: 30px 0 15px;">
      <a href="${receiptUrl}" style="display: inline-block; background: linear-gradient(135deg, #d97706, #b45309); color: #ffffff; font-weight: 800; font-size: 14px; padding: 14px 28px; border-radius: 10px; text-decoration: none; box-shadow: 0 4px 15px rgba(217, 119, 6, 0.35);">
        📄 Ver Comprobante Digital Interactivo
      </a>
      <p style="color: #a8a29e; font-size: 12px; margin-top: 10px;">
        📎 También hemos adjuntado a este correo tu comprobante oficial en formato PDF vectorial de alta calidad.
      </p>
    </div>
  `);

  const mailOptions = {
    from: '"Sebastian G • Pagos & Reservas" <reservas@sebastiang.app>',
    to: booking.clientEmail.trim(),
    subject,
    html
  };

  // Si recibimos el PDF en base64, lo adjuntamos directamente
  if (pdfBase64) {
    mailOptions.attachments = [
      {
        filename: `Comprobante-SebastianG-${voucherNum}.pdf`,
        content: pdfBase64,
        encoding: 'base64',
        contentType: 'application/pdf'
      }
    ];
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✓ Comprobante oficial enviado por correo a ${booking.clientEmail} (${voucherNum})`);
    return { sent: true, voucherNum };
  } catch (err) {
    console.error('Error enviando comprobante de pago por correo:', err);
    return { sent: false, error: err.message };
  }
}

/**
 * 2. Envía confirmación oficial de sesión al cliente (cuando el fotógrafo la aprueba)
 */
export async function sendBookingConfirmedEmail(booking, customNotes = '') {
  if (!booking || !booking.clientEmail || !booking.clientEmail.includes('@')) {
    return false;
  }

  const transporter = getTransporter();
  if (!transporter) return false;

  const rawName = (booking.clientName || 'Cliente').trim();
  const firstName = escapeHtml(rawName.split(' ')[0] || rawName);
  const isOutside = booking.locationType === 'outside_san_antero' || booking.locationType === 'outside';
  const loc = escapeHtml(booking.specificLocation || (isOutside ? 'Locación con Desplazamiento' : 'Locación Acordada'));

  try {
    const html = wrapEmailTemplate(`
      <div style="background-color: #064e3b; border: 1px solid #059669; padding: 14px 16px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
        <span style="color: #6ee7b7; font-weight: 800; font-size: 15px; text-transform: uppercase; letter-spacing: 1px;">
          ✓ ¡Sesión Fotográfica Confirmada!
        </span>
      </div>
      <h2 style="color: #f59e0b; margin-top: 0; font-size: 20px;">
        ¡Hola ${firstName}! ✨
      </h2>
      <p style="color: #e7e5e4; font-size: 15px; line-height: 1.6;">
        Te confirmo con mucho agrado que tu <strong>Sesión Fotográfica Profesional con Sebastian G</strong> ha sido agendada de forma exclusiva en mi calendario de trabajo.
      </p>
      <div style="background-color: #0c0a09; border: 1px solid #292524; border-radius: 12px; padding: 18px; margin: 20px 0;">
        <p style="margin: 6px 0; color: #d6d3d1; font-size: 14px;">🗓️ <strong>Fecha y Hora:</strong> ${escapeHtml(booking.dateTime)}</p>
        <p style="margin: 6px 0; color: #d6d3d1; font-size: 14px;">📍 <strong>Locación:</strong> ${loc}</p>
        <p style="margin: 6px 0; color: #d6d3d1; font-size: 14px;">📦 <strong>Paquete:</strong> ${escapeHtml(booking.packageName)}</p>
      </div>
      ${customNotes && customNotes.trim() ? `
      <div style="background-color: #292524; border-left: 4px solid #f59e0b; padding: 14px; border-radius: 8px; margin: 20px 0;">
        <span style="color: #f59e0b; font-weight: bold; font-size: 13px; text-transform: uppercase;">📝 Nota de Sebastian G:</span>
        <p style="margin: 6px 0 0; color: #f5f5f4; font-size: 14px; font-style: italic;">"${escapeHtml(customNotes.trim())}"</p>
      </div>` : ''}
      <div style="background-color: #172554; border-left: 4px solid #3b82f6; padding: 14px; border-radius: 8px; margin: 20px 0;">
        <span style="color: #93c5fd; font-weight: bold; font-size: 13px;">💡 Consejos para el día de tu sesión:</span>
        <ul style="margin: 8px 0 0; padding-left: 18px; color: #e0e7ff; font-size: 13px; line-height: 1.5;">
          <li>Llega con 10 o 15 minutos de anticipación al punto acordado.</li>
          <li>Lleva tus cambios de vestuario planchados y listos.</li>
          <li>Descansa bien la noche anterior y mantén una buena hidratación.</li>
          <li>⛅ <strong>Garantía de Clima en ${loc}:</strong> Si el clima en ${loc} (lluvia o tormenta) no permite realizar las fotos, reprogramamos para otra fecha sin costo.</li>
        </ul>
      </div>
      <p style="color: #a8a29e; font-size: 14px; text-align: center; margin-top: 25px;">
        ¡Será un verdadero placer capturar tus mejores momentos frente al lente! 📸
      </p>
    `);

    await transporter.sendMail({
      from: '"Sebastian G • Fotografía" <reservas@sebastiang.app>',
      to: booking.clientEmail.trim(),
      subject: `🎉 ¡Cita Confirmada! Tu Sesión con Sebastian G (${booking.dateTime})`,
      html
    });

    console.log('✓ Confirmación de cita enviada por correo al cliente:', booking.clientEmail);
    return true;
  } catch (err) {
    console.error('Error enviando confirmación de cita por correo:', err);
    return false;
  }
}

/**
 * 2.1 Envía correo de agradecimiento y estado al cliente cuando la sesión se marca como realizada
 */
export async function sendSessionCompletedEmail(booking, customNotes = '') {
  if (!booking || !booking.clientEmail || !booking.clientEmail.includes('@')) {
    return false;
  }

  const transporter = getTransporter();
  if (!transporter) return false;

  const rawName = (booking.clientName || booking.client_name || 'Cliente').trim();
  const firstName = escapeHtml(rawName.split(' ')[0] || rawName);
  const loc = escapeHtml(booking.specificLocation || booking.specific_location || 'Locación Acordada');
  const pkgName = escapeHtml(booking.packageName || booking.package_name || 'Sesión Fotográfica');
  const dateStr = escapeHtml(booking.dateTime || booking.date_time || 'Fecha acordada');

  try {
    const html = wrapEmailTemplate(`
      <div style="background-color: #064e3b; border: 1px solid #059669; padding: 14px 16px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
        <span style="color: #6ee7b7; font-weight: 800; font-size: 15px; text-transform: uppercase; letter-spacing: 1px;">
          🎉 ¡Sesión Fotográfica Realizada con Éxito!
        </span>
      </div>
      <h2 style="color: #f59e0b; margin-top: 0; font-size: 20px;">
        ¡Hola ${firstName}! ✨📸
      </h2>
      <p style="color: #e7e5e4; font-size: 15px; line-height: 1.6;">
        Queremos darte las gracias por haber compartido tu tiempo y tu confianza en la sesión de hoy correspondiente a tu <strong>${pkgName}</strong>.
      </p>
      <div style="background-color: #0c0a09; border: 1px solid #292524; border-radius: 12px; padding: 18px; margin: 20px 0;">
        <p style="margin: 6px 0; color: #d6d3d1; font-size: 14px;">🗓️ <strong>Fecha de la Sesión:</strong> ${dateStr}</p>
        <p style="margin: 6px 0; color: #d6d3d1; font-size: 14px;">📍 <strong>Locación:</strong> ${loc}</p>
        <p style="margin: 6px 0; color: #d6d3d1; font-size: 14px;">📦 <strong>Paquete:</strong> ${pkgName}</p>
      </div>
      ${customNotes && customNotes.trim() ? `
      <div style="background-color: #292524; border-left: 4px solid #f59e0b; padding: 14px; border-radius: 8px; margin: 20px 0;">
        <span style="color: #f59e0b; font-weight: bold; font-size: 13px; text-transform: uppercase;">📝 Mensaje de Sebastian G:</span>
        <p style="margin: 6px 0 0; color: #f5f5f4; font-size: 14px; font-style: italic;">"${escapeHtml(customNotes.trim())}"</p>
      </div>` : ''}
      <div style="background-color: #172554; border-left: 4px solid #3b82f6; padding: 14px; border-radius: 8px; margin: 20px 0;">
        <span style="color: #93c5fd; font-weight: bold; font-size: 13px;">⏳ ¿Qué sigue ahora?</span>
        <ul style="margin: 8px 0 0; padding-left: 18px; color: #e0e7ff; font-size: 13px; line-height: 1.6;">
          <li>Tus fotografías ya están en proceso de respaldo digital y revelado profesional.</li>
          <li>Muy pronto recibirás tu enlace privado exclusivo para que puedas visualizar la preselección y elegir tus fotos favoritas.</li>
          <li>Si tu paquete incluye fotos impresas o retablos, te indicaremos cómo recibirlos una vez finalizada la selección.</li>
        </ul>
      </div>
      <p style="color: #a8a29e; font-size: 14px; text-align: center; margin-top: 25px;">
        ¡Fue un verdadero honor haber trabajado contigo frente al lente! Si tienes alguna pregunta, puedes responder directamente a nuestro WhatsApp oficial. 📸✨
      </p>
    `);

    await transporter.sendMail({
      from: '"Sebastian G • Fotografía" <reservas@sebastiang.app>',
      to: booking.clientEmail.trim(),
      subject: `🎉 ¡Gracias por tu sesión hoy! Tus fotos ya están en proceso • Sebastian G`,
      html
    });

    console.log('✓ Correo de sesión realizada enviado al cliente:', booking.clientEmail);
    return true;
  } catch (err) {
    console.error('Error enviando correo de sesión realizada:', err);
    return false;
  }
}

/**
 * 3. Envía las fotos listas al cliente por correo (WeTransfer o Galería VIP)
 */
export async function sendPhotoDeliveryEmail({ clientName, clientEmail, packageName, downloadUrl, customNotes = '' }) {
  if (!clientEmail || !clientEmail.includes('@')) {
    return false;
  }

  const transporter = getTransporter();
  if (!transporter) return false;

  const rawName = (clientName || 'Cliente').trim();
  const firstName = escapeHtml(rawName.split(' ')[0] || rawName);

  try {
    const html = wrapEmailTemplate(`
      <div style="background-color: #78350f; border: 1px solid #d97706; padding: 14px 16px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
        <span style="color: #fde68a; font-weight: 800; font-size: 15px; text-transform: uppercase; letter-spacing: 1px;">
          ✨ ¡Tus Fotos Están Listas en Calidad Original Full HD!
        </span>
      </div>
      <h2 style="color: #f59e0b; margin-top: 0; font-size: 20px;">
        ¡Hola ${firstName}! 📸
      </h2>
      <p style="color: #e7e5e4; font-size: 15px; line-height: 1.6;">
        Hemos finalizado la edición y el retoque profesional de tus fotografías seleccionadas correspondientes a tu <strong>${escapeHtml(packageName || 'Sesión Fotográfica')}</strong>.
      </p>
      <p style="color: #d6d3d1; font-size: 14px; line-height: 1.6;">
        Para que tus fotos conserven el 100% de nitidez, color y resolución original (sin la compresión que aplica WhatsApp), puedes descargarlas directamente en el siguiente botón:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${downloadUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; font-weight: 800; font-size: 16px; padding: 15px 32px; border-radius: 12px; text-decoration: none; box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);">
          📥 Descargar Mis Fotos en Máxima Calidad
        </a>
      </div>
      ${customNotes && customNotes.trim() ? `
      <div style="background-color: #292524; border-left: 4px solid #f59e0b; padding: 14px; border-radius: 8px; margin: 20px 0;">
        <span style="color: #f59e0b; font-weight: bold; font-size: 13px; text-transform: uppercase;">📝 Nota de Sebastian G:</span>
        <p style="margin: 6px 0 0; color: #f5f5f4; font-size: 14px; font-style: italic;">"${escapeHtml(customNotes.trim())}"</p>
      </div>` : ''}
      <div style="background-color: #0c0a09; border: 1px solid #292524; border-radius: 12px; padding: 14px 18px; margin: 20px 0;">
        <p style="margin: 0; color: #a8a29e; font-size: 12px; line-height: 1.5;">
          💡 <strong>Recomendación importante:</strong> Te sugerimos descargar los archivos a tu computador o celular lo antes posible para conservarlos siempre en su resolución original.
        </p>
      </div>
      <p style="color: #e7e5e4; font-size: 14px; text-align: center; margin-top: 25px;">
        ¡Fue un verdadero honor haber capturado tus mejores momentos! ✨
      </p>
    `);

    await transporter.sendMail({
      from: '"Sebastian G • Fotografía" <reservas@sebastiang.app>',
      to: clientEmail.trim(),
      subject: `📸 ¡Tus Fotos Están Listas en Calidad Original Full HD! • Sebastian G`,
      html
    });

    console.log('✓ Entrega de fotos enviada por correo al cliente:', clientEmail);
    return true;
  } catch (err) {
    console.error('Error enviando entrega de fotos por correo:', err);
    return false;
  }
}

/**
 * 4. Envía código de autenticación de dos factores (2FA) al correo oficial del administrador
 */
export async function sendTwoFactorCodeEmail(code, targetEmail = 'sgarcesg0410@gmail.com') {
  const transporter = getTransporter();
  if (!transporter) return false;

  try {
    const dest = (targetEmail || 'sgarcesg0410@gmail.com').trim();
    const html = wrapEmailTemplate(`
      <div style="background-color: #292524; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 8px; margin-bottom: 20px;">
        <span style="color: #f59e0b; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
          🔐 Código de Acceso Seguro (2FA) • Sebastian G
        </span>
      </div>
      <p style="color: #e7e5e4; font-size: 15px; line-height: 1.6; margin-top: 0;">
        ¡Hola Sebastian! Se ha solicitado un ingreso al <strong>Panel de Administración</strong> desde un dispositivo no reconocido.
      </p>
      <p style="color: #d6d3d1; font-size: 14px; line-height: 1.6;">
        Para confirmar tu identidad y autorizar el acceso privado a tus reservas, fotos y finanzas, ingresa el siguiente código de verificación de 6 dígitos:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <div style="display: inline-block; background: #0c0a09; border: 2px solid #f59e0b; padding: 16px 36px; border-radius: 16px; font-family: monospace; font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #f59e0b; box-shadow: 0 8px 30px rgba(245, 158, 11, 0.25);">
          ${code}
        </div>
      </div>
      <div style="background-color: #0c0a09; border: 1px solid #292524; border-radius: 12px; padding: 14px 18px; margin: 20px 0;">
        <p style="margin: 0; color: #a8a29e; font-size: 12px; line-height: 1.5;">
          ⏱️ Este código vence en <strong>10 minutos</strong>.<br/>
          ⚠️ Si tú no realizaste este intento de inicio de sesión, ignora este mensaje. El acceso permanece bloqueado con seguridad de doble factor.
        </p>
      </div>
    `);

    await transporter.sendMail({
      from: '"Seguridad Sebastian G" <reservas@sebastiang.app>',
      to: dest,
      bcc: 'reservas@sebastiang.app',
      subject: `🔐 Tu Código de Seguridad 2FA es [ ${code} ] • Sebastian G`,
      html
    });

    console.log('✓ Código 2FA enviado por correo a:', dest);
    return true;
  } catch (err) {
    console.error('Error enviando código 2FA por correo:', err);
    return false;
  }
}

/**
 * 5. Envía código de recuperación de contraseña al correo oficial del administrador
 *    Regla de seguridad: Fuga cero (NUNCA registrar el código en logs)
 */
export async function sendPasswordResetCodeEmail(code, targetEmail = process.env.ADMIN_EMAIL || 'sgarcesg0410@gmail.com') {
  const transporter = getTransporter();
  if (!transporter) return false;

  try {
    const dest = (targetEmail || process.env.ADMIN_EMAIL || 'sgarcesg0410@gmail.com').trim();
    const html = wrapEmailTemplate(`
      <div style="background-color: #292524; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 8px; margin-bottom: 20px;">
        <span style="color: #f59e0b; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
          🔐 Recuperación de Contraseña • Sebastian G
        </span>
      </div>
      <p style="color: #e7e5e4; font-size: 15px; line-height: 1.6; margin-top: 0;">
        ¡Hola Sebastian! Se ha solicitado restablecer la contraseña de acceso al <strong>Panel de Administración</strong>.
      </p>
      <p style="color: #d6d3d1; font-size: 14px; line-height: 1.6;">
        Para continuar con el restablecimiento seguro de tu cuenta, ingresa el siguiente código de verificación de 6 dígitos:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <div style="display: inline-block; background: #0c0a09; border: 2px solid #f59e0b; padding: 16px 36px; border-radius: 16px; font-family: monospace; font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #f59e0b; box-shadow: 0 8px 30px rgba(245, 158, 11, 0.25);">
          ${code}
        </div>
      </div>
      <div style="background-color: #0c0a09; border: 1px solid #292524; border-radius: 12px; padding: 14px 18px; margin: 20px 0;">
        <p style="margin: 0; color: #a8a29e; font-size: 12px; line-height: 1.5;">
          ⏱️ Este código vence en <strong>10 minutos</strong> y solo puede ser usado una vez.<br/>
          ⚠️ Si tú no solicitaste este cambio, puedes ignorar este mensaje de forma segura. Tu contraseña actual no ha sido modificada.
        </p>
      </div>
    `);

    await transporter.sendMail({
      from: '"Seguridad Sebastian G" <reservas@sebastiang.app>',
      to: dest,
      bcc: 'reservas@sebastiang.app',
      subject: `🔐 Código para Recuperar Contraseña • Sebastian G`,
      html
    });

    console.log('✓ Código de recuperación enviado por correo a:', dest);
    return true;
  } catch (err) {
    console.error('Error enviando código de recuperación por correo:', err);
    return false;
  }
}

/**
 * 6. Envía alerta de seguridad cuando la contraseña de administrador ha sido cambiada
 */
export async function sendPasswordChangedAlertEmail(targetEmail = process.env.ADMIN_EMAIL || 'sgarcesg0410@gmail.com', details = {}) {
  const transporter = getTransporter();
  if (!transporter) return false;

  try {
    const dest = (targetEmail || process.env.ADMIN_EMAIL || 'sgarcesg0410@gmail.com').trim();
    const timestamp = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    const ip = details.ip ? `<p style="margin: 4px 0; color: #a8a29e; font-size: 13px;">🌐 Dirección IP: <strong>${escapeHtml(details.ip)}</strong></p>` : '';

    const html = wrapEmailTemplate(`
      <div style="background-color: #7f1d1d; border-left: 4px solid #ef4444; padding: 14px 16px; border-radius: 8px; margin-bottom: 20px;">
        <span style="color: #fca5a5; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
          ⚠️ Alerta de Seguridad: Contraseña de Administrador Cambiada
        </span>
      </div>
      <p style="color: #e7e5e4; font-size: 15px; line-height: 1.6; margin-top: 0;">
        ¡Hola Sebastian! Te notificamos que la contraseña de acceso a tu <strong>Panel de Administración</strong> ha sido modificada satisfactoriamente.
      </p>
      <div style="background-color: #0c0a09; border: 1px solid #292524; border-radius: 12px; padding: 14px 18px; margin: 20px 0;">
        <p style="margin: 4px 0; color: #a8a29e; font-size: 13px;">🗓️ Fecha y hora: <strong>${timestamp} (hora de Colombia)</strong></p>
        ${ip}
        <p style="margin: 8px 0 0; color: #34d399; font-size: 13px; font-weight: bold;">
          ✓ Todas las sesiones activas en otros dispositivos han sido revocadas automáticamente.
        </p>
      </div>
      <p style="color: #d6d3d1; font-size: 14px; line-height: 1.6;">
        Si tú realizaste este cambio, no es necesaria ninguna acción adicional. Si tú <strong>NO</strong> realizaste este cambio, tu cuenta podría estar comprometida: ponte en contacto de inmediato o actualiza la clave en tus variables de entorno.
      </p>
    `);

    await transporter.sendMail({
      from: '"Seguridad Sebastian G" <reservas@sebastiang.app>',
      to: dest,
      bcc: 'reservas@sebastiang.app',
      subject: `⚠️ Tu Contraseña de Administrador fue Cambiada • Sebastian G`,
      html
    });

    console.log('✓ Alerta de seguridad (contraseña cambiada) enviada por correo a:', dest);
    return true;
  } catch (err) {
    console.error('Error enviando alerta de cambio de contraseña por correo:', err);
    return false;
  }
}
