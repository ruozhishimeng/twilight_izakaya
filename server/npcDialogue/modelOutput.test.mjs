import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findForbiddenMutationKey,
  validateActorOutput,
  validateDirectorOutput,
} from './modelOutput.mjs';

const compilation = {
  actorContext: {
    responseMode: 'guarded_refusal',
    allowedFacts: [{ id: 'surface_fact', text: '安全事实' }],
    hintableFacts: [{ id: 'hint_fact', hintText: '安全暗示' }],
  },
  decision: { topicIds: ['own_death'], responseMode: 'guarded_refusal' },
};

test('actor output cannot choose endChat or mutate state', () => {
  assert.equal(validateActorOutput({
    replyLines: ['「不说。」'], mood: 'guarded', addressedTopics: ['own_death'],
    responseMode: 'guarded_refusal', usedFactIds: [], endChat: true,
  }, compilation).ok, false);
});

test('actor output requires exact decision topics, mode, and safe fact ids', () => {
  assert.equal(validateActorOutput({
    replyLines: ['「不说。」'], mood: 'guarded', addressedTopics: ['unknown_topic'],
    responseMode: 'guarded_refusal', usedFactIds: [],
  }, compilation).code, 'unknown_topic');
  assert.equal(validateActorOutput({
    replyLines: ['「不说。」'], mood: 'guarded', addressedTopics: ['own_death'],
    responseMode: 'direct_answer', usedFactIds: [],
  }, compilation).code, 'response_mode_conflict');
  assert.equal(validateActorOutput({
    replyLines: ['「不说。」'], mood: 'guarded', addressedTopics: ['own_death'],
    responseMode: 'guarded_refusal', usedFactIds: ['sealed_fact'],
  }, compilation).code, 'non_whitelisted_fact');
});

test('director output recursively rejects state mutation keys', () => {
  const result = validateDirectorOutput({
    verdict: 'revise', violations: ['state_mutation'],
    finalReplyLines: ['「别问了。」'], mood: 'guarded',
    metadata: { gameStatePatch: { affection: 100 } },
  });
  assert.equal(result.ok, false);
});

test('strict actor and director objects normalize punctuation only after validation', () => {
  const actor = validateActorOutput({
    replyLines: ['「别问。'], mood: 'guarded', addressedTopics: ['own_death'],
    responseMode: 'guarded_refusal', usedFactIds: ['surface_fact'],
  }, compilation);
  assert.equal(actor.ok, true);
  assert.deepEqual(actor.value.replyLines, ['「别问。」']);
  const director = validateDirectorOutput({
    verdict: 'pass', violations: [], finalReplyLines: ['「别问。'], mood: 'guarded',
  });
  assert.equal(director.ok, true);
  assert.deepEqual(director.value.finalReplyLines, ['「别问。」']);
});

test('actor and director reject compound lines instead of expanding one supplied line', () => {
  const actor = validateActorOutput({
    replyLines: ['（低头）「这事别问。」'], mood: 'guarded', addressedTopics: ['own_death'],
    responseMode: 'guarded_refusal', usedFactIds: [],
  }, compilation);
  assert.equal(actor.ok, false);
  assert.equal(actor.code, 'invalid_reply_lines');

  const director = validateDirectorOutput({
    verdict: 'revise', violations: ['invalid_structure'],
    finalReplyLines: ['「这事别问。」「喝一杯吧。」'], mood: 'guarded',
  });
  assert.equal(director.ok, false);
});

test('actor accepts one dialogue unit containing nested title marks', () => {
  const actor = validateActorOutput({
    replyLines: ['「《黄昏》这本书不错。」'], mood: 'guarded', addressedTopics: ['own_death'],
    responseMode: 'guarded_refusal', usedFactIds: [],
  }, compilation);

  assert.equal(actor.ok, true);
  assert.deepEqual(actor.value.replyLines, ['「《黄昏》这本书不错。」']);
});

test('recursive mutation detection covers every protected gameplay collection', () => {
  const keys = [
    'relationshipChanges',
    'completedEvents',
    'selectedOptions',
    'unlocks',
    'rewards',
    'nextNode',
    'gameStatePatch',
  ];

  assert.deepEqual(
    keys.map(key => findForbiddenMutationKey({ envelope: { payload: { [key]: [] } } })),
    keys,
  );
});
