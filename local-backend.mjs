import dotenv from 'dotenv';
import { createApiSettingsState } from './server/apiSettings/state.mjs';
import {
  DEFAULT_BACKEND_HOST,
  DEFAULT_BACKEND_PORT,
  startBackendServer,
} from './server/backendApp.mjs';

dotenv.config();

const port = Number(process.env.PORT || DEFAULT_BACKEND_PORT);
const host = process.env.HOST || DEFAULT_BACKEND_HOST;
const apiSettingsState = createApiSettingsState({
  authorApiKey:
    process.env.TWILIGHT_AUTHOR_MINIMAX_API_KEY ||
    process.env.AUTHOR_MINIMAX_API_KEY ||
    process.env.MINIMAX_API_KEY ||
    '',
  allowCurrentKeyAsAuthor: true,
});

try {
  await startBackendServer({
    host,
    port,
    apiSettingsState,
  });
  console.log(`[twilight-izakaya-backend] listening on http://${host}:${port}`);
} catch (error) {
  console.error('[twilight-izakaya-backend] failed to start:', error);
  process.exit(1);
}
