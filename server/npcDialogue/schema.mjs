const SESSION_STATE = 'dayLoop.guest.llmChatSession';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTranscriptEntry(entry) {
  return (
    !!entry &&
    typeof entry === 'object' &&
    isNonEmptyString(entry.speaker) &&
    isNonEmptyString(entry.text)
  );
}

function isGuestProfile(value) {
  return (
    !!value &&
    typeof value === 'object' &&
    isNonEmptyString(value.identity) &&
    isNonEmptyString(value.personality) &&
    isNonEmptyString(value.description)
  );
}

function isLastDrink(value) {
  if (value === null) {
    return true;
  }

  return (
    !!value &&
    typeof value === 'object' &&
    typeof value.isSuccess === 'boolean' &&
    (value.label === undefined || typeof value.label === 'string') &&
    (value.mixedDrinkName === undefined || typeof value.mixedDrinkName === 'string') &&
    (value.sourceNodeId === undefined ||
      value.sourceNodeId === null ||
      typeof value.sourceNodeId === 'string')
  );
}

export function validateNpcDialogueRequest(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: '请求体必须是 JSON 对象。' };
  }

  if (body.state !== SESSION_STATE) {
    return { ok: false, error: '只有尾声聊天会话阶段可以调用对话服务。' };
  }

  if (!isNonEmptyString(body.guestId) || !isNonEmptyString(body.guestName)) {
    return { ok: false, error: '缺少角色信息。' };
  }

  if (!isGuestProfile(body.guestProfile)) {
    return { ok: false, error: '角色人设摘要格式无效。' };
  }

  if (!isNonEmptyString(body.playerText)) {
    return { ok: false, error: '玩家输入不能为空。' };
  }

  if (body.playerText.trim().length > 60) {
    return { ok: false, error: '一次最多输入 60 个字。' };
  }

  if (!Number.isInteger(body.week) || !Number.isInteger(body.day) || !Number.isInteger(body.guestInDay)) {
    return { ok: false, error: '日期状态不完整。' };
  }

  if (body.currentNodeId !== null && body.currentNodeId !== undefined && typeof body.currentNodeId !== 'string') {
    return { ok: false, error: '当前节点标识无效。' };
  }

  if (!Array.isArray(body.observedFeatures) || !body.observedFeatures.every(item => typeof item === 'string')) {
    return { ok: false, error: '观察线索格式无效。' };
  }

  if (
    !Array.isArray(body.recentTranscript) ||
    !body.recentTranscript.every(isTranscriptEntry)
  ) {
    return { ok: false, error: '近期对话记录格式无效。' };
  }

  if (!isLastDrink(body.lastDrink ?? null)) {
    return { ok: false, error: '最近一次调酒结果格式无效。' };
  }

  if (!Number.isInteger(body.turnIndex) || body.turnIndex < 1) {
    return { ok: false, error: '对话轮次无效。' };
  }

  return {
    ok: true,
    value: {
      state: SESSION_STATE,
      guestId: body.guestId.trim(),
      guestName: body.guestName.trim(),
      guestProfile: {
        identity: body.guestProfile.identity.trim(),
        personality: body.guestProfile.personality.trim(),
        description: body.guestProfile.description.trim(),
      },
      playerText: body.playerText.trim(),
      week: body.week,
      day: body.day,
      guestInDay: body.guestInDay,
      currentNodeId: body.currentNodeId ?? null,
      observedFeatures: body.observedFeatures.map(item => item.trim()).filter(Boolean),
      recentTranscript: body.recentTranscript
        .map(entry => ({
          speaker: entry.speaker.trim(),
          text: entry.text.trim(),
        }))
        .filter(entry => entry.speaker && entry.text)
        .slice(-8),
      lastDrink: body.lastDrink ?? null,
      turnIndex: body.turnIndex,
    },
  };
}
