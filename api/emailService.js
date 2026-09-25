import nodemailer from 'nodemailer';

// Configuración SMTP con Zoho Mail (Puente Oficial reservas@sebastiang.app)
const ZOHO_CONFIG = {
  host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com',
  port: parseInt(process.env.ZOHO_SMTP_PORT || '587', 10),
  secure: false, // Port 587 uses STARTTLS
  auth: {
    user: process.env.ZOHO_SMTP_USER || 'reservas@sebastiang.app',
    pass: process.env.ZOHO_SMTP_PASS || 'u4qELE6UzRtY'
  }
};

let cachedTransporter = null;

function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport(ZOHO_CONFIG);
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
      Fotografía & Edición Profesional • San Antero
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
      © ${new Date().getFullYear()} Sebastian G. Todos los derechos reservados. San Antero, Córdoba, Colombia.
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

  const rawName = (booking.clientName || 'Cliente').trim();
  const firstName = rawName.split(' ')[0] || rawName;
  const isOutside = booking.locationType === 'outside_san_antero' || booking.locationType === 'outside';
  const loc = booking.specificLocation || (isOutside ? 'Locación Especial / Fuera' : 'San Antero');
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
          <td style="color: #ffffff; font-weight: bold;">${booking.clientName}</td>
        </tr>
        <tr>
          <td style="color: #a8a29e;">📱 WhatsApp:</td>
          <td><a href="https://wa.me/${(booking.clientWhatsApp || '').replace(/\D/g, '')}" style="color: #34d399; font-weight: bold; text-decoration: none;">${booking.clientWhatsApp} (Chatear)</a></td>
        </tr>
        ${booking.clientEmail ? `
        <tr>
          <td style="color: #a8a29e;">✉️ Correo:</td>
          <td style="color: #38bdf8;">${booking.clientEmail}</td>
        </tr>` : ''}
        <tr>
          <td style="color: #a8a29e;">📦 Paquete:</td>
          <td style="color: #f59e0b; font-weight: bold;">${booking.packageName || 'Sesión Fotográfica'}</td>
        </tr>
        <tr>
          <td style="color: #a8a29e;">🗓️ Fecha y Hora:</td>
          <td style="color: #ffffff; font-weight: bold;">${booking.dateTime}</td>
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
          <td style="color: #e7e5e4;">${booking.description}</td>
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
          <p style="margin: 6px 0; color: #d6d3d1; font-size: 14px;"><strong>Paquete:</strong> ${booking.packageName}</p>
          <p style="margin: 6px 0; color: #d6d3d1; font-size: 14px;"><strong>Fecha y Hora:</strong> ${booking.dateTime}</p>
          <p style="margin: 6px 0; color: #d6d3d1; font-size: 14px;"><strong>Locación:</strong> ${loc}</p>
          <p style="margin: 6px 0; color: #d6d3d1; font-size: 14px;"><strong>Valor Total:</strong> $${priceFormatted} COP</p>
        </div>

        <div style="background-color: #292524; border-left: 4px solid #34d399; padding: 12px 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #e7e5e4; font-size: 13px; line-height: 1.5;">
            💡 <strong>Próximo paso:</strong> Te contactaremos por WhatsApp al número que registraste (<strong>${booking.clientWhatsApp}</strong>) para coordinar detalles de vestuario y confirmar definitivamente tu sesión.
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
 * 2. Envía confirmación oficial de sesión al cliente (cuando el fotógrafo la aprueba)
 */
export async function sendBookingConfirmedEmail(booking, customNotes = '') {
  if (!booking || !booking.clientEmail || !booking.clientEmail.includes('@')) {
    return false;
  }

  const transporter = getTransporter();
  const rawName = (booking.clientName || 'Cliente').trim();
  const firstName = rawName.split(' ')[0] || rawName;
  const isOutside = booking.locationType === 'outside_san_antero' || booking.locationType === 'outside';
  const loc = booking.specificLocation || (isOutside ? 'Locación Especial / Fuera' : 'San Antero');

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
        <p style="margin: 6px 0; color: #d6d3d1; font-size: 14px;">🗓️ <strong>Fecha y Hora:</strong> ${booking.dateTime}</p>
        <p style="margin: 6px 0; color: #d6d3d1; font-size: 14px;">📍 <strong>Locación:</strong> ${loc}</p>
        <p style="margin: 6px 0; color: #d6d3d1; font-size: 14px;">📦 <strong>Paquete:</strong> ${booking.packageName}</p>
      </div>

      ${customNotes && customNotes.trim() ? `
      <div style="background-color: #292524; border-left: 4px solid #f59e0b; padding: 14px; border-radius: 8px; margin: 20px 0;">
        <span style="color: #f59e0b; font-weight: bold; font-size: 13px; text-transform: uppercase;">📝 Nota de Sebastian G:</span>
        <p style="margin: 6px 0 0; color: #f5f5f4; font-size: 14px; font-style: italic;">"${customNotes.trim()}"</p>
      </div>` : ''}

      <div style="background-color: #172554; border-left: 4px solid #3b82f6; padding: 14px; border-radius: 8px; margin: 20px 0;">
        <span style="color: #93c5fd; font-weight: bold; font-size: 13px;">💡 Consejos para el día de tu sesión:</span>
        <ul style="margin: 8px 0 0; padding-left: 18px; color: #e0e7ff; font-size: 13px; line-height: 1.5;">
          <li>Llega con 10 o 15 minutos de anticipación al punto acordado.</li>
          <li>Lleva tus cambios de vestuario planchados y listos.</li>
          <li>Descansa bien la noche anterior y mantén una buena hidratación.</li>
          <li>⛅ <strong>Garantía de Clima:</strong> Si el clima en San Antero (lluvia o tormenta) no permite hacer las fotos en la playa, reprogramamos para otra fecha sin costo.</li>
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
 * 3. Envía las fotos listas al cliente por correo (WeTransfer o Galería VIP)
 */
export async function sendPhotoDeliveryEmail({ clientName, clientEmail, packageName, downloadUrl, customNotes = '' }) {
  if (!clientEmail || !clientEmail.includes('@')) {
    return false;
  }

  const transporter = getTransporter();
  const rawName = (clientName || 'Cliente').trim();
  const firstName = rawName.split(' ')[0] || rawName;

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
        Hemos finalizado la edición y el retoque profesional de tus fotografías seleccionadas correspondientes a tu <strong>${packageName || 'Sesión Fotográfica'}</strong>.
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
        <p style="margin: 6px 0 0; color: #f5f5f4; font-size: 14px; font-style: italic;">"${customNotes.trim()}"</p>
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
