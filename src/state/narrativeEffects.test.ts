import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  applyNarrativeTransaction,
  buildNarrativeTransactionId,
  createInitialNarrativeEffectsState,
  createNarrativeTransaction,
  getRelationshipValue,
  type RelationshipAxisRegistry,
} from './narrativeEffects';

test('relationship transactions apply positive and negative affection changes', () => {
  const initial = createInitialNarrativeEffectsState();
  const positive = createNarrativeTransaction({
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
        amount: 15,
      },
    ],
  });
  const afterPositive = applyNarrativeTransaction(initial, positive);

  assert.equal(afterPositive.applied, true);
  assert.equal(getRelationshipValue(afterPositive.nextState, 'aqiang'), 15);
  assert.equal(afterPositive.receipt.changes[0]?.appliedAmount, 15);

  const negative = createNarrativeTransaction({
    scope: 'game',
    source: {
      guestId: 'aqiang',
      eventId: 'aqiang_002_dialogue_main',
      optionId: 'dismiss_his_worry',
    },
    effects: [
      {
        id: 'affection_for_dismissal',
        type: 'relationship.change',
        target: 'self',
        amount: -6,
      },
    ],
  });
  const afterNegative = applyNarrativeTransaction(afterPositive.nextState, negative);

  assert.equal(getRelationshipValue(afterNegative.nextState, 'aqiang'), 9);
  assert.equal(afterNegative.receipt.changes[0]?.appliedAmount, -6);
});

test('relationship axes are extensible and update independently', () => {
  const axes: RelationshipAxisRegistry = {
    affection: { initial: 0, min: -100, max: 100 },
    trust: { initial: 10, min: 0, max: 50 },
  };
  const transaction = createNarrativeTransaction({
    scope: 'game',
    source: {
      guestId: 'aqiang',
      eventId: 'aqiang_003_drink_request',
    },
    effects: [
      {
        id: 'affection_for_drink',
        type: 'relationship.change',
        target: 'self',
        axis: 'affection',
        amount: 4,
      },
      {
        id: 'trust_for_drink',
        type: 'relationship.change',
        target: 'self',
        axis: 'trust',
        amount: 7,
      },
    ],
  });

  const result = applyNarrativeTransaction(createInitialNarrativeEffectsState(), transaction, axes);

  assert.equal(getRelationshipValue(result.nextState, 'aqiang', 'affection', axes), 4);
  assert.equal(getRelationshipValue(result.nextState, 'aqiang', 'trust', axes), 17);
  assert.deepEqual(
    result.receipt.changes.map(change => [change.axis, change.before, change.after]),
    [
      ['affection', 0, 4],
      ['trust', 10, 17],
    ],
  );
});

test('applying the same transaction twice is idempotent', () => {
  const transaction = createNarrativeTransaction({
    scope: 'game',
    source: {
      guestId: 'yuki',
      eventId: 'yuki_001_dialogue_main',
      optionId: 'welcome_yuki',
    },
    effects: [
      {
        id: 'affection_for_welcome',
        type: 'relationship.change',
        target: 'self',
        amount: 8,
      },
    ],
  });
  const first = applyNarrativeTransaction(createInitialNarrativeEffectsState(), transaction);
  const second = applyNarrativeTransaction(first.nextState, transaction);

  assert.equal(first.applied, true);
  assert.equal(second.applied, false);
  assert.equal(second.nextState, first.nextState);
  assert.equal(second.receipt, first.receipt);
  assert.equal(getRelationshipValue(second.nextState, 'yuki'), 8);
  assert.equal(Object.keys(second.nextState.appliedTransactions).length, 1);
});

test('relationship changes clamp to the configured axis range', () => {
  const increase = createNarrativeTransaction({
    scope: 'game',
    source: { guestId: 'fox_uncle', eventId: 'fox_uncle_affection_max' },
    effects: [
      {
        id: 'large_positive_change',
        type: 'relationship.change',
        target: 'self',
        amount: 500,
      },
    ],
  });
  const afterIncrease = applyNarrativeTransaction(createInitialNarrativeEffectsState(), increase);

  assert.equal(getRelationshipValue(afterIncrease.nextState, 'fox_uncle'), 100);
  assert.equal(afterIncrease.receipt.changes[0]?.requestedAmount, 500);
  assert.equal(afterIncrease.receipt.changes[0]?.appliedAmount, 100);

  const decrease = createNarrativeTransaction({
    scope: 'game',
    source: { guestId: 'fox_uncle', eventId: 'fox_uncle_affection_min' },
    effects: [
      {
        id: 'large_negative_change',
        type: 'relationship.change',
        target: 'self',
        amount: -500,
      },
    ],
  });
  const afterDecrease = applyNarrativeTransaction(afterIncrease.nextState, decrease);

  assert.equal(getRelationshipValue(afterDecrease.nextState, 'fox_uncle'), -100);
  assert.equal(afterDecrease.receipt.changes[0]?.before, 100);
  assert.equal(afterDecrease.receipt.changes[0]?.appliedAmount, -200);
});

test('transaction ids separate game scope from individual visit scope', () => {
  const gameId = buildNarrativeTransactionId({
    scope: 'game',
    source: {
      guestId: 'aqiang',
      eventId: 'aqiang_001_dialogue_main',
      optionId: 'care',
    },
  });
  const firstVisitId = buildNarrativeTransactionId({
    scope: 'visit',
    source: {
      guestId: 'aqiang',
      eventId: 'aqiang_001_dialogue_main',
      optionId: 'care',
      visitId: 'W1:D3:G2:aqiang',
    },
  });
  const secondVisitId = buildNarrativeTransactionId({
    scope: 'visit',
    source: {
      guestId: 'aqiang',
      eventId: 'aqiang_001_dialogue_main',
      optionId: 'care',
      visitId: 'W2:D3:G1:aqiang',
    },
  });

  assert.equal(gameId, 'game/aqiang/aqiang_001_dialogue_main/option/care');
  assert.notEqual(firstVisitId, gameId);
  assert.notEqual(firstVisitId, secondVisitId);
  assert.throws(
    () =>
      buildNarrativeTransactionId({
        scope: 'visit',
        source: { guestId: 'aqiang', eventId: 'aqiang_001_dialogue_main' },
      }),
    /visitId/,
  );
});

test('effect-free transactions persist idempotent event and option facts', () => {
  const eventTransaction = createNarrativeTransaction({
    scope: 'game',
    source: {
      guestId: 'aqiang',
      eventId: 'aqiang_001_dialogue_main',
    },
    effects: [],
  });
  const optionTransaction = createNarrativeTransaction({
    scope: 'visit',
    source: {
      guestId: 'aqiang',
      eventId: 'aqiang_001_dialogue_main',
      optionId: 'care',
      visitId: 'W1:D3:G2:aqiang',
    },
    effects: [],
  });

  const afterEvent = applyNarrativeTransaction(
    createInitialNarrativeEffectsState(),
    eventTransaction,
  );
  const afterOption = applyNarrativeTransaction(afterEvent.nextState, optionTransaction);
  const replayedOption = applyNarrativeTransaction(afterOption.nextState, optionTransaction);

  assert.equal(afterEvent.nextState.completedEvents[eventTransaction.id], true);
  assert.equal(afterEvent.nextState.selectedOptions[eventTransaction.id], undefined);
  assert.equal(afterOption.nextState.selectedOptions[optionTransaction.id], true);
  assert.equal(afterOption.nextState.completedEvents[optionTransaction.id], undefined);
  assert.equal(afterEvent.receipt.changes.length, 0);
  assert.equal(afterOption.receipt.changes.length, 0);
  assert.equal(replayedOption.applied, false);
  assert.equal(replayedOption.nextState, afterOption.nextState);
});
