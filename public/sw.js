const CACHE_NAME = 'sebastiang-v2026-09';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app-icon.png',
  '/app-icon-maskable.png',
  '/favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-First strategy: siempre busca contenido fresco en el servidor,
// permitiendo que las actualizaciones de Vercel lleguen al instante
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // No interceptar peticiones backend ni base de datos Supabase
  if (url.pathname.startsWith('/api') || url.hostname.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Interacción con Notificaciones Push (Estilo WhatsApp / Messenger)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const notifData = event.notification.data || {};
  let targetUrl = notifData.url || '/?mode=admin';

  if (action === 'whatsapp' && notifData.whatsappUrl) {
    targetUrl = notifData.whatsappUrl;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una ventana abierta con el panel, enfocarla
      for (const client of clientList) {
        if (client.url.includes('mode=admin') && 'focus' in client) {
          if (notifData.targetTab) {
            client.postMessage({ type: 'NAVIGATE_TAB', tab: notifData.targetTab });
          }
          return client.focus();
        }
      }
      // Si no hay ventana abierta, abrir la URL correspondiente
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
