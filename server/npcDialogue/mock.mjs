function countChars(lines) {
  return lines.join('').length;
}

function buildFoxUncleReply(request) {
  const drinkLabel = request.lastDrink?.label || request.lastDrink?.mixedDrinkName;
  const replies = [];

  if (drinkLabel && request.lastDrink?.isSuccess) {
    replies.push(`狐面大叔看了看那杯「${drinkLabel}」，拐杖在地上轻轻点了一下。`);
    replies.push('「酒是调对了。」他慢悠悠地说，「你既然还想聊，老夫就再陪你两句。」');
  } else if (drinkLabel) {
    replies.push(`狐面大叔垂眼看向那杯「${drinkLabel}」。`);
    replies.push('「味道还没站稳，人话倒是先说出口了。」他笑了笑，「也不算坏事。」');
  } else {
    replies.push('狐面大叔扶着拐杖，没有立刻起身。');
    replies.push('「门还没关，灯也还亮着。」他慢吞吞地说，「你要问什么，就趁现在。」');
  }

  if (request.observedFeatures.length > 0 && replies.length < 2) {
    replies.push(`他像是注意到你方才盯着${request.observedFeatures[0]}看了很久，却没有立刻点破。`);
  }

  return replies.slice(0, 2);
}

function buildGenericReply(request) {
  const drinkLabel = request.lastDrink?.label || request.lastDrink?.mixedDrinkName;

  if (drinkLabel && request.lastDrink?.isSuccess) {
    return [
      `${request.guestName}低头看了眼那杯「${drinkLabel}」。`,
      '「这杯酒至少没辜负今晚。」对方顿了顿，又把目光落回你身上。',
    ];
  }

  return [
    `${request.guestName}安静地听完了你的话。`,
    '对方没有急着离开，像是在等你把真正想说的那句也说出口。',
  ];
}

export function buildMockNpcDialogueResponse(request) {
  const replyLines =
    request.guestId === 'fox_uncle'
      ? buildFoxUncleReply(request)
      : buildGenericReply(request);

  return {
    replyLines,
    mood: request.guestId === 'fox_uncle' ? 'steady' : 'warm',
    endChat: false,
    usage: {
      provider: 'mock-local',
      promptChars: request.playerText.length + JSON.stringify(request.recentTranscript).length,
      completionChars: countChars(replyLines),
    },
  };
}
