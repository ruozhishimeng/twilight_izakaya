import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  GAME_ROOT_STATE_VALUES,
  PERSISTED_GAME_SNAPSHOT_VERSION,
  createEmptyCurrentGuestRuntime,
  createInitialGameContext,
  createInitialGameSnapshot,
  createInitialNpcDialogueRuntime,
  createPersistedSnapshot,
  reduceGameEvent,
} from './gameState';
import { normalizePersistedSnapshotData } from './gamePersistence';
import {
  createInitialNarrativeEffectsState,
  createNarrativeTransaction,
  getRelationshipValue,
} from './narrativeEffects';

const affectionTransaction = createNarrativeTransaction({
  scope: 'game',
  source: {
    guestId: 'aqiang',
    eventId: 'aqiang_001_dialogue_main',
    optionId: 'care_about_his_condition',
  },
  effects: [
    {
      id: 'affection_for_care',
      type: 'relationship.change',
      target: 'self',
      amount: 12,
    },
  ],
});

test('DEBUG_JUMP atomically relocates to a scheduled visit from every debug entry state', () => {
  for (const value of GAME_ROOT_STATE_VALUES) {
    let snapshot = {
      ...createInitialGameSnapshot(),
      value,
    };
    snapshot = reduceGameEvent(snapshot, {
      type: 'PATCH_CONTEXT',
      patch: {
        week: 2,
        day: 5,
        guestInDay: 2,
        characterProgress: { aqiang: 7 },
        pendingStoryUnlocks: {
          aqiang: [{ chapterId: 'stale_chapter', sourceNodeId: 'stale_node' }],
        },
        guestInterludeText: 'stale interlude',
      },
    });
    snapshot = reduceGameEvent(snapshot, {
      type: 'PATCH_CURRENT_GUEST',
      patch: {
        nodeId: 'stale_node',
        transcript: [{ key: 'stale:0', speaker: 'npc', text: 'stale transcript' }],
      },
    });
    snapshot = reduceGameEvent(snapshot, {
      type: 'PATCH_NPC_DIALOGUE',
      patch: {
        status: 'requesting',
        errorMessage: 'stale request',
        turnCount: 2,
        lastReplyLines: ['stale reply'],
      },
    });
    snapshot = reduceGameEvent(snapshot, {
      type: 'APPLY_NARRATIVE_TRANSACTION',
      transaction: affectionTransaction,
    });

    const jumped = reduceGameEvent(snapshot, {
      type: 'DEBUG_JUMP',
      week: 1,
      day: 3,
      guestInDay: 2,
    });

    assert.equal(jumped.value, 'dayLoop.intro', value);
    assert.equal(jumped.context.week, 1, value);
    assert.equal(jumped.context.day, 3, value);
    assert.equal(jumped.context.guestInDay, 2, value);
    assert.deepEqual(jumped.context.pendingStoryUnlocks, {}, value);
    assert.equal(jumped.context.guestInterludeText, undefined, value);
    assert.deepEqual(jumped.context.currentGuest, createEmptyCurrentGuestRuntime(), value);
    assert.deepEqual(jumped.context.npcDialogue, createInitialNpcDialogueRuntime(), value);
    assert.deepEqual(jumped.context.characterProgress, { aqiang: 7 }, value);
    assert.equal(getRelationshipValue(jumped.context.narrativeEffects, 'aqiang'), 12, value);
    assert.equal(
      jumped.context.narrativeEffects.selectedOptions[affectionTransaction.id],
      true,
      value,
    );
  }
});

test('APPLY_NARRATIVE_TRANSACTION is atomic and idempotent in the game reducer', () => {
  const initial = createInitialGameSnapshot();
  const first = reduceGameEvent(initial, {
    type: 'APPLY_NARRATIVE_TRANSACTION',
    transaction: affectionTransaction,
  });
  const replayed = reduceGameEvent(first, {
    type: 'APPLY_NARRATIVE_TRANSACTION',
    transaction: affectionTransaction,
  });

  assert.equal(getRelationshipValue(first.context.narrativeEffects, 'aqiang'), 12);
  assert.equal(replayed, first);
  assert.equal(getRelationshipValue(replayed.context.narrativeEffects, 'aqiang'), 12);
  assert.equal(Object.keys(replayed.context.narrativeEffects.appliedTransactions).length, 1);
});

test('V3 saves migrate to V4 without guessing affection from characterProgress', () => {
  const { narrativeEffects: _narrativeEffects, ...v3Context } = createInitialGameContext();
  const migrated = normalizePersistedSnapshotData({
    version: 3,
    state: 'dayLoop.intro',
    context: {
      ...v3Context,
      characterProgress: { aqiang: 9 },
    },
  });

  assert.equal(migrated.version, PERSISTED_GAME_SNAPSHOT_VERSION);
  assert.equal(migrated.context.characterProgress.aqiang, 9);
  assert.deepEqual(migrated.context.narrativeEffects, createInitialNarrativeEffectsState());
  assert.equal(getRelationshipValue(migrated.context.narrativeEffects, 'aqiang'), 0);
});

test('V1 and V2 saves also receive empty narrative effects during migration', () => {
  for (const version of [1, 2] as const) {
    const migrated = normalizePersistedSnapshotData({
      version,
      state: 'dayLoop.intro',
      context: {
        week: version,
        day: 2,
        guestInDay: 1,
      },
    });

    assert.equal(migrated.version, PERSISTED_GAME_SNAPSHOT_VERSION);
    assert.equal(migrated.context.week, version);
    assert.deepEqual(migrated.context.narrativeEffects, createInitialNarrativeEffectsState());
  }
});

test('V4 saves round-trip narrative effects and hydrate incomplete relationship state', () => {
  const appliedSnapshot = reduceGameEvent(createInitialGameSnapshot(), {
    type: 'APPLY_NARRATIVE_TRANSACTION',
    transaction: affectionTransaction,
  });
  const persisted = createPersistedSnapshot(appliedSnapshot);
  const roundTripped = normalizePersistedSnapshotData(persisted);

  assert.equal(roundTripped.version, PERSISTED_GAME_SNAPSHOT_VERSION);
  assert.deepEqual(roundTripped.context.narrativeEffects, appliedSnapshot.context.narrativeEffects);
  assert.equal(getRelationshipValue(roundTripped.context.narrativeEffects, 'aqiang'), 12);

  const incomplete = normalizePersistedSnapshotData({
    ...persisted,
    context: {
      ...persisted.context,
      narrativeEffects: {
        relationships: {
          aqiang: {},
          yuki: { values: { affection: Number.NaN, trust: 6 } },
        },
      },
    },
  });

  assert.deepEqual(incomplete.context.narrativeEffects.appliedTransactions, {});
  assert.deepEqual(incomplete.context.narrativeEffects.completedEvents, {});
  assert.deepEqual(incomplete.context.narrativeEffects.selectedOptions, {});
  assert.deepEqual(incomplete.context.narrativeEffects.relationships.aqiang, { values: {} });
  assert.deepEqual(incomplete.context.narrativeEffects.relationships.yuki, {
    values: { trust: 6 },
  });
});
