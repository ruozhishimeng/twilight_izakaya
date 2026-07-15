import { handleNpcDialogueRequest } from './handler.mjs';
import { parseMiniMaxAuthorizationHeader } from './apiKey.mjs';

export function registerNpcDialogueRoute(app) {
  app.post('/api/npc-dialogue', async (req, res) => {
    const auth = parseMiniMaxAuthorizationHeader(req.get('authorization'));
    if (!auth.ok) {
      res.status(401).json({ error: auth.error });
      return;
    }

    const result = await handleNpcDialogueRequest(req.body, {
      apiKey: auth.apiKey,
    });
    res.status(result.status).json(result.body);
  });
}
