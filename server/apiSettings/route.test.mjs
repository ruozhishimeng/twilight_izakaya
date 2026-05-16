import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import express from 'express';
import { createApiSettingsState } from './state.mjs';
import { registerApiSettingsRoute } from './route.mjs';

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${address.port}`,
      });
    });
    server.once('error', reject);
  });
}

async function withServer(state, callback) {
  const app = express();
  app.use(express.json());
  registerApiSettingsRoute(app, state);
  const runtime = await listen(app);

  try {
    await callback(runtime.url);
  } finally {
    await new Promise(resolve => runtime.server.close(resolve));
  }
}

test('GET /api/settings/api-key returns MiniMax status without key material', async () => {
  const env = {
    MINIMAX_API_KEY: '',
    MINIMAX_MODEL: 'MiniMax-M2.5',
  };
  const state = createApiSettingsState({ env, authorApiKey: '' });

  await withServer(state, async url => {
    const response = await fetch(`${url}/api/settings/api-key`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.provider, 'minimax');
    assert.equal(body.configured, false);
    assert.equal(Object.hasOwn(body, 'apiKey'), false);
  });
});

test('POST /api/settings/api-key saves a custom MiniMax key', async () => {
  const env = {
    MINIMAX_API_KEY: '',
    MINIMAX_MODEL: 'MiniMax-M2.5',
  };
  const state = createApiSettingsState({ env, authorApiKey: '' });

  await withServer(state, async url => {
    const response = await fetch(`${url}/api/settings/api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'custom',
        apiKey: 'test-player-key',
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(env.MINIMAX_API_KEY, 'test-player-key');
    assert.equal(body.configured, true);
    assert.equal(body.source, 'custom');
    assert.equal(JSON.stringify(body).includes('test-player-key'), false);
  });
});

test('POST /api/settings/api-key returns 409 when author key is unavailable', async () => {
  const env = {
    MINIMAX_API_KEY: '',
    MINIMAX_MODEL: 'MiniMax-M2.5',
  };
  const state = createApiSettingsState({ env, authorApiKey: '' });

  await withServer(state, async url => {
    const response = await fetch(`${url}/api/settings/api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'author' }),
    });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.match(body.error, /作者 KEY/);
    assert.equal(env.MINIMAX_API_KEY, '');
  });
});
