export const DEFAULT_RELATIONSHIP_AXIS_ID = 'affection';

export interface RelationshipAxisDefinition {
  initial: number;
  min: number;
  max: number;
}

export type RelationshipAxisRegistry = Readonly<
  Record<string, Readonly<RelationshipAxisDefinition>>
>;

export const DEFAULT_RELATIONSHIP_AXES: RelationshipAxisRegistry = Object.freeze({
  [DEFAULT_RELATIONSHIP_AXIS_ID]: Object.freeze({
    initial: 0,
    min: -100,
    max: 100,
  }),
});

export interface RelationshipState {
  values: Record<string, number>;
}

export type RelationshipStore = Record<string, RelationshipState>;

export type NarrativeEffectScope = 'game' | 'visit';

export interface NarrativeEffectSource {
  guestId: string;
  eventId: string;
  optionId?: string;
  visitId?: string;
}

export interface RelationshipChangeEffect {
  id: string;
  type: 'relationship.change';
  target: 'self' | string;
  axis?: string;
  amount: number;
}

export type NarrativeEffect = RelationshipChangeEffect;

export interface NarrativeTransaction {
  id: string;
  scope: NarrativeEffectScope;
  source: NarrativeEffectSource;
  effects: readonly NarrativeEffect[];
}

export interface AppliedRelationshipChange {
  type: 'relationship.change';
  effectId: string;
  targetId: string;
  axis: string;
  requestedAmount: number;
  before: number;
  after: number;
  appliedAmount: number;
}

export type AppliedNarrativeChange = AppliedRelationshipChange;

export interface NarrativeTransactionReceipt {
  id: string;
  scope: NarrativeEffectScope;
  source: NarrativeEffectSource;
  changes: readonly AppliedNarrativeChange[];
}

export interface NarrativeEffectsState {
  relationships: RelationshipStore;
  appliedTransactions: Record<string, NarrativeTransactionReceipt>;
  completedEvents: Record<string, true>;
  selectedOptions: Record<string, true>;
}

export interface ApplyNarrativeTransactionResult {
  nextState: NarrativeEffectsState;
  receipt: NarrativeTransactionReceipt;
  applied: boolean;
}

export interface NarrativeTransactionIdentity {
  scope: NarrativeEffectScope;
  source: NarrativeEffectSource;
}

export type CreateNarrativeTransactionInput = Omit<NarrativeTransaction, 'id'>;

export function createInitialNarrativeEffectsState(): NarrativeEffectsState {
  return {
    relationships: {},
    appliedTransactions: {},
    completedEvents: {},
    selectedOptions: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hydrateTrueRecord(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, enabled]) => enabled === true),
  ) as Record<string, true>;
}

function hydrateRelationships(value: unknown): RelationshipStore {
  if (!isRecord(value)) {
    return {};
  }

  const relationships: RelationshipStore = {};
  Object.entries(value).forEach(([targetId, rawState]) => {
    if (!targetId.trim() || !isRecord(rawState)) {
      return;
    }

    const rawValues = isRecord(rawState.values) ? rawState.values : {};
    const values = Object.fromEntries(
      Object.entries(rawValues).filter(
        ([axis, score]) => axis.trim() && typeof score === 'number' && Number.isFinite(score),
      ),
    ) as Record<string, number>;
    relationships[targetId] = { values };
  });
  return relationships;
}

function isNarrativeTransactionReceipt(value: unknown): value is NarrativeTransactionReceipt {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return false;
  }
  if (value.scope !== 'game' && value.scope !== 'visit') {
    return false;
  }
  if (!isRecord(value.source) || typeof value.source.guestId !== 'string' || typeof value.source.eventId !== 'string') {
    return false;
  }
  if (
    value.source.optionId !== undefined &&
    (typeof value.source.optionId !== 'string' || !value.source.optionId.trim())
  ) {
    return false;
  }
  if (
    value.scope === 'visit' &&
    (typeof value.source.visitId !== 'string' || !value.source.visitId.trim())
  ) {
    return false;
  }
  return Array.isArray(value.changes);
}

export function hydrateNarrativeEffectsState(value: unknown): NarrativeEffectsState {
  if (!isRecord(value)) {
    return createInitialNarrativeEffectsState();
  }

  const appliedTransactions: Record<string, NarrativeTransactionReceipt> = {};
  if (isRecord(value.appliedTransactions)) {
    Object.entries(value.appliedTransactions).forEach(([transactionId, receipt]) => {
      if (isNarrativeTransactionReceipt(receipt) && receipt.id === transactionId) {
        appliedTransactions[transactionId] = receipt;
      }
    });
  }

  const completedEvents = hydrateTrueRecord(value.completedEvents);
  const selectedOptions = hydrateTrueRecord(value.selectedOptions);
  Object.entries(appliedTransactions).forEach(([transactionId, receipt]) => {
    if (receipt.source.optionId) {
      selectedOptions[transactionId] = true;
    } else {
      completedEvents[transactionId] = true;
    }
  });

  return {
    relationships: hydrateRelationships(value.relationships),
    appliedTransactions,
    completedEvents,
    selectedOptions,
  };
}

function requireNonEmptyString(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`[narrativeEffects] ${label} must be a non-empty string`);
  }
  return normalized;
}

function requireFiniteNumber(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`[narrativeEffects] ${label} must be a finite number`);
  }
  return value;
}

function normalizeAxisDefinition(
  axis: string,
  registry: RelationshipAxisRegistry,
): Readonly<RelationshipAxisDefinition> {
  const definition = registry[axis];
  if (!definition) {
    throw new Error(`[narrativeEffects] unknown relationship axis "${axis}"`);
  }

  const min = requireFiniteNumber(definition.min, `axis ${axis}.min`);
  const max = requireFiniteNumber(definition.max, `axis ${axis}.max`);
  const initial = requireFiniteNumber(definition.initial, `axis ${axis}.initial`);
  if (min > max) {
    throw new Error(`[narrativeEffects] axis ${axis}.min cannot exceed max`);
  }
  if (initial < min || initial > max) {
    throw new Error(`[narrativeEffects] axis ${axis}.initial must be within its bounds`);
  }

  return definition;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function encodeIdentityPart(value: string) {
  return encodeURIComponent(value);
}

export function buildNarrativeTransactionId({
  scope,
  source,
}: NarrativeTransactionIdentity): string {
  const guestId = requireNonEmptyString(source.guestId, 'source.guestId');
  const eventId = requireNonEmptyString(source.eventId, 'source.eventId');
  const optionPart = source.optionId !== undefined
    ? `/option/${encodeIdentityPart(requireNonEmptyString(source.optionId, 'source.optionId'))}`
    : '';

  if (scope === 'visit') {
    const visitId = requireNonEmptyString(source.visitId || '', 'source.visitId for visit scope');
    return `visit/${encodeIdentityPart(visitId)}/${encodeIdentityPart(guestId)}/${encodeIdentityPart(eventId)}${optionPart}`;
  }

  return `game/${encodeIdentityPart(guestId)}/${encodeIdentityPart(eventId)}${optionPart}`;
}

export function createNarrativeTransaction(
  input: CreateNarrativeTransactionInput,
): NarrativeTransaction {
  return {
    ...input,
    id: buildNarrativeTransactionId(input),
  };
}

export function getRelationshipValue(
  state: NarrativeEffectsState,
  targetId: string,
  axis = DEFAULT_RELATIONSHIP_AXIS_ID,
  registry: RelationshipAxisRegistry = DEFAULT_RELATIONSHIP_AXES,
): number {
  const normalizedTargetId = requireNonEmptyString(targetId, 'relationship target');
  const normalizedAxis = requireNonEmptyString(axis, 'relationship axis');
  const definition = normalizeAxisDefinition(normalizedAxis, registry);
  const storedValue = state.relationships[normalizedTargetId]?.values[normalizedAxis];

  if (storedValue === undefined) {
    return definition.initial;
  }

  return clamp(
    requireFiniteNumber(storedValue, `relationship ${normalizedTargetId}.${normalizedAxis}`),
    definition.min,
    definition.max,
  );
}

function assertTransaction(transaction: NarrativeTransaction) {
  requireNonEmptyString(transaction.id, 'transaction.id');
  requireNonEmptyString(transaction.source.guestId, 'source.guestId');
  requireNonEmptyString(transaction.source.eventId, 'source.eventId');
  if (transaction.scope !== 'game' && transaction.scope !== 'visit') {
    throw new Error('[narrativeEffects] transaction.scope must be "game" or "visit"');
  }
  if (transaction.source.optionId !== undefined) {
    requireNonEmptyString(transaction.source.optionId, 'source.optionId');
  }
  if (transaction.scope === 'visit') {
    requireNonEmptyString(transaction.source.visitId || '', 'source.visitId for visit scope');
  }

  const effectIds = new Set<string>();
  transaction.effects.forEach(effect => {
    const effectId = requireNonEmptyString(effect.id, 'effect.id');
    if (effectIds.has(effectId)) {
      throw new Error(`[narrativeEffects] duplicate effect id "${effectId}" in transaction`);
    }
    effectIds.add(effectId);
    requireFiniteNumber(effect.amount, `effect ${effectId}.amount`);
  });
}

function resolveRelationshipTarget(effect: RelationshipChangeEffect, source: NarrativeEffectSource) {
  return effect.target === 'self'
    ? requireNonEmptyString(source.guestId, 'source.guestId')
    : requireNonEmptyString(effect.target, `effect ${effect.id}.target`);
}

export function applyNarrativeTransaction(
  state: NarrativeEffectsState,
  transaction: NarrativeTransaction,
  registry: RelationshipAxisRegistry = DEFAULT_RELATIONSHIP_AXES,
): ApplyNarrativeTransactionResult {
  assertTransaction(transaction);

  const existingReceipt = state.appliedTransactions[transaction.id];
  if (existingReceipt) {
    return {
      nextState: state,
      receipt: existingReceipt,
      applied: false,
    };
  }

  const nextRelationships: RelationshipStore = { ...state.relationships };
  const copiedTargets = new Set<string>();
  const changes: AppliedNarrativeChange[] = [];

  transaction.effects.forEach(effect => {
    switch (effect.type) {
      case 'relationship.change': {
        const targetId = resolveRelationshipTarget(effect, transaction.source);
        const axis = requireNonEmptyString(
          effect.axis ?? DEFAULT_RELATIONSHIP_AXIS_ID,
          `effect ${effect.id}.axis`,
        );
        const definition = normalizeAxisDefinition(axis, registry);
        const existingTarget = nextRelationships[targetId];

        if (!copiedTargets.has(targetId)) {
          nextRelationships[targetId] = {
            values: { ...(existingTarget?.values || {}) },
          };
          copiedTargets.add(targetId);
        }

        const before = getRelationshipValue(
          {
            relationships: nextRelationships,
            appliedTransactions: state.appliedTransactions,
            completedEvents: state.completedEvents,
            selectedOptions: state.selectedOptions,
          },
          targetId,
          axis,
          registry,
        );
        const after = clamp(before + effect.amount, definition.min, definition.max);
        nextRelationships[targetId]!.values[axis] = after;
        changes.push({
          type: effect.type,
          effectId: effect.id,
          targetId,
          axis,
          requestedAmount: effect.amount,
          before,
          after,
          appliedAmount: after - before,
        });
        break;
      }
      default: {
        const unsupported = effect as { type?: unknown };
        throw new Error(`[narrativeEffects] unsupported effect: ${String(unsupported.type)}`);
      }
    }
  });

  const receipt: NarrativeTransactionReceipt = {
    id: transaction.id,
    scope: transaction.scope,
    source: { ...transaction.source },
    changes,
  };

  const completedEvents = transaction.source.optionId
    ? state.completedEvents
    : { ...state.completedEvents, [transaction.id]: true as const };
  const selectedOptions = transaction.source.optionId
    ? { ...state.selectedOptions, [transaction.id]: true as const }
    : state.selectedOptions;

  return {
    nextState: {
      relationships: nextRelationships,
      appliedTransactions: {
        ...state.appliedTransactions,
        [transaction.id]: receipt,
      },
      completedEvents,
      selectedOptions,
    },
    receipt,
    applied: true,
  };
}
