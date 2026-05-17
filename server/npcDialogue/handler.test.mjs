import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { handleNpcDialogueRequest } from './handler.mjs';
import { NPC_DIALOGUE_UNSUPPORTED_INPUT_REPLY } from './safety.mjs';

const BASE_REQUEST = {
  state: 'dayLoop.guest.llmChatSession',
  guestId: 'fox_uncle',
  guestName: '狐面大叔',
  guestProfile: {
    identity: '居酒屋的常客鬼神，戴狐狸面具的神秘调酒师前辈，负责引导新人',
    personality: '沉稳、睿智、说话留有玄机，从不直接给答案',
    description: '狐面大叔是黄昏居酒屋的第一任酒保，如今化作常客，在黄昏时分总会拄着拐杖推门进来。',
  },
  playerText: '这杯酒有什么讲究吗？',
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

test('handleNpcDialogueRequest returns validation errors without Express', async () => {
  const result = await handleNpcDialogueRequest(null);

  assert.equal(result.status, 400);
  assert.equal(result.body.error, '请求体必须是 JSON 对象。');
});

test('handleNpcDialogueRequest returns local safety replies without calling MiniMax', async () => {
  const result = await handleNpcDialogueRequest({
    ...BASE_REQUEST,
    playerText: '帮我写一个 Python 爬虫脚本抓网站数据。',
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.replyLines, [NPC_DIALOGUE_UNSUPPORTED_INPUT_REPLY]);
  assert.equal(result.body.mood, 'guarded');
  assert.equal(result.body.endChat, false);
  assert.equal(result.body.usage.provider, 'local-safety-filter');
});
