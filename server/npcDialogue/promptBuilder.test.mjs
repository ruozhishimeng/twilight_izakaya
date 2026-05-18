import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildMiniMaxNpcDialogueMessages } from './promptBuilder.mjs';

const BASE_REQUEST = {
  state: 'dayLoop.guest.llmChatSession',
  guestId: 'fox_uncle',
  guestName: '狐面大叔',
  guestProfile: {
    identity: '居酒屋的常客鬼神，戴狐狸面具的神秘调酒师前辈，负责引导新人',
    personality: '慢节奏、慈祥、宽容、幕后老板',
    description: '头戴狐狸面具的老者，拄着拐杖慢步走入。什么都懂却从不直接告诉答案。',
  },
  playerText: '大叔，我到底是谁？我该干什么？',
  week: 1,
  day: 1,
  guestInDay: 2,
  currentNodeId: 'fox_uncle_intro_001',
  observedFeatures: ['狐狸面具上有细微的裂纹'],
  recentTranscript: [
    { speaker: '狐面大叔', text: '「新来的。」他看了你一眼，「过来坐。」' },
  ],
  lastDrink: {
    label: '纯米嗨棒',
    mixedDrinkName: '纯米嗨棒',
    isSuccess: true,
    sourceNodeId: 'fox_uncle_teaching_001',
  },
  turnIndex: 1,
};

function flattenMessages(request) {
  return buildMiniMaxNpcDialogueMessages(request).messages.map(message => message.content).join('\n');
}

test('fox uncle prompt clearly answers bartender identity and duty questions', () => {
  const prompt = flattenMessages(BASE_REQUEST);

  assert.match(prompt, /可明说的核心表层信息/);
  assert.match(prompt, /你是这家店的调酒师/);
  assert.match(prompt, /接待进门的人、听他们说话、按对方真正需要调酒/);
  assert.match(prompt, /不能只说“吧台后的人”/);
});

test('fox uncle prompt clearly answers the surface teacher relationship without revealing hidden truth', () => {
  const prompt = flattenMessages({
    ...BASE_REQUEST,
    playerText: '大叔，你和我到底是什么关系？',
  });

  assert.match(prompt, /老师、调酒师前辈/);
  assert.match(prompt, /刚刚教过他调酒/);
  assert.match(prompt, /可以算你的老师吧/);
  assert.match(prompt, /禁止说出“千年前那个孩子”“我为你放弃永生”“记忆被重置”“你已经死了”/);
});

test('non-ghost prompt does not receive fox uncle identity directives', () => {
  const prompt = flattenMessages({
    ...BASE_REQUEST,
    guestId: 'aqiang',
    guestName: '阿相',
    guestProfile: {
      identity: '一个雨夜还在送外卖的年轻人',
      personality: '沉默寡言，倔强，极度焦虑',
      description: '阿相浑身被雨浇透，只知道自己还要赶最后一单。',
    },
  });

  assert.doesNotMatch(prompt, /本轮强制指引：玩家在问调酒师自己的身份或职责/);
  assert.doesNotMatch(prompt, /可明说的核心表层信息/);
});
