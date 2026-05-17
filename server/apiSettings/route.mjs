import { createApiSettingsState } from './state.mjs';
import { handleApiSettingsRequest } from './handler.mjs';

export function registerApiSettingsRoute(app, apiSettingsState = createApiSettingsState()) {
  app.get('/api/settings/api-key', async (_req, res) => {
    const result = await handleApiSettingsRequest({ method: 'GET' }, apiSettingsState);
    res.status(result.status).json(result.body);
  });

  app.post('/api/settings/api-key', async (req, res) => {
    const result = await handleApiSettingsRequest(
      {
        method: 'POST',
        body: req.body,
      },
      apiSettingsState,
    );
    res.status(result.status).json(result.body);
  });
}
