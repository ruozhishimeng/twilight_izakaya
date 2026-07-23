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
  hydrateLoadedGameSnapshot,
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

test('batch transcript append uses the latest reducer state once', () => {
  const snapshot = reduceGameEvent(createInitialGameSnapshot(), {
    type: 'PATCH_CURRENT_GUEST',
    patch: { transcript: [{ key: 'story:0', speaker: '旁白', text: '开场' }] },
  });
  const playerLine = { key: 'llm-chat:1:player', speaker: '我', text: '说吧' };
  const npcLineOne = { key: 'llm-chat:1:npc:0', speaker: '客人', text: '第一句' };
  const npcLineTwo = { key: 'llm-chat:1:npc:1', speaker: '客人', text: '第二句' };
  const next = reduceGameEvent(snapshot, {
    type: 'APPEND_CURRENT_GUEST_TRANSCRIPT',
    entries: [playerLine, npcLineOne, npcLineTwo],
  });
  assert.deepEqual(next.context.currentGuest.transcript.slice(-3), [playerLine, npcLineOne, npcLineTwo]);
  assert.equal(snapshot.context.currentGuest.transcript.length, 1);
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

test('V4 saves migrate to V5 tail-chat resume and clear transient request state without gameplay loss', () => {
  const base = createInitialGameContext();
  const narrativeEffects = {
    ...base.narrativeEffects,
    completedEvents: { aqiang_phase1_success: true as const },
  };
  const {
    resume: _resume,
    closed: _closed,
    ...v4TailChat
  } = base.currentGuest.tailChat;
  const migrated = normalizePersistedSnapshotData({
    version: 4,
    state: 'dayLoop.guest.llmChatLobby',
    context: {
      ...base,
      week: 3,
      day: 4,
      guestInDay: 2,
      narrativeEffects,
      unlockedStoryChapters: { aqiang: ['aqiang_story_01'] },
      currentGuest: {
        ...base.currentGuest,
        transcript: [{ key: 'story:0', speaker: '阿相', text: '「……」' }],
        tailChat: {
          ...v4TailChat,
          resumeNodeId: 'aqiang_002_dialogue_main',
        },
      },
      npcDialogue: {
        ...base.npcDialogue,
        status: 'requesting',
        errorMessage: 'transient',
      },
    },
  });
  assert.equal(migrated.version, 5);
  assert.equal(migrated.context.week, 3);
  assert.equal(migrated.context.day, 4);
  assert.equal(migrated.context.guestInDay, 2);
  assert.deepEqual(migrated.context.narrativeEffects, narrativeEffects);
  assert.deepEqual(migrated.context.unlockedStoryChapters, { aqiang: ['aqiang_story_01'] });
  assert.deepEqual(migrated.context.currentGuest.transcript, [{ key: 'story:0', speaker: '阿相', text: '「……」' }]);
  assert.deepEqual(migrated.context.currentGuest.tailChat.resume, {
    kind: 'node', nodeId: 'aqiang_002_dialogue_main',
  });
  assert.equal(migrated.context.currentGuest.tailChat.closed, false);
  assert.equal(migrated.context.npcDialogue.status, 'idle');
  assert.equal(migrated.context.npcDialogue.errorMessage, null);
});

test('a save captured after endChat commit hydrates outside the closed interactive session', () => {
  const initial = createInitialGameSnapshot();
  const committed = {
    ...initial,
    value: 'dayLoop.guest.llmChatSession' as const,
    context: {
      ...initial.context,
      currentGuest: {
        ...initial.context.currentGuest,
        tailChat: {
          ...initial.context.currentGuest.tailChat,
          turnsUsed: 1,
          closed: true,
        },
      },
    },
  };
  const persistedDuringPlayback = createPersistedSnapshot(committed);
  const loaded = hydrateLoadedGameSnapshot(
    normalizePersistedSnapshotData(persistedDuringPlayback),
  );

  assert.equal(loaded.context.currentGuest.tailChat.closed, true);
  assert.equal(loaded.value, 'dayLoop.guest.llmChatLobby');
});

test('V4 and V5 hydration and re-persistence drop undeclared dialogue diagnostics', () => {
  for (const version of [4, 5] as const) {
    const base = createInitialGameContext();
    const normalized = normalizePersistedSnapshotData({
      version,
      state: 'dayLoop.guest.llmChatLobby',
      context: {
        ...base,
        dialogueDiagnostics: { leaked: 'top-level' },
        npcDialogue: {
          ...base.npcDialogue,
          diagnostics: { leaked: 'nested' },
        },
      },
    });

    assert.equal('dialogueDiagnostics' in normalized.context, false, `V${version}`);
    assert.equal('diagnostics' in normalized.context.npcDialogue, false, `V${version}`);

    const persistedAgain = createPersistedSnapshot({
      value: normalized.state,
      context: normalized.context,
    });
    assert.equal('dialogueDiagnostics' in persistedAgain.context, false, `V${version}`);
    assert.equal('diagnostics' in persistedAgain.context.npcDialogue, false, `V${version}`);
  }
});
