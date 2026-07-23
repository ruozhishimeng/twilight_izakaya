import { strict as assert } from 'node:assert';
import { afterEach, test } from 'node:test';
import { MiniMaxProviderError, requestMiniMaxNpcDialogue } from './provider.mjs';

const originalFetch = globalThis.fetch;
const originalEnvironmentApiKey = process.env.MINIMAX_API_KEY;
const originalTimeout = process.env.MINIMAX_TIMEOUT_MS;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalEnvironmentApiKey === undefined) {
    delete process.env.MINIMAX_API_KEY;
  } else {
    process.env.MINIMAX_API_KEY = originalEnvironmentApiKey;
  }
  if (originalTimeout === undefined) delete process.env.MINIMAX_TIMEOUT_MS;
  else process.env.MINIMAX_TIMEOUT_MS = originalTimeout;
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
    temperature: 0.65,
    topP: 0.8,
  });
  const requestBody = JSON.parse(requestOptions.body);

  assert.equal(requestUrl, 'https://api.minimaxi.com/v1/text/chatcompletion_v2');
  assert.equal(requestOptions.headers.Authorization, 'Bearer request-player-key');
  assert.equal(requestBody.model, 'MiniMax-M2.5');
  assert.equal(requestBody.temperature, 0.65);
  assert.equal(requestBody.top_p, 0.8);
  assert.equal(requestBody.stream, false);
  assert.equal(JSON.stringify(requestBody).includes('request-player-key'), false);
  assert.equal(JSON.stringify(result).includes('request-player-key'), false);
});

test('external abort is linked and remains distinguishable from timeout', async () => {
  const external = new AbortController();
  globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  });
  const pending = requestMiniMaxNpcDialogue({
    messages: [{ role: 'user', content: 'test' }], promptChars: 4, apiKey: 'request-key',
    signal: external.signal, temperature: 0.65, topP: 0.9,
  });
  external.abort();
  await assert.rejects(pending, error => {
    assert.equal(error.code, 'request_aborted');
    assert.equal(error.status, 499);
    return true;
  });
});

test('internal timeout maps to request_timeout', async () => {
  process.env.MINIMAX_TIMEOUT_MS = '5';
  globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  });
  await assert.rejects(requestMiniMaxNpcDialogue({
    messages: [{ role: 'user', content: 'test' }], promptChars: 4, apiKey: 'request-key',
    temperature: 0.1, topP: 0.8,
  }), error => {
    assert.equal(error.code, 'request_timeout');
    assert.equal(error.status, 504);
    return true;
  });
});

test('external abort remains linked while the upstream response body is streaming', async () => {
  const external = new AbortController();
  globalThis.fetch = async (_url, options) => ({
    ok: true,
    status: 200,
    text: () => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
      setTimeout(() => reject(new Error('body stream was not aborted')), 10);
    }),
  });
  const pending = requestMiniMaxNpcDialogue({
    messages: [{ role: 'user', content: 'test' }], promptChars: 4, apiKey: 'request-key',
    signal: external.signal, temperature: 0.65, topP: 0.9,
  });
  queueMicrotask(() => external.abort());
  await assert.rejects(pending, error => {
    assert.equal(error.code, 'request_aborted');
    return true;
  });
});
