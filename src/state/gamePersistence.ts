import type { DailyGuestRecord, DailySummary, JournalReward } from '../types/journal';
import {
  PERSISTED_GAME_SNAPSHOT_VERSION,
  assertGameRootStateValue,
  hydrateCurrentGuestRuntime,
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

type PersistedGameContextV1 = Omit<GameContext, 'npcDialogue' | 'currentGuest'> & {
  currentGuest?: Partial<CurrentGuestRuntime>;
};

interface PersistedGameSnapshotV1 {
  version: 1;
  state: string;
  context: PersistedGameContextV1;
}

type PersistedGameContextV2 = Omit<GameContext, 'npcDialogue' | 'currentGuest'> & {
  currentGuest?: Partial<CurrentGuestRuntime>;
  npcDialogue?: Partial<NpcDialogueRuntime>;
};

interface PersistedGameSnapshotV2 {
  version: 2;
  state: string;
  context: PersistedGameContextV2;
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

function isPersistedGameSnapshotV3(value: unknown): value is PersistedGameSnapshot {
  if (
    !isRecord(value) ||
    value.version !== PERSISTED_GAME_SNAPSHOT_VERSION ||
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

function migratePersistedSnapshotV1(data: PersistedGameSnapshotV1): PersistedGameSnapshot {
  return {
    version: PERSISTED_GAME_SNAPSHOT_VERSION,
    state: assertGameRootStateValue(data.state),
    context: {
      ...data.context,
      currentGuest: hydrateCurrentGuestRuntime(data.context.currentGuest),
      npcDialogue: hydrateNpcDialogueRuntime(),
    },
  };
}

function migratePersistedSnapshotV2(data: PersistedGameSnapshotV2): PersistedGameSnapshot {
  return {
    version: PERSISTED_GAME_SNAPSHOT_VERSION,
    state: assertGameRootStateValue(data.state),
    context: {
      ...data.context,
      currentGuest: hydrateCurrentGuestRuntime(data.context.currentGuest),
      npcDialogue: hydrateNpcDialogueRuntime(data.context.npcDialogue),
    },
  };
}

function migrateLegacySaveData(data: LegacySaveData): PersistedGameSnapshot {
  return {
    version: PERSISTED_GAME_SNAPSHOT_VERSION,
    state: legacyPhaseToState(data.phase, data.showObservation),
    context: {
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
    },
  };
}

export function normalizePersistedSnapshotData(data: unknown): PersistedGameSnapshot {
  if (isPersistedGameSnapshotV3(data)) {
    return data;
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
