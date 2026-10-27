const { app, BrowserWindow, session, shell, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { startServer } = require('../server.js');

let mainWindow = null;
let localServer = null;
let localOrigin = null;

ipcMain.handle('get-displays', () => {
  const primaryId = screen.getPrimaryDisplay().id;
  const displays = screen.getAllDisplays().map((display, index) => ({
    id: String(display.id),
    label: display.label || `Screen ${index + 1}`,
    isPrimary: display.id === primaryId,
    bounds: { ...display.bounds },
    workArea: { ...display.workArea },
    width: display.size.width,
    height: display.size.height,
    scaleFactor: display.scaleFactor,
  }));

  const secondary = displays.find((display) => !display.isPrimary) || displays[0];
  return [
    {
      id: 'default',
      label: 'Default (secondary display)',
      isDefault: true,
      isPrimary: false,
      bounds: secondary ? { ...secondary.bounds } : { x: 0, y: 0, width: 1024, height: 768 },
      workArea: secondary ? { ...secondary.workArea } : { x: 0, y: 0, width: 1024, height: 768 },
      width: secondary?.width || 1024,
      height: secondary?.height || 768,
    },
    ...displays,
  ];
});

ipcMain.on('toggle-presentation-fullscreen', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window && !window.isDestroyed()) window.setFullScreen(!window.isFullScreen());
});

ipcMain.on('close-presentation-window', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window && !window.isDestroyed()) {
    window.setFullScreen(false);
    window.close();
  }
});

function getPortableRoot() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
  if (app.isPackaged) return path.dirname(process.execPath);
  return path.join(__dirname, '..', '.portable-profile');
}

function configureProfileDirectory() {
  const portableRoot = getPortableRoot();
  const profileDir = path.join(portableRoot, 'profile');
  try {
    fs.mkdirSync(profileDir, { recursive: true });
    const probe = path.join(profileDir, '.write-test');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    app.setPath('userData', profileDir);
    app.setPath('sessionData', path.join(profileDir, 'session'));
  } catch (error) {
    // A read-only USB drive should still allow the app to start.  Chromium
    // falls back to the normal per-user directory for its cache in that case.
    console.warn('[desktop] Portable profile is not writable:', error.message);
  }
}

function parseWindowFeatures(features) {
  const result = {};
  for (const part of String(features || '').split(',')) {
    const [key, value] = part.split('=').map((item) => item.trim());
    if (!key || value === undefined) continue;
    const number = Number(value);
    if (['left', 'top', 'width', 'height'].includes(key) && Number.isFinite(number)) {
      result[key === 'left' ? 'x' : key === 'top' ? 'y' : key] = number;
    }
  }
  return result;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#0d1117',
    title: 'PDF Presentation Tool',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      nativeWindowOpen: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url, features }) => {
    if (localOrigin && url.startsWith(localOrigin)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          ...parseWindowFeatures(features),
          show: false,
          backgroundColor: '#000000',
          autoHideMenuBar: true,
          webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            nativeWindowOpen: true,
          },
        },
      };
    }

    if (/^https?:/i.test(url)) shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-create-window', (window) => {
    window.setMenuBarVisibility(false);
    window.setAutoHideMenuBar(true);
    window.once('ready-to-show', () => window.show());
    window.on('closed', () => {
      // The renderer detects the closed BrowserWindowProxy and updates its UI.
    });
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadURL(`${localOrigin}/index.html`);
}

async function startDesktop() {
  const distRoot = path.join(__dirname, '..', 'dist');
  localServer = await startServer({ root: distRoot });
  localOrigin = localServer.url;
  createWindow();
}

configureProfileDirectory();
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = permission === 'media' && localOrigin && webContents.getURL().startsWith(localOrigin);
    callback(Boolean(allowed));
  });

  try {
    await startDesktop();
  } catch (error) {
    console.error('[desktop] Failed to start:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  if (localServer) {
    const server = localServer;
    localServer = null;
    await server.close();
  }
});

app.on('activate', () => {
  if (!mainWindow && localOrigin) createWindow();
});
