import assert from 'node:assert/strict';
import test from 'node:test';
import { buildActorMessages } from './actorPrompt.mjs';

const sealedCompilation = {
  actorContext: {
    characterIdentity: { role: '老师', appearance: '狐狸面具', personality: '克制' },
    voiceProfile: { sentence_length: 'short', rhythm: '慢', initiative: 'low', action_frequency: 'rare', preferred: [], avoid: [], banned_phrases: [] },
    sceneSummary: '居酒屋吧台', relationshipPosture: 'affection:6',
    cognitionStates: [{ topicId: 'old_child', state: 'suppressed' }],
    allowedFacts: [{ id: 'fox_surface_teacher_relation', text: '他曾教过调酒。' }],
    hintableFacts: [], responseMode: 'guarded_refusal', refusalEscalation: 2,
    recentStyleSummary: [], relevantExamples: [],
  },
  directorContext: {
    voiceProfile: {}, allowedFactIds: ['fox_surface_teacher_relation'], hintableFactIds: [],
    protectedTopics: [{ topicId: 'old_child', cognition: 'suppressed', rule: '不要确认调酒师就是旧日孩子', forbiddenConceptIds: ['old_child_truth'] }],
    recentStyleSummary: [],
  },
  guardRules: { protectedLexemes: ['千年前那个孩子'], bannedPhrases: [], allowedMoods: ['guarded'] },
  decision: { topicIds: ['old_child'], primaryTopicId: 'old_child', cognition: 'suppressed', disclosureLevel: 'sealed', responseMode: 'guarded_refusal', repetitionLevel: 2, endChat: true },
};

test('actor prompt receives safe facts but no sealed truth or endChat authority', () => {
  const prompt = JSON.stringify(buildActorMessages(sealedCompilation));
  assert.match(prompt, /fox_surface_teacher_relation/);
  for (const mood of ['steady', 'warm', 'guarded', 'awkward', 'cryptic', 'nostalgic']) {
    assert.match(prompt, new RegExp(mood));
  }
  assert.doesNotMatch(prompt, /千年前那个孩子|endChat|gameStatePatch/);
});

test('actor prompt defensively redacts protected lexemes from every safe-context field', () => {
  const compilation = structuredClone(sealedCompilation);
  compilation.actorContext.voiceProfile.avoid = ['不要说千年前那个孩子'];
  compilation.actorContext.sceneSummary = '不要输出 endChat';
  const prompt = JSON.stringify(buildActorMessages(compilation));
  assert.doesNotMatch(prompt, /千年前那个孩子|endChat/);
  assert.match(prompt, /【受保护内容】/);
});

test('actor prompt redacts punctuation and whitespace variants of protected lexemes', () => {
  const compilation = structuredClone(sealedCompilation);
  compilation.guardRules.protectedLexemes = ['旧日孩子'];
  compilation.actorContext.sceneSummary = '安全前文：旧日 孩子；安全后文：旧日·孩子。';

  const prompt = JSON.stringify(buildActorMessages(compilation));

  assert.doesNotMatch(prompt, /旧日 孩子|旧日·孩子/);
  assert.match(prompt, /安全前文：【受保护内容】；安全后文：【受保护内容】。/);
});

test('actor payload sanitizes nested protected variants before JSON escaping', () => {
  const compilation = structuredClone(sealedCompilation);
  compilation.guardRules.protectedLexemes = ['旧日孩子'];
  compilation.actorContext.characterIdentity.personality = '甲旧日\n孩子乙';
  compilation.actorContext.voiceProfile.avoid = ['丙旧日\t孩子丁'];
  compilation.actorContext.allowedFacts = [{ id: 'surface', text: '戊旧日 孩子己' }];
  compilation.actorContext.relevantExamples = [{
    id: 'safe_example',
    reply_lines: ['庚旧日·孩子辛'],
  }];

  const messages = buildActorMessages(compilation, {
    playerText: '壬endChat癸旧日\n孩子子',
  });
  const serialized = messages[1].content;
  const payload = JSON.parse(serialized);

  assert.doesNotMatch(serialized, /旧日(?:\\n|\\t| |·)孩子|endChat/);
  assert.equal(payload.characterIdentity.personality, '甲【受保护内容】乙');
  assert.deepEqual(payload.voiceProfile.avoid, ['丙【受保护内容】丁']);
  assert.equal(payload.allowedFacts[0].text, '戊【受保护内容】己');
  assert.deepEqual(payload.relevantExamples[0].reply_lines, ['庚【受保护内容】辛']);
  assert.equal(payload.playerText, '壬【受保护内容】癸【受保护内容】子');
});
