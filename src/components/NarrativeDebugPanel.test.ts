import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { CharacterNode, Guest } from '../data/content/types';
import { createInitialGameContext } from '../state/gameState';
import {
  applyNarrativeTransaction,
  createNarrativeTransaction,
} from '../state/narrativeEffects';
import { buildNarrativeDebugSnapshot } from './NarrativeDebugPanel';

const guest = {
  id: 'aqiang',
  name: '阿相',
} as Guest;

test('debug snapshot reports exact axes, resolved exit, counts, and latest transactions', () => {
  const context = createInitialGameContext();
  let effects = context.narrativeEffects;
  const transactions = [];

  for (let index = 0; index < 12; index += 1) {
    const transaction = createNarrativeTransaction({
      scope: 'game',
      source: {
        guestId: guest.id,
        eventId: `aqiang_event_${index}`,
        optionId: index % 2 === 1 ? `option_${index}` : undefined,
      },
      effects: [
        {
          id: `affection_${index}`,
          type: 'relationship.change',
          target: 'self',
          amount: 1,
        },
      ],
    });
    transactions.push(transaction);
    effects = applyNarrativeTransaction(effects, transaction).nextState;
  }

  context.narrativeEffects = {
    ...effects,
    relationships: {
      ...effects.relationships,
      [guest.id]: {
        values: {
          ...effects.relationships[guest.id]!.values,
          trust: 7,
        },
      },
    },
  };
  context.week = 1;
  context.day = 3;
  context.guestInDay = 2;

  const node: CharacterNode = {
    event_id: 'aqiang_003_drink_request',
    exit: {
      kind: 'mixing',
      request: { request_text: '调一杯能让人想起重要之人的酒' },
      outcomes: {
        success: 'aqiang_phase1_success',
        fail: 'aqiang_phase1_fail',
      },
    },
  };
  const snapshot = buildNarrativeDebugSnapshot({
    context,
    state: 'dayLoop.guest.story',
    guest,
    currentNode: node,
  });

  assert.equal(snapshot.week, 1);
  assert.equal(snapshot.day, 3);
  assert.equal(snapshot.guestInDay, 2);
  assert.equal(snapshot.state, 'dayLoop.guest.story');
  assert.deepEqual(snapshot.guest, { id: 'aqiang', name: '阿相' });
  assert.deepEqual(snapshot.node, { id: 'aqiang_003_drink_request' });
  assert.deepEqual(snapshot.exit, {
    kind: 'mixing',
    targets: ['aqiang_phase1_success', 'aqiang_phase1_fail'],
  });
  assert.deepEqual(snapshot.directive, {
    kind: 'mixing',
    targets: ['aqiang_phase1_success', 'aqiang_phase1_fail'],
  });
  assert.deepEqual(snapshot.relationship.axes, { affection: 12, trust: 7 });
  assert.deepEqual(snapshot.counts, {
    completedEvents: 6,
    selectedOptions: 6,
    appliedTransactions: 12,
  });
  assert.equal(snapshot.recentTransactions.length, 10);
  assert.equal(snapshot.recentTransactions[0]?.id, transactions[11]?.id);
  assert.equal(snapshot.recentTransactions[9]?.id, transactions[2]?.id);
  assert.deepEqual(snapshot.recentTransactions[0]?.changes[0], {
    type: 'relationship.change',
    effectId: 'affection_11',
    targetId: 'aqiang',
    axis: 'affection',
    requestedAmount: 1,
    before: 11,
    after: 12,
    appliedAmount: 1,
  });
});

test('debug snapshot safely represents a missing current node', () => {
  const snapshot = buildNarrativeDebugSnapshot({
    context: createInitialGameContext(),
    state: 'mainMenu',
    guest,
    currentNode: null,
  });

  assert.equal(snapshot.node, null);
  assert.equal(snapshot.exit, null);
  assert.equal(snapshot.directive, null);
  assert.deepEqual(snapshot.relationship.axes, { affection: 0 });
  assert.deepEqual(snapshot.counts, {
    completedEvents: 0,
    selectedOptions: 0,
    appliedTransactions: 0,
  });
  assert.deepEqual(snapshot.recentTransactions, []);
});

test('debug snapshot distinguishes a declared next exit from the tail-chat runtime directive', () => {
  const snapshot = buildNarrativeDebugSnapshot({
    context: createInitialGameContext(),
    state: 'dayLoop.guest.story',
    guest,
    currentNode: {
      event_id: 'tail_chat_source',
      llm_chat: { entry_mode: 'before_next_node' },
      script_flow: [{ type: 'npc', content: ['再聊一会儿。'] }],
      exit: { kind: 'next', target: 'after_tail_chat' },
    },
  });

  assert.deepEqual(snapshot.exit, {
    kind: 'next',
    targets: ['after_tail_chat'],
  });
  assert.deepEqual(snapshot.directive, {
    kind: 'tail_chat',
    targets: ['after_tail_chat'],
  });
});
