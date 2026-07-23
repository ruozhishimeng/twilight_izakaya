import type { DailyGuestRecord, DailySummary, JournalReward } from '../types/journal';
import {
  PERSISTED_GAME_SNAPSHOT_VERSION,
  assertGameRootStateValue,
  hydrateCurrentGuestRuntime,
  hydrateGameContext,
  hydrateNpcDialogueRuntime,
  isGameRootStateValue,
  legacyPhaseToState,
  type CurrentGuestRuntime,
  type GameContext,
  type GamePhase,
  type GuestReflectionState,
  type NpcDialogueRuntime,
  type PersistedGameSnapshot,
} from './gameState';

interface LegacySaveData {
  phase: GamePhase;
  currentWeek: number;
  currentDay: number;
  currentGuestInDay: number;
  characterProgress: Record<string, number>;
  characterObservations?: Record<string, string[]>;
  discoveredFeatures: string[];
  unlockedRecipes: string[];
  inventory: string[];
  isSuccess: boolean;
  currentNodeId: string | null;
  showObservation: boolean;
  observationPrompt: string;
  observationContinueNode: string | null;
  availableFeatureGroups: string[] | undefined;
  isMixing: boolean;
  mixedDrinkName: string | undefined;
  teachingNodeId: string | null;
  mixingNodeId: string | null;
  currentGuestRewards?: JournalReward[];
  currentGuestDrinkLabel?: string;
  currentGuestChallenges?: string[];
  currentDayRecords?: DailyGuestRecord[];
  journalHistory?: DailySummary[];
  pendingStoryUnlocks?: Record<string, Array<{
    chapterId: string;
    reason?: string;
    sourceNodeId?: string;
  }>>;
  unlockedStoryChapters?: Record<string, string[]>;
  pendingDaySummary?: DailySummary | null;
  pendingGuestReflection?: GuestReflectionState | null;
  currentGuestTranscript?: Array<{
    key: string;
    speaker: string;
    text: string;
  }>;
}

type PersistedGameContextV1 = Omit<
  GameContext,
  'npcDialogue' | 'currentGuest' | 'narrativeEffects'
> & {
  currentGuest?: Partial<CurrentGuestRuntime>;
};

interface PersistedGameSnapshotV1 {
  version: 1;
  state: string;
  context: PersistedGameContextV1;
}

type PersistedGameContextV2 = Omit<
  GameContext,
  'npcDialogue' | 'currentGuest' | 'narrativeEffects'
> & {
  currentGuest?: Partial<CurrentGuestRuntime>;
  npcDialogue?: Partial<NpcDialogueRuntime>;
};

interface PersistedGameSnapshotV2 {
  version: 2;
  state: string;
  context: PersistedGameContextV2;
}

type PersistedGameContextV3 = Omit<GameContext, 'narrativeEffects'>;

interface PersistedGameSnapshotV3 {
  version: 3;
  state: string;
  context: PersistedGameContextV3;
}

interface PersistedGameSnapshotV4Input {
  version: 4;
  state: string;
  context: Record<string, unknown>;
}

interface PersistedGameSnapshotV5Input {
  version: 5;
  state: string;
  context: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isLegacySaveData(value: unknown): value is LegacySaveData {
  return isRecord(value) && 'phase' in value && 'currentWeek' in value;
}

function isPersistedGameSnapshotV1(value: unknown): value is PersistedGameSnapshotV1 {
  if (!isRecord(value) || value.version !== 1 || !('state' in value) || !('context' in value)) {
    return false;
  }

  return typeof value.state === 'string' && isRecord(value.context);
}

function isPersistedGameSnapshotV2(value: unknown): value is PersistedGameSnapshotV2 {
  if (
    !isRecord(value) ||
    value.version !== 2 ||
    !('state' in value) ||
    !('context' in value)
  ) {
    return false;
  }

  return typeof value.state === 'string' && isRecord(value.context);
}

function isPersistedGameSnapshotV3(value: unknown): value is PersistedGameSnapshotV3 {
  if (
    !isRecord(value) ||
    value.version !== 3 ||
    !('state' in value) ||
    !('context' in value)
  ) {
    return false;
  }

  return (
    isGameRootStateValue(value.state) &&
    isRecord(value.context) &&
    isRecord(value.context.currentGuest) &&
    isRecord(value.context.npcDialogue)
  );
}

function isPersistedGameSnapshotV4(value: unknown): value is PersistedGameSnapshotV4Input {
  if (
    !isRecord(value) ||
    value.version !== 4 ||
    !('state' in value) ||
    !('context' in value)
  ) {
    return false;
  }

  return (
    isGameRootStateValue(value.state) &&
    isRecord(value.context) &&
    isRecord(value.context.currentGuest) &&
    isRecord(value.context.npcDialogue)
  );
}

function isPersistedGameSnapshotV5(value: unknown): value is PersistedGameSnapshotV5Input {
  return isRecord(value) && value.version === PERSISTED_GAME_SNAPSHOT_VERSION &&
    typeof value.state === 'string' && isGameRootStateValue(value.state) &&
    isRecord(value.context) && isRecord(value.context.currentGuest) && isRecord(value.context.npcDialogue);
}

function migratePersistedSnapshotV1(data: PersistedGameSnapshotV1): PersistedGameSnapshot {
  return {
    version: PERSISTED_GAME_SNAPSHOT_VERSION,
    state: assertGameRootStateValue(data.state),
    context: hydrateGameContext({
      ...data.context,
      currentGuest: hydrateCurrentGuestRuntime(data.context.currentGuest),
      npcDialogue: hydrateNpcDialogueRuntime(),
    }),
  };
}

function migratePersistedSnapshotV2(data: PersistedGameSnapshotV2): PersistedGameSnapshot {
  return {
    version: PERSISTED_GAME_SNAPSHOT_VERSION,
    state: assertGameRootStateValue(data.state),
    context: hydrateGameContext({
      ...data.context,
      currentGuest: hydrateCurrentGuestRuntime(data.context.currentGuest),
      npcDialogue: hydrateNpcDialogueRuntime(data.context.npcDialogue),
    }),
  };
}

function migratePersistedSnapshotV3(data: PersistedGameSnapshotV3): PersistedGameSnapshot {
  return {
    version: PERSISTED_GAME_SNAPSHOT_VERSION,
    state: assertGameRootStateValue(data.state),
    context: hydrateGameContext(data.context),
  };
}

function migratePersistedSnapshotV4(data: PersistedGameSnapshotV4Input): PersistedGameSnapshot {
  return {
    version: PERSISTED_GAME_SNAPSHOT_VERSION,
    state: assertGameRootStateValue(data.state),
    context: hydrateGameContext(data.context as Partial<GameContext>),
  };
}

function normalizePersistedSnapshotV5(data: PersistedGameSnapshotV5Input): PersistedGameSnapshot {
  return {
    version: PERSISTED_GAME_SNAPSHOT_VERSION,
    state: assertGameRootStateValue(data.state),
    context: hydrateGameContext(data.context as Partial<GameContext>),
  };
}

function migrateLegacySaveData(data: LegacySaveData): PersistedGameSnapshot {
  return {
    version: PERSISTED_GAME_SNAPSHOT_VERSION,
    state: legacyPhaseToState(data.phase, data.showObservation),
    context: hydrateGameContext({
      week: data.currentWeek,
      day: data.currentDay,
      guestInDay: data.currentGuestInDay,
      characterProgress: data.characterProgress || {},
      characterObservations: data.characterObservations || {},
      pendingStoryUnlocks: data.pendingStoryUnlocks || {},
      unlockedStoryChapters: data.unlockedStoryChapters || {},
      unlockedRecipes: data.unlockedRecipes || [],
      inventory: data.inventory || [],
      currentDayRecords: data.currentDayRecords || [],
      journalHistory: data.journalHistory || [],
      pendingDaySummary: data.pendingDaySummary || null,
      pendingGuestReflection: data.pendingGuestReflection || null,
      guestInterludeText: undefined,
      npcDialogue: hydrateNpcDialogueRuntime(),
      currentGuest: hydrateCurrentGuestRuntime({
        nodeId: data.currentNodeId,
        discoveredFeatures: data.discoveredFeatures || [],
        teachingNodeId: data.teachingNodeId,
        mixingNodeId: data.mixingNodeId,
        observationRequest: data.showObservation
          ? {
              prompt: data.observationPrompt || '',
              continueNodeId: data.observationContinueNode,
              featureGroups: data.availableFeatureGroups,
            }
          : null,
        isSuccess: data.isSuccess || false,
        mixedDrinkName: data.mixedDrinkName,
        rewards: data.currentGuestRewards || [],
        drinkLabel: data.currentGuestDrinkLabel,
        challenges: data.currentGuestChallenges || [],
        transcript: data.currentGuestTranscript || [],
      }),
    }),
  };
}

export function normalizePersistedSnapshotData(data: unknown): PersistedGameSnapshot {
  if (isPersistedGameSnapshotV5(data)) {
    return normalizePersistedSnapshotV5(data);
  }

  if (isPersistedGameSnapshotV4(data)) {
    return migratePersistedSnapshotV4(data);
  }

  if (isPersistedGameSnapshotV3(data)) {
    return migratePersistedSnapshotV3(data);
  }

  if (isPersistedGameSnapshotV2(data)) {
    return migratePersistedSnapshotV2(data);
  }

  if (isPersistedGameSnapshotV1(data)) {
    return migratePersistedSnapshotV1(data);
  }

  if (isLegacySaveData(data)) {
    return migrateLegacySaveData(data);
  }

  if (isRecord(data) && 'version' in data) {
    throw new Error(`Unsupported save snapshot version: ${String(data.version)}`);
  }

  throw new Error('Unsupported save format');
}
