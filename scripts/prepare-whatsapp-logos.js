import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.join(process.cwd(), 'public');
const outDir = path.join(publicDir, 'logos-perfil');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function prepareLogos() {
  const SIZE = 1080;

  // 1. WhatsApp Profile Avatar: Deep obsidian black circular-safe background with white signature
  const whiteSigPath = path.join(publicDir, 'logo-trimmed.png');
  const blackSigPath = path.join(publicDir, 'logo-black.png');
  const appIconPath = path.join(publicDir, 'app-icon.png');

  // Resize signature to fit safely within the 700px circle zone so WhatsApp circular crop never cuts it
  const signatureWidth = 720;
  const resizedSigWhite = await sharp(whiteSigPath)
    .resize(signatureWidth, null, { fit: 'inside' })
    .toBuffer();

  const backgroundBlack = await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 12, g: 10, b: 9, alpha: 1 } // Luxury deep obsidian #0c0a09
    }
  }).png().toBuffer();

  // Combine centered
  const avatarSigBlack = await sharp(backgroundBlack)
    .composite([{ input: resizedSigWhite, gravity: 'center' }])
    .png({ quality: 100 })
    .toFile(path.join(outDir, '1_Logo_Firma_Fondo_Negro_WhatsApp.png'));

  console.log('✓ Created: 1_Logo_Firma_Fondo_Negro_WhatsApp.png');

  // 2. WhatsApp Profile Avatar: Modern Icon SG (app-icon resized to 1080x1080)
  const avatarIconSG = await sharp(appIconPath)
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 12, g: 10, b: 9, alpha: 1 } })
    .png({ quality: 100 })
    .toFile(path.join(outDir, '2_Icono_SG_Gradiente_WhatsApp.png'));

  console.log('✓ Created: 2_Icono_SG_Gradiente_WhatsApp.png');

  // 3. WhatsApp Profile Avatar: Gold edition signature on luxury dark texture
  const svgGoldOverlay = `
  <svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="goldGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.18" />
        <stop offset="65%" stop-color="#f59e0b" stop-opacity="0.04" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0" />
      </radialGradient>
      <!-- Safe Area Guide circle for preview -->
      <circle cx="${SIZE/2}" cy="${SIZE/2}" r="500" fill="none" stroke="#f59e0b" stroke-opacity="0.25" stroke-width="2" stroke-dasharray="8 8" />
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#goldGlow)" />
  </svg>
  `;

  const avatarGoldSig = await sharp(backgroundBlack)
    .composite([
      { input: Buffer.from(svgGoldOverlay), top: 0, left: 0 },
      { input: resizedSigWhite, gravity: 'center' }
    ])
    .png({ quality: 100 })
    .toFile(path.join(outDir, '3_Logo_Firma_Dorado_Elegante.png'));

  console.log('✓ Created: 3_Logo_Firma_Dorado_Elegante.png');

  // 4. Clean transparent versions
  fs.copyFileSync(whiteSigPath, path.join(outDir, '4_Firma_Blanca_Transparente.png'));
  fs.copyFileSync(blackSigPath, path.join(outDir, '5_Firma_Negra_Transparente.png'));
  console.log('✓ Copied transparent signatures.');
}

prepareLogos().catch(console.error);
