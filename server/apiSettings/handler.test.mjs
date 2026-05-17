import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { handleApiSettingsRequest } from './handler.mjs';
import { createApiSettingsState } from './state.mjs';

test('handleApiSettingsRequest returns status without exposing key material', async () => {
  const env = {
    MINIMAX_API_KEY: 'test-author-key',
    MINIMAX_MODEL: 'MiniMax-M2.5',
  };
  const state = createApiSettingsState({
    env,
    authorApiKey: 'test-author-key',
  });

  const result = await handleApiSettingsRequest({ method: 'GET' }, state);

  assert.equal(result.status, 200);
  assert.equal(result.body.configured, true);
  assert.equal(result.body.source, 'author');
  assert.equal(JSON.stringify(result.body).includes('test-author-key'), false);
});

test('handleApiSettingsRequest updates custom key without Express', async () => {
  const env = {
    MINIMAX_API_KEY: '',
    MINIMAX_MODEL: 'MiniMax-M2.5',
  };
  const state = createApiSettingsState({ env, authorApiKey: '' });

  const result = await handleApiSettingsRequest({
    method: 'POST',
    body: {
      mode: 'custom',
      apiKey: 'test-player-key',
    },
  }, state);

  assert.equal(result.status, 200);
  assert.equal(env.MINIMAX_API_KEY, 'test-player-key');
  assert.equal(result.body.configured, true);
  assert.equal(result.body.source, 'custom');
  assert.equal(JSON.stringify(result.body).includes('test-player-key'), false);
});

test('handleApiSettingsRequest rejects unsupported methods for Vercel functions', async () => {
  const state = createApiSettingsState({ env: {}, authorApiKey: '' });

  const result = await handleApiSettingsRequest({ method: 'DELETE' }, state);

  assert.equal(result.status, 405);
  assert.match(result.body.error, /不支持/);
});
