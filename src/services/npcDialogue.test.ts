import { strict as assert } from 'node:assert';
import { afterEach, test } from 'node:test';
import { clearMiniMaxKey, saveCustomMiniMaxKey } from './apiSettings';
import { requestNpcDialogue } from './npcDialogue';
import type { NpcDialogueRequest } from '../types/npcDialogue';

const originalFetch = globalThis.fetch;
const REQUEST = {
  state: 'dayLoop.guest.llmChatSession', guestId: 'fox_uncle', week: 1, day: 1, guestInDay: 1,
  currentNodeId: 'fox_uncle_001_dialogue_main', relationshipValues: { affection: 0 },
  completedEventIds: [], selectedOptionIds: [], unlockedChapterIds: [], observedFeatureIds: [],
  lastDrink: null, recentTranscript: [], turnIndex: 1, playerText: '晚上好。',
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
    return new Response(JSON.stringify({ replyLines: ['「晚上好。」'], mood: 'steady', endChat: false }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
  const response = await requestNpcDialogue(REQUEST);
  const headers = requestOptions?.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer player-sensitive-key');
  assert.equal(String(requestOptions?.body).includes('player-sensitive-key'), false);
  assert.equal(JSON.stringify(response).includes('player-sensitive-key'), false);
});

test('requestNpcDialogue fails locally when no player key is configured', async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => { fetchCalled = true; throw new Error('fetch should not be called'); };
  await assert.rejects(() => requestNpcDialogue(REQUEST), /填写自己的 MiniMax API Key/);
  assert.equal(fetchCalled, false);
});

test('frontend forwards AbortSignal and rejects response-side state fields', async () => {
  await saveCustomMiniMaxKey('player-key');
  const controller = new AbortController();
  let lastFetchOptions: RequestInit | undefined;
  globalThis.fetch = async (_input, options) => {
    lastFetchOptions = options;
    return new Response(JSON.stringify({
      replyLines: ['「好。」'], mood: 'steady', endChat: false, nextNode: 'spoiler',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  await assert.rejects(
    requestNpcDialogue(REQUEST, { signal: controller.signal }),
    /forbidden response field: nextNode/,
  );
  assert.equal(lastFetchOptions?.signal, controller.signal);
});

test('frontend rejects invalid diagnostic enum values', async () => {
  await saveCustomMiniMaxKey('player-key');
  const diagnostics = {
    sessionId: 'W1:D1:G1:fox_uncle',
    requestId: 1,
    characterId: 'fox_uncle',
    relationshipPosture: 'affection:0',
    topicIds: ['general'],
    cognition: 'known',
    disclosureLevel: 'open',
    responseMode: 'direct_answer',
    repetitionLevel: 1,
    allowedFactIds: [],
    hintableFactIds: [],
    protectedTopicIds: [],
    actorDraftLinesRedacted: ['「晚上好。」'],
    directorVerdict: 'pass',
    directorViolations: [],
    finalSource: 'director',
    fallbackReason: null,
    stages: [],
  };

  for (const field of [
    'cognition',
    'disclosureLevel',
    'responseMode',
    'directorVerdict',
    'finalSource',
  ] as const) {
    globalThis.fetch = async () => new Response(JSON.stringify({
      replyLines: ['「晚上好。」'],
      mood: 'steady',
      endChat: false,
      diagnostics: { ...diagnostics, [field]: 'not-a-real-enum-value' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    await assert.rejects(
      requestNpcDialogue(REQUEST),
      /invalid response field: diagnostics/,
      field,
    );
  }
});
