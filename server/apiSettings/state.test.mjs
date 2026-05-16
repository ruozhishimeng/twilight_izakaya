import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createApiSettingsState } from './state.mjs';

test('reports missing MiniMax key without exposing secret values', () => {
  const env = {
    MINIMAX_API_KEY: '',
    MINIMAX_MODEL: 'MiniMax-M2.5',
  };
  const state = createApiSettingsState({
    env,
    authorApiKey: '',
  });

  const status = state.getStatus();

  assert.equal(status.provider, 'minimax');
  assert.equal(status.configured, false);
  assert.equal(status.source, 'none');
  assert.equal(status.supportsAuthorKey, false);
  assert.equal(Object.hasOwn(status, 'apiKey'), false);
});

test('useAuthorKey activates the captured author key without returning it', async () => {
  const env = {
    MINIMAX_API_KEY: '',
    MINIMAX_MODEL: 'MiniMax-M2.5',
  };
  const state = createApiSettingsState({
    env,
    authorApiKey: 'test-author-key',
  });

  const result = await state.useAuthorKey();
  const status = state.getStatus();

  assert.equal(result.ok, true);
  assert.equal(env.MINIMAX_API_KEY, 'test-author-key');
  assert.equal(status.configured, true);
  assert.equal(status.source, 'author');
  assert.equal(status.supportsAuthorKey, true);
  assert.equal(JSON.stringify(status).includes('test-author-key'), false);
});

test('saveCustomKey trims and persists the player MiniMax key', async () => {
  const env = {
    MINIMAX_API_KEY: '',
    MINIMAX_MODEL: 'MiniMax-M2.5',
  };
  const patches = [];
  const state = createApiSettingsState({
    env,
    authorApiKey: '',
    persistConfig: async patch => {
      patches.push(patch);
    },
  });

  const result = await state.saveCustomKey('  test-player-key  ');
  const status = state.getStatus();

  assert.equal(result.ok, true);
  assert.equal(env.MINIMAX_API_KEY, 'test-player-key');
  assert.deepEqual(patches, [{ MINIMAX_API_KEY: 'test-player-key' }]);
  assert.equal(status.configured, true);
  assert.equal(status.source, 'custom');
  assert.equal(JSON.stringify(status).includes('test-player-key'), false);
});

test('saveCustomKey rejects empty and placeholder keys', async () => {
  const env = {
    MINIMAX_API_KEY: '',
    MINIMAX_MODEL: 'MiniMax-M2.5',
  };
  const state = createApiSettingsState({
    env,
    authorApiKey: '',
  });

  await assert.rejects(() => state.saveCustomKey(''), /有效/);
  await assert.rejects(() => state.saveCustomKey('yourAPIKEY'), /有效/);
  assert.equal(env.MINIMAX_API_KEY, '');
});
