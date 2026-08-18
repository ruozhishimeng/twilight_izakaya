import {
  createNarrativeTransaction,
  type NarrativeEffectScope,
  type NarrativeTransaction,
  type NarrativeEffectSource as RuntimeNarrativeEffectSource,
  type RelationshipChangeEffect,
} from '../../state/narrativeEffects';
import type { MixingTier } from './mixingScore';
import type {
  CharacterNode,
  NarrativeEffectScopeSource,
  NarrativeEffectSource,
  NodePlayerOption,
} from './types';

export interface CompileOptionNarrativeTransactionInput {
  guestId: string;
  eventId: string;
  option: NodePlayerOption;
  visitId?: string;
}

export interface CompileNodeCompletionNarrativeTransactionInput {
  guestId: string;
  eventId: string;
  node: CharacterNode;
  visitId?: string;
}

function requireNonEmptyString(value: string | undefined, label: string) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error(`[contentEffects] ${label} must be a non-empty string`);
  }
  return normalized;
}

function resolveScope(
  value: NarrativeEffectScopeSource | undefined,
  label: string,
): NarrativeEffectScope {
  if (value === undefined) {
    return 'game';
  }
  if (value !== 'game' && value !== 'visit') {
    throw new Error(`[contentEffects] ${label} must be "game" or "visit"`);
  }
  return value;
}

function compileEffects(effects: NarrativeEffectSource[] | undefined): RelationshipChangeEffect[] {
  return (effects || []).map(({ feedback: _feedback, ...effect }) => ({ ...effect }));
}

function buildSource(
  scope: NarrativeEffectScope,
  guestId: string,
  eventId: string,
  visitId?: string,
  optionId?: string,
): RuntimeNarrativeEffectSource {
  const source: RuntimeNarrativeEffectSource = {
    guestId: requireNonEmptyString(guestId, 'guestId'),
    eventId: requireNonEmptyString(eventId, 'eventId'),
  };

  if (optionId !== undefined) {
    source.optionId = requireNonEmptyString(optionId, 'option.id');
  }
  if (scope === 'visit') {
    source.visitId = requireNonEmptyString(visitId, 'visitId for visit scope');
  }

  return source;
}

export function compileOptionNarrativeTransaction({
  guestId,
  eventId,
  option,
  visitId,
}: CompileOptionNarrativeTransactionInput): NarrativeTransaction {
  const optionId = requireNonEmptyString(option.id, 'option.id');
  const scope = resolveScope(option.effect_scope, `option ${optionId}.effect_scope`);

  return createNarrativeTransaction({
    scope,
    source: buildSource(scope, guestId, eventId, visitId, optionId),
    effects: compileEffects(option.effects),
  });
}

export function compileNodeCompletionNarrativeTransaction({
  guestId,
  eventId,
  node,
  visitId,
}: CompileNodeCompletionNarrativeTransactionInput): NarrativeTransaction {
  const scope = resolveScope(node.on_complete?.effect_scope, `node ${eventId}.on_complete.effect_scope`);

  return createNarrativeTransaction({
    scope,
    source: buildSource(scope, guestId, eventId, visitId),
    effects: compileEffects(node.on_complete?.effects),
  });
}

export interface CompileMixingTierNarrativeTransactionInput {
  guestId: string;
  visitId: string;
  mixingNodeId: string;
  tier: MixingTier;
}

// 调酒三档好感事务（半心制）：perfect +1 / good 0 / off -1。
// 每次到访每个调酒节点至多应用一次（visit 作用域幂等，id 自然复用
// buildNarrativeTransactionId 的 visit 分支：visit/{visitId}/{guestId}/{mixingNodeId}）。
const MIXING_TIER_AFFECTION_AMOUNT: Record<MixingTier, number> = {
  perfect: 1,
  good: 0,
  off: -1,
};

export function compileMixingTierNarrativeTransaction({
  guestId,
  visitId,
  mixingNodeId,
  tier,
}: CompileMixingTierNarrativeTransactionInput): NarrativeTransaction {
  const eventId = requireNonEmptyString(mixingNodeId, 'mixingNodeId');
  const amount = MIXING_TIER_AFFECTION_AMOUNT[tier];

  return createNarrativeTransaction({
    scope: 'visit',
    source: buildSource('visit', guestId, eventId, visitId),
    effects: [
      {
        id: `mixing_tier_${tier}_affection`,
        type: 'relationship.change',
        target: 'self',
        axis: 'affection',
        amount,
      },
    ],
  });
}

export interface CompileChapterUnlockNarrativeTransactionInput {
  guestId: string;
  chapterId: string;
}

// 章节 sticky 解锁 fact id：`{guestId}_chapter_{chapterId}_unlocked`（spec §5.4 约定）。
// resolveStartNodeForVisit（flowHelpers.ts）复用此命名判断「已解锁」。
export function buildChapterUnlockFactId(guestId: string, chapterId: string): string {
  return `${requireNonEmptyString(guestId, 'guestId')}_chapter_${requireNonEmptyString(chapterId, 'chapterId')}_unlocked`;
}

// 章节 sticky 解锁 fact：game 作用域、无效果的事务，事件 id 即 spec 约定的
// `{guestId}_chapter_{chapterId}_unlocked`，走既有 applyNarrativeTransaction 路径
// 记录进 completedEvents，供 resolveStartNodeForVisit 的「只进不退」判断复用。
export function compileChapterUnlockNarrativeTransaction({
  guestId,
  chapterId,
}: CompileChapterUnlockNarrativeTransactionInput): NarrativeTransaction {
  const eventId = buildChapterUnlockFactId(guestId, chapterId);

  return createNarrativeTransaction({
    scope: 'game',
    source: buildSource('game', guestId, eventId),
    effects: [],
  });
}
