const { app, BrowserWindow, Menu, shell, ipcMain, Notification } = require('electron');
const path = require('path');

let mainWindow;

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
      sandbox: false,
      webSecurity: true
    }
  });

  Menu.setApplicationMenu(null);

  // Abrir enlaces externos (WhatsApp, Instagram, etc.) en el navegador predeterminado de Windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://wa.me') || url.startsWith('https://api.whatsapp.com') || url.startsWith('mailto:') || !url.includes('sebastiang.app')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
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
  if (url) await shell.openExternal(url);
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
