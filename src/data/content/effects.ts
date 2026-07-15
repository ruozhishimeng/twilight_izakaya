import {
  createNarrativeTransaction,
  type NarrativeEffectScope,
  type NarrativeTransaction,
  type NarrativeEffectSource as RuntimeNarrativeEffectSource,
  type RelationshipChangeEffect,
} from '../../state/narrativeEffects';
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
