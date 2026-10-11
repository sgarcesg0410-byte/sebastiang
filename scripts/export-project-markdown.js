import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const outputFile = path.join(projectRoot, 'PROJECT_SOURCE_CODE.md');

const includedExtensions = new Set(['.js', '.jsx', '.cjs', '.mjs', '.sql', '.html', '.css', '.json']);
const excludedDirectories = new Set(['node_modules', 'dist', 'release', '.git', 'scratch_photos']);
const excludedFiles = new Set(['package-lock.json', 'PROJECT_SOURCE_CODE.md']);

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    if (item.isDirectory()) {
      if (!excludedDirectories.has(item.name)) {
        results = results.concat(getFiles(path.join(dir, item.name)));
      }
    } else {
      const ext = path.extname(item.name).toLowerCase();
      if (includedExtensions.has(ext) && !excludedFiles.has(item.name)) {
        results.push(path.join(dir, item.name));
      }
    }
  }
  return results;
}

console.log('Recolectando archivos para exportar a Markdown...');
const files = getFiles(projectRoot);

let mdContent = `# 📦 SebastianG • Código Fuente Completo del Proyecto en Markdown\n\n`;
mdContent += `Este archivo consolida el código fuente de los archivos de configuración, lógica, backend y frontend del proyecto **SebastianG Fotografía & Reservas**.\n\n`;
mdContent += `**Fecha de generación:** ${new Date().toISOString()}\n`;
mdContent += `**Total de archivos incluidos:** ${files.length}\n\n`;
mdContent += `## 📑 Índice de Archivos\n\n`;

files.forEach((file) => {
  const rel = path.relative(projectRoot, file).replace(/\\/g, '/');
  mdContent += `- [${rel}](#${rel.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()})\n`;
});

mdContent += `\n---\n\n`;

files.forEach((file) => {
  const rel = path.relative(projectRoot, file).replace(/\\/g, '/');
  const ext = path.extname(file).replace('.', '');
  const lang = ext === 'jsx' || ext === 'cjs' ? 'javascript' : ext;
  
  try {
    const content = fs.readFileSync(file, 'utf-8');
    mdContent += `## 📄 ${rel}\n\n`;
    mdContent += `\`\`\`${lang}\n`;
    mdContent += content;
    if (!content.endsWith('\n')) mdContent += '\n';
    mdContent += `\`\`\`\n\n---\n\n`;
  } catch (err) {
    console.warn(`No se pudo leer ${rel}:`, err.message);
  }
});

fs.writeFileSync(outputFile, mdContent, 'utf-8');
const stats = fs.statSync(outputFile);
console.log(`✓ Archivo Markdown generado con éxito: PROJECT_SOURCE_CODE.md (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
