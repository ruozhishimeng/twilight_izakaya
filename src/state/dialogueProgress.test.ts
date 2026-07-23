import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Guest } from '../data/content/types';
import { buildDialogueProgressSnapshot } from './dialogueProgress';
import { createInitialGameSnapshot, reduceGameEvent } from './gameState';
import { createNarrativeTransaction } from './narrativeEffects';

test('snapshot contains only ids, numbers, and bounded dialogue text', () => {
  const guest = { id: 'aqiang', name: '阿相' } as Guest;
  let snapshot = createInitialGameSnapshot();
  snapshot = reduceGameEvent(snapshot, {
    type: 'APPLY_NARRATIVE_TRANSACTION',
    transaction: createNarrativeTransaction({
      scope: 'game',
      source: { guestId: 'aqiang', eventId: 'aqiang_phase1_success' },
      effects: [{ id: 'affection', type: 'relationship.change', target: 'self', amount: 6 }],
    }),
  });
  snapshot = reduceGameEvent(snapshot, {
    type: 'PATCH_CONTEXT',
    patch: {
      week: 2,
      day: 3,
      guestInDay: 1,
      characterObservations: { aqiang: ['obs_chest_package'] },
      unlockedStoryChapters: { aqiang: ['aqiang_story_01'] },
    },
  });
  snapshot = reduceGameEvent(snapshot, {
    type: 'PATCH_CURRENT_GUEST',
    patch: {
      nodeId: 'aqiang_001_dialogue_main',
      discoveredFeatures: ['obs_chest_package'],
      transcript: [
        { key: 'story:1', speaker: '旁白', text: '雨声压低了屋里的呼吸。' },
        { key: 'llm-chat:1:player', speaker: '我', text: '盒子是给谁的？' },
        { key: 'llm-chat:1:npc:0', speaker: guest.name, text: '「与你无关。」' },
      ],
      lastDrinkResult: { recipeId: 'R001', isSuccess: true, sourceNodeId: 'aqiang_003_drink_request' },
    },
  });
  const before = structuredClone(snapshot);

  const result = buildDialogueProgressSnapshot({ snapshot, guest, playerText: '盒子是给谁的？' });

  assert.equal(result.relationshipValues.affection, 6);
  assert.deepEqual(result.observedFeatureIds, ['obs_chest_package']);
  assert.deepEqual(result.unlockedChapterIds, ['aqiang_story_01']);
  assert.deepEqual(result.recentTranscript.map(entry => [entry.role, entry.source]), [
    ['narration', 'story'],
    ['player', 'tail_chat'],
    ['npc', 'tail_chat'],
  ]);
  assert.equal(result.lastDrink?.recipeId, 'R001');
  assert.equal(result.turnIndex, 1);
  assert.equal(JSON.stringify(result).includes('personality'), false);
  assert.equal(JSON.stringify(result).includes('short_story'), false);
  assert.deepEqual(snapshot, before);
});
