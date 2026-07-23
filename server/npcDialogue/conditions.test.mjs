import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesDialogueCondition, resolveFirstMatchingRule } from './conditions.mjs';

test('conditions support recursive state gates and authored rule order', () => {
  const snapshot = { relationshipValues: { affection: 6 }, completedEventIds: ['aqiang_005_dialogue_main'] };
  assert.equal(matchesDialogueCondition({ all: [
    { completed_event: 'aqiang_005_dialogue_main' },
    { relationship: { axis: 'affection', min: 5 } },
  ] }, snapshot), true);
});

test('first matching rule retains authored order', () => {
  const selected = resolveFirstMatchingRule([
    { when: { always: true }, value: 'first' },
    { when: { always: true }, value: 'second' },
  ], {});
  assert.equal(selected.value, 'first');
});
