import assert from 'node:assert/strict';
import test from 'node:test';
import { compileDialogueTurnContext } from './contextCompiler.mjs';

const character = {
  characterId: 'aqiang', name: '阿相', guestType: 'Lost Soul', publicIdentity: { role: '客人', appearance: '雨衣', personality: '沉默' },
  validIds: { nodeIds: [], observedFeatureIds: [], recipeIds: [] }, nodeScenes: {},
  policy: { version: 1, character_id: 'aqiang', public_identity: { role: '客人', appearance: '雨衣', personality: '沉默' }, voice: { sentence_length: 'short', rhythm: '慢', initiative: 'low', action_frequency: 'rare', preferred: [], avoid: [], banned_phrases: [] }, facts: [{ id: 'secret', text: '玩家就是千年前那个孩子', hint_text: '旧事未明', tags: [] }], protected_concepts: [{ id: 'past', capsule: '不要确认玩家与旧日孩子的关系', lexemes: ['千年前那个孩子'] }], default_topic_id: 'surface', topics: [{ id: 'surface', priority: 5, cues: ['面具'], cognition: { default: 'known' }, disclosure: [{ when: { always: true }, level: 'open', response_mode: 'direct_answer' }] }, { id: 'secret_topic', priority: 1, cues: ['面具'], cognition: { default: 'suppressed' }, disclosure: [{ when: { always: true }, level: 'sealed', response_mode: 'guarded_refusal', protected_concept_ids: ['past'] }] }], fallbacks: { default: { reply_lines: ['……'], mood: 'steady' } }, examples: [], conversation: { end_chat_modes: [] } },
};

test('sealed truth is physically absent from actor context', () => {
  const compiled = compileDialogueTurnContext(character, { playerText: '面具', recentTranscript: [] }, { inputKind: 'in_world' });
  assert.doesNotMatch(JSON.stringify(compiled.actorContext), /千年前那个孩子/);
  assert.match(JSON.stringify(compiled.directorContext), /不要确认玩家与旧日孩子的关系/);
  assert.deepEqual(compiled.guardRules.protectedLexemes, ['千年前那个孩子']);
});

test('multiple matched topics select the strictest disclosure', () => {
  const compiled = compileDialogueTurnContext(character, { playerText: '你的面具和我到底有什么关系？', recentTranscript: [] }, { inputKind: 'in_world' });
  assert.equal(compiled.decision.disclosureLevel, 'sealed');
  assert.equal(compiled.decision.responseMode, 'guarded_refusal');
});

test('actor context excludes protected material from unnormalized examples', () => {
  const unsafeCharacter = structuredClone(character);
  unsafeCharacter.policy.examples = [{ id: 'unsafe', topic_id: 'secret_topic', response_mode: 'guarded_refusal', mood: 'guarded', kind: 'positive', player_text: '千年前那个孩子是谁？', reply_lines: ['玩家就是千年前那个孩子'] }];
  const compiled = compileDialogueTurnContext(unsafeCharacter, { playerText: '面具', recentTranscript: [] }, { inputKind: 'in_world' });
  assert.doesNotMatch(JSON.stringify(compiled.actorContext), /千年前那个孩子|玩家就是千年前那个孩子/);
});

test('unnormalized hint fact examples cannot expose full text but retain safe hint_text', () => {
  const hintCharacter = structuredClone(character);
  hintCharacter.policy.facts = [{ id: 'hint-fact', text: '完整提示事实', hint_text: '安全暗示', tags: [] }];
  hintCharacter.policy.topics[1].disclosure = [{ when: { always: true }, level: 'hint', response_mode: 'emotional_hint', hint_fact_ids: ['hint-fact'] }];
  hintCharacter.policy.examples = [{ id: 'unsafe-hint-example', topic_id: 'secret_topic', response_mode: 'emotional_hint', mood: 'cryptic', kind: 'positive', player_text: '完整提示事实', reply_lines: ['完整提示事实'] }];
  const compiled = compileDialogueTurnContext(hintCharacter, { playerText: '面具', recentTranscript: [] }, { inputKind: 'in_world' });
  assert.doesNotMatch(JSON.stringify(compiled.actorContext), /完整提示事实/);
  assert.match(JSON.stringify(compiled.actorContext), /安全暗示/);
});

test('director includes every protected concept capsule in rule order', () => {
  const multiConceptCharacter = structuredClone(character);
  multiConceptCharacter.policy.protected_concepts = [
    { id: 'first', capsule: '先不要确认第一件事', lexemes: ['第一禁词'] },
    { id: 'second', capsule: '再不要确认第二件事', lexemes: ['第二禁词'] },
  ];
  multiConceptCharacter.policy.topics[1].disclosure[0].protected_concept_ids = ['first', 'second'];
  const compiled = compileDialogueTurnContext(multiConceptCharacter, { playerText: '面具', recentTranscript: [] }, { inputKind: 'in_world' });
  const topic = compiled.directorContext.protectedTopics.find(entry => entry.topicId === 'secret_topic');
  assert.deepEqual(topic.forbiddenConceptIds, ['first', 'second']);
  assert.equal(topic.rule, '先不要确认第一件事\n再不要确认第二件事');
});
