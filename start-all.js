import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Iniciando Estudio Fotográfico San Antero...');

// Iniciar Backend Express (Puerto 3001)
const server = spawn('node', ['server/index.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

// Iniciar Frontend Vite (Puerto 5173)
const vite = spawn('npx', ['vite', '--host'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

process.on('SIGINT', () => {
  server.kill();
  vite.kill();
  process.exit();
});
