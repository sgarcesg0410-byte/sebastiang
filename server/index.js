// ==============================================================================
// SERVIDOR LOCAL / ESCRITORIO UNIFICADO (CANONICAL BACKEND ENTRYPOINT)
// ==============================================================================
// Unifica el entorno local (`npm run server`, `npm run dev:all`, Electron) con
// el backend canónico de producción (`../api/index.js`), eliminando duplicidad
// de rutas, divergencia de validaciones y almacenamiento local desincronizado.
// ==============================================================================

import 'dotenv/config';
import app from '../api/index.js';

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
  console.log(`✓ Servidor canónico de Foto Reservas corriendo en http://localhost:${PORT}`);
});

export default app;
