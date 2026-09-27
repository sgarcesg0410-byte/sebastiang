import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const WIDTH = 1640;
const HEIGHT = 624;

const brainDir = 'C:\\Users\\Sebas\\.gemini\\antigravity\\brain\\06375906-47ce-4f9b-9974-8009bffffe5d';
const publicDir = path.join(process.cwd(), 'public');
const generatedSunsetPath = path.join(brainDir, 'portada_facebook_sebastiang_1790484805296.jpg');

async function createCinematicCover() {
  console.log('Generating Cinematic Cover...');

  // 1. Resize and crop the sunset camera photo to exact Facebook dimensions (1640x624)
  const bgBuffer = await sharp(generatedSunsetPath)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'center' })
    .toBuffer();

  // 2. SVG overlay with dark vignette on left side for text readability + luxury gold branding
  const svgOverlay = `
  <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Gradient shadow on left to make text pop against bright sunset -->
      <linearGradient id="leftFade" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0a0806" stop-opacity="0.88" />
        <stop offset="38%" stop-color="#0e0a07" stop-opacity="0.75" />
        <stop offset="65%" stop-color="#140d08" stop-opacity="0.35" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.05" />
      </linearGradient>

      <!-- Warm ambient bottom glow -->
      <linearGradient id="bottomFade" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#0a0806" stop-opacity="0.75" />
        <stop offset="30%" stop-color="#0a0806" stop-opacity="0.25" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0" />
      </linearGradient>

      <!-- Gold metallic text gradient -->
      <linearGradient id="goldText" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#FCD34D" />
        <stop offset="50%" stop-color="#F59E0B" />
        <stop offset="100%" stop-color="#D97706" />
      </linearGradient>

      <!-- Drop shadow for text -->
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.9" />
      </filter>
    </defs>

    <!-- Shading overlays -->
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#leftFade)" />
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bottomFade)" />

    <!-- Thin elegant luxury border -->
    <rect x="24" y="24" width="${WIDTH - 48}" height="${HEIGHT - 48}" rx="20" fill="none" stroke="#F59E0B" stroke-opacity="0.3" stroke-width="1.5" />

    <!-- Left Brand Content Group -->
    <g transform="translate(100, 110)" filter="url(#shadow)">
      
      <!-- Top Pill Tag -->
      <rect x="0" y="0" width="310" height="34" rx="17" fill="#F59E0B" fill-opacity="0.18" stroke="#F59E0B" stroke-opacity="0.5" stroke-width="1" />
      <text x="20" y="22" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#FDE68A" letter-spacing="3">
        SAN ANTERO &amp; COVEÑAS
      </text>

      <!-- Main Artist Title -->
      <text x="0" y="98" font-family="'Georgia', serif" font-size="64" font-weight="900" fill="url(#goldText)" letter-spacing="4">
        SEBASTIAN G
      </text>

      <!-- Subtitle -->
      <text x="4" y="142" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="700" fill="#F5F5F4" letter-spacing="5">
        FOTOGRAFÍA PROFESIONAL
      </text>

      <!-- Services List -->
      <text x="4" y="195" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="400" fill="#D6D3D1" letter-spacing="1.2">
        Sesiones en Playa  •  Retratos  •  Quinceañeras  •  Bodas  •  Eventos
      </text>

      <!-- Slogan -->
      <text x="4" y="235" font-family="'Georgia', serif" font-style="italic" font-size="16" fill="#FDE68A" letter-spacing="0.5">
        "Capturamos momentos, creamos recuerdos. ♡"
      </text>

      <!-- Contact Bar Pill -->
      <g transform="translate(0, 280)">
        <!-- WhatsApp Button -->
        <rect x="0" y="0" width="320" height="48" rx="24" fill="#059669" fill-opacity="0.9" stroke="#10B981" stroke-width="1" />
        <text x="24" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="800" fill="#FFFFFF" letter-spacing="1">
          📲 WhatsApp: 324 472 5167
        </text>

        <!-- Web Badge -->
        <rect x="336" y="0" width="220" height="48" rx="24" fill="#1C1917" fill-opacity="0.85" stroke="#F59E0B" stroke-opacity="0.5" stroke-width="1" />
        <text x="360" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="800" fill="#FBBF24" letter-spacing="1">
          🌐 sebastiang.app
        </text>
      </g>
    </g>
  </svg>
  `;

  const finalBuffer = await sharp(bgBuffer)
    .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
    .jpeg({ quality: 95 })
    .toBuffer();

  const outPublic = path.join(publicDir, 'portada-facebook-cinematica.jpg');
  const outBrain = path.join(brainDir, 'portada_facebook_cinematica.jpg');
  fs.writeFileSync(outPublic, finalBuffer);
  fs.writeFileSync(outBrain, finalBuffer);
  console.log('✓ Created Cinematic Cover:', outPublic);
}

async function createEditorialCollageCover() {
  console.log('Generating Editorial Collage Cover...');

  const photo1Path = path.join(publicDir, 'catalog', 'cat-1789916145830.jpg');
  const photo2Path = path.join(publicDir, 'catalog', 'cat-1790139247128.jpg');
  const photo3Path = path.join(publicDir, 'catalog', 'cat-1790138378422.jpg');

  const p1 = await sharp(photo1Path).resize(360, 480, { fit: 'cover' }).toBuffer();
  const p2 = await sharp(photo2Path).resize(360, 480, { fit: 'cover' }).toBuffer();
  const p3 = await sharp(photo3Path).resize(360, 480, { fit: 'cover' }).toBuffer();

  // Create base canvas: Dark luxury background (1640x624)
  const svgCollage = `
  <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg" cx="30%" cy="50%" r="70%">
        <stop offset="0%" stop-color="#1c1612" />
        <stop offset="60%" stop-color="#0e0c0a" />
        <stop offset="100%" stop-color="#050504" />
      </radialGradient>
      <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#FCD34D" />
        <stop offset="50%" stop-color="#F59E0B" />
        <stop offset="100%" stop-color="#D97706" />
      </linearGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />

    <!-- Thin gold outer border -->
    <rect x="24" y="24" width="${WIDTH - 48}" height="${HEIGHT - 48}" rx="20" fill="none" stroke="#F59E0B" stroke-opacity="0.35" stroke-width="1.5" />

    <!-- Left Brand Section -->
    <g transform="translate(80, 110)">
      <rect x="0" y="0" width="310" height="34" rx="17" fill="#F59E0B" fill-opacity="0.18" stroke="#F59E0B" stroke-opacity="0.5" stroke-width="1" />
      <text x="20" y="22" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#FDE68A" letter-spacing="3">
        SAN ANTERO &amp; COVEÑAS
      </text>

      <text x="0" y="98" font-family="'Georgia', serif" font-size="62" font-weight="900" fill="url(#gold)" letter-spacing="4">
        SEBASTIAN G
      </text>

      <text x="4" y="142" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="700" fill="#F5F5F4" letter-spacing="5">
        FOTOGRAFÍA &amp; EDICIÓN PROFESIONAL
      </text>

      <text x="4" y="195" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="400" fill="#D6D3D1" letter-spacing="1">
        Retratos en Playa  •  Quinceañeras  •  Parejas  •  Familias  •  Eventos
      </text>

      <text x="4" y="235" font-family="'Georgia', serif" font-style="italic" font-size="16" fill="#FDE68A">
        "Capturamos momentos, creamos recuerdos. ♡"
      </text>

      <g transform="translate(0, 280)">
        <rect x="0" y="0" width="300" height="48" rx="24" fill="#059669" fill-opacity="0.9" stroke="#10B981" stroke-width="1" />
        <text x="24" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="800" fill="#FFFFFF" letter-spacing="1">
          📲 WhatsApp: 324 472 5167
        </text>

        <rect x="316" y="0" width="200" height="48" rx="24" fill="#1C1917" stroke="#F59E0B" stroke-opacity="0.5" stroke-width="1" />
        <text x="336" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="800" fill="#FBBF24" letter-spacing="1">
          🌐 sebastiang.app
        </text>
      </g>
    </g>

    <!-- Frames for photos on right -->
    <rect x="830" y="70" width="220" height="484" rx="16" fill="none" stroke="#F59E0B" stroke-opacity="0.4" stroke-width="2" />
    <rect x="1080" y="70" width="220" height="484" rx="16" fill="none" stroke="#F59E0B" stroke-opacity="0.4" stroke-width="2" />
    <rect x="1330" y="70" width="220" height="484" rx="16" fill="none" stroke="#F59E0B" stroke-opacity="0.4" stroke-width="2" />
  </svg>
  `;

  const p1Thumb = await sharp(photo1Path).resize(216, 480, { fit: 'cover' }).toBuffer();
  const p2Thumb = await sharp(photo2Path).resize(216, 480, { fit: 'cover' }).toBuffer();
  const p3Thumb = await sharp(photo3Path).resize(216, 480, { fit: 'cover' }).toBuffer();

  const finalCollage = await sharp(Buffer.from(svgCollage))
    .composite([
      { input: p1Thumb, top: 72, left: 832 },
      { input: p2Thumb, top: 72, left: 1082 },
      { input: p3Thumb, top: 72, left: 1332 }
    ])
    .jpeg({ quality: 95 })
    .toBuffer();

  const outPublic = path.join(publicDir, 'portada-facebook-editorial.jpg');
  const outBrain = path.join(brainDir, 'portada_facebook_editorial.jpg');
  fs.writeFileSync(outPublic, finalCollage);
  fs.writeFileSync(outBrain, finalCollage);
  console.log('✓ Created Editorial Cover:', outPublic);
}

async function main() {
  await createCinematicCover();
  await createEditorialCollageCover();
}

main().catch(console.error);
