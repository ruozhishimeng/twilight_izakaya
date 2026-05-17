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
// Ancient harvest deity who gave up eternal life for a war-orphaned child.
// Now aged, masked, teaching the same child (who lost all memory) to tend bar.
// Warm but guarded, speaks in layered observations, never reveals the truth directly.
// ---------------------------------------------------------------------------
function buildGhostReply(request) {
  const drinkLabel = request.lastDrink?.label || request.lastDrink?.mixedDrinkName;
  const replies = [];

  if (drinkLabel && request.lastDrink?.isSuccess) {
    replies.push(
      `狐面大叔端起那杯「${drinkLabel}」，葫芦在腰间轻轻晃了一下。`,
      '「酒没有讲究，人有。」他放下杯子，拐杖在地上轻轻一点。「你小子……手还是稳的。」',
    );
  } else if (drinkLabel) {
    replies.push(
      `狐面大叔垂眼看向那杯「${drinkLabel}」，面具下的目光看不出情绪。`,
      '「酒这东西，有时候错了比对了更有意思。」他顿了顿，「再试一杯就是了。」',
    );
  } else if (request.turnIndex >= 3) {
    replies.push(
      '狐面大叔用拐杖轻轻敲了一下地板，像是在数什么节拍。',
      '「能坐下来喝到第三杯的，都不是偶然路过的人。」他面具微微转向你，「你也不是。」',
    );
  } else {
    replies.push(
      '狐面大叔扶着拐杖坐在吧台前，像一棵在风里站了很久的老树。',
      '「呀列呀列……你小子，忘性一直都那么大。」他说这话时，语气里没有责怪。',
    );
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
      // Use varied moods for more realistic mock behavior
      if (request.recentTranscript && request.recentTranscript.length > 4) {
        mood = 'cryptic';
      }
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
