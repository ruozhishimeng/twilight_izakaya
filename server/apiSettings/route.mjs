import { createApiSettingsState } from './state.mjs';

function getErrorStatus(error) {
  return typeof error?.status === 'number' ? error.status : 400;
}

export function registerApiSettingsRoute(app, apiSettingsState = createApiSettingsState()) {
  app.get('/api/settings/api-key', (_req, res) => {
    res.json(apiSettingsState.getStatus());
  });

  app.post('/api/settings/api-key', async (req, res) => {
    const mode = typeof req.body?.mode === 'string' ? req.body.mode : '';

    try {
      if (mode === 'author') {
        const result = await apiSettingsState.useAuthorKey();
        if (!result.ok) {
          res.status(result.status || 409).json({
            error: result.error || '无法使用作者 KEY。',
            status: apiSettingsState.getStatus(),
          });
          return;
        }

        res.json(result.status);
        return;
      }

      if (mode === 'custom') {
        const result = await apiSettingsState.saveCustomKey(req.body?.apiKey);
        res.json(result.status);
        return;
      }

      if (mode === 'clear') {
        const result = await apiSettingsState.clearKey();
        res.json(result.status);
        return;
      }

      res.status(400).json({
        error: '未知的 API 设置操作。',
        status: apiSettingsState.getStatus(),
      });
    } catch (error) {
      res.status(getErrorStatus(error)).json({
        error: error instanceof Error ? error.message : 'API 设置更新失败。',
        status: apiSettingsState.getStatus(),
      });
    }
  });
}
