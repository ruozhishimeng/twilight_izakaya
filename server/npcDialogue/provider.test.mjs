import { strict as assert } from 'node:assert';
import { afterEach, test } from 'node:test';
import { MiniMaxProviderError, requestMiniMaxNpcDialogue } from './provider.mjs';

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.MINIMAX_API_KEY;
const originalModel = process.env.MINIMAX_MODEL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.MINIMAX_API_KEY = originalApiKey;
  process.env.MINIMAX_MODEL = originalModel;
});

test('requestMiniMaxNpcDialogue maps MiniMax 1026 input sensitivity to a local safety error', async () => {
  process.env.MINIMAX_API_KEY = 'test-api-key';
  process.env.MINIMAX_MODEL = 'MiniMax-M2.5';
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

test('requestMiniMaxNpcDialogue uses conservative decoding settings for stable NPC JSON', async () => {
  process.env.MINIMAX_API_KEY = 'test-api-key';
  process.env.MINIMAX_MODEL = 'MiniMax-M2.5';
  let requestBody = null;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      base_resp: { status_code: 0, status_msg: 'success' },
      choices: [
        {
          message: {
            content: '{"replyLines":["「好。」"],"mood":"steady","endChat":false}',
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

  await requestMiniMaxNpcDialogue({
    messages: [{ role: 'user', content: 'test' }],
    promptChars: 4,
  });

  assert.equal(requestBody.temperature, 0.35);
  assert.equal(requestBody.top_p, 0.9);
  assert.equal(requestBody.stream, false);
});
