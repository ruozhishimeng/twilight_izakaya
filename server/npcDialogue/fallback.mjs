import { normalizeReplyLines } from './responseParser.mjs';

const GENERIC_FALLBACKS = {
  safety_prompt_injection: { reply_lines: ['「还是说说店里的事吧。」'], mood: 'guarded' },
  safety_illegal: { reply_lines: ['「这种事，不适合在这里谈。」'], mood: 'guarded' },
  safety_sexual: { reply_lines: ['「换个话题。」'], mood: 'guarded' },
  silence_or_exit: { reply_lines: ['（对方沉默下来，没有再开口。）'], mood: 'guarded' },
  explicit_boundary: { reply_lines: ['「这件事到此为止。」'], mood: 'guarded' },
  guarded_refusal: { reply_lines: ['「这件事，我不想说。」'], mood: 'guarded' },
  soft_deflection: { reply_lines: ['「还是聊聊眼前的事吧。」'], mood: 'steady' },
  default: { reply_lines: ['（对方停顿片刻，没有继续这个话题。）'], mood: 'guarded' },
};

export function buildCharacterFallback(character, options) {
  const policyFallbacks = character?.policy?.fallbacks || {};
  const configured = policyFallbacks[options.fallbackKey] || policyFallbacks.default;
  const selected = configured || GENERIC_FALLBACKS[options.fallbackKey] || GENERIC_FALLBACKS.default;
  const replyLines = normalizeReplyLines(selected.reply_lines);
  return {
    replyLines,
    mood: selected.mood,
    endChat: options.endChat,
    usage: {
      provider: 'local-character-fallback',
      promptChars: options.promptChars || 0,
      completionChars: replyLines.join('').length,
    },
  };
}
