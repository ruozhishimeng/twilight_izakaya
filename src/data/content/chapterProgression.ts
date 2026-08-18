import { buildChapterUnlockFactId } from './effects';
import {
  getRelationshipValue,
  selectNarrativeFactIds,
  type NarrativeEffectsState,
} from '../../state/narrativeEffects';
import type { Guest } from './types';

export interface ResolveStartNodeContext {
  narrativeEffects: NarrativeEffectsState;
  defaultStartNodeId: string;
}

// 到访起始节点解析（spec §7.1）：好感驱动章节推进。
//
// 从高到低找首个「可解锁」的章节：
//   - 解锁条件：min_affection 已达成 **或** 已有 sticky 解锁 fact（只进不退）；
//   - 且 start_node 自身的 need_event 前置（若有）已满足（顺序章节由 need_event 链保证）。
// 找到 → 返回该章节 start_node；否则返回 schedule 默认 start_node（现状不变）。
//
// 注意：这是纯函数，不写任何 state（不依赖任何加载器、可脱离 Vite 单测）。
// sticky 解锁 fact 由调用侧在进入该章节真实发生时，通过
// compileChapterUnlockNarrativeTransaction 记录（走 applyNarrativeTransaction 路径）。
export function resolveStartNodeForVisit(
  guest: Guest,
  context: ResolveStartNodeContext,
): string {
  const chapters = guest.meta.chapters;
  if (!Array.isArray(chapters) || chapters.length === 0) {
    return context.defaultStartNodeId;
  }

  const affection = getRelationshipValue(context.narrativeEffects, guest.id, 'affection');
  const completedEventIds = new Set<string>(
    selectNarrativeFactIds(context.narrativeEffects, guest.id).completedEventIds,
  );

  for (let i = chapters.length - 1; i >= 0; i -= 1) {
    const chapter = chapters[i];
    const startNode = guest.nodeMap.get(chapter.start_node);
    const needEvents = startNode?.trigger_condition?.need_event ?? [];
    const prerequisitesMet = needEvents.every(eventId => completedEventIds.has(String(eventId)));

    const stickyUnlocked = completedEventIds.has(buildChapterUnlockFactId(guest.id, chapter.id));
    const thresholdMet = affection >= chapter.min_affection;
    const unlocked = stickyUnlocked || thresholdMet;

    if (unlocked && prerequisitesMet) {
      return chapter.start_node;
    }
  }

  return context.defaultStartNodeId;
}
