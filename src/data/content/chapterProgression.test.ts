import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { CharacterNode, Guest } from './types';
import { compileChapterUnlockNarrativeTransaction } from './effects';
import {
  applyNarrativeTransaction,
  createInitialNarrativeEffectsState,
  createNarrativeTransaction,
  type NarrativeEffectsState,
} from '../../state/narrativeEffects';
import { resolveStartNodeForVisit } from './chapterProgression';

const chapters = [
  { id: 'phase_2', start_node: 'g2', min_affection: 4 },
  { id: 'phase_3', start_node: 'g3', min_affection: 6 },
];

// g1 无前置；g2 需 g1_done；g3 需 g2_done（模拟顺序章节的 need_event 链）。
const NEED_EVENTS: Record<string, string[]> = {
  g1: [],
  g2: ['g1_done'],
  g3: ['g2_done'],
};

function makeGuest(): Guest {
  const nodeMap = new Map<string, CharacterNode>();
  Object.entries(NEED_EVENTS).forEach(([id, needEvent]) => {
    nodeMap.set(id, { event_id: id, trigger_condition: { need_event: needEvent } });
  });

  return {
    id: 'aqiang',
    name: '阿相',
    imagePlaceholderColor: '#000000',
    avatarColor: '#000000',
    image: '',
    expressions: {},
    features: [],
    correctFeatures: [],
    phases: [],
    type: 'Lost Soul',
    meta: { character_id: 'aqiang', base_info: {}, chapters },
    llmChatDefault: {
      enabled: false,
      maxTurns: 3,
      entryStatusText: '',
      blockedMessage: '',
      exhaustedMessage: '',
    },
    gallery: { baseInfo: {}, chapters: [] },
    startNodeIds: ['g1'],
    nodeMap,
    nodes: { main: [], teaching: [], chat: [], hidden: [], all: [] },
  };
}

function withAffection(state: NarrativeEffectsState, amount: number): NarrativeEffectsState {
  return { ...state, relationships: { aqiang: { values: { affection: amount } } } };
}

// need_event 前置事实必须经真实事务写入（selectNarrativeFactIds 只读 appliedTransactions 的 source.eventId）。
function withCompletedEvent(state: NarrativeEffectsState, eventId: string): NarrativeEffectsState {
  const transaction = createNarrativeTransaction({
    scope: 'game',
    source: { guestId: 'aqiang', eventId },
    effects: [],
  });
  return applyNarrativeTransaction(state, transaction).nextState;
}

test('resolveStartNodeForVisit returns the default start when no chapter unlocks', () => {
  const result = resolveStartNodeForVisit(makeGuest(), {
    narrativeEffects: withAffection(createInitialNarrativeEffectsState(), 0),
    defaultStartNodeId: 'g1',
  });
  assert.equal(result, 'g1');
});

test('resolveStartNodeForVisit picks the highest chapter whose threshold and need_event are met', () => {
  let state = createInitialNarrativeEffectsState();
  state = withCompletedEvent(state, 'g1_done');
  state = withCompletedEvent(state, 'g2_done');
  const result = resolveStartNodeForVisit(makeGuest(), {
    narrativeEffects: withAffection(state, 6),
    defaultStartNodeId: 'g1',
  });
  assert.equal(result, 'g3');
});

test('resolveStartNodeForVisit falls back to a lower chapter when the higher need_event is unmet', () => {
  // 好感 6 已达 g3 阈值，但 g2_done 未完成 → g3 不可进入，落到 g2（阈值 4 达成 + g1_done 满足）。
  const state = withCompletedEvent(createInitialNarrativeEffectsState(), 'g1_done');
  const result = resolveStartNodeForVisit(makeGuest(), {
    narrativeEffects: withAffection(state, 6),
    defaultStartNodeId: 'g1',
  });
  assert.equal(result, 'g2');
});

test('resolveStartNodeForVisit requires need_event prerequisites even when the threshold is met', () => {
  // 好感 4 达 g2 阈值，但 g1_done 未完成 → 无章节可解锁 → 默认。
  const result = resolveStartNodeForVisit(makeGuest(), {
    narrativeEffects: withAffection(createInitialNarrativeEffectsState(), 4),
    defaultStartNodeId: 'g1',
  });
  assert.equal(result, 'g1');
});

test('resolveStartNodeForVisit keeps a chapter unlocked via sticky fact after affection drops (只进不退)', () => {
  let state = withCompletedEvent(createInitialNarrativeEffectsState(), 'g1_done');
  // 首次进入 g2 时记录 sticky 解锁 fact。
  const sticky = compileChapterUnlockNarrativeTransaction({ guestId: 'aqiang', chapterId: 'phase_2' });
  const applied = applyNarrativeTransaction(withAffection(state, 4), sticky);
  assert.ok(applied.applied, 'sticky transaction should apply');

  // 好感跌回 0（低于 g2 阈值 4），sticky 仍使 g2 解锁 —— 只进不退。
  const result = resolveStartNodeForVisit(makeGuest(), {
    narrativeEffects: withAffection(applied.nextState, 0),
    defaultStartNodeId: 'g1',
  });
  assert.equal(result, 'g2');
});
