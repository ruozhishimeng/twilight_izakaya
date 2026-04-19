import type { DailyGuestRecord, DailySummary, JournalReward } from '../types/journal';
import { assertTransitionState } from './gameTransitions';

export type GamePhase =
  | 'start_screen'
  | 'main_menu'
  | 'intro_sequence'
  | 'intro'
  | 'observation'
  | 'story'
  | 'mixing'
  | 'result'
  | 'day_summary'
  | 'guest_reflection';

export type GameRootStateValue =
  | 'boot'
  | 'startScreen'
  | 'mainMenu'
  | 'introSequence'
  | 'dayLoop.intro'
  | 'dayLoop.guest.story'
  | 'dayLoop.guest.chat'
  | 'dayLoop.guest.observation'
  | 'dayLoop.guest.mixing'
  | 'dayLoop.guest.result'
  | 'dayLoop.guest.reward'
  | 'dayLoop.guest.llmChatLobby'
  | 'dayLoop.guest.llmChatSession'
  | 'dayLoop.guest.reflection'
  | 'dayLoop.daySummary';

export const GAME_ROOT_STATE_VALUES = [
  'boot',
  'startScreen',
  'mainMenu',
  'introSequence',
  'dayLoop.intro',
  'dayLoop.guest.story',
  'dayLoop.guest.chat',
  'dayLoop.guest.observation',
  'dayLoop.guest.mixing',
  'dayLoop.guest.result',
  'dayLoop.guest.reward',
  'dayLoop.guest.llmChatLobby',
  'dayLoop.guest.llmChatSession',
  'dayLoop.guest.reflection',
  'dayLoop.daySummary',
] as const satisfies readonly GameRootStateValue[];

export interface StoryUnlockEntry {
  chapterId: string;
  reason?: string;
  sourceNodeId?: string;
}

export interface GuestTranscriptEntry {
  key: string;
  speaker: string;
  text: string;
}

export interface ObservationRequest {
  prompt: string;
  continueNodeId: string | null;
  featureGroups?: string[];
}

export interface GuestReflectionState {
  text: string;
  sameDay: boolean;
  nextWeek: number;
  nextDay: number;
  nextGuestInDay: number;
  nextDayRecords: DailyGuestRecord[];
  daySummary: DailySummary | null;
}

export interface TailChatRuntime {
  enabled: boolean;
  turnsUsed: number;
  maxTurns: number;
  entryStatusText: string;
  blockedMessage: string;
  exhaustedMessage: string;
  resumeNodeId: string | null;
}

export interface LastDrinkResult {
  label?: string;
  mixedDrinkName?: string;
  isSuccess: boolean;
  sourceNodeId?: string | null;
}

export interface NpcDialogueRuntime {
  status: 'idle' | 'requesting' | 'error';
  errorMessage: string | null;
  turnCount: number;
  lastReplyLines: string[];
}

export interface CurrentGuestRuntime {
  nodeId: string | null;
  returnNodeId: string | null;
  rewardReturnState: 'story' | 'chat' | null;
  discoveredFeatures: string[];
  teachingNodeId: string | null;
  mixingNodeId: string | null;
  observationRequest: ObservationRequest | null;
  pendingRewards: JournalReward[];
  pendingRewardNewIds: string[];
  pendingMixingRetry: boolean;
  mixingPromptOverride?: string;
  isSuccess: boolean;
  mixedDrinkName?: string;
  isNewRecipe: boolean;
  rewards: JournalReward[];
  drinkLabel?: string;
  challenges: string[];
  transcript: GuestTranscriptEntry[];
  tailChat: TailChatRuntime;
  lastDrinkResult: LastDrinkResult | null;
}

export interface GameContext {
  week: number;
  day: number;
  guestInDay: number;
  characterProgress: Record<string, number>;
  characterObservations: Record<string, string[]>;
  pendingStoryUnlocks: Record<string, StoryUnlockEntry[]>;
  unlockedStoryChapters: Record<string, string[]>;
  unlockedRecipes: string[];
  inventory: string[];
  currentDayRecords: DailyGuestRecord[];
  journalHistory: DailySummary[];
  pendingDaySummary: DailySummary | null;
  pendingGuestReflection: GuestReflectionState | null;
  guestInterludeText?: string;
  currentGuest: CurrentGuestRuntime;
  npcDialogue: NpcDialogueRuntime;
}

export interface GameSnapshot {
  value: GameRootStateValue;
  context: GameContext;
}

export interface PersistedGameSnapshot {
  version: number;
  state: GameRootStateValue;
  context: GameContext;
}

export type GameEvent =
  | { type: 'TRANSITION'; value: GameRootStateValue }
  | { type: 'RESET'; value?: GameRootStateValue }
  | { type: 'LOAD'; snapshot: GameSnapshot }
  | { type: 'PATCH_CONTEXT'; patch: Partial<GameContext> }
  | { type: 'PATCH_CURRENT_GUEST'; patch: Partial<CurrentGuestRuntime> }
  | { type: 'RESET_CURRENT_GUEST' }
  | { type: 'PATCH_NPC_DIALOGUE'; patch: Partial<NpcDialogueRuntime> };

export const PERSISTED_GAME_SNAPSHOT_VERSION = 3;

export function isGameRootStateValue(value: unknown): value is GameRootStateValue {
  return typeof value === 'string' && GAME_ROOT_STATE_VALUES.includes(value as GameRootStateValue);
}

export function assertGameRootStateValue(value: unknown): GameRootStateValue {
  if (isGameRootStateValue(value)) {
    return value;
  }

  throw new Error(`[gameState] unsupported root state: ${String(value)}`);
}

export function createInitialTailChatRuntime(): TailChatRuntime {
  return {
    enabled: true,
    turnsUsed: 0,
    maxTurns: 3,
    entryStatusText: '不说话可太无聊了……',
    blockedMessage: '现在还是不太适合聊天……',
    exhaustedMessage: '聊得够多了……',
    resumeNodeId: null,
  };
}

function deriveLastDrinkResultFromCurrentGuest(
  currentGuest?: Partial<CurrentGuestRuntime>,
): LastDrinkResult | null {
  if (!currentGuest) {
    return null;
  }

  const label = typeof currentGuest.drinkLabel === 'string' ? currentGuest.drinkLabel.trim() : '';
  const mixedDrinkName =
    typeof currentGuest.mixedDrinkName === 'string' ? currentGuest.mixedDrinkName.trim() : '';

  if (!label && !mixedDrinkName) {
    return null;
  }

  return {
    label: label || mixedDrinkName || undefined,
    mixedDrinkName: mixedDrinkName || undefined,
    isSuccess: Boolean(currentGuest.isSuccess),
    sourceNodeId: currentGuest.mixingNodeId ?? null,
  };
}

export function createEmptyCurrentGuestRuntime(): CurrentGuestRuntime {
  return {
    nodeId: null,
    returnNodeId: null,
    rewardReturnState: null,
    discoveredFeatures: [],
    teachingNodeId: null,
    mixingNodeId: null,
    observationRequest: null,
    pendingRewards: [],
    pendingRewardNewIds: [],
    pendingMixingRetry: false,
    mixingPromptOverride: undefined,
    isSuccess: false,
    mixedDrinkName: undefined,
    isNewRecipe: false,
    rewards: [],
    drinkLabel: undefined,
    challenges: [],
    transcript: [],
    tailChat: createInitialTailChatRuntime(),
    lastDrinkResult: null,
  };
}

export function createInitialNpcDialogueRuntime(): NpcDialogueRuntime {
  return {
    status: 'idle',
    errorMessage: null,
    turnCount: 0,
    lastReplyLines: [],
  };
}

export function hydrateCurrentGuestRuntime(
  currentGuest?: Partial<CurrentGuestRuntime>,
): CurrentGuestRuntime {
  const base = createEmptyCurrentGuestRuntime();
  const next = currentGuest || {};

  return {
    ...base,
    ...next,
    discoveredFeatures: Array.isArray(next.discoveredFeatures) ? next.discoveredFeatures : base.discoveredFeatures,
    pendingRewards: Array.isArray(next.pendingRewards) ? next.pendingRewards : base.pendingRewards,
    pendingRewardNewIds: Array.isArray(next.pendingRewardNewIds) ? next.pendingRewardNewIds : base.pendingRewardNewIds,
    rewards: Array.isArray(next.rewards) ? next.rewards : base.rewards,
    challenges: Array.isArray(next.challenges) ? next.challenges : base.challenges,
    transcript: Array.isArray(next.transcript) ? next.transcript : base.transcript,
    tailChat: {
      ...base.tailChat,
      ...(next.tailChat || {}),
    },
    lastDrinkResult: next.lastDrinkResult || deriveLastDrinkResultFromCurrentGuest(next),
  };
}

export function hydrateNpcDialogueRuntime(
  npcDialogue?: Partial<NpcDialogueRuntime>,
): NpcDialogueRuntime {
  const base = createInitialNpcDialogueRuntime();
  const next = npcDialogue || {};

  return {
    ...base,
    ...next,
    lastReplyLines: Array.isArray(next.lastReplyLines) ? next.lastReplyLines : base.lastReplyLines,
  };
}

export function hydrateGameContext(context: GameContext): GameContext {
  return {
    ...context,
    currentGuest: hydrateCurrentGuestRuntime(context.currentGuest),
    npcDialogue: hydrateNpcDialogueRuntime(context.npcDialogue),
  };
}

export function createInitialGameContext(): GameContext {
  return {
    week: 1,
    day: 1,
    guestInDay: 1,
    characterProgress: {},
    characterObservations: {},
    pendingStoryUnlocks: {},
    unlockedStoryChapters: {},
    unlockedRecipes: [],
    inventory: [],
    currentDayRecords: [],
    journalHistory: [],
    pendingDaySummary: null,
    pendingGuestReflection: null,
    guestInterludeText: undefined,
    currentGuest: createEmptyCurrentGuestRuntime(),
    npcDialogue: createInitialNpcDialogueRuntime(),
  };
}

export function createInitialGameSnapshot(): GameSnapshot {
  return {
    value: 'boot',
    context: createInitialGameContext(),
  };
}

export function createPersistedSnapshot(snapshot: GameSnapshot): PersistedGameSnapshot {
  return {
    version: PERSISTED_GAME_SNAPSHOT_VERSION,
    state: snapshot.value,
    context: snapshot.context,
  };
}

export function hydrateLoadedGameSnapshot(
  snapshot: PersistedGameSnapshot | GameSnapshot,
): GameSnapshot {
  const state = 'state' in snapshot ? snapshot.state : snapshot.value;

  return {
    value: assertGameRootStateValue(state),
    context: hydrateGameContext(snapshot.context),
  };
}

export function reduceGameEvent(snapshot: GameSnapshot, event: GameEvent): GameSnapshot {
  switch (event.type) {
    case 'TRANSITION':
      assertTransitionState(snapshot.value, event.value);
      return {
        ...snapshot,
        value: event.value,
      };
    case 'RESET':
      return {
        ...createInitialGameSnapshot(),
        value: event.value ?? 'boot',
      };
    case 'LOAD':
      return event.snapshot;
    case 'PATCH_CONTEXT':
      return {
        ...snapshot,
        context: {
          ...snapshot.context,
          ...event.patch,
        },
      };
    case 'PATCH_CURRENT_GUEST':
      return {
        ...snapshot,
        context: {
          ...snapshot.context,
          currentGuest: {
            ...snapshot.context.currentGuest,
            ...event.patch,
            tailChat: event.patch.tailChat
              ? {
                  ...snapshot.context.currentGuest.tailChat,
                  ...event.patch.tailChat,
                }
              : snapshot.context.currentGuest.tailChat,
            lastDrinkResult:
              event.patch.lastDrinkResult === undefined
                ? snapshot.context.currentGuest.lastDrinkResult
                : event.patch.lastDrinkResult,
          },
        },
      };
    case 'RESET_CURRENT_GUEST':
      return {
        ...snapshot,
        context: {
          ...snapshot.context,
          currentGuest: createEmptyCurrentGuestRuntime(),
          npcDialogue: createInitialNpcDialogueRuntime(),
        },
      };
    case 'PATCH_NPC_DIALOGUE':
      return {
        ...snapshot,
        context: {
          ...snapshot.context,
          npcDialogue: {
            ...snapshot.context.npcDialogue,
            ...event.patch,
          },
        },
      };
    default:
      return snapshot;
  }
}

export function toGamePhase(state: GameRootStateValue): GamePhase {
  switch (state) {
    case 'boot':
    case 'startScreen':
      return 'start_screen';
    case 'mainMenu':
      return 'main_menu';
    case 'introSequence':
      return 'intro_sequence';
    case 'dayLoop.intro':
      return 'intro';
    case 'dayLoop.guest.observation':
      return 'observation';
    case 'dayLoop.guest.story':
    case 'dayLoop.guest.chat':
    case 'dayLoop.guest.reward':
      return 'story';
    case 'dayLoop.guest.mixing':
      return 'mixing';
    case 'dayLoop.guest.result':
      return 'result';
    case 'dayLoop.guest.llmChatLobby':
    case 'dayLoop.guest.llmChatSession':
      return 'story';
    case 'dayLoop.daySummary':
      return 'day_summary';
    case 'dayLoop.guest.reflection':
      return 'guest_reflection';
    default:
      return 'start_screen';
  }
}

export function legacyPhaseToState(phase: GamePhase, showObservation = false): GameRootStateValue {
  if (showObservation) {
    return 'dayLoop.guest.observation';
  }

  switch (phase) {
    case 'start_screen':
      return 'startScreen';
    case 'main_menu':
      return 'mainMenu';
    case 'intro_sequence':
      return 'introSequence';
    case 'intro':
      return 'dayLoop.intro';
    case 'observation':
      return 'dayLoop.guest.observation';
    case 'story':
      return 'dayLoop.guest.story';
    case 'mixing':
      return 'dayLoop.guest.mixing';
    case 'result':
      return 'dayLoop.guest.result';
    case 'day_summary':
      return 'dayLoop.daySummary';
    case 'guest_reflection':
      return 'dayLoop.guest.reflection';
    default:
      return 'startScreen';
  }
}
