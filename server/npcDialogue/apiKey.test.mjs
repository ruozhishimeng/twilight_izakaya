import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseMiniMaxAuthorizationHeader, validateMiniMaxApiKey } from './apiKey.mjs';

test('parseMiniMaxAuthorizationHeader accepts one opaque MiniMax bearer key', () => {
  assert.deepEqual(parseMiniMaxAuthorizationHeader('Bearer player-key-123'), {
    ok: true,
    apiKey: 'player-key-123',
  });
});

test('MiniMax request key validation rejects missing, placeholder, whitespace and oversized keys', () => {
  for (const value of [
    undefined,
    '',
    'yourAPIKEY',
    'your_api_key',
    'your-minimax-api-key',
    'your_minimax_api_key',
    'key with spaces',
    '含中文的-key',
    'x'.repeat(513),
  ]) {
    const result = validateMiniMaxApiKey(value);
    assert.equal(result.ok, false);
    if (typeof value === 'string' && value.length > 0) {
      assert.equal(JSON.stringify(result).includes(value), false);
    }
  }
});

test('parseMiniMaxAuthorizationHeader rejects non-Bearer credentials without echoing them', () => {
  const result = parseMiniMaxAuthorizationHeader('Basic sensitive-player-key');
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result).includes('sensitive-player-key'), false);
});
