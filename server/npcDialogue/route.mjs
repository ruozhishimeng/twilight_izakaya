import { handleNpcDialogueRequest } from './handler.mjs';

export function registerNpcDialogueRoute(app) {
  app.post('/api/npc-dialogue', async (req, res) => {
    const result = await handleNpcDialogueRequest(req.body);
    res.status(result.status).json(result.body);
  });
}
