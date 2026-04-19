import { buildMiniMaxNpcDialogueMessages } from './promptBuilder.mjs';
import { requestMiniMaxNpcDialogue, MiniMaxProviderError } from './provider.mjs';
import { validateNpcDialogueRequest } from './schema.mjs';

const ALLOWED_MOODS = new Set(['steady', 'warm', 'guarded', 'awkward']);

function stripCodeFence(content) {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractJsonCandidate(content) {
  const stripped = stripCodeFence(content);
  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return stripped.slice(firstBrace, lastBrace + 1);
  }

  return stripped;
}

function fallbackPlainDialogue(content) {
  const stripped = stripCodeFence(content);

  if (!stripped || stripped.length > 90) {
    return null;
  }

  if (stripped.includes('{') || stripped.includes('}')) {
    return null;
  }

  return {
    replyLines: [stripped],
    mood: 'steady',
    endChat: false,
  };
}

function splitActionAndSpeech(line) {
  const trimmed = typeof line === 'string' ? line.trim() : '';
  if (!trimmed) {
    return [];
  }

  const match = trimmed.match(/^[（(]([^）)]+)[）)]\s*(.+)$/);
  if (!match) {
    return [trimmed];
  }

  const action = `（${match[1].trim()}）`;
  const speech = match[2].trim();
  return speech ? [action, speech] : [action];
}

function normalizeReplyLines(lines) {
  const normalized = [];

  for (const line of lines) {
    normalized.push(...splitActionAndSpeech(line));
  }

  return normalized.filter(Boolean);
}

function parseModelOutput(content) {
  const candidate = extractJsonCandidate(content);

  try {
    return JSON.parse(candidate);
  } catch {
    const fallback = fallbackPlainDialogue(content);
    if (fallback) {
      fallback.replyLines = normalizeReplyLines(fallback.replyLines);
      console.warn('[npc-dialogue] model returned plain dialogue, normalized into replyLines.');
      return fallback;
    }

    console.error('[npc-dialogue] invalid model output:', content);
    throw new MiniMaxProviderError('模型返回格式无效。', {
      status: 502,
      code: 'invalid_json',
    });
  }
}

function validateNpcDialogueResponse(value) {
  if (!value || typeof value !== 'object') {
    return { ok: false, error: '模型返回结构无效。' };
  }

  const replyLines = Array.isArray(value.replyLines)
    ? normalizeReplyLines(
        value.replyLines.map(line => (typeof line === 'string' ? line.trim() : '')).filter(Boolean),
      )
    : null;

  if (!replyLines || replyLines.length < 1 || replyLines.length > 2) {
    return { ok: false, error: '模型返回的 replyLines 数量无效。' };
  }

  if (replyLines.join('').length > 90) {
    return { ok: false, error: '模型返回内容过长。' };
  }

  if (!ALLOWED_MOODS.has(value.mood)) {
    return { ok: false, error: '模型返回的 mood 无效。' };
  }

  if (typeof value.endChat !== 'boolean') {
    return { ok: false, error: '模型返回的 endChat 无效。' };
  }

  return {
    ok: true,
    value: {
      replyLines,
      mood: value.mood,
      endChat: value.endChat,
    },
  };
}

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
