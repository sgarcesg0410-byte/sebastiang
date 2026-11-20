const { app, BrowserWindow, Menu, shell, ipcMain, Notification, session } = require('electron');
const path = require('path');
const { fileURLToPath } = require('url');

let mainWindow;

// ------------------------------------------------------------------------------
// VALIDACIÓN DE ENLACES EXTERNOS Y RUTAS FILE:// LOCALES
// ------------------------------------------------------------------------------
// Antes se usaba `!url.includes('sebastiang.app')`, que se burla con un dominio
// como sebastiang.app.evil.com. Ahora se parsea la URL y se exige https + host
// de una lista blanca. Para `file:`, se restringe exclusivamente al directorio
// empaquetado `dist/` de la aplicación.
// ------------------------------------------------------------------------------
const APP_HOSTS = ['sebastiang.app', 'www.sebastiang.app'];
const EXTERNAL_HOSTS = [
  ...APP_HOSTS,
  'wa.me', 'api.whatsapp.com',
  'checkout.wompi.co',
  'instagram.com', 'www.instagram.com',
  'facebook.com', 'www.facebook.com',
  'maps.google.com', 'drive.google.com',
  'wetransfer.com', 'we.tl'
];
const LOCAL_DIST_ROOT = path.resolve(__dirname, '..', 'dist');
const HARDENED_WEB_PREFERENCES = {
  preload: path.join(__dirname, 'preload.cjs'),
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true, // aísla el renderer aunque cargue contenido remoto
  webSecurity: true
};

function parseUrl(rawUrl) {
  try {
    return new URL(String(rawUrl || ''));
  } catch {
    return null;
  }
}

function isAllowedLocalDistFileUrl(parsedUrl) {
  if (!parsedUrl || parsedUrl.protocol !== 'file:') return false;
  try {
    const resolvedTarget = path.resolve(fileURLToPath(parsedUrl));
    const normRoot = process.platform === 'win32' ? LOCAL_DIST_ROOT.toLowerCase() : LOCAL_DIST_ROOT;
    const normTarget = process.platform === 'win32' ? resolvedTarget.toLowerCase() : resolvedTarget;
    return normTarget === normRoot || normTarget.startsWith(normRoot + path.sep);
  } catch {
    return false;
  }
}

function isSafeExternalUrl(rawUrl) {
  const parsed = parseUrl(rawUrl);
  if (!parsed) return false;
  if (parsed.protocol === 'mailto:') return true;
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;
  return EXTERNAL_HOSTS.includes(parsed.hostname.toLowerCase());
}

function isInternalUrl(rawUrl) {
  const parsed = parseUrl(rawUrl);
  if (!parsed) return false;
  if (parsed.protocol === 'file:') {
    return isAllowedLocalDistFileUrl(parsed);
  }
  if (!app.isPackaged && parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
    return true;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;
  return APP_HOSTS.includes(parsed.hostname.toLowerCase());
}

function attachWebContentsSecurityGuards(contents) {
  // Prohibir la inyección dinámica de <webview>
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  // Abrir enlaces externos (WhatsApp, Wompi, Instagram, etc.) en el navegador predeterminado
  contents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true
          }
        }
      };
    }
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url);
    } else {
      console.warn('[Electron] Ventana bloqueada por seguridad:', url);
    }
    return { action: 'deny' };
  });

  // Impedir que la app navegue fuera del sitio (o al navegador si es un enlace externo)
  contents.on('will-navigate', (event, url) => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) shell.openExternal(url);
    else console.warn('[Electron] Navegación bloqueada por seguridad:', url);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'Sebastian G • Fotografía & POS Estudio',
    icon: path.join(__dirname, '..', 'public', process.platform === 'win32' ? 'app-icon.ico' : 'app-icon.png'),
    backgroundColor: '#0c0a09',
    autoHideMenuBar: true,
    show: false,
    webPreferences: HARDENED_WEB_PREFERENCES
  });

  Menu.setApplicationMenu(null);

  // Mostrar la ventana cuando esté lista para evitar parpadeos blancos
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Cargar primero la app en la nube con modo admin directo (validando ELECTRON_START_URL)
  const rawStartUrl = String(process.env.ELECTRON_START_URL || '').trim();
  const cloudUrl = (rawStartUrl && isInternalUrl(rawStartUrl))
    ? rawStartUrl
    : 'https://sebastiang.app/?mode=admin';
  const localDistPath = path.join(__dirname, '..', 'dist', 'index.html');

  mainWindow.loadURL(cloudUrl).catch((err) => {
    console.warn('Conexión remota fallida o sin internet, cargando paquete local...', err);
    mainWindow.loadFile(localDistPath, { query: { mode: 'admin' } });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Valida que el emisor de un mensaje IPC sea el marco principal de un origen interno autorizado (Hallazgo B7)
function isTrustedIpcSender(event) {
  const senderFrame = event && event.senderFrame;
  if (!senderFrame) return false;
  if (senderFrame.parent) return false; // Rechazar iframes secundarios
  return isInternalUrl(senderFrame.url);
}

// Handlers IPC para funciones nativas de escritorio
ipcMain.handle('app:print', async (event, options = {}) => {
  if (!isTrustedIpcSender(event)) {
    console.warn('[Electron] IPC app:print rechazado desde origen no confiable:', event?.senderFrame?.url);
    return false;
  }
  if (!mainWindow) return false;
  const safeOptions = {
    silent: false,
    printBackground: options?.printBackground !== false,
    landscape: Boolean(options?.landscape),
    color: options?.color !== false
  };
  return new Promise((resolve) => {
    mainWindow.webContents.print(safeOptions, (success, failureReason) => {
      resolve({ success, failureReason });
    });
  });
});

ipcMain.handle('app:open-external', async (event, url) => {
  if (!isTrustedIpcSender(event)) {
    console.warn('[Electron] IPC app:open-external rechazado desde origen no confiable:', event?.senderFrame?.url);
    return false;
  }
  // El renderer puede cargar contenido remoto: nunca se abre una URL sin validar.
  if (!isSafeExternalUrl(url)) {
    console.warn('[Electron] URL externa bloqueada por seguridad:', url);
    return false;
  }
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('app:notification', (event, { title, body } = {}) => {
  if (!isTrustedIpcSender(event)) {
    console.warn('[Electron] IPC app:notification rechazado desde origen no confiable:', event?.senderFrame?.url);
    return false;
  }
  if (Notification.isSupported()) {
    new Notification({
      title: String(title || 'Sebastian G • Estudio').slice(0, 80),
      body: String(body || '').slice(0, 240),
      icon: path.join(__dirname, '..', 'public', 'app-icon.png')
    }).show();
  }
  return true;
});

// Endurecimiento global para toda instancia WebContents (principal y ventanas emergentes)
app.on('web-contents-created', (_event, contents) => {
  attachWebContentsSecurityGuards(contents);
});

app.whenReady().then(() => {
  // Denegar por defecto todos los permisos sensibles (cámara, micrófono, geolocalización, USB, etc.)
  // y autorizar únicamente notificaciones para orígenes internos oficiales.
  if (session.defaultSession) {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      const requestingUrl = details?.requestingUrl || webContents?.getURL?.() || '';
      const allowed = permission === 'notifications' && isInternalUrl(requestingUrl);
      callback(allowed);
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
      const originUrl = requestingOrigin || webContents?.getURL?.() || '';
      return permission === 'notifications' && isInternalUrl(originUrl);
    });
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
