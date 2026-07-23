import { findForbiddenMutationKey } from './modelOutput.mjs';
import {
  containsProtectedText,
  normalizeProtectedText,
  redactProtectedText,
} from './protectedText.mjs';
import { normalizeReplyLines } from './responseParser.mjs';

const GLOBAL_BANNED_PHRASES = [
  '作为ai', '作为人工智能', '语言模型', 'ai助手', '客服', '客户服务',
  '有什么可以帮', '抱歉我不能', '无法协助', '系统提示', '开发者指令',
];

function normalizedText(value) {
  return normalizeProtectedText(value);
}

function bigrams(value) {
  const text = normalizedText(value);
  const result = new Set();
  for (let index = 0; index < text.length - 1; index += 1) result.add(text.slice(index, index + 2));
  return result;
}

function similarity(left, right) {
  const a = bigrams(left); const b = bigrams(right);
  if (!a.size || !b.size) return normalizedText(left) === normalizedText(right) ? 1 : 0;
  let intersection = 0;
  a.forEach(pair => { if (b.has(pair)) intersection += 1; });
  return intersection / new Set([...a, ...b]).size;
}

export function redactProtectedLines(lines, protectedLexemes = []) {
  return lines.map(line => redactProtectedText(line, protectedLexemes));
}

export function guardDialogueReply(candidate, input) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) ||
      Object.keys(candidate).some(key => !['replyLines', 'mood'].includes(key)) ||
      findForbiddenMutationKey(candidate)) {
    return { ok: false, reason: 'state_mutation' };
  }
  const replyLines = normalizeReplyLines(candidate.replyLines);
  if (replyLines.length < 1 || replyLines.length > 5 || replyLines.join('').length > 120) {
    return { ok: false, reason: 'invalid_structure' };
  }
  if (!input.guardRules.allowedMoods.includes(candidate.mood)) return { ok: false, reason: 'invalid_mood' };
  const combined = normalizedText(replyLines.join('\n'));
  const forbiddenPhrases = [
    ...GLOBAL_BANNED_PHRASES,
    ...(input.guardRules.bannedPhrases || []),
    ...(input.guardRules.publicConflictLexemes || []),
  ].map(normalizedText).filter(Boolean);
  if (forbiddenPhrases.some(phrase => combined.includes(phrase)) ||
      containsProtectedText(replyLines.join('\n'), input.guardRules.protectedLexemes)) {
    return { ok: false, reason: 'forbidden_content' };
  }

  const recentNpcLines = (input.recentTranscript || [])
    .filter(entry => entry?.role === 'npc' && entry?.source === 'tail_chat')
    .map(entry => entry.text);
  if (recentNpcLines.some(previous => replyLines.some(current =>
    normalizedText(previous) === normalizedText(current) || similarity(previous, current) >= 0.82
  ))) return { ok: false, reason: 'repetition' };

  return { ok: true, value: { replyLines, mood: candidate.mood } };
}
