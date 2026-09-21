import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './style.css'

// Capturar evento de instalación nativa de la app en Android
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredInstallPrompt = e;
    window.dispatchEvent(new Event('pwa-installable'));
  });
}

// Registrar Service Worker para habilitar WebAPK en Android
if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
