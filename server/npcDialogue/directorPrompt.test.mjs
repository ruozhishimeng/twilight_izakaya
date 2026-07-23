import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDirectorMessages } from './directorPrompt.mjs';

const sealedCompilation = {
  actorContext: { recentStyleSummary: [] },
  directorContext: {
    voiceProfile: { rhythm: '慢' }, allowedFactIds: [], hintableFactIds: [],
    protectedTopics: [{ topicId: 'old_child', cognition: 'suppressed', rule: '不要确认调酒师就是旧日孩子', forbiddenConceptIds: ['old_child_truth'] }],
    recentStyleSummary: [],
  },
  decision: { topicIds: ['old_child'], cognition: 'suppressed', disclosureLevel: 'sealed', responseMode: 'guarded_refusal', repetitionLevel: 1, endChat: false },
};
const actorCandidate = { replyLines: ['「这事别问。」'], mood: 'guarded', addressedTopics: ['old_child'], responseMode: 'guarded_refusal', usedFactIds: [] };

test('director prompt contains the fixed rubric and protected capsule', () => {
  const prompt = JSON.stringify(buildDirectorMessages({ compilation: sealedCompilation, candidate: actorCandidate }));
  assert.match(prompt, /persona_drift|disclosure_violation|ai_tone/);
  assert.match(prompt, /不要确认调酒师就是旧日孩子/);
});
