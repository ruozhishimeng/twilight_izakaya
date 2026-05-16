import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseModelOutput, validateNpcDialogueResponse } from './responseParser.mjs';

test('validateNpcDialogueResponse splits adjacent quoted speeches into separate reply lines', () => {
  const parsed = parseModelOutput(JSON.stringify({
    replyLines: ['「没关系。」「能喝就行。」'],
    mood: 'steady',
    endChat: false,
  }));
  const validation = validateNpcDialogueResponse(parsed);

  assert.equal(validation.ok, true);
  assert.deepEqual(validation.value.replyLines, [
    '「没关系。」',
    '「能喝就行。」',
  ]);
});

test('validateNpcDialogueResponse removes orphan punctuation after an opening quote', () => {
  const parsed = parseModelOutput(JSON.stringify({
    replyLines: ['「，每年都是他帮我过生日。」'],
    mood: 'guarded',
    endChat: false,
  }));
  const validation = validateNpcDialogueResponse(parsed);

  assert.equal(validation.ok, true);
  assert.deepEqual(validation.value.replyLines, [
    '「每年都是他帮我过生日。」',
  ]);
});

test('validateNpcDialogueResponse normalizes common traditional characters and stray closing quotes', () => {
  const parsed = parseModelOutput(JSON.stringify({
    replyLines: ['」「你心里想的是什麼？」', '《謝謝。'],
    mood: 'warm',
    endChat: false,
  }));
  const validation = validateNpcDialogueResponse(parsed);

  assert.equal(validation.ok, true);
  assert.deepEqual(validation.value.replyLines, [
    '「你心里想的是什么？」',
    '「谢谢。」',
  ]);
});

test('parseModelOutput recovers malformed JSON when reply lines and mood are still readable', () => {
  const parsed = parseModelOutput(
    '{"replyLines":["（他抬起眼看了看你愣了一下）","「......还好。」","「就是有点冷。」”（他顿了顿，又补充道）《謝謝。","mood":"warm","endChat":false}',
  );
  const validation = validateNpcDialogueResponse(parsed);

  assert.equal(validation.ok, true);
  assert.equal(validation.value.mood, 'warm');
  assert.equal(validation.value.endChat, false);
  assert.deepEqual(validation.value.replyLines, [
    '（他抬起眼看了看你愣了一下）',
    '「......还好。」',
    '「就是有点冷。」',
    '（他顿了顿，又补充道）',
    '「谢谢。」',
  ]);
});

test('validateNpcDialogueResponse keeps the first five normalized lines when the model over-answers', () => {
  const parsed = parseModelOutput(JSON.stringify({
    replyLines: [
      '（她攥紧杯子）',
      '「他会回来的。」',
      '（声音低下去）',
      '「我只是还没等到。」',
      '「我想说谢谢。」',
      '「还有对不起。」',
    ],
    mood: 'guarded',
    endChat: false,
  }));
  const validation = validateNpcDialogueResponse(parsed);

  assert.equal(validation.ok, true);
  assert.deepEqual(validation.value.replyLines, [
    '（她攥紧杯子）',
    '「他会回来的。」',
    '（声音低下去）',
    '「我只是还没等到。」',
    '「我想说谢谢。」',
  ]);
});

test('validateNpcDialogueResponse accepts a single string replyLines value', () => {
  const parsed = parseModelOutput(JSON.stringify({
    replyLines: '「今晚的酒，慢慢喝就好。」',
    mood: 'warm',
    endChat: false,
  }));
  const validation = validateNpcDialogueResponse(parsed);

  assert.equal(validation.ok, true);
  assert.deepEqual(validation.value.replyLines, [
    '「今晚的酒，慢慢喝就好。」',
  ]);
});

test('validateNpcDialogueResponse recovers common alternate reply text fields', () => {
  const parsed = parseModelOutput(JSON.stringify({
    replyLines: [],
    reply: '「别急。」',
    mood: 'steady',
    endChat: false,
  }));
  const validation = validateNpcDialogueResponse(parsed);

  assert.equal(validation.ok, true);
  assert.deepEqual(validation.value.replyLines, [
    '「别急。」',
  ]);
});
