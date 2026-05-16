function countChars(lines) {
  return lines.join('').length;
}

function getGuestType(guestId) {
  if (guestId === 'fox_uncle') return 'ghost';
  if (guestId === 'aqiang' || guestId === 'yuki') return 'lost_soul';
  return 'regular';
}

// ---------------------------------------------------------------------------
// Ghost (鬼神) — fox_uncle
// Wise, cryptic, unhurried. Speaks in proverbs and layered observations.
// ---------------------------------------------------------------------------
function buildGhostReply(request) {
  const drinkLabel = request.lastDrink?.label || request.lastDrink?.mixedDrinkName;
  const replies = [];

  if (drinkLabel && request.lastDrink?.isSuccess) {
    replies.push(`狐面大叔端起那杯「${drinkLabel}」，面具下的目光深不见底。`);
    replies.push('「酒没有讲究，人有。」他放下杯子，拐杖在地上轻轻一点。');
  } else if (drinkLabel) {
    replies.push(`狐面大叔垂眼看向那杯「${drinkLabel}」，面具纹丝不动。`);
    replies.push('「酒这东西，有时候错了比对了更有意思。」他像是自言自语。');
  } else if (request.turnIndex >= 3) {
    replies.push('狐面大叔用拐杖轻轻敲了一下地板，像是在数拍子。');
    replies.push('「能坐下来喝到第三杯的，都不是偶然路过的人。」');
  } else {
    replies.push('狐面大叔扶着拐杖，像一棵在风里站了很多年的老树。');
    replies.push('「你要问的，其实你心里已经有答案了。」他缓缓说道。');
  }

  if (request.observedFeatures.length > 0 && replies.length < 2) {
    replies.push(`他注意到了你的目光——${request.observedFeatures[0]}。但他只是微微点头，没有点破。`);
  }

  return replies.slice(0, 2);
}

// ---------------------------------------------------------------------------
// Lost Soul (迷失者／滞留者) — aqiang, yuki
// Confused, driven by unresolved attachment. Searching but unsure what for.
// ---------------------------------------------------------------------------
function buildLostSoulReply(request) {
  const drinkLabel = request.lastDrink?.label || request.lastDrink?.mixedDrinkName;
  const replies = [];

  if (drinkLabel && request.lastDrink?.isSuccess) {
    replies.push(`${request.guestName}捧着那杯「${drinkLabel}」，手指微微发颤。`);
    replies.push('「这味道……好像让我想起了什么。」对方皱着眉，努力抓住那个模糊的轮廓。');
  } else if (drinkLabel) {
    replies.push(`${request.guestName}低头看着那杯「${drinkLabel}」，像是在看一面模糊的镜子。`);
    replies.push('「不对……不是这个。」声音发紧，「可我又说不清自己想要什么。」');
  } else {
    replies.push(`${request.guestName}的视线在你和吧台之间不安地游离。`);
    replies.push('「我在找一个……东西。」对方顿了顿，「也可能是一个答案。我不太确定。」');
  }

  return replies.slice(0, 2);
}

// ---------------------------------------------------------------------------
// Regular (普通人) — everyone else
// Neutral, warm, conversational. No strong thematic coloring.
// ---------------------------------------------------------------------------
function buildRegularReply(request) {
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

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------
export function buildMockNpcDialogueResponse(request) {
  const guestType = getGuestType(request.guestId);

  let replyLines;
  let mood;

  switch (guestType) {
    case 'ghost':
      replyLines = buildGhostReply(request);
      mood = 'steady';
      break;
    case 'lost_soul':
      replyLines = buildLostSoulReply(request);
      mood = 'guarded';
      break;
    default:
      replyLines = buildRegularReply(request);
      mood = 'warm';
      break;
  }

  return {
    replyLines,
    mood,
    endChat: false,
    usage: {
      provider: 'mock-local',
      promptChars: request.playerText.length + JSON.stringify(request.recentTranscript).length,
      completionChars: countChars(replyLines),
    },
  };
}
