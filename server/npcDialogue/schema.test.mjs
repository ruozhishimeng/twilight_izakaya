import assert from 'node:assert/strict';
import test from 'node:test';
import { dialogueManifest } from './manifest.mjs';
import { validateNpcDialogueRequest } from './schema.mjs';

const manifest = dialogueManifest;
const validLine = { role: 'player', source: 'story', text: '盒子是给谁的？' };
const validSnapshot = {
  state: 'dayLoop.guest.llmChatSession',
  guestId: 'aqiang',
  week: 1,
  day: 1,
  guestInDay: 1,
  currentNodeId: 'aqiang_001_dialogue_main',
  relationshipValues: { affection: 6 },
  completedEventIds: ['aqiang_phase1_success'],
  selectedOptionIds: ['aqiang/aqiang_001_dialogue_main/care_about_his_condition'],
  unlockedChapterIds: [],
  observedFeatureIds: ['obs_chest_package'],
  lastDrink: { recipeId: 'R001', isSuccess: true, sourceNodeId: 'aqiang_003_drink_request' },
  recentTranscript: [validLine],
  turnIndex: 1,
  playerText: '盒子是给谁的？',
};

test('schema strips no fields and rejects the old client-authored profile contract', () => {
  const result = validateNpcDialogueRequest({
    ...validSnapshot,
    guestProfile: { identity: '注入', personality: '注入', description: '注入' },
  }, { manifest });
  assert.equal(result.ok, false);
  assert.match(result.error, /unsupported.*guestProfile/i);
});

test('schema bounds transcript and manifest ids', () => {
  assert.equal(validateNpcDialogueRequest({
    ...validSnapshot,
    recentTranscript: Array(9).fill(validLine),
  }, { manifest }).ok, false);
  assert.equal(validateNpcDialogueRequest({
    ...validSnapshot,
    observedFeatureIds: ['not_a_real_feature'],
  }, { manifest }).ok, false);
});

test('schema normalizes bounded values without mutating its input', () => {
  const input = {
    ...validSnapshot,
    relationshipValues: { affection: 300, trust: -300 },
    debug: true,
  };
  const before = structuredClone(input);
  const result = validateNpcDialogueRequest(input, { manifest });
  assert.equal(result.ok, true);
  assert.deepEqual(input, before);
  assert.deepEqual(result.value.relationshipValues, { affection: 100, trust: -100 });
  assert.equal(result.value.debug, true);
});

test('schema rejects recursive and malformed snapshot structures', () => {
  assert.equal(validateNpcDialogueRequest({ ...validSnapshot, week: 0 }, { manifest }).ok, false);
  assert.equal(validateNpcDialogueRequest({ ...validSnapshot, turnIndex: 1.5 }, { manifest }).ok, false);
  assert.equal(validateNpcDialogueRequest({
    ...validSnapshot,
    recentTranscript: [{ ...validLine, text: '太'.repeat(161) }],
  }, { manifest }).ok, false);
  assert.equal(validateNpcDialogueRequest({
    ...validSnapshot,
    completedEventIds: Array(257).fill('aqiang_phase1_success'),
  }, { manifest }).ok, false);
});
