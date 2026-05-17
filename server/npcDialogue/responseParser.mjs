import { MiniMaxProviderError } from './provider.mjs';

const ALLOWED_MOODS = new Set(['steady', 'warm', 'guarded', 'awkward', 'cryptic', 'nostalgic']);
const ALTERNATE_REPLY_LINE_KEYS = ['reply', 'replyLine', 'text', 'content', 'message', 'dialogue'];

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

  if (!stripped || stripped.length > 120) {
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

function recoverMalformedJson(content) {
  const moodMatch = content.match(/"mood"\s*:\s*"(steady|warm|guarded|awkward|cryptic|nostalgic)"/);
  const endChatMatch = content.match(/"endChat"\s*:\s*(true|false)/);
  const replyStart = content.indexOf('"replyLines"');

  if (!moodMatch || !endChatMatch || replyStart < 0) {
    return null;
  }

  const bracketStart = content.indexOf('[', replyStart);
  if (bracketStart < 0 || moodMatch.index <= bracketStart) {
    return null;
  }

  const replySection = content.slice(bracketStart + 1, moodMatch.index);
  const replyLines = [];
  const stringPattern = /"([^"]*)"/g;
  let match = stringPattern.exec(replySection);

  while (match) {
    if (match[1].trim()) {
      replyLines.push(match[1].trim());
    }
    match = stringPattern.exec(replySection);
  }

  if (replyLines.length < 1) {
    return null;
  }

  return {
    replyLines,
    mood: moodMatch[1],
    endChat: endChatMatch[1] === 'true',
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

function splitStructuredSegments(line) {
  const trimmed = line
    .trim()
    .replace(/《/g, '「')
    .replace(/》/g, '」')
    .replace(/[“”]/g, '');
  const segments = [];
  const pattern = /（[^）]+）|「[^」]+」|「[^」]+$/g;
  let match = pattern.exec(trimmed);

  while (match) {
    segments.push(match[0]);
    match = pattern.exec(trimmed);
  }

  if (segments.length < 2) {
    return [trimmed];
  }

  const remainder = trimmed
    .replace(pattern, '')
    .replace(/[」"'`，,、。；;：:\s]+/g, '');

  return remainder ? [trimmed] : segments;
}

function splitAdjacentQuotedSpeech(line) {
  const trimmed = line.trim().replace(/^」+/, '');
  const matches = trimmed.match(/「[^」]+」/g);

  if (!matches || matches.length < 2 || matches.join('') !== trimmed) {
    return [trimmed];
  }

  return matches;
}

function normalizeCjkVariants(line) {
  return line.replace(/[麼麽為說這裡謝體與後會還樣點對實]/g, char => ({
    麼: '么',
    麽: '么',
    為: '为',
    說: '说',
    這: '这',
    裡: '里',
    謝: '谢',
    體: '体',
    與: '与',
    後: '后',
    會: '会',
    還: '还',
    樣: '样',
    點: '点',
    對: '对',
    實: '实',
  }[char] || char));
}

function normalizeLineText(line) {
  const cleaned = normalizeCjkVariants(line)
    .replace(/^」+/, '')
    .replace(/^《/, '「')
    .replace(/》$/, '」')
    .replace(/「[，,、。；;：:！？!?]+/g, '「')
    .replace(/[，,、；;：:]+」/g, '」')
    .trim();

  if (cleaned.startsWith('「') && !cleaned.endsWith('」') && !cleaned.includes('」')) {
    return `${cleaned}」`;
  }

  return cleaned;
}

function normalizeReplyLines(lines) {
  const normalized = [];

  for (const line of lines) {
    for (const segment of splitActionAndSpeech(line)) {
      for (const structuredSegment of splitStructuredSegments(segment)) {
        for (const quotedSegment of splitAdjacentQuotedSpeech(structuredSegment)) {
          const cleaned = normalizeLineText(quotedSegment);
          if (cleaned) {
            normalized.push(cleaned);
          }
        }
      }
    }
  }

  return normalized;
}

function collectReplyLineCandidates(value) {
  const candidates = [];

  const append = (raw) => {
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed) {
        candidates.push(trimmed);
      }
      return;
    }

    if (Array.isArray(raw)) {
      raw.forEach(append);
    }
  };

  append(value.replyLines);

  if (candidates.length > 0) {
    return candidates;
  }

  for (const key of ALTERNATE_REPLY_LINE_KEYS) {
    append(value[key]);
    if (candidates.length > 0) {
      return candidates;
    }
  }

  return candidates;
}

export function parseModelOutput(content) {
  const candidate = extractJsonCandidate(content);

  try {
    return JSON.parse(candidate);
  } catch {
    const recovered = recoverMalformedJson(content);
    if (recovered) {
      console.warn('[npc-dialogue] recovered malformed model JSON.');
      return recovered;
    }

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

export function validateNpcDialogueResponse(value) {
  if (!value || typeof value !== 'object') {
    return { ok: false, error: '模型返回结构无效。' };
  }

  const normalizedReplyLines = normalizeReplyLines(collectReplyLineCandidates(value));
  const replyLines = normalizedReplyLines.slice(0, 5);

  if (replyLines.length < 1) {
    return { ok: false, error: '模型返回的 replyLines 数量无效。' };
  }

  if (replyLines.join('').length > 120) {
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
