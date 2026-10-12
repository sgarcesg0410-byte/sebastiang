import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const TARGET_DIRS = ['api', 'server'];
let totalChecked = 0;
let errors = 0;

function checkFile(filePath) {
  try {
    execSync(`node --check "${filePath}"`, { stdio: 'pipe' });
    console.log(`✓ Sintaxis válida: ${filePath}`);
    totalChecked++;
  } catch (err) {
    console.error(`❌ ERROR DE SINTAXIS en: ${filePath}`);
    console.error(err.stderr ? err.stderr.toString() : err.message);
    errors++;
  }
}

function traverseDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      traverseDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.cjs') || entry.name.endsWith('.mjs'))) {
      checkFile(fullPath);
    }
  }
}

console.log('🔍 Iniciando verificación exhaustiva de sintaxis del backend...');
for (const dir of TARGET_DIRS) {
  traverseDir(dir);
}

if (fs.existsSync('electron/main.cjs')) {
  checkFile('electron/main.cjs');
}

console.log(`\n📋 Verificación completa: ${totalChecked} archivos revisados.`);
if (errors > 0) {
  console.error(`🚨 Se encontraron ${errors} errores de sintaxis.`);
  process.exit(1);
} else {
  console.log('✅ Todos los módulos del backend tienen sintaxis 100% válida.\n');
}
