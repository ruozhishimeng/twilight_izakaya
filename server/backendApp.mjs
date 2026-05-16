import express from 'express';
import path from 'path';
import { registerApiSettingsRoute } from './apiSettings/route.mjs';
import { createApiSettingsState } from './apiSettings/state.mjs';
import { registerNpcDialogueRoute } from './npcDialogue/route.mjs';

export const DEFAULT_BACKEND_HOST = '127.0.0.1';
export const DEFAULT_BACKEND_PORT = 3001;

export function createBackendApp(options = {}) {
  const {
    staticDir = null,
    serviceName = 'twilight-izakaya-backend',
    apiSettingsState = createApiSettingsState(),
  } = options;

  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: serviceName,
      time: new Date().toISOString(),
    });
  });

  app.get('/api/ping', (_req, res) => {
    res.json({
      message: 'pong',
      service: serviceName,
    });
  });

  registerApiSettingsRoute(app, apiSettingsState);
  registerNpcDialogueRoute(app);

  if (staticDir) {
    app.use(express.static(staticDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/health') {
        next();
        return;
      }

      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  return app;
}

export function startBackendServer(options = {}) {
  const {
    host = DEFAULT_BACKEND_HOST,
    port = DEFAULT_BACKEND_PORT,
    staticDir = null,
    serviceName,
    apiSettingsState,
  } = options;

  const app = createBackendApp({
    staticDir,
    serviceName,
    apiSettingsState,
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      resolve({
        app,
        server,
        host,
        port,
        url: `http://${host}:${port}`,
      });
    });

    server.once('error', reject);
  });
}
