import { handleNpcDialogueRequest } from './handler.mjs';
import { resolveMiniMaxApiKey } from './apiKey.mjs';

export function registerNpcDialogueRoute(app) {
  app.post('/api/npc-dialogue', async (req, res) => {
    const auth = resolveMiniMaxApiKey(
      req.get('authorization'),
      process.env.MINIMAX_API_KEY,
    );
    if (!auth.ok) {
      res.status(401).json({ error: auth.error });
      return;
    }

    const controller = new AbortController();
    const abortRequest = () => controller.abort();
    const abortOnUnfinishedClose = () => {
      if (!res.writableEnded) controller.abort();
    };
    req.once('aborted', abortRequest);
    res.once('close', abortOnUnfinishedClose);
    try {
      const result = await handleNpcDialogueRequest(req.body, {
        apiKey: auth.apiKey,
        signal: controller.signal,
        includeDebug: req.body?.debug === true,
      });
      if (!res.destroyed && !res.writableEnded) {
        res.status(result.status).json(result.body);
      }
    } finally {
      req.off('aborted', abortRequest);
      res.off('close', abortOnUnfinishedClose);
    }
  });
}
