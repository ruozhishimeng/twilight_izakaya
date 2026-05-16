import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createApiSettingsState } from './apiSettings/state.mjs';
import { startBackendServer } from './backendApp.mjs';

test('startBackendServer wires the provided API settings state', async () => {
  const env = {
    MINIMAX_API_KEY: 'test-author-key',
    MINIMAX_MODEL: 'MiniMax-M2.5',
  };
  const apiSettingsState = createApiSettingsState({
    env,
    authorApiKey: 'test-author-key',
  });
  const runtime = await startBackendServer({
    host: '127.0.0.1',
    port: 0,
    apiSettingsState,
  });

  try {
    const address = runtime.server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/settings/api-key`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.configured, true);
    assert.equal(body.source, 'author');
    assert.equal(body.supportsAuthorKey, true);
  } finally {
    await new Promise(resolve => runtime.server.close(resolve));
  }
});
