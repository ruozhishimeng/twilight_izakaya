function formatObservedFeatures(features) {
  if (!Array.isArray(features) || features.length === 0) {
    return '暂无已记录线索';
  }

  return features.join('、');
}

function formatLastDrink(lastDrink) {
  if (!lastDrink) {
    return '本轮尚无已记录调酒结果。';
  }

  const drinkName = lastDrink.mixedDrinkName || lastDrink.label || '未命名酒品';
  const sourceNode = lastDrink.sourceNodeId || '未知节点';
  return [
    `结果：${lastDrink.isSuccess ? '成功' : '失败'}`,
    `酒品：${drinkName}`,
    `来源节点：${sourceNode}`,
  ].join('；');
}

function formatRecentTranscript(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return '暂无近期对话记录。';
  }

  return entries
    .slice(-8)
    .map((entry, index) => `${index + 1}. ${entry.speaker}：${entry.text}`)
    .join('\n');
}

function buildSystemPrompt(request) {
  return [
    `你是《黄昏居酒屋》中的${request.guestName}。`,
    `身份摘要：${request.guestProfile.identity}`,
    `性格摘要：${request.guestProfile.personality}`,
    `人物描述：${request.guestProfile.description}`,
    '你必须严格遵守事实区，不得遗忘、否认或改写事实。',
    '你不能推进主线、不能发奖励、不能解锁剧情、不能修改调酒结果、不能添加事实区之外的新世界设定。',
    '只用简体中文回复，保持像该角色会说的话。',
    '输出必须是 JSON 字符串，且只能包含以下字段：replyLines、mood、endChat。',
    'replyLines 只能是 1 到 2 句；总长度不超过 90 个汉字。',
    '如果需要动作描写，必须把动作单独写成一条 replyLines，不要把“（动作）”和说话内容混在同一条里。',
    'mood 只能是 steady、warm、guarded、awkward 四选一。',
    'endChat 必须是布尔值。除非对话明显该结束，否则默认 false。',
    '如果你只想说一句，也必须把这句台词放进 replyLines 数组里。',
    '禁止直接输出角色台词正文；只允许输出 JSON 字符串。',
    '不要输出 Markdown，不要输出解释，不要输出代码块。',
  ].join('\n');
}

function buildFactBlock(request) {
  return [
    '事实区：',
    `- 当前时间：第 ${request.week} 周，第 ${request.day} 天，今天第 ${request.guestInDay} 位客人`,
    `- 当前节点：${request.currentNodeId || '未知节点'}`,
    `- 当前尾声对话轮次：第 ${request.turnIndex} 轮`,
    `- 最近一次调酒结果：${formatLastDrink(request.lastDrink)}`,
    `- 已观察线索：${formatObservedFeatures(request.observedFeatures)}`,
    '- 最近对话摘要：',
    formatRecentTranscript(request.recentTranscript),
  ].join('\n');
}

export function buildMiniMaxNpcDialogueMessages(request) {
  const messages = [
    {
      role: 'system',
      name: request.guestName,
      content: buildSystemPrompt(request),
    },
    {
      role: 'user_system',
      name: '酒保',
      content: '你正在和店里的调酒师交谈。对方就是刚刚接待你、为你调酒并回应你的人。',
    },
    {
      role: 'sample_message_user',
      name: '玩家示例',
      content: '您看起来像是在这里待过很多年。',
    },
    {
      role: 'sample_message_ai',
      name: request.guestName,
      content: JSON.stringify({
        replyLines: [
          '（他抬了抬眼）',
          '「待得久，不代表什么都要说。」',
        ],
        mood: 'guarded',
        endChat: false,
      }),
    },
    {
      role: 'user',
      name: '系统事实',
      content: buildFactBlock(request),
    },
    {
      role: 'user',
      name: '玩家',
      content: request.playerText,
    },
  ];

  const promptChars = messages.reduce((total, message) => total + message.content.length, 0);

  return {
    messages,
    promptChars,
  };
}
