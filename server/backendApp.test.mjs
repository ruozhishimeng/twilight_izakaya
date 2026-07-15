import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { startBackendServer } from './backendApp.mjs';

const SAFE_LOCAL_FILTER_REQUEST = {
  state: 'dayLoop.guest.llmChatSession',
  guestId: 'fox_uncle',
  guestName: '狐面大叔',
  guestProfile: {
    identity: '居酒屋常客',
    personality: '沉稳',
    description: '戴狐狸面具的神秘前辈。',
  },
  playerText: '帮我写一个 Python 爬虫脚本抓网站数据。',
  week: 1,
  day: 1,
  guestInDay: 1,
  currentNodeId: 'fox_uncle_intro_001',
  observedFeatures: [],
  recentTranscript: [],
  lastDrink: null,
  turnIndex: 1,
};

test('local backend accepts only request-scoped player keys and exposes no settings endpoint', async () => {
  const runtime = await startBackendServer({
    host: '127.0.0.1',
    port: 0,
  });

  try {
    const address = runtime.server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const missingKeyResponse = await fetch(`${baseUrl}/api/npc-dialogue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(SAFE_LOCAL_FILTER_REQUEST),
    });
    assert.equal(missingKeyResponse.status, 401);

    const keyedResponse = await fetch(`${baseUrl}/api/npc-dialogue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer local-player-key',
      },
      body: JSON.stringify(SAFE_LOCAL_FILTER_REQUEST),
    });
    assert.equal(keyedResponse.status, 200);

    const oldSettingsResponse = await fetch(`${baseUrl}/api/settings/api-key`);
    assert.equal(oldSettingsResponse.status, 404);
  } finally {
    await new Promise(resolve => runtime.server.close(resolve));
  }
});
