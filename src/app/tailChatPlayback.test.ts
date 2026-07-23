import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { advanceTailChatPlayback } from './tailChatPlayback';

test('policy end waits for the final NPC line then closes the session', () => {
  const last = advanceTailChatPlayback({
    stage: 'npc', playerText: '说吧', npcLines: ['第一句', '第二句'], npcIndex: 1,
    endChatAfterPlayback: true,
  });
  assert.deepEqual(last, { action: 'close_session' });
});

test('playback advances player then every NPC line before returning to input', () => {
  assert.deepEqual(advanceTailChatPlayback({
    stage: 'player', playerText: '说吧', npcLines: ['第一句', '第二句'], npcIndex: 0,
    endChatAfterPlayback: false,
  }), { action: 'show_npc', npcIndex: 0 });
  assert.deepEqual(advanceTailChatPlayback({
    stage: 'npc', playerText: '说吧', npcLines: ['第一句', '第二句'], npcIndex: 0,
    endChatAfterPlayback: false,
  }), { action: 'show_npc', npcIndex: 1 });
  assert.deepEqual(advanceTailChatPlayback({
    stage: 'npc', playerText: '说吧', npcLines: ['第一句', '第二句'], npcIndex: 1,
    endChatAfterPlayback: false,
  }), { action: 'input' });
});
