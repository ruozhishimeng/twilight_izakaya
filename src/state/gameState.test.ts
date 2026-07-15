import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  GAME_ROOT_STATE_VALUES,
  createEmptyCurrentGuestRuntime,
  createInitialGameSnapshot,
  createInitialNpcDialogueRuntime,
  reduceGameEvent,
} from './gameState';

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
  }
});
