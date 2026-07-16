import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  compileNodeCompletionNarrativeTransaction,
  compileOptionNarrativeTransaction,
} from './effects';

test('option effects compile to a game-scoped transaction by default', () => {
  const transaction = compileOptionNarrativeTransaction({
    guestId: 'aqiang',
    eventId: 'aqiang_001_dialogue_main',
    option: {
      id: 'ask_about_sister',
      text: '是要送给谁吗？',
      effects: [
        {
          id: 'care_about_family',
          type: 'relationship.change',
          target: 'self',
          amount: 2,
          feedback: '阿相感受到了你的关心',
        },
      ],
    },
  });

  assert.equal(transaction.id, 'game/aqiang/aqiang_001_dialogue_main/option/ask_about_sister');
  assert.equal(transaction.scope, 'game');
  assert.deepEqual(transaction.source, {
    guestId: 'aqiang',
    eventId: 'aqiang_001_dialogue_main',
    optionId: 'ask_about_sister',
  });
  assert.deepEqual(transaction.effects, [
    {
      id: 'care_about_family',
      type: 'relationship.change',
      target: 'self',
      amount: 2,
    },
  ]);
});

test('an option transaction may intentionally contain no effects but still requires a stable id', () => {
  const transaction = compileOptionNarrativeTransaction({
    guestId: 'aqiang',
    eventId: 'aqiang_001_dialogue_main',
    option: {
      id: 'quietly_listen',
      text: '沉默地听他说',
    },
  });

  assert.deepEqual(transaction.effects, []);
  assert.throws(
    () => compileOptionNarrativeTransaction({
      guestId: 'aqiang',
      eventId: 'aqiang_001_dialogue_main',
      option: { text: '没有稳定 ID 的选项' },
    }),
    /option\.id must be a non-empty string/,
  );
});

test('visit-scoped option effects require visitId and include it in transaction identity', () => {
  const option = {
    id: 'visit_only_response',
    text: '本次来访限定回应',
    effect_scope: 'visit' as const,
    effects: [],
  };

  assert.throws(
    () => compileOptionNarrativeTransaction({
      guestId: 'aqiang',
      eventId: 'aqiang_visit_event',
      option,
    }),
    /visitId for visit scope must be a non-empty string/,
  );

  const transaction = compileOptionNarrativeTransaction({
    guestId: 'aqiang',
    eventId: 'aqiang_visit_event',
    option,
    visitId: 'W1_D3_G2',
  });

  assert.equal(
    transaction.id,
    'visit/W1_D3_G2/aqiang/aqiang_visit_event/option/visit_only_response',
  );
  assert.equal(transaction.scope, 'visit');
});

test('node completion compiles even without effects and supports visit scope', () => {
  const recordedFact = compileNodeCompletionNarrativeTransaction({
    guestId: 'aqiang',
    eventId: 'aqiang_phase1_success',
    node: { event_id: 'aqiang_phase1_success' },
  });
  assert.equal(recordedFact.id, 'game/aqiang/aqiang_phase1_success');
  assert.deepEqual(recordedFact.effects, []);

  const visitTransaction = compileNodeCompletionNarrativeTransaction({
    guestId: 'aqiang',
    eventId: 'aqiang_phase1_success',
    visitId: 'W1_D3_G2',
    node: {
      event_id: 'aqiang_phase1_success',
      on_complete: {
        effect_scope: 'visit',
        effects: [
          {
            id: 'successful_service',
            type: 'relationship.change',
            target: 'self',
            axis: 'affection',
            amount: 3,
          },
        ],
      },
    },
  });

  assert.equal(visitTransaction.id, 'visit/W1_D3_G2/aqiang/aqiang_phase1_success');
  assert.equal(visitTransaction.scope, 'visit');
  assert.equal(visitTransaction.effects.length, 1);
});
