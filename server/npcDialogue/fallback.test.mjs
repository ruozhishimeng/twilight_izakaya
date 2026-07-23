import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCharacterFallback } from './fallback.mjs';

const foxCharacter = {
  characterId: 'fox_uncle',
  policy: {
    fallbacks: {
      silence_or_exit: { reply_lines: ['（他扶正面具，没有再开口。）'], mood: 'guarded' },
      default: { reply_lines: ['「先喝酒吧。」'], mood: 'steady' },
    },
  },
};

test('fallback is selected by character and mode and keeps deterministic endChat', () => {
  const result = buildCharacterFallback(foxCharacter, {
    fallbackKey: 'silence_or_exit', endChat: true, promptChars: 12,
  });
  assert.deepEqual(result.replyLines, ['（他扶正面具，没有再开口。）']);
  assert.equal(result.endChat, true);
  assert.equal(result.usage.provider, 'local-character-fallback');
});

test('fallback uses a safe generic line when Task 3 role policy is absent', () => {
  const result = buildCharacterFallback({ characterId: 'aqiang', policy: null }, {
    fallbackKey: 'guarded_refusal', endChat: false, promptChars: 4,
  });
  assert.equal(result.replyLines.length, 1);
  assert.equal(result.mood, 'guarded');
});
