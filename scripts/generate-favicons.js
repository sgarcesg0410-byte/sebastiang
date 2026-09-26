import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Clean, razor-sharp SVG for favicons with full transparency outside the rounded squircle
// We optimize the squircle radius and font sizing so that at 16x16 and 32x32 the "SG" is punchy and instantly recognizable
const svgFavicon = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Sunset Gradients -->
    <linearGradient id="favBase" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFD600" />
      <stop offset="25%" stop-color="#FF6A00" />
      <stop offset="55%" stop-color="#EE0979" />
      <stop offset="85%" stop-color="#9B51E0" />
      <stop offset="100%" stop-color="#5851DB" />
    </linearGradient>

    <radialGradient id="favYellow" cx="20%" cy="95%" r="75%">
      <stop offset="0%" stop-color="#FFEA79" stop-opacity="0.95" />
      <stop offset="40%" stop-color="#FF7A00" stop-opacity="0.85" />
      <stop offset="85%" stop-color="#D6249F" stop-opacity="0" />
    </radialGradient>

    <radialGradient id="favPurple" cx="85%" cy="15%" r="80%">
      <stop offset="0%" stop-color="#405DE6" stop-opacity="0.95" />
      <stop offset="50%" stop-color="#833AB4" stop-opacity="0.85" />
      <stop offset="100%" stop-color="#C13584" stop-opacity="0" />
    </radialGradient>

    <linearGradient id="favGlass" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.38" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
    </linearGradient>

    <filter id="favDropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.45" />
    </filter>
  </defs>

  <!--
    IMPORTANT: No background rectangle! Outside the squircle is 100% transparent.
    Squircle starts with slight margin (x=8, y=8, w=496, h=496, rx=120) so antialiasing is silky smooth.
  -->
  <rect x="8" y="8" width="496" height="496" rx="120" fill="url(#favBase)" />
  <rect x="8" y="8" width="496" height="496" rx="120" fill="url(#favYellow)" />
  <rect x="8" y="8" width="496" height="496" rx="120" fill="url(#favPurple)" />

  <!-- Subtle glass highlight -->
  <rect x="12" y="12" width="488" height="488" rx="116" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-opacity="0.4" />
  <path d="M 8 128 C 8 61.7 61.7 8 128 8 L 384 8 C 450.3 8 504 61.7 504 128 L 504 220 L 8 220 Z" fill="url(#favGlass)" />

  <!-- Monogram SG - Crisp, bold and perfectly legible at small sizes -->
  <g filter="url(#favDropShadow)">
    <text
      x="256"
      y="336"
      text-anchor="middle"
      font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', Montserrat, Segoe UI, Arial, sans-serif"
      font-size="234"
      font-weight="900"
      letter-spacing="-12"
      fill="#FFFFFF"
    >SG</text>
  </g>
</svg>
`;

// Helper to create a valid multi-image ICO file from PNG buffers
function createIco(pngBuffers) {
  // pngBuffers: array of { width, height, buffer }
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = count * dirEntrySize;
  let offset = headerSize + dirSize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(count, 4); // count of images

  const dirEntries = [];
  const imageBuffers = [];

  for (const item of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(item.width >= 256 ? 0 : item.width, 0);
    entry.writeUInt8(item.height >= 256 ? 0 : item.height, 1);
    entry.writeUInt8(0, 2); // palette colors
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(item.buffer.length, 8); // image size
    entry.writeUInt32LE(offset, 12); // image offset

    dirEntries.push(entry);
    imageBuffers.push(item.buffer);
    offset += item.buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...imageBuffers]);
}

async function generateFavicons() {
  console.log('Generating crisp, transparent-corner favicons...');
  const svgBuf = Buffer.from(svgFavicon);

  // 1. Save updated favicon.svg
  fs.writeFileSync('public/favicon.svg', svgFavicon.trim());

  // 2. Generate 16x16, 32x32, 48x48, 64x64, 180x180 PNGs with full RGBA transparency
  const sizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-48x48.png', size: 48 },
    { name: 'favicon.png', size: 64 },
    { name: 'apple-touch-icon.png', size: 180 },
  ];

  const icoSources = [];

  for (const { name, size } of sizes) {
    const pngBuf = await sharp(svgBuf)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();

    fs.writeFileSync(path.join('public', name), pngBuf);

    if (size === 16 || size === 32 || size === 48) {
      icoSources.push({ width: size, height: size, buffer: pngBuf });
    }
  }

  // 3. Generate multi-resolution favicon.ico (16, 32, 48)
  const icoBuf = createIco(icoSources);
  fs.writeFileSync('public/favicon.ico', icoBuf);

  // Copy to dist if dist exists
  if (fs.existsSync('dist')) {
    fs.copyFileSync('public/favicon.svg', 'dist/favicon.svg');
    for (const { name } of sizes) {
      fs.copyFileSync(path.join('public', name), path.join('dist', name));
    }
    fs.copyFileSync('public/favicon.ico', 'dist/favicon.ico');
  }

  console.log('All favicons generated with full alpha transparency!');
}

generateFavicons().catch(console.error);
