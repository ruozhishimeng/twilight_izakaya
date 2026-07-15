import { strict as assert } from 'node:assert';
import { afterEach, test } from 'node:test';
import { clearMiniMaxKey, saveCustomMiniMaxKey } from './apiSettings';
import { requestNpcDialogue } from './npcDialogue';
import type { NpcDialogueRequest } from '../types/npcDialogue';

const originalFetch = globalThis.fetch;
const REQUEST = {
  state: 'dayLoop.guest.llmChatSession',
  guestId: 'fox_uncle',
  guestName: '狐面大叔',
  guestProfile: {
    identity: '居酒屋常客',
    personality: '沉稳',
    description: '戴狐狸面具的前辈。',
  },
  playerText: '晚上好。',
  week: 1,
  day: 1,
  guestInDay: 1,
  currentNodeId: 'fox_uncle_001',
  observedFeatures: [],
  recentTranscript: [],
  lastDrink: null,
  turnIndex: 1,
} satisfies NpcDialogueRequest;

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await clearMiniMaxKey();
});

test('requestNpcDialogue sends the player key only in Authorization', async () => {
  await saveCustomMiniMaxKey('player-sensitive-key');
  let requestOptions: RequestInit | undefined;
  globalThis.fetch = async (_input, options) => {
    requestOptions = options;
    return new Response(JSON.stringify({
      replyLines: ['「晚上好。」'],
      mood: 'steady',
      endChat: false,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const response = await requestNpcDialogue(REQUEST);
  const headers = requestOptions?.headers as Record<string, string>;

  assert.equal(headers.Authorization, 'Bearer player-sensitive-key');
  assert.equal(String(requestOptions?.body).includes('player-sensitive-key'), false);
  assert.equal(JSON.stringify(response).includes('player-sensitive-key'), false);
});

test('requestNpcDialogue fails locally when no player key is configured', async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error('fetch should not be called');
  };

  await assert.rejects(() => requestNpcDialogue(REQUEST), /填写自己的 MiniMax API Key/);
  assert.equal(fetchCalled, false);
});
