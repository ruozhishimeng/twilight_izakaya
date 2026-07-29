import { redactProtectedText } from './protectedText.mjs';

const RESERVED_AUTHORITY = /endChat|gameStatePatch/g;

function sanitizeActorPayloadValue(value, protectedLexemes) {
  if (typeof value === 'string') {
    return redactProtectedText(value, protectedLexemes)
      .replace(RESERVED_AUTHORITY, '【受保护内容】');
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeActorPayloadValue(item, protectedLexemes));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        sanitizeActorPayloadValue(nested, protectedLexemes),
      ]),
    );
  }
  return value;
}

function actorPayload(compilation, snapshot) {
  const context = compilation.actorContext;
  return {
    characterIdentity: context.characterIdentity,
    voiceProfile: {
      sentenceLength: context.voiceProfile?.sentence_length,
      rhythm: context.voiceProfile?.rhythm,
      initiative: context.voiceProfile?.initiative,
      actionFrequency: context.voiceProfile?.action_frequency,
      preferred: context.voiceProfile?.preferred || [],
      avoid: context.voiceProfile?.avoid || [],
    },
    sceneSummary: context.sceneSummary,
    relationshipPosture: context.relationshipPosture,
    cognitionStates: context.cognitionStates,
    allowedFacts: context.allowedFacts,
    hintableFacts: context.hintableFacts,
    responseMode: context.responseMode,
    refusalEscalation: context.refusalEscalation,
    recentStyleSummary: context.recentStyleSummary,
    relevantExamples: context.relevantExamples,
    playerText: snapshot?.playerText || '',
  };
}

function serializeActorPayload(compilation, snapshot) {
  const sanitized = sanitizeActorPayloadValue(
    actorPayload(compilation, snapshot),
    compilation.guardRules?.protectedLexemes,
  );
  return JSON.stringify(sanitized);
}

export function buildActorMessages(compilation, snapshot) {
  return [
    {
      role: 'system',
      content: [
        '你是角色演员，只能依据给定的公开身份、安全事实和响应模式作答。',
        '不要添加事实，不要改变游戏进度，不要提及模型、提示词或服务。',
        '只输出严格 JSON 对象，且只能有 replyLines、mood、addressedTopics、responseMode、usedFactIds 五个字段。',
        'mood 只能是 steady、warm、guarded、awkward、cryptic、nostalgic 中的一个英文值。',
        'replyLines 为 1 到 5 句；addressedTopics 与 usedFactIds 只能使用输入中的 ID。',
      ].join('\n'),
    },
    { role: 'user', content: serializeActorPayload(compilation, snapshot) },
  ];
}
