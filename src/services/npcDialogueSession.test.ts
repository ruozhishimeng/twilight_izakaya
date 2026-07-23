import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  NpcDialogueRequestCoordinator,
  canInteractWithTailChat,
} from './npcDialogueSession';

test('a new session lease aborts and invalidates the old lease', () => {
  const coordinator = new NpcDialogueRequestCoordinator();
  const first = coordinator.begin('visit-a');
  const second = coordinator.begin('visit-b');
  assert.equal(first.signal.aborted, true);
  assert.equal(coordinator.isCurrent(first), false);
  assert.equal(coordinator.isCurrent(second), true);
});

test('finish clears only the matching lease and cancel invalidates generations', () => {
  const coordinator = new NpcDialogueRequestCoordinator();
  const first = coordinator.begin('visit-a');
  coordinator.finish({ ...first, requestId: first.requestId + 1 });
  assert.equal(coordinator.isCurrent(first), true);
  coordinator.finish(first);
  assert.equal(coordinator.isCurrent(first), false);
  const second = coordinator.begin('visit-a');
  coordinator.cancel();
  assert.equal(second.signal.aborted, true);
  assert.equal(coordinator.isCurrent(second), false);
});

test('closed tail-chat sessions cannot start a request or remain UI-interactive', () => {
  assert.equal(canInteractWithTailChat({
    state: 'dayLoop.guest.llmChatSession',
    closed: true,
    status: 'idle',
  }), false);
});
