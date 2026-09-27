import nodemailer from 'nodemailer';
import path from 'path';

const ZOHO_CONFIG = {
  host: 'smtp.zoho.com',
  port: 587,
  secure: false,
  auth: {
    user: 'reservas@sebastiang.app',
    pass: 'u4qELE6UzRtY'
  }
};

const transporter = nodemailer.createTransport(ZOHO_CONFIG);

const publicDir = path.join(process.cwd(), 'public', 'logos-perfil');

const attachments = [
  {
    filename: '1_Logo_Firma_Fondo_Negro_WhatsApp.png',
    path: path.join(publicDir, '1_Logo_Firma_Fondo_Negro_WhatsApp.png'),
    cid: 'logo_negro'
  },
  {
    filename: '2_Icono_SG_Gradiente_WhatsApp.png',
    path: path.join(publicDir, '2_Icono_SG_Gradiente_WhatsApp.png'),
    cid: 'logo_icono'
  },
  {
    filename: '3_Logo_Firma_Dorado_Elegante.png',
    path: path.join(publicDir, '3_Logo_Firma_Dorado_Elegante.png'),
    cid: 'logo_dorado'
  },
  {
    filename: '4_Firma_Blanca_Transparente.png',
    path: path.join(publicDir, '4_Firma_Blanca_Transparente.png')
  },
  {
    filename: '5_Firma_Negra_Transparente.png',
    path: path.join(publicDir, '5_Firma_Negra_Transparente.png')
  }
];

const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Tus Logos Oficiales para Perfil de WhatsApp - Sebastian G</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0c0a09; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e7e5e4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0c0a09; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #141210; border-radius: 24px; border: 1px solid #292524; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8);">
          
          <!-- Encabezado de Marca -->
          <tr>
            <td style="padding: 35px 30px 25px; text-align: center; background: radial-gradient(circle at 50% 30%, #292015 0%, #141210 70%); border-bottom: 1px solid #292524;">
              <h1 style="margin: 0; color: #f59e0b; font-size: 26px; font-weight: 800; letter-spacing: 2px;">
                📸 SEBASTIAN G
              </h1>
              <p style="margin: 6px 0 0; color: #a8a29e; font-size: 13px; text-transform: uppercase; letter-spacing: 2.5px;">
                Fotografía & Edición Profesional • San Antero
              </p>
            </td>
          </tr>

          <!-- Mensaje Principal -->
          <tr>
            <td style="padding: 30px 30px 20px;">
              <h2 style="margin: 0 0 12px; color: #ffffff; font-size: 20px; font-weight: 700;">
                ¡Hola Sebastián! 👋✨
              </h2>
              <p style="margin: 0 0 20px; color: #d6d3d1; font-size: 14px; line-height: 1.6;">
                Aquí tienes tus logos oficiales en <strong>máxima resolución HD (1080 × 1080 px)</strong>, especialmente adaptados para que calcen a la perfección dentro del círculo de perfil de <strong>WhatsApp (Línea 1 y Línea 2)</strong> sin que ninguna letra quede cortada.
              </p>
              
              <div style="background-color: #1c1917; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 14px 18px; margin-bottom: 25px;">
                <p style="margin: 0; font-size: 13px; color: #fcd34d; font-weight: 600;">
                  💡 Vienen adjuntos a este correo como archivos descargables para que los guardes en tu celular y los pongas de perfil de inmediato.
                </p>
              </div>

              <!-- Muestra 1: Logo Firma Fondo Negro -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0c0a09; border: 1px solid #292524; border-radius: 16px; margin-bottom: 20px; overflow: hidden;">
                <tr>
                  <td width="140" style="padding: 15px; text-align: center;">
                    <img src="cid:logo_negro" alt="Logo Firma Negro" width="110" height="110" style="border-radius: 50%; border: 2px solid #f59e0b; display: block; margin: 0 auto;" />
                  </td>
                  <td style="padding: 15px 20px 15px 0;">
                    <span style="display: inline-block; background-color: #f59e0b; color: #000; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; margin-bottom: 6px;">
                      Recomendada Línea Principal
                    </span>
                    <h3 style="margin: 0 0 4px; color: #ffffff; font-size: 15px; font-weight: bold;">
                      1. Firma Blanca sobre Fondo Negro Obsidiana
                    </h3>
                    <p style="margin: 0; font-size: 12px; color: #a8a29e; line-height: 1.4;">
                      Elegante, minimalista y de alto impacto visual. Queda circular perfecta en WhatsApp sin perder bordes.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Muestra 2: Icono SG Gradiente -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0c0a09; border: 1px solid #292524; border-radius: 16px; margin-bottom: 20px; overflow: hidden;">
                <tr>
                  <td width="140" style="padding: 15px; text-align: center;">
                    <img src="cid:logo_icono" alt="Icono SG Gradiente" width="110" height="110" style="border-radius: 50%; border: 2px solid #f59e0b; display: block; margin: 0 auto;" />
                  </td>
                  <td style="padding: 15px 20px 15px 0;">
                    <span style="display: inline-block; background-color: #ec4899; color: #fff; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; margin-bottom: 6px;">
                      Estilo App & Redes
                    </span>
                    <h3 style="margin: 0 0 4px; color: #ffffff; font-size: 15px; font-weight: bold;">
                      2. Icono Squircle "SG" Atardecer Caribeño
                    </h3>
                    <p style="margin: 0; font-size: 12px; color: #a8a29e; line-height: 1.4;">
                      El isotipo moderno y colorido con gradiente sunset, ideal para distinguir tu línea secundaria o Instagram.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Muestra 3: Logo Firma Dorado Glow -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0c0a09; border: 1px solid #292524; border-radius: 16px; margin-bottom: 25px; overflow: hidden;">
                <tr>
                  <td width="140" style="padding: 15px; text-align: center;">
                    <img src="cid:logo_dorado" alt="Firma Dorada" width="110" height="110" style="border-radius: 50%; border: 2px solid #f59e0b; display: block; margin: 0 auto;" />
                  </td>
                  <td style="padding: 15px 20px 15px 0;">
                    <span style="display: inline-block; background-color: #059669; color: #fff; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; margin-bottom: 6px;">
                      Edición Dorada Premium
                    </span>
                    <h3 style="margin: 0 0 4px; color: #ffffff; font-size: 15px; font-weight: bold;">
                      3. Firma con Destello Ámbar Dorado
                    </h3>
                    <p style="margin: 0; font-size: 12px; color: #a8a29e; line-height: 1.4;">
                      Con un suave halo dorado de fondo que aporta calidez cinematográfica.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Instrucciones para WhatsApp -->
              <div style="background: linear-gradient(135deg, #1c1917, #0c0a09); border: 1px solid #3b332a; border-radius: 16px; padding: 20px; margin-bottom: 10px;">
                <h4 style="margin: 0 0 10px; color: #f59e0b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                  📲 Cómo cambiar tu foto de perfil en WhatsApp:
                </h4>
                <ol style="margin: 0; padding-left: 20px; color: #d6d3d1; font-size: 13px; line-height: 1.6;">
                  <li>Descarga la imagen que más te guste de los archivos adjuntos en este correo.</li>
                  <li>Abre <strong>WhatsApp</strong> en tu celular y toca los <strong>tres puntos (⋮)</strong> ➔ <strong>Ajustes</strong>.</li>
                  <li>Toca tu foto de perfil actual y luego el icono de la <strong>Cámara</strong> ➔ <strong>Galería</strong>.</li>
                  <li>Selecciona la imagen descargada: verás que calza exacto en el círculo sin tener que recortarla. ¡Y pulsa <strong>Listo</strong>!</li>
                </ol>
              </div>

            </td>
          </tr>

          <!-- Pie de Página -->
          <tr>
            <td style="padding: 25px 30px; text-align: center; background-color: #0c0a09; border-top: 1px solid #292524;">
              <p style="margin: 0 0 6px; color: #a8a29e; font-size: 13px;">
                🌐 <a href="https://sebastiang.app" style="color: #f59e0b; text-decoration: none; font-weight: bold;">sebastiang.app</a> • 
                ✉️ <a href="mailto:reservas@sebastiang.app" style="color: #f59e0b; text-decoration: none;">reservas@sebastiang.app</a>
              </p>
              <p style="margin: 0; color: #78716c; font-size: 11px;">
                Sebastian G • San Antero, Córdoba, Colombia.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

async function main() {
  console.log('Sending logos email to sgarcesg0410@gmail.com and reservas@sebastiang.app...');
  const info = await transporter.sendMail({
    from: '"Sebastian G • Fotografía" <reservas@sebastiang.app>',
    to: 'sgarcesg0410@gmail.com',
    cc: 'reservas@sebastiang.app',
    subject: '📸 Tus Logos Oficiales para Perfil de WhatsApp - Sebastian G',
    html: htmlContent,
    attachments
  });

  console.log('✓ Email sent successfully! MessageId:', info.messageId);
}

main().catch(console.error);
