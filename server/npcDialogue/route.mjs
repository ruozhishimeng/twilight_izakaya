import { buildMiniMaxNpcDialogueMessages } from './promptBuilder.mjs';
import { requestMiniMaxNpcDialogue, MiniMaxProviderError } from './provider.mjs';
import { parseModelOutput, validateNpcDialogueResponse } from './responseParser.mjs';
import { buildUnsupportedNpcDialogueResponse, moderateNpcDialogueInput } from './safety.mjs';
import { validateNpcDialogueRequest } from './schema.mjs';

export function registerNpcDialogueRoute(app) {
  app.post('/api/npc-dialogue', async (req, res) => {
    const validation = validateNpcDialogueRequest(req.body);

    if (!validation.ok) {
      res.status(400).json({
        error: validation.error,
      });
      return;
    }

    try {
      const moderation = moderateNpcDialogueInput(validation.value.playerText);
      if (!moderation.allowed) {
        res.json(buildUnsupportedNpcDialogueResponse(moderation, validation.value.playerText.length));
        return;
      }

      const promptPayload = buildMiniMaxNpcDialogueMessages(validation.value);
      const providerResult = await requestMiniMaxNpcDialogue(promptPayload);
      const parsedOutput = parseModelOutput(providerResult.content);
      const responseValidation = validateNpcDialogueResponse(parsedOutput);

      if (!responseValidation.ok) {
        res.status(502).json({
          error: responseValidation.error,
        });
        return;
      }

      res.json({
        ...responseValidation.value,
        usage: providerResult.usage,
      });
    } catch (error) {
      if (error instanceof MiniMaxProviderError) {
        res.status(error.status).json({
          error: error.message,
        });
        return;
      }

      res.status(502).json({
        error: '对话服务返回了无效内容。',
      });
    }
  });
}
