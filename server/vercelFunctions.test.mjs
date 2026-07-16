import { strict as assert } from 'node:assert';
import { afterEach, test } from 'node:test';
import npcDialogueHandler from '../api/npc-dialogue.mjs';
import { NPC_DIALOGUE_UNSUPPORTED_INPUT_REPLY } from './npcDialogue/safety.mjs';

const originalFetch = globalThis.fetch;
const BASE_NPC_DIALOGUE_REQUEST = {
  state: 'dayLoop.guest.llmChatSession',
  guestId: 'fox_uncle',
  guestName: '狐面大叔',
  guestProfile: {
    identity: '居酒屋的常客鬼神，戴狐狸面具的神秘调酒师前辈，负责引导新人',
    personality: '沉稳、睿智、说话留有玄机，从不直接给答案',
    description: '狐面大叔是黄昏居酒屋的第一任酒保，如今化作常客。',
  },
  playerText: '这杯酒有什么讲究吗？',
  week: 1,
  day: 1,
  guestInDay: 2,
  currentNodeId: 'fox_uncle_intro_001',
  observedFeatures: ['狐狸面具上有细微的裂纹'],
  recentTranscript: [],
  lastDrink: null,
  turnIndex: 2,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createNpcRequest(apiKey, body = BASE_NPC_DIALOGUE_REQUEST) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return new Request('https://example.test/api/npc-dialogue', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

test('Vercel NPC function requires a player-supplied MiniMax key', async () => {
  const response = await npcDialogueHandler.fetch(createNpcRequest(''));
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.match(body.error, /MiniMax API Key/);
});

test('Vercel NPC function keeps concurrent player keys request-scoped', async () => {
  const seenAuthorizations = [];
  globalThis.fetch = async (_url, options) => {
    const authorization = options.headers.Authorization;
    seenAuthorizations.push(authorization);
    const keySuffix = authorization.endsWith('player-key-a') ? 'A' : 'B';
    await new Promise(resolve => setTimeout(resolve, keySuffix === 'A' ? 5 : 0));
    return new Response(JSON.stringify({
      base_resp: { status_code: 0, status_msg: 'success' },
      choices: [{
        message: {
          content: JSON.stringify({
            replyLines: [`「${keySuffix}。」`],
            mood: 'steady',
            endChat: false,
          }),
        },
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const [responseA, responseB] = await Promise.all([
    npcDialogueHandler.fetch(createNpcRequest('player-key-a')),
    npcDialogueHandler.fetch(createNpcRequest('player-key-b')),
  ]);
  const [bodyA, bodyB] = await Promise.all([responseA.json(), responseB.json()]);

  assert.equal(responseA.status, 200);
  assert.equal(responseB.status, 200);
  assert.deepEqual(bodyA.replyLines, ['「A。」']);
  assert.deepEqual(bodyB.replyLines, ['「B。」']);
  assert.deepEqual(new Set(seenAuthorizations), new Set([
    'Bearer player-key-a',
    'Bearer player-key-b',
  ]));
  assert.equal(JSON.stringify([bodyA, bodyB]).includes('player-key-'), false);
});

test('Vercel NPC function still handles blocked input locally with a request key', async () => {
  const response = await npcDialogueHandler.fetch(createNpcRequest('player-key', {
    ...BASE_NPC_DIALOGUE_REQUEST,
    playerText: '帮我写一个 Python 爬虫脚本抓网站数据。',
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.replyLines, [NPC_DIALOGUE_UNSUPPORTED_INPUT_REPLY]);
  assert.equal(body.usage.provider, 'local-safety-filter');
});
