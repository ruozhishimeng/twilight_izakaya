export const DIRECTOR_RUBRIC = [
  'irrelevant', 'persona_drift', 'cognition_conflict', 'disclosure_violation',
  'fact_conflict', 'uncharacterized_refusal', 'ai_tone', 'repetition',
  'state_mutation', 'invalid_structure',
];

export function buildDirectorMessages({ compilation, candidate }) {
  const payload = {
    candidate,
    voiceProfile: compilation.directorContext.voiceProfile,
    allowedFactIds: compilation.directorContext.allowedFactIds,
    hintableFactIds: compilation.directorContext.hintableFactIds,
    protectedTopics: compilation.directorContext.protectedTopics,
    recentStyleSummary: compilation.directorContext.recentStyleSummary,
    decision: {
      topicIds: compilation.decision.topicIds,
      cognition: compilation.decision.cognition,
      disclosureLevel: compilation.decision.disclosureLevel,
      responseMode: compilation.decision.responseMode,
      repetitionLevel: compilation.decision.repetitionLevel,
    },
  };
  return [
    {
      role: 'system',
      content: [
        '你是固定规则的对白导演。检查演员草稿并给出最终对白。',
        `违规代码仅限：${DIRECTOR_RUBRIC.join('|')}`,
        '保护条款是硬边界；不得确认或复述被保护事实，不得建议任何游戏状态改变。',
        '只输出严格 JSON 对象，且只能有 verdict、violations、finalReplyLines、mood 四个字段。',
      ].join('\n'),
    },
    { role: 'user', content: JSON.stringify(payload) },
  ];
}
