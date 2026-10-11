const { app, BrowserWindow, Menu, shell, ipcMain, Notification } = require('electron');
const path = require('path');

let mainWindow;

// ------------------------------------------------------------------------------
// VALIDACIÓN DE ENLACES EXTERNOS
// ------------------------------------------------------------------------------
// Antes se usaba `!url.includes('sebastiang.app')`, que se burla con un dominio
// como sebastiang.app.evil.com. Ahora se parsea la URL y se exige https + host
// de una lista blanca. Nunca se abren esquemas peligrosos (file:, ms-*, smb:...).
// ------------------------------------------------------------------------------
const APP_HOSTS = ['sebastiang.app', 'www.sebastiang.app'];
const EXTERNAL_HOSTS = [
  ...APP_HOSTS,
  'wa.me', 'api.whatsapp.com',
  'instagram.com', 'www.instagram.com',
  'facebook.com', 'www.facebook.com'
];

function parseUrl(rawUrl) {
  try {
    return new URL(String(rawUrl || ''));
  } catch {
    return null;
  }
}

function isSafeExternalUrl(rawUrl) {
  const parsed = parseUrl(rawUrl);
  if (!parsed) return false;
  if (parsed.protocol === 'mailto:') return true;
  if (parsed.protocol !== 'https:') return false;
  return EXTERNAL_HOSTS.includes(parsed.hostname.toLowerCase());
}

function isInternalUrl(rawUrl) {
  const parsed = parseUrl(rawUrl);
  if (!parsed) return false;
  if (parsed.protocol === 'file:') return true;
  return APP_HOSTS.includes(parsed.hostname.toLowerCase());
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true, // aísla el renderer aunque cargue contenido remoto
      webSecurity: true
    }
  });

  Menu.setApplicationMenu(null);

  // Abrir enlaces externos (WhatsApp, Instagram, etc.) en el navegador predeterminado de Windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url)) return { action: 'allow' };
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url);
    } else {
      console.warn('[Electron] Ventana bloqueada por seguridad:', url);
    }
    return { action: 'deny' };
  });

  // Impedir que la app navegue fuera del sitio (o al navegador si es un enlace externo)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) shell.openExternal(url);
    else console.warn('[Electron] Navegación bloqueada por seguridad:', url);
  });

  // Mostrar la ventana cuando esté lista para evitar parpadeos blancos
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Cargar primero la app en la nube con modo admin directo
  const cloudUrl = process.env.ELECTRON_START_URL || 'https://sebastiang.app/?mode=admin';
  const localDistPath = path.join(__dirname, '..', 'dist', 'index.html');

  mainWindow.loadURL(cloudUrl).catch((err) => {
    console.warn('Conexión remota fallida o sin internet, cargando paquete local...', err);
    mainWindow.loadFile(localDistPath, { query: { mode: 'admin' } });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handlers IPC para funciones nativas de escritorio
ipcMain.handle('app:print', async (event, options = {}) => {
  if (!mainWindow) return false;
  return new Promise((resolve) => {
    mainWindow.webContents.print(options, (success, failureReason) => {
      resolve({ success, failureReason });
    });
  });
});

ipcMain.handle('app:open-external', async (event, url) => {
  // El renderer puede cargar contenido remoto: nunca se abre una URL sin validar.
  if (!isSafeExternalUrl(url)) {
    console.warn('[Electron] URL externa bloqueada por seguridad:', url);
    return false;
  }
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('app:notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({
      title: title || 'Sebastian G • Estudio',
      body: body || '',
      icon: path.join(__dirname, '..', 'public', 'app-icon.png')
    }).show();
  }
  return true;
});

app.whenReady().then(() => {
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
