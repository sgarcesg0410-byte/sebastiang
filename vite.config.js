import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const emptyDepPath = path.resolve(__dirname, 'src/services/emptyOptionalDep.js')

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      // jsPDF declara html2canvas, canvg y dompurify como dependencias opcionales para jsPDF.html().
      // No usamos jsPDF.html() (generamos PDF vectorial puro), así que el alias evita inflar el bundle;
      // el override "dompurify" en package.json se conserva deliberadamente para parchear CVEs
      // transitivos de jspdf -> dompurify reportados por npm audit.
      html2canvas: emptyDepPath,
      canvg: emptyDepPath,
      dompurify: emptyDepPath
    }
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('react-dom') || id.includes('/react/')) {
              return 'vendor-react';
            }
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    host: true, // Permite abrirlo desde el celular en la misma red WiFi
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  test: {
    testTimeout: 15000
  }
})
