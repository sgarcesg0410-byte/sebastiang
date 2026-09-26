import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// 1. GENERATE OG-IMAGE.PNG (1200 x 630 px) - Industry standard for WhatsApp, Facebook, Twitter, iMessage
// Designed with a centered safe area (630x630 in the middle) so whether displayed as 16:9 or cropped to 1:1, it is 100% flawless.
const svgOgBanner = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradient: Deep luxury obsidian with subtle warmth -->
    <radialGradient id="bgGlow" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#1c1612" />
      <stop offset="45%" stop-color="#0e0c0a" />
      <stop offset="100%" stop-color="#060504" />
    </radialGradient>

    <!-- Warm Caribbean Sunset Ambient Glow behind the logo -->
    <radialGradient id="ambientGlow" cx="50%" cy="42%" r="38%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.32" />
      <stop offset="40%" stop-color="#ec4899" stop-opacity="0.20" />
      <stop offset="75%" stop-color="#8b5cf6" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#060504" stop-opacity="0" />
    </radialGradient>

    <!-- Instagram Sunset Gradients for Emblem -->
    <linearGradient id="igBase" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFD600" />
      <stop offset="25%" stop-color="#FF6A00" />
      <stop offset="55%" stop-color="#EE0979" />
      <stop offset="85%" stop-color="#9B51E0" />
      <stop offset="100%" stop-color="#5851DB" />
    </linearGradient>

    <radialGradient id="igYellowGlow" cx="20%" cy="95%" r="75%">
      <stop offset="0%" stop-color="#FFEA79" stop-opacity="0.9" />
      <stop offset="40%" stop-color="#FF7A00" stop-opacity="0.8" />
      <stop offset="85%" stop-color="#D6249F" stop-opacity="0" />
    </radialGradient>

    <radialGradient id="igPurpleGlow" cx="85%" cy="15%" r="80%">
      <stop offset="0%" stop-color="#405DE6" stop-opacity="0.95" />
      <stop offset="50%" stop-color="#833AB4" stop-opacity="0.85" />
      <stop offset="100%" stop-color="#C13584" stop-opacity="0" />
    </radialGradient>

    <linearGradient id="glassTop" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.36" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
    </linearGradient>

    <!-- Drop Shadow on SG letters -->
    <filter id="shadowSG" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.45" />
    </filter>

    <!-- Luxurious floating shadow for the entire emblem -->
    <filter id="emblemShadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.75" />
      <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#f59e0b" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Canvas Background -->
  <rect width="1200" height="630" fill="url(#bgGlow)" />
  <rect width="1200" height="630" fill="url(#ambientGlow)" />

  <!-- Subtle luxury border frame -->
  <rect x="24" y="24" width="1152" height="582" rx="28" fill="none" stroke="#f59e0b" stroke-opacity="0.15" stroke-width="1.5" />

  <!--
    CENTERED EMBLEM
    Size: 260 x 260 px.
    x = (1200 - 260) / 2 = 470
    y = 100
    Emblem ends at y = 360.
    Plenty of room for elegant branding below!
  -->
  <g transform="translate(470, 95)" filter="url(#emblemShadow)">
    <!-- Squircle with 62px border radius -->
    <rect width="260" height="260" rx="62" fill="url(#igBase)" />
    <rect width="260" height="260" rx="62" fill="url(#igYellowGlow)" />
    <rect width="260" height="260" rx="62" fill="url(#igPurpleGlow)" />

    <!-- Glass sheen & top shine -->
    <rect x="2" y="2" width="256" height="256" rx="60" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.45" />
    <path d="M 0 62 C 0 27.8 27.8 0 62 0 L 198 0 C 232.2 0 260 27.8 260 62 L 260 108 L 0 108 Z" fill="url(#glassTop)" />

    <!-- SG Monogram -->
    <g filter="url(#shadowSG)">
      <text
        x="130"
        y="172"
        text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', Montserrat, 'Segoe UI', Arial, sans-serif"
        font-size="116"
        font-weight="900"
        letter-spacing="-6"
        fill="#FFFFFF"
      >SG</text>
    </g>
  </g>

  <!-- Verified Photographer Badge Pill -->
  <g transform="translate(485, 385)">
    <rect width="230" height="34" rx="17" fill="#171412" stroke="#f59e0b" stroke-opacity="0.4" stroke-width="1" />
    <circle cx="22" cy="17" r="4.5" fill="#10b981" />
    <text x="36" y="22" font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="700" letter-spacing="1.5" fill="#f59e0b">PORTAFOLIO OFICIAL</text>
  </g>

  <!-- Typography Brand -->
  <text
    x="600"
    y="462"
    text-anchor="middle"
    font-family="Georgia, 'Playfair Display', serif"
    font-size="34"
    font-weight="700"
    letter-spacing="5"
    fill="#FFFFFF"
  >SEBASTIAN G</text>

  <text
    x="600"
    y="498"
    text-anchor="middle"
    font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', Segoe UI, sans-serif"
    font-size="14"
    font-weight="600"
    letter-spacing="4"
    fill="#e5e7eb"
  >FOTOGRAFÍA &amp; EDICIÓN PROFESIONAL</text>

  <text
    x="600"
    y="528"
    text-anchor="middle"
    font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', Segoe UI, sans-serif"
    font-size="12"
    font-weight="500"
    letter-spacing="2"
    fill="#a8a29e"
  >SAN ANTERO &amp; COVEÑAS • COLOMBIA</text>
</svg>
`;

async function main() {
  console.log('Generating social sharing OpenGraph assets...');

  // 1. Generate og-image.png (1200 x 630)
  const ogBuffer = Buffer.from(svgOgBanner);
  await sharp(ogBuffer)
    .png({ quality: 90, compressionLevel: 8 })
    .toFile('public/og-image.png');
  
  // Also create a high-quality JPG version (WhatsApp loves small fast JPGs)
  await sharp(ogBuffer)
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toFile('public/og-image.jpg');

  // Copy to dist as well
  if (fs.existsSync('dist')) {
    fs.copyFileSync('public/og-image.png', 'dist/og-image.png');
    fs.copyFileSync('public/og-image.jpg', 'dist/og-image.jpg');
  }

  const statOg = fs.statSync('public/og-image.png');
  const statOgJpg = fs.statSync('public/og-image.jpg');

  console.log('✓ public/og-image.png (1200x630):', (statOg.size / 1024).toFixed(1), 'KB');
  console.log('✓ public/og-image.jpg (1200x630):', (statOgJpg.size / 1024).toFixed(1), 'KB');
  console.log('Done!');
}

main().catch(console.error);
