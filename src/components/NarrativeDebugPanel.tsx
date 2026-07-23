import React, { useMemo, useState } from 'react';
import { Check, Clipboard, TriangleAlert } from 'lucide-react';
import {
  interpretNodeCompletion,
  type NarrativeDirective,
} from '../data/content/interpreter';
import { getExitTargets, resolveNodeExit } from '../data/content/narrative';
import type { CharacterNode, Guest, NarrativeExit } from '../data/content/types';
import type { GameContext, GameRootStateValue } from '../state/gameState';
import type { DialogueTurnDiagnostics } from '../types/npcDialogue';
import {
  DEFAULT_RELATIONSHIP_AXIS_ID,
  getRelationshipValue,
  type AppliedNarrativeChange,
  type NarrativeEffectScope,
  type NarrativeEffectSource,
} from '../state/narrativeEffects';

export interface NarrativeDebugExit {
  kind: NarrativeExit['kind'] | 'invalid';
  targets: string[];
  error?: string;
}

export interface NarrativeDebugDirective {
  kind: NarrativeDirective['kind'] | 'invalid';
  targets: string[];
  choices?: string[];
  error?: string;
}

export interface NarrativeDebugTransaction {
  id: string;
  scope: NarrativeEffectScope;
  source: NarrativeEffectSource;
  changes: AppliedNarrativeChange[];
}

export interface NarrativeDebugSnapshot {
  week: number;
  day: number;
  guestInDay: number;
  state: GameRootStateValue;
  guest: {
    id: string;
    name: string;
  };
  node: {
    id: string | null;
  } | null;
  exit: NarrativeDebugExit | null;
  directive: NarrativeDebugDirective | null;
  relationship: {
    guestId: string;
    axes: Record<string, number>;
  };
  counts: {
    completedEvents: number;
    selectedOptions: number;
    appliedTransactions: number;
  };
  recentTransactions: NarrativeDebugTransaction[];
  dialogueTurn: DialogueTurnDiagnostics | null;
}

export interface BuildNarrativeDebugSnapshotInput {
  context: GameContext;
  state: GameRootStateValue;
  guest: Guest;
  currentNode: CharacterNode | null | undefined;
  dialogueDiagnostics?: DialogueTurnDiagnostics | null;
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function buildDebugExit(currentNode: CharacterNode | null | undefined): NarrativeDebugExit | null {
  if (!currentNode) {
    return null;
  }

  try {
    const exit = resolveNodeExit(currentNode);
    return {
      kind: exit.kind,
      targets: getExitTargets(exit),
    };
  } catch (error) {
    return {
      kind: 'invalid',
      targets: [],
      error: messageFromError(error),
    };
  }
}

function buildDebugDirective(
  currentNode: CharacterNode | null | undefined,
): NarrativeDebugDirective | null {
  if (!currentNode) {
    return null;
  }

  try {
    const directive = interpretNodeCompletion(currentNode);
    switch (directive.kind) {
      case 'await_choice':
        return {
          kind: directive.kind,
          targets: [],
          choices: directive.options.map(option => option.key),
        };
      case 'node':
        return { kind: directive.kind, targets: [directive.nodeId] };
      case 'tail_chat':
        return {
          kind: directive.kind,
          targets: directive.resume.kind === 'node' ? [directive.resume.nodeId] : [],
        };
      case 'observation':
        return { kind: directive.kind, targets: [directive.continueNodeId] };
      case 'mixing':
        return { kind: directive.kind, targets: getExitTargets(directive.exit) };
      case 'end_visit':
        return { kind: directive.kind, targets: [] };
    }
  } catch (error) {
    return {
      kind: 'invalid',
      targets: [],
      error: messageFromError(error),
    };
  }
}

function buildRelationshipAxes(context: GameContext, guestId: string) {
  const storedAxes = context.narrativeEffects.relationships[guestId]?.values || {};
  const axes: Record<string, number> = { ...storedAxes };
  if (axes[DEFAULT_RELATIONSHIP_AXIS_ID] === undefined) {
    axes[DEFAULT_RELATIONSHIP_AXIS_ID] = getRelationshipValue(
      context.narrativeEffects,
      guestId,
    );
  }

  return Object.fromEntries(
    Object.entries(axes).sort(([left], [right]) => left.localeCompare(right)),
  );
}

/**
 * Builds the complete, serializable Inspector payload. It deliberately selects
 * narrative fields instead of copying GameContext, so credentials and unrelated
 * runtime data can never enter the debug export.
 */
export function buildNarrativeDebugSnapshot({
  context,
  state,
  guest,
  currentNode,
  dialogueDiagnostics = null,
}: BuildNarrativeDebugSnapshotInput): NarrativeDebugSnapshot {
  const effects = context.narrativeEffects;
  const recentTransactions = Object.values(effects.appliedTransactions)
    .slice(-10)
    .reverse()
    .map(receipt => ({
      id: receipt.id,
      scope: receipt.scope,
      source: { ...receipt.source },
      changes: receipt.changes.map(change => ({ ...change })),
    }));

  return {
    week: context.week,
    day: context.day,
    guestInDay: context.guestInDay,
    state,
    guest: {
      id: guest.id,
      name: guest.name,
    },
    node: currentNode
      ? {
          id: currentNode.event_id || currentNode.id || null,
        }
      : null,
    exit: buildDebugExit(currentNode),
    directive: buildDebugDirective(currentNode),
    relationship: {
      guestId: guest.id,
      axes: buildRelationshipAxes(context, guest.id),
    },
    counts: {
      completedEvents: Object.keys(effects.completedEvents).length,
      selectedOptions: Object.keys(effects.selectedOptions).length,
      appliedTransactions: Object.keys(effects.appliedTransactions).length,
    },
    recentTransactions,
    dialogueTurn: dialogueDiagnostics,
  };
}

interface NarrativeDebugPanelProps extends BuildNarrativeDebugSnapshotInput {
  className?: string;
}

function compactId(value: string) {
  return value.length > 42 ? `${value.slice(0, 20)}…${value.slice(-18)}` : value;
}

export default function NarrativeDebugPanel({
  context,
  state,
  guest,
  currentNode,
  dialogueDiagnostics,
  className = '',
}: NarrativeDebugPanelProps) {
  const snapshot = useMemo(
    () => buildNarrativeDebugSnapshot({ context, state, guest, currentNode, dialogueDiagnostics }),
    [context, currentNode, dialogueDiagnostics, guest, state],
  );
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const copySnapshot = async () => {
    try {
      if (!globalThis.navigator?.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await globalThis.navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  };

  const axisEntries = Object.entries(snapshot.relationship.axes);

  return (
    <aside
      aria-label="剧情 Inspector"
      className={`flex max-h-[78vh] w-[430px] max-w-full flex-col overflow-hidden border-4 border-[#17100c] bg-[#211711] text-[#eadfc9] shadow-[0_12px_36px_rgba(0,0,0,0.6)] pixel-rounded-lg ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b-4 border-[#17100c] bg-[#302018] px-4 py-3">
        <div>
          <div className="text-[10px] tracking-[0.28em] text-[#b78b57]">DEVELOPMENT</div>
          <h2 className="mt-1 text-base font-bold text-[#fff0d4]">剧情 Inspector</h2>
        </div>
        <button
          type="button"
          onClick={copySnapshot}
          className="pixel-button flex items-center gap-2 px-3 py-2 text-xs"
          title="复制脱敏剧情快照"
        >
          {copyStatus === 'copied' ? <Check size={14} /> : <Clipboard size={14} />}
          {copyStatus === 'copied' ? '已复制' : copyStatus === 'error' ? '复制失败' : '复制 JSON'}
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-xs custom-scrollbar">
        <section className="grid grid-cols-3 gap-2">
          {[
            ['周', snapshot.week],
            ['日', snapshot.day],
            ['客序', snapshot.guestInDay],
          ].map(([label, value]) => (
            <div key={label} className="border-2 border-[#4c3a2e] bg-[#17100c] px-3 py-2 text-center pixel-rounded-sm">
              <div className="text-[10px] text-[#a98a68]">{label}</div>
              <div className="mt-1 text-base font-bold text-[#f0c986]">{value}</div>
            </div>
          ))}
        </section>

        <section className="border-2 border-[#4c3a2e] bg-[#17100c] p-3 pixel-rounded-sm">
          <div className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-2">
            <span className="text-[#a98a68]">状态</span>
            <code className="break-all text-[#d8c7ab]">{snapshot.state}</code>
            <span className="text-[#a98a68]">来客</span>
            <span>{snapshot.guest.name} · {snapshot.guest.id}</span>
            <span className="text-[#a98a68]">节点</span>
            <code className="break-all">{snapshot.node?.id || '—'}</code>
            <span className="text-[#a98a68]">出口</span>
            <div>
              <code className={snapshot.exit?.kind === 'invalid' ? 'text-[#e98e75]' : 'text-[#9fd2a6]'}>
                {snapshot.exit?.kind || '—'}
              </code>
              {snapshot.exit && snapshot.exit.targets.length > 0 && (
                <div className="mt-1 break-all leading-5 text-[#cdbb9e]">
                  {snapshot.exit.targets.join(' → ')}
                </div>
              )}
              {snapshot.exit?.error && (
                <div className="mt-2 flex gap-2 text-[#e98e75]">
                  <TriangleAlert className="mt-0.5 shrink-0" size={13} />
                  <span>{snapshot.exit.error}</span>
                </div>
              )}
            </div>
            <span className="text-[#a98a68]">解释结果</span>
            <div>
              <code className={snapshot.directive?.kind === 'invalid' ? 'text-[#e98e75]' : 'text-[#9fd2a6]'}>
                {snapshot.directive?.kind || '—'}
              </code>
              {snapshot.directive && snapshot.directive.targets.length > 0 && (
                <div className="mt-1 break-all leading-5 text-[#cdbb9e]">
                  {snapshot.directive.targets.join(' → ')}
                </div>
              )}
              {snapshot.directive?.choices && snapshot.directive.choices.length > 0 && (
                <div className="mt-1 break-all leading-5 text-[#cdbb9e]">
                  {snapshot.directive.choices.join(' / ')}
                </div>
              )}
              {snapshot.directive?.error && (
                <div className="mt-2 flex gap-2 text-[#e98e75]">
                  <TriangleAlert className="mt-0.5 shrink-0" size={13} />
                  <span>{snapshot.directive.error}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="border-2 border-[#4c3a2e] bg-[#17100c] p-3 pixel-rounded-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-[#f0c986]">关系精确值</h3>
            <code className="text-[10px] text-[#8f7c65]">{snapshot.relationship.guestId}</code>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {axisEntries.map(([axis, value]) => (
              <div key={axis} className="flex items-center justify-between border border-[#453327] bg-[#281b15] px-2 py-1.5">
                <code className="text-[#cdbb9e]">{axis}</code>
                <strong className="text-[#fff0d4]">{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2">
          {[
            ['事件', snapshot.counts.completedEvents],
            ['选项', snapshot.counts.selectedOptions],
            ['事务', snapshot.counts.appliedTransactions],
          ].map(([label, value]) => (
            <div key={label} className="border-2 border-[#4c3a2e] bg-[#17100c] px-2 py-2 text-center pixel-rounded-sm">
              <div className="text-[10px] text-[#a98a68]">{label}</div>
              <div className="mt-1 font-bold text-[#d8c7ab]">{value}</div>
            </div>
          ))}
        </section>

        <section className="border-2 border-[#4c3a2e] bg-[#17100c] p-3 pixel-rounded-sm">
          <h3 className="mb-2 font-bold text-[#f0c986]">最近模型回合（脱敏）</h3>
          {snapshot.dialogueTurn ? (
            <div className="grid grid-cols-[84px_1fr] gap-x-2 gap-y-1.5 break-all">
              <span className="text-[#a98a68]">来源</span><code>{snapshot.dialogueTurn.finalSource}</code>
              <span className="text-[#a98a68]">裁决</span><code>{snapshot.dialogueTurn.directorVerdict}</code>
              <span className="text-[#a98a68]">响应模式</span><code>{snapshot.dialogueTurn.responseMode}</code>
              <span className="text-[#a98a68]">话题</span><code>{snapshot.dialogueTurn.topicIds.join(', ') || '—'}</code>
              <span className="text-[#a98a68]">演员草稿</span>
              <span>{snapshot.dialogueTurn.actorDraftLinesRedacted.join(' / ') || '—'}</span>
            </div>
          ) : (
            <div className="py-2 text-center text-[#7f705e]">暂无安全诊断</div>
          )}
        </section>

        <section className="border-2 border-[#4c3a2e] bg-[#17100c] p-3 pixel-rounded-sm">
          <h3 className="mb-2 font-bold text-[#f0c986]">最近事务（最多 10 条）</h3>
          {snapshot.recentTransactions.length === 0 ? (
            <div className="py-3 text-center text-[#7f705e]">暂无剧情事务</div>
          ) : (
            <div className="space-y-2">
              {snapshot.recentTransactions.map(transaction => (
                <article key={transaction.id} className="border border-[#453327] bg-[#281b15] p-2">
                  <div className="flex items-start justify-between gap-2">
                    <code title={transaction.id} className="break-all text-[10px] text-[#d8c7ab]">
                      {compactId(transaction.id)}
                    </code>
                    <span className="shrink-0 text-[9px] uppercase text-[#a98a68]">{transaction.scope}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-[#8f7c65]">
                    {transaction.source.eventId}
                    {transaction.source.optionId ? ` / ${transaction.source.optionId}` : ''}
                  </div>
                  {transaction.changes.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {transaction.changes.map(change => (
                        <div key={`${transaction.id}:${change.effectId}`} className="flex justify-between gap-2 text-[10px]">
                          <code>{change.targetId}.{change.axis}</code>
                          <span className={change.appliedAmount >= 0 ? 'text-[#9fd2a6]' : 'text-[#e98e75]'}>
                            {change.before} → {change.after} ({change.appliedAmount >= 0 ? '+' : ''}{change.appliedAmount})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-[10px] text-[#7f705e]">仅记录剧情事实，无数值变化</div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
