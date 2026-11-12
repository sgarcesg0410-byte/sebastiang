const fs = require('fs');
const path = require('path');

const sharpDistDir = path.resolve(__dirname, '../node_modules/sharp/dist');
const sharpMjs = path.join(sharpDistDir, 'index.mjs');

if (fs.existsSync(sharpDistDir) && !fs.existsSync(sharpMjs)) {
  try {
    fs.writeFileSync(sharpMjs, "import sharp from './index.cjs';\nexport default sharp;\n", 'utf8');
  } catch (e) {
    // Silently ignore if permissions prevent writing
  }
}
