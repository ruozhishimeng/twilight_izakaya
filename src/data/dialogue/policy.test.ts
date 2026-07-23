import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDialogueSelectedOptionId,
  makeReferenceIndex,
  normalizeDialoguePolicy,
} from './policy';
import type { DialogueProgressSnapshot, DialogueTurnCompilation } from './types';

const makeTopic = (overrides: Record<string, unknown> = {}) => ({
  id: 'general', priority: 1, cues: ['你好'],
  cognition: { default: 'known' },
  disclosure: [{ when: { always: true }, level: 'open', response_mode: 'direct_answer' }],
  ...overrides,
});

const makePolicy = (overrides: Record<string, unknown> = {}) => ({
  version: 1, character_id: 'aqiang',
  public_identity: { role: '客人', appearance: '安全外观', personality: '沉默' },
  voice: { sentence_length: 'short', rhythm: '慢', initiative: 'low', action_frequency: 'rare', preferred: [], avoid: [], banned_phrases: [] },
  facts: [], protected_concepts: [], default_topic_id: 'general', topics: [makeTopic()],
  fallbacks: { default: { reply_lines: ['……'], mood: 'steady' } }, examples: [],
  conversation: { end_chat_modes: [] }, ...overrides,
});

test('hint rules require an independent safe hint_text', () => {
  const fixture = makePolicy({
    facts: [{ id: 'secret', text: '完整秘密', tags: ['secret'] }],
    topics: [makeTopic({ disclosure: [{ when: { always: true }, level: 'hint', response_mode: 'emotional_hint', hint_fact_ids: ['secret'] }] })],
  });
  assert.throws(() => normalizeDialoguePolicy(fixture, makeReferenceIndex()), /hint_text/);
});

test('a topic has exactly one trailing always rule', () => {
  const fixture = makePolicy({ topics: [makeTopic({ disclosure: [
    { when: { always: true }, level: 'guarded', response_mode: 'guarded_refusal' },
    { when: { completed_event: 'aqiang_008_dialogue_main' }, level: 'partial', response_mode: 'partial_answer' },
  ] })] });
  assert.throws(() => normalizeDialoguePolicy(fixture, makeReferenceIndex({ completedEventIds: ['aqiang_008_dialogue_main'] })), /always.*last/);
});

test('selected_option uses a stable compound author id', () => {
  assert.equal(buildDialogueSelectedOptionId('aqiang', 'aqiang_001_dialogue_main', 'care_about_his_condition'), 'aqiang/aqiang_001_dialogue_main/care_about_his_condition');
});

test('policy rejects examples that repeat protected lexemes or sealed fact text', () => {
  const fixture = makePolicy({
    facts: [{ id: 'secret', text: '真正的秘密', tags: ['secret'] }],
    protected_concepts: [{ id: 'identity', capsule: '不要确认身份', lexemes: ['旧日身份'] }],
    topics: [makeTopic({ disclosure: [{ when: { always: true }, level: 'sealed', response_mode: 'guarded_refusal', fact_ids: ['secret'], protected_concept_ids: ['identity'] }] })],
    examples: [{ id: 'leak', topic_id: 'general', response_mode: 'guarded_refusal', mood: 'guarded', kind: 'positive', player_text: '旧日身份是什么？', reply_lines: ['真正的秘密'] }],
  });
  assert.throws(() => normalizeDialoguePolicy(fixture, makeReferenceIndex()), /examples.*protected/i);
});

test('hint fact full text is protected while its distinct hint_text remains usable in examples', () => {
  const base = {
    facts: [{ id: 'hint-fact', text: '完整提示事实', hint_text: '安全暗示', tags: [] }],
    topics: [makeTopic({ disclosure: [{ when: { always: true }, level: 'hint', response_mode: 'emotional_hint', hint_fact_ids: ['hint-fact'] }] })],
  };
  for (const example of [
    { player_text: '完整提示事实', reply_lines: ['保持克制'] },
    { player_text: '请告诉我', reply_lines: ['完整提示事实'] },
  ]) {
    assert.throws(() => normalizeDialoguePolicy(makePolicy({ ...base, examples: [{ id: 'unsafe', topic_id: 'general', response_mode: 'emotional_hint', mood: 'cryptic', kind: 'positive', ...example }] }), makeReferenceIndex()), /examples.*protected/i);
  }
  const normalized = normalizeDialoguePolicy(makePolicy({ ...base, examples: [{ id: 'safe', topic_id: 'general', response_mode: 'emotional_hint', mood: 'cryptic', kind: 'positive', player_text: '安全暗示', reply_lines: ['保持克制'] }] }), makeReferenceIndex());
  assert.equal(normalized.examples[0].player_text, '安全暗示');
});

test('condition references reject unknown IDs even when their valid domain is empty', () => {
  const cases = [
    { completed_event: 'missing-event' }, { selected_option: 'missing-option' },
    { unlocked_chapter: 'missing-chapter' }, { current_node: 'missing-node' },
    { observed_feature: 'missing-feature' },
  ];
  cases.forEach(when => {
    const fixture = makePolicy({ topics: [makeTopic({ disclosure: [
      { when, level: 'partial', response_mode: 'partial_answer' },
      { when: { always: true }, level: 'guarded', response_mode: 'guarded_refusal' },
    ] })] });
    assert.throws(() => normalizeDialoguePolicy(fixture, makeReferenceIndex()), /unknown/);
  });
});

test('normalization preserves authored non-ID sequence order', () => {
  const fixture = makePolicy({
    voice: { sentence_length: 'short', rhythm: '慢', initiative: 'low', action_frequency: 'rare', preferred: ['第二', '第一'], avoid: ['乙', '甲'], banned_phrases: ['后', '前'] },
    facts: [{ id: 'safe', text: '安全事实', tags: ['第二标签', '第一标签'] }],
    protected_concepts: [{ id: 'concept', capsule: '安全胶囊', lexemes: ['第二词', '第一词'] }],
    topics: [makeTopic({ cues: ['第二提示', '第一提示'] })],
    fallbacks: { default: { reply_lines: ['第二句', '第一句'], mood: 'steady' } },
    examples: [{ id: 'safe-example', topic_id: 'general', response_mode: 'direct_answer', mood: 'steady', kind: 'positive', player_text: '你好', reply_lines: ['第二答复', '第一答复'] }],
    conversation: { end_chat_modes: ['silence_or_exit', 'explicit_boundary'] },
  });
  const normalized = normalizeDialoguePolicy(fixture, makeReferenceIndex());
  assert.deepEqual(normalized.voice.preferred, ['第二', '第一']);
  assert.deepEqual(normalized.topics[0].cues, ['第二提示', '第一提示']);
  assert.deepEqual(normalized.protected_concepts[0].lexemes, ['第二词', '第一词']);
  assert.deepEqual(normalized.fallbacks.default.reply_lines, ['第二句', '第一句']);
  assert.deepEqual(normalized.examples[0].reply_lines, ['第二答复', '第一答复']);
  assert.deepEqual(normalized.conversation.end_chat_modes, ['silence_or_exit', 'explicit_boundary']);
});

test('public progress and turn-compilation contracts are available to TypeScript callers', () => {
  const snapshot: DialogueProgressSnapshot = {
    playerText: '你好', relationshipValues: { affection: 0 }, completedEventIds: [], selectedOptionIds: [], unlockedChapterIds: [], currentNodeId: null, observedFeatureIds: [], lastDrinkSuccess: null, recentTranscript: [],
  };
  const compilation: DialogueTurnCompilation | undefined = undefined;
  assert.equal(snapshot.currentNodeId, null);
  assert.equal(compilation, undefined);
});
