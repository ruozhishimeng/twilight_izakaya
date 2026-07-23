const ALLOWED_MOODS = new Set(['steady', 'warm', 'guarded', 'awkward', 'cryptic', 'nostalgic']);

function normalizeCjkVariants(line) {
  return line.replace(/[麼麽為說這裡謝體與後會還樣點對實]/g, char => ({
    麼: '么', 麽: '么', 為: '为', 說: '说', 這: '这', 裡: '里', 謝: '谢',
    體: '体', 與: '与', 後: '后', 會: '会', 還: '还', 樣: '样', 點: '点',
    對: '对', 實: '实',
  }[char] || char));
}

function normalizeLineText(line) {
  const cleaned = normalizeCjkVariants(String(line || ''))
    .trim().replace(/^[」》]+/, '').replace(/^《/, '「').replace(/》$/, '」')
    .replace(/「[，,、。；;：:！？!?]+/g, '「')
    .replace(/[，,、；;：:]+」/g, '」');
  if (cleaned.startsWith('「') && !cleaned.endsWith('」') && !cleaned.includes('」')) return `${cleaned}」`;
  return cleaned;
}

export function isCompoundReplyLine(line) {
  const value = String(line || '').trim();
  const wrappers = new Map([
    ['「', '」'],
    ['（', '）'],
    ['(', ')'],
  ]);
  const separator = /[\s\p{P}\p{S}]/u;
  let index = 0;
  let units = 0;

  while (index < value.length) {
    while (index < value.length) {
      const character = value[index];
      if (wrappers.has(character) || !separator.test(character)) break;
      index += 1;
    }
    if (index >= value.length) break;
    units += 1;
    if (units > 1) return true;

    const opener = value[index];
    const closer = wrappers.get(opener);
    if (!closer) {
      index += 1;
      while (index < value.length && !wrappers.has(value[index])) index += 1;
      continue;
    }

    let depth = 0;
    while (index < value.length) {
      const character = value[index];
      if (character === opener) depth += 1;
      if (character === closer) {
        depth -= 1;
        index += 1;
        if (depth === 0) break;
        continue;
      }
      index += 1;
    }
  }

  return false;
}

export function normalizeReplyLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines.flatMap(raw => {
    if (typeof raw !== 'string' || !raw.trim()) return [];
    const normalized = normalizeLineText(raw.trim());
    return normalized ? [normalized] : [];
  });
}

export function parseModelOutput(content) {
  try {
    const value = JSON.parse(String(content || '').trim());
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not object');
    return { ok: true, value };
  } catch {
    return { ok: false, code: 'invalid_json', error: '模型返回格式无效。' };
  }
}

export function validateNpcDialogueResponse(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: '模型返回结构无效。' };
  const keys = Object.keys(value);
  if (keys.length !== 3 || !keys.every(key => ['replyLines', 'mood', 'endChat'].includes(key))) {
    return { ok: false, error: '模型返回结构包含未知字段。' };
  }
  if (!Array.isArray(value.replyLines) || !value.replyLines.every(line => typeof line === 'string' && line.trim())) {
    return { ok: false, error: '模型返回的 replyLines 数量无效。' };
  }
  if (value.replyLines.some(isCompoundReplyLine)) {
    return { ok: false, error: '模型返回的 replyLines 结构无效。' };
  }
  const replyLines = normalizeReplyLines(value.replyLines);
  if (replyLines.length < 1 || replyLines.length > 5 || replyLines.join('').length > 120) {
    return { ok: false, error: '模型返回的 replyLines 数量无效。' };
  }
  if (!ALLOWED_MOODS.has(value.mood)) return { ok: false, error: '模型返回的 mood 无效。' };
  if (typeof value.endChat !== 'boolean') return { ok: false, error: '模型返回的 endChat 无效。' };
  return { ok: true, value: { replyLines, mood: value.mood, endChat: value.endChat } };
}
