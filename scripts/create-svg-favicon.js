import fs from 'fs';
import path from 'path';

const logoPath = path.resolve('public/logo-white.png');
const logoB64 = fs.readFileSync(logoPath).toString('base64');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="128" fill="#0c0a09"/>
  <circle cx="256" cy="256" r="230" fill="none" stroke="#f59e0b" stroke-width="6" opacity="0.3"/>
  <image href="data:image/png;base64,${logoB64}" x="56" y="140" width="400" height="232" preserveAspectRatio="xMidYMid meet"/>
</svg>`;

fs.writeFileSync(path.resolve('public/favicon.svg'), svg, 'utf-8');
console.log('favicon.svg successfully generated!');
