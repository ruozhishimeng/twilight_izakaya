import dotenv from 'dotenv';
import {
  DEFAULT_BACKEND_HOST,
  DEFAULT_BACKEND_PORT,
  startBackendServer,
} from './server/backendApp.mjs';

dotenv.config();

const port = Number(process.env.PORT || DEFAULT_BACKEND_PORT);
const host = process.env.HOST || DEFAULT_BACKEND_HOST;

try {
  await startBackendServer({
    host,
    port,
  });
  console.log(`[twilight-izakaya-backend] listening on http://${host}:${port}`);
} catch (error) {
  console.error('[twilight-izakaya-backend] failed to start:', error);
  process.exit(1);
}
