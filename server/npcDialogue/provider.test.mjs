import { strict as assert } from 'node:assert';
import { afterEach, test } from 'node:test';
import { MiniMaxProviderError, requestMiniMaxNpcDialogue } from './provider.mjs';

const originalFetch = globalThis.fetch;
const originalEnvironmentApiKey = process.env.MINIMAX_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalEnvironmentApiKey === undefined) {
    delete process.env.MINIMAX_API_KEY;
  } else {
    process.env.MINIMAX_API_KEY = originalEnvironmentApiKey;
  }
});

test('requestMiniMaxNpcDialogue refuses a request-scoped call without a player key', async () => {
  process.env.MINIMAX_API_KEY = 'environment-fallback-must-not-be-used';
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error('fetch should not be called');
  };

  await assert.rejects(
    requestMiniMaxNpcDialogue({
      messages: [{ role: 'user', content: 'test' }],
      promptChars: 4,
      apiKey: '',
    }),
    error => {
      assert.equal(error instanceof MiniMaxProviderError, true);
      assert.equal(error.status, 401);
      assert.equal(error.code, 'missing_api_key');
      return true;
    },
  );
  assert.equal(fetchCalled, false);
});

test('requestMiniMaxNpcDialogue maps MiniMax 1026 input sensitivity to a local safety error', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    base_resp: {
      status_code: 1026,
      status_msg: 'input new_sensitive',
    },
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  await assert.rejects(
    requestMiniMaxNpcDialogue({
      messages: [{ role: 'user', content: 'test' }],
      promptChars: 4,
      apiKey: 'test-api-key',
    }),
    error => {
      assert.equal(error instanceof MiniMaxProviderError, true);
      assert.equal(error.status, 422);
      assert.equal(error.code, 'minimax_input_blocked');
      assert.match(error.message, /输入/);
      return true;
    },
  );
});

test('requestMiniMaxNpcDialogue uses the request key and fixed MiniMax endpoint/model', async () => {
  let requestUrl = null;
  let requestOptions = null;
  globalThis.fetch = async (url, options) => {
    requestUrl = String(url);
    requestOptions = options;
    return new Response(JSON.stringify({
      base_resp: { status_code: 0, status_msg: 'success' },
      choices: [
        {
          message: {
            content: '{"replyLines":["「好。」],"mood":"steady","endChat":false}',
          },
        },
      ],
      usage: {
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const result = await requestMiniMaxNpcDialogue({
    messages: [{ role: 'user', content: 'test' }],
    promptChars: 4,
    apiKey: 'request-player-key',
  });
  const requestBody = JSON.parse(requestOptions.body);

  assert.equal(requestUrl, 'https://api.minimaxi.com/v1/text/chatcompletion_v2');
  assert.equal(requestOptions.headers.Authorization, 'Bearer request-player-key');
  assert.equal(requestBody.model, 'MiniMax-M2.5');
  assert.equal(requestBody.temperature, 0.35);
  assert.equal(requestBody.top_p, 0.9);
  assert.equal(requestBody.stream, false);
  assert.equal(JSON.stringify(requestBody).includes('request-player-key'), false);
  assert.equal(JSON.stringify(result).includes('request-player-key'), false);
});
