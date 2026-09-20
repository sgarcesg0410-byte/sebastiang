import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateGoldIcons() {
  const logoWhitePath = path.resolve('public/logo-white.png');
  const logoBuffer = fs.readFileSync(logoWhitePath);

  // 1. Create a 512x512 gold background with rounded corners or full square for maskable
  // Beautiful luxury metallic gold gradient SVG background
  const goldSvg = `
  <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f8dc7e"/>
        <stop offset="35%" stop-color="#dfaa32"/>
        <stop offset="70%" stop-color="#b8831a"/>
        <stop offset="100%" stop-color="#8b5d09"/>
      </linearGradient>
      <radialGradient id="goldShine" cx="50%" cy="30%" r="60%">
        <stop offset="0%" stop-color="#fff" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="512" height="512" fill="url(#goldGrad)" rx="110"/>
    <rect width="512" height="512" fill="url(#goldShine)" rx="110"/>
    <circle cx="256" cy="256" r="236" fill="none" stroke="#ffffff" stroke-width="4" opacity="0.3"/>
  </svg>
  `;

  const goldBgBuffer = await sharp(Buffer.from(goldSvg))
    .png()
    .toBuffer();

  // Resize white logo to fit inside with padding
  // Width 400, preserve aspect ratio
  const resizedLogo = await sharp(logoBuffer)
    .resize(390, 200, { fit: 'inside' })
    .toBuffer();

  // Composite white logo centered on gold background
  const icon512 = await sharp(goldBgBuffer)
    .composite([
      {
        input: resizedLogo,
        gravity: 'center'
      }
    ])
    .png()
    .toBuffer();

  // Save 512x512 app-icon.png
  fs.writeFileSync('public/app-icon.png', icon512);

  // Save 180x180 apple-touch-icon.png
  const icon180 = await sharp(icon512).resize(180, 180).png().toBuffer();
  fs.writeFileSync('public/apple-touch-icon.png', icon180);

  // Save 64x64 favicon.png
  const icon64 = await sharp(icon512).resize(64, 64).png().toBuffer();
  fs.writeFileSync('public/favicon.png', icon64);

  // Save 32x32 favicon.ico
  const icon32 = await sharp(icon512).resize(32, 32).toFormat('png').toBuffer();
  fs.writeFileSync('public/favicon.ico', icon32);

  // Save SVG favicon with gold background & embedded white logo
  const logoB64 = resizedLogo.toString('base64');
  const faviconSvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f8dc7e"/>
        <stop offset="35%" stop-color="#dfaa32"/>
        <stop offset="70%" stop-color="#b8831a"/>
        <stop offset="100%" stop-color="#8b5d09"/>
      </linearGradient>
      <radialGradient id="goldShine" cx="50%" cy="30%" r="60%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="512" height="512" fill="url(#goldGrad)" rx="110"/>
    <rect width="512" height="512" fill="url(#goldShine)" rx="110"/>
    <circle cx="256" cy="256" r="236" fill="none" stroke="#ffffff" stroke-width="4" opacity="0.3"/>
    <image href="data:image/png;base64,${logoB64}" x="61" y="156" width="390" height="200" preserveAspectRatio="xMidYMid meet"/>
  </svg>`;
  fs.writeFileSync('public/favicon.svg', faviconSvg, 'utf-8');

  console.log('✅ Gold background with white letters icons created successfully!');
}

generateGoldIcons().catch(console.error);
