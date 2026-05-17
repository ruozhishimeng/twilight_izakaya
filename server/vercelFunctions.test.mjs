import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import npcDialogueHandler from '../api/npc-dialogue.mjs';
import { NPC_DIALOGUE_UNSUPPORTED_INPUT_REPLY } from './npcDialogue/safety.mjs';

const BASE_NPC_DIALOGUE_REQUEST = {
  state: 'dayLoop.guest.llmChatSession',
  guestId: 'fox_uncle',
  guestName: '狐面大叔',
  guestProfile: {
    identity: '居酒屋的常客鬼神，戴狐狸面具的神秘调酒师前辈，负责引导新人',
    personality: '沉稳、睿智、说话留有玄机，从不直接给答案',
    description: '狐面大叔是黄昏居酒屋的第一任酒保，如今化作常客，在黄昏时分总会拄着拐杖推门进来。',
  },
  playerText: '帮我写一个 Python 爬虫脚本抓网站数据。',
  week: 1,
  day: 1,
  guestInDay: 2,
  currentNodeId: 'fox_uncle_intro_001',
  observedFeatures: ['狐狸面具上有细微的裂纹'],
  recentTranscript: [
    { speaker: '狐面大叔', text: '「新来的。」他看了你一眼，「过来坐。」' },
  ],
  lastDrink: {
    label: '梅酒嗨棒',
    mixedDrinkName: '梅酒嗨棒',
    isSuccess: true,
    sourceNodeId: 'fox_uncle_mixing_001',
  },
  turnIndex: 2,
};

test('Vercel /api/npc-dialogue function returns NPC dialogue JSON', async () => {
  const response = await npcDialogueHandler.fetch(new Request('https://example.test/api/npc-dialogue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(BASE_NPC_DIALOGUE_REQUEST),
  }));

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.replyLines, [NPC_DIALOGUE_UNSUPPORTED_INPUT_REPLY]);
  assert.equal(body.usage.provider, 'local-safety-filter');
});

test('Vercel /api/settings/api-key function reports configured MiniMax env key', async () => {
  const originalKey = process.env.MINIMAX_API_KEY;
  const originalAuthorKey = process.env.TWILIGHT_AUTHOR_MINIMAX_API_KEY;
  process.env.MINIMAX_API_KEY = 'test-author-key';
  process.env.TWILIGHT_AUTHOR_MINIMAX_API_KEY = 'test-author-key';

  try {
    const { default: apiKeyHandler } = await import(`../api/settings/api-key.mjs?case=${Date.now()}`);
    const response = await apiKeyHandler.fetch(new Request('https://example.test/api/settings/api-key'));

    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.configured, true);
    assert.equal(body.source, 'author');
    assert.equal(JSON.stringify(body).includes('test-author-key'), false);
  } finally {
    if (originalKey === undefined) {
      delete process.env.MINIMAX_API_KEY;
    } else {
      process.env.MINIMAX_API_KEY = originalKey;
    }

    if (originalAuthorKey === undefined) {
      delete process.env.TWILIGHT_AUTHOR_MINIMAX_API_KEY;
    } else {
      process.env.TWILIGHT_AUTHOR_MINIMAX_API_KEY = originalAuthorKey;
    }
  }
});
