import assert from 'node:assert/strict';
import test from 'node:test';
import { MiniMaxProviderError } from './provider.mjs';
import { runDialoguePipeline } from './pipeline.mjs';

const actorJson = JSON.stringify({
  replyLines: ['「我不想说。」'], mood: 'guarded', addressedTopics: ['own_death'],
  responseMode: 'guarded_refusal', usedFactIds: [],
});
const directorRevisionJson = JSON.stringify({
  verdict: 'revise', violations: ['uncharacterized_refusal'],
  finalReplyLines: ['「这事，先别问。」'], mood: 'guarded',
});
const directorPassJson = JSON.stringify({
  verdict: 'pass', violations: [], finalReplyLines: ['「我不想说。」'], mood: 'guarded',
});
const networkError = new MiniMaxProviderError('无法连接 MiniMax 对话服务。', { status: 502, code: 'network_error' });

const compilation = {
  character: {
    characterId: 'fox_uncle', policy: { fallbacks: { guarded_refusal: { reply_lines: ['「别问了。」'], mood: 'guarded' } } },
  },
  actorContext: {
    characterIdentity: { role: '客人', appearance: '狐狸面具', personality: '克制' },
    voiceProfile: { sentence_length: 'short', rhythm: '慢', initiative: 'low', action_frequency: 'rare', preferred: [], avoid: [], banned_phrases: [] },
    sceneSummary: '', relationshipPosture: 'affection:0', cognitionStates: [{ topicId: 'own_death', state: 'suppressed' }],
    allowedFacts: [], hintableFacts: [], responseMode: 'guarded_refusal', refusalEscalation: 1,
    recentStyleSummary: [], relevantExamples: [],
  },
  directorContext: { voiceProfile: {}, allowedFactIds: [], hintableFactIds: [], protectedTopics: [], recentStyleSummary: [] },
  guardRules: { protectedLexemes: [], bannedPhrases: [], allowedMoods: ['guarded'] },
  decision: { topicIds: ['own_death'], primaryTopicId: 'own_death', cognition: 'suppressed', disclosureLevel: 'guarded', responseMode: 'guarded_refusal', repetitionLevel: 1, endChat: true },
};
const snapshot = {
  guestId: 'fox_uncle', week: 1, day: 1, guestInDay: 1, currentNodeId: null,
  relationshipValues: { affection: 0 }, completedEventIds: [], selectedOptionIds: [],
  unlockedChapterIds: [], observedFeatureIds: [], lastDrink: null, recentTranscript: [],
  turnIndex: 1, playerText: '你到底是谁？',
};

function scriptedModel(script) {
  const model = async request => {
    model.calls.push(request);
    const next = script[model.calls.length - 1];
    if (next instanceof Error) throw next;
    return {
      content: next,
      usage: { provider: 'test:model', promptTokens: 2, completionTokens: 3, totalTokens: 5, promptChars: request.promptChars, completionChars: next.length },
    };
  };
  model.calls = [];
  return model;
}

function makePipelineInput(overrides = {}) {
  return { compilation, snapshot, apiKey: 'request-key', requestModel: scriptedModel([actorJson, directorPassJson]), ...overrides };
}

test('director revision wins after exactly two calls', async () => {
  const model = scriptedModel([actorJson, directorRevisionJson]);
  const result = await runDialoguePipeline(makePipelineInput({ requestModel: model }));
  assert.equal(model.calls.length, 2);
  assert.deepEqual(result.replyLines, ['「这事，先别问。」']);
  assert.equal(result.endChat, true);
  assert.equal(result.trace.finalSource, 'director');
  assert.deepEqual(model.calls.map(call => [call.temperature, call.topP]), [[0.65, 0.9], [0.1, 0.8]]);
  assert.equal(result.usage.totalTokens, 10);
});

test('director timeout uses guarded actor draft without a third call', async () => {
  const model = scriptedModel([actorJson, new MiniMaxProviderError('timeout', { status: 504 })]);
  const result = await runDialoguePipeline(makePipelineInput({ requestModel: model }));
  assert.equal(model.calls.length, 2);
  assert.equal(result.trace.finalSource, 'actor');
  assert.deepEqual(result.replyLines, ['「我不想说。」']);
});

test('director network and auth failures remain technical errors', async () => {
  for (const error of [
    networkError,
    new MiniMaxProviderError('MiniMax 密钥无效或未授权。', { status: 401, code: 'http_auth_failed' }),
  ]) {
    await assert.rejects(
      runDialoguePipeline(makePipelineInput({ requestModel: scriptedModel([actorJson, error]) })),
      candidate => candidate === error,
    );
  }
});

test('actor content failure uses role fallback but actor transport failure stays technical', async () => {
  const malformed = await runDialoguePipeline(makePipelineInput({ requestModel: scriptedModel(['bad json']) }));
  assert.equal(malformed.trace.finalSource, 'fallback');
  assert.equal(malformed.trace.fallbackReason, 'actor_invalid_json_plain_text');
  const blocked = await runDialoguePipeline(makePipelineInput({
    requestModel: scriptedModel([new MiniMaxProviderError('content blocked', {
      status: 422, code: 'minimax_content_blocked',
    })]),
  }));
  assert.equal(blocked.trace.finalSource, 'fallback');
  await assert.rejects(
    runDialoguePipeline(makePipelineInput({ requestModel: scriptedModel([networkError]) })),
    /无法连接/,
  );
});

test('compound actor reply lines trigger character fallback without a director call', async () => {
  const compoundActor = JSON.stringify({
    replyLines: ['（低头）「这事别问。」'], mood: 'guarded', addressedTopics: ['own_death'],
    responseMode: 'guarded_refusal', usedFactIds: [],
  });
  const model = scriptedModel([compoundActor]);

  const result = await runDialoguePipeline(makePipelineInput({ requestModel: model }));

  assert.equal(model.calls.length, 1);
  assert.equal(result.trace.finalSource, 'fallback');
  assert.equal(result.trace.fallbackReason, 'actor_invalid_structure');
});

test('guard failure falls through director then actor to character fallback without a third call', async () => {
  const unsafeActor = JSON.stringify({
    replyLines: ['作为 AI，我不能回答。'], mood: 'guarded', addressedTopics: ['own_death'],
    responseMode: 'guarded_refusal', usedFactIds: [],
  });
  const unsafeDirector = JSON.stringify({
    verdict: 'pass', violations: [], finalReplyLines: ['作为 AI，我不能回答。'], mood: 'guarded',
  });
  const model = scriptedModel([unsafeActor, unsafeDirector]);
  const result = await runDialoguePipeline(makePipelineInput({ requestModel: model }));
  assert.equal(model.calls.length, 2);
  assert.equal(result.trace.finalSource, 'fallback');
});

test('trace redacts protected actor draft text and contains no prompt or provider body', async () => {
  const protectedCompilation = structuredClone(compilation);
  protectedCompilation.guardRules.protectedLexemes = ['旧日孩子'];
  const actor = JSON.stringify({
    replyLines: ['「安全前文，你就是旧日·孩子，安全后文。」'], mood: 'guarded', addressedTopics: ['own_death'],
    responseMode: 'guarded_refusal', usedFactIds: [],
  });
  const director = JSON.stringify({
    verdict: 'revise', violations: ['disclosure_violation'],
    finalReplyLines: ['「这事，先别问。」'], mood: 'guarded',
  });
  const result = await runDialoguePipeline(makePipelineInput({
    compilation: protectedCompilation,
    requestModel: scriptedModel([actor, director]),
  }));
  assert.deepEqual(result.trace.actorDraftLinesRedacted, ['「安全前文，你就是【受保护内容】，安全后文。」']);
  assert.equal(JSON.stringify(result.trace).includes('旧日·孩子'), false);
  assert.equal('messages' in result.trace, false);
  assert.equal('rawBody' in result.trace, false);
});
