import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyModelOutputEnvelope,
  isCompoundReplyLine,
  normalizeReplyLines,
  parseModelOutput,
  validateNpcDialogueResponse,
} from './responseParser.mjs';

test('model output envelope classification reports wrappers without exposing content', () => {
  assert.equal(classifyModelOutputEnvelope('```json\n{"replyLines":["「别问。」"]}\n```'), 'markdown_fence');
  assert.equal(classifyModelOutputEnvelope('说明：{"replyLines":["「别问。」"]}'), 'wrapped_object');
  assert.equal(classifyModelOutputEnvelope('{"replyLines":["「别问。」"]'), 'truncated_object');
  assert.equal(classifyModelOutputEnvelope('{"replyLines":["「别问。」"],}'), 'object_syntax');
  assert.equal(classifyModelOutputEnvelope('「别问。」'), 'plain_text');
});

test('strict parser unwraps one complete Markdown JSON fence', () => {
  const parsed = parseModelOutput('```json\n{"replyLines":["「别问。」"]}\n```');
  assert.deepEqual(parsed, {
    ok: true,
    value: { replyLines: ['「别问。」'] },
  });
});

test('strict parser returns local structured errors without plain-text or malformed recovery', () => {
  assert.deepEqual(parseModelOutput('「别问。」'), {
    ok: false,
    code: 'invalid_json',
    error: '模型返回格式无效。',
  });
  assert.equal(parseModelOutput('{"replyLines":["「别问。」"]').ok, false);
  assert.equal(parseModelOutput('说明：\n```json\n{"replyLines":["「别问。」"]}\n```').ok, false);
});

test('reply normalization preserves punctuation repair after strict structure passes', () => {
  assert.deepEqual(normalizeReplyLines(['「，每年都是他帮我过生日。', '》《謝謝。']), [
    '「每年都是他帮我过生日。」',
    '「谢谢。」',
  ]);
  assert.deepEqual(normalizeReplyLines(['「没关系。」「能喝就行。」']), [
    '「没关系。」「能喝就行。」',
  ]);
});

test('one supplied reply line is never expanded into action and speech segments', () => {
  assert.deepEqual(normalizeReplyLines(['（低头）「这事别问。」']), [
    '（低头）「这事别问。」',
  ]);
});

test('compound detection counts only top-level reply units', () => {
  const compounds = [
    '（低头）「这事别问。」',
    '「这事别问。」（低头）',
    '「这事别问。」「喝一杯吧。」',
    '（低头）（叹气）',
    '（低头）这事别问。',
    '「这事别问。」然后转身离开',
  ];
  assert.deepEqual(compounds.map(isCompoundReplyLine), compounds.map(() => true));

  assert.equal(isCompoundReplyLine('「《黄昏》这本书不错。」'), false);
  assert.equal(isCompoundReplyLine('「他说：“这事别问。”」'), false);
  assert.equal(isCompoundReplyLine('（低头）'), false);
  assert.equal(isCompoundReplyLine('这事别问。'), false);
});

test('legacy one-stage response validation rejects alternate keys and coercions', () => {
  assert.equal(validateNpcDialogueResponse({
    replyLines: [], reply: '「别急。」', mood: 'steady', endChat: false,
  }).ok, false);
  assert.equal(validateNpcDialogueResponse({
    replyLines: '「别急。」', mood: 'steady', endChat: false,
  }).ok, false);
  assert.equal(validateNpcDialogueResponse({
    replyLines: ['「别急。」'], mood: 'steady', endChat: false, nextNode: 'secret',
  }).ok, false);
  assert.equal(validateNpcDialogueResponse({
    replyLines: ['「别急。」「喝一杯吧。」'], mood: 'steady', endChat: false,
  }).ok, false);
  assert.equal(validateNpcDialogueResponse({
    replyLines: ['「《黄昏》这本书不错。」'], mood: 'steady', endChat: false,
  }).ok, true);
});
