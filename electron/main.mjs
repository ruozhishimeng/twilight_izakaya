import { app, BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { startBackendServer } from '../server/backendApp.mjs';
import { scrubLegacyPlaintextMiniMaxKey } from './legacyConfig.mjs';

const DESKTOP_HOST = '127.0.0.1';
const DESKTOP_PORT = 37621;
let mainWindow = null;
let backendServer = null;

app.setName('黄昏居酒屋');

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

function applyDesktopRuntimeConfig() {
  process.env.HOST = DESKTOP_HOST;
  process.env.PORT = String(DESKTOP_PORT);
  process.env.TWILIGHT_DESKTOP = 'true';
}

async function startDesktopBackend() {
  const appRoot = app.getAppPath();
  const staticDir = path.join(appRoot, 'dist');

  if (!fs.existsSync(path.join(staticDir, 'index.html'))) {
    throw new Error(`未找到桌面前端构建产物：${staticDir}`);
  }

  const legacyConfigPath = path.join(app.getPath('userData'), 'config.json');
  scrubLegacyPlaintextMiniMaxKey(legacyConfigPath);
  applyDesktopRuntimeConfig();

  const backend = await startBackendServer({
    host: DESKTOP_HOST,
    port: DESKTOP_PORT,
    staticDir,
    serviceName: 'twilight-izakaya-desktop',
  });

  backendServer = backend.server;
  return backend.url;
}

async function createMainWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#1c1411',
    title: '黄昏居酒屋',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  await mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.focus();
});

app.on('before-quit', () => {
  if (backendServer) {
    backendServer.close();
    backendServer = null;
  }
});

app.whenReady()
  .then(async () => {
    const url = await startDesktopBackend();
    await createMainWindow(url);
  })
  .catch(error => {
    const message = error?.code === 'EADDRINUSE'
      ? `本地端口 ${DESKTOP_PORT} 已被占用。请确认是否已经打开了一个《黄昏居酒屋》桌面版实例。`
      : error instanceof Error
        ? error.message
        : String(error);

    dialog.showErrorBox('黄昏居酒屋启动失败', message);
    app.quit();
  });

app.on('window-all-closed', () => {
  app.quit();
});
