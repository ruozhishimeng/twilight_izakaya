import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CharacterNode, NodePlayerOption } from '../data/content/types';
import {
  getMixingRequest,
  isMixingExit,
  resolveNodeExit,
} from '../data/content/narrative';
import {
  compileNodeCompletionNarrativeTransaction,
  compileOptionNarrativeTransaction,
} from '../data/content/effects';
import type { NarrativeTransaction } from '../state/narrativeEffects';
import {
  contentRegistry,
  findNodeForGuest,
  getGuestsForDay,
  resolveLlmChatConfigForGuest,
} from '../data/gameData';
import {
  DAYS_PER_WEEK,
  buildDailyGuestRecord,
  findScheduledVisit,
  findTeachingNodeForMixing,
  formatMixedDrinkLabel,
  normalizeStoryUnlockEntries,
  resolveGuestNode,
  type ScheduledVisit,
} from '../app/flowHelpers';
import {
  resolveMixingOutcomeNode,
  shouldRetryMixingFailure,
} from '../app/narrativeRouting';
import { selectGameRuntimeView } from '../state/gameSelectors';
import {
  toGamePhase,
  type GameContext,
  type GameRootStateValue,
  type GameSnapshot,
  type GuestReflectionState,
  type GuestTranscriptEntry,
  type StoryUnlockEntry,
  type TailChatResume,
} from '../state/gameState';
import type { JournalReward } from '../types/journal';
import { requestNpcDialogue } from '../services/npcDialogue';
import {
  NpcDialogueRequestCoordinator,
  canInteractWithTailChat,
} from '../services/npcDialogueSession';
import { buildDialogueProgressSnapshot } from '../state/dialogueProgress';
import type { DialogueTurnDiagnostics } from '../types/npcDialogue';

interface GameMachineController {
  snapshot: GameSnapshot;
  transition: (value: GameRootStateValue) => void;
  debugJumpToVisit: (week: number, day: number, guestInDay: number) => void;
  patchContext: (patch: Partial<GameContext>) => void;
  patchCurrentGuest: (patch: Partial<GameContext['currentGuest']>) => void;
  patchNpcDialogue: (patch: Partial<GameContext['npcDialogue']>) => void;
  appendCurrentGuestTranscriptEntries: (entries: GuestTranscriptEntry[]) => void;
  applyNarrativeTransaction: (transaction: NarrativeTransaction) => void;
  resetCurrentGuest: () => void;
}

interface GameFlowControllerOptions {
  closeTranscript?: () => void;
  playSfx?: (soundId: string) => void;
  debugDialogue?: boolean;
}

type MixingCandidate = CharacterNode | null | undefined;
type RewardPayload = {
  details?: JournalReward | JournalReward[];
} | null | undefined;

function mergeUniqueStrings(existing: string[], next: string[]) {
  return [...new Set([...existing, ...next].filter(Boolean))];
}

function weekdayLabel(day: number) {
  return ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'][day - 1] || `第 ${day} 天`;
}

function getNextExitTarget(node: MixingCandidate) {
  if (!node) {
    return null;
  }
  const exit = resolveNodeExit(node);
  return exit.kind === 'next' ? exit.target : null;
}

function asMixingNode(node: MixingCandidate) {
  if (!node) {
    return null;
  }
  return isMixingExit(resolveNodeExit(node)) ? node : null;
}

export function useGameFlowController(
  machine: GameMachineController,
  options: GameFlowControllerOptions = {},
) {
  const {
    snapshot,
    transition,
    debugJumpToVisit,
    patchContext,
    patchCurrentGuest,
    patchNpcDialogue,
    appendCurrentGuestTranscriptEntries,
    applyNarrativeTransaction,
    resetCurrentGuest,
  } = machine;
  const closeTranscript = options.closeTranscript || (() => {});
  const playSfx = options.playSfx || (() => {});
  const requestCoordinatorRef = useRef(new NpcDialogueRequestCoordinator());
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const [dialogueDiagnostics, setDialogueDiagnostics] = useState<DialogueTurnDiagnostics | null>(null);

  const game = snapshot.context;
  const currentPhase = toGamePhase(snapshot.value);
  const runtime = useMemo(() => selectGameRuntimeView(snapshot), [snapshot]);
  const {
    guest,
    currentGuestData,
    startNodeId,
    currentNode,
    teachingNode,
    mixingNode,
    availableChatNodes,
    canShowTranscriptButton,
    activeAudioNode,
  } = runtime;
  const visitId = `W${game.week}:D${game.day}:G${game.guestInDay}:${guest.id}`;

  useEffect(() => {
    if (snapshot.value !== 'dayLoop.guest.llmChatSession') {
      requestCoordinatorRef.current.cancel();
    }
  }, [snapshot.value]);

  useEffect(() => () => requestCoordinatorRef.current.cancel(), []);

  const recordNarrativeOption = useCallback((node: CharacterNode, option: NodePlayerOption) => {
    const eventId = node.event_id || node.id;
    if (!eventId || !option.id) {
      return;
    }

    applyNarrativeTransaction(compileOptionNarrativeTransaction({
      guestId: guest.id,
      eventId,
      option,
      visitId,
    }));
  }, [applyNarrativeTransaction, guest.id, visitId]);

  const recordNarrativeNodeCompletion = useCallback((node: CharacterNode) => {
    const eventId = node.event_id || node.id;
    if (!eventId) {
      return;
    }

    applyNarrativeTransaction(compileNodeCompletionNarrativeTransaction({
      guestId: guest.id,
      eventId,
      node,
      visitId,
    }));
  }, [applyNarrativeTransaction, guest.id, visitId]);

  const appendCurrentGuestChallenge = useCallback((challenge?: string) => {
    const normalized = challenge?.trim();
    if (!normalized || game.currentGuest.challenges.includes(normalized)) {
      return;
    }

    patchCurrentGuest({
      challenges: [...game.currentGuest.challenges, normalized],
    });
  }, [game.currentGuest.challenges, patchCurrentGuest]);

  const queueStoryUnlocks = useCallback((guestIdToUnlock: string, entries: StoryUnlockEntry[]) => {
    if (entries.length === 0) {
      return;
    }

    const existing = game.pendingStoryUnlocks[guestIdToUnlock] || [];
    const next = [...existing];
    entries.forEach(entry => {
      if (!next.some(item => item.chapterId === entry.chapterId)) {
        next.push(entry);
      }
    });

    patchContext({
      pendingStoryUnlocks: {
        ...game.pendingStoryUnlocks,
        [guestIdToUnlock]: next,
      },
    });
  }, [game.pendingStoryUnlocks, patchContext]);

  const commitPendingStoryUnlocks = useCallback(() => {
    const nextUnlocked = { ...game.unlockedStoryChapters };

    Object.entries(game.pendingStoryUnlocks).forEach(([guestIdToUnlock, entries]) => {
      const existing = new Set(nextUnlocked[guestIdToUnlock] || []);
      entries.forEach(entry => existing.add(entry.chapterId));
      nextUnlocked[guestIdToUnlock] = [...existing];
    });

    patchContext({
      unlockedStoryChapters: nextUnlocked,
      pendingStoryUnlocks: {},
    });
  }, [game.pendingStoryUnlocks, game.unlockedStoryChapters, patchContext]);

  const appendCurrentGuestTranscript = useCallback((entry: GuestTranscriptEntry) => {
    appendCurrentGuestTranscriptEntries([entry]);
  }, [appendCurrentGuestTranscriptEntries]);

  const cancelNpcDialogueRequests = useCallback(() => {
    requestCoordinatorRef.current.cancel();
  }, []);

  const jumpToVisit = useCallback((targetVisit: ScheduledVisit) => {
    requestCoordinatorRef.current.cancel();
    patchContext({
      week: targetVisit.week,
      day: targetVisit.day,
      guestInDay: targetVisit.guestInDay,
      currentDayRecords: [],
      pendingDaySummary: null,
      pendingGuestReflection: null,
      guestInterludeText: undefined,
    });
    resetCurrentGuest();
    closeTranscript();
    transition('dayLoop.intro');
  }, [closeTranscript, patchContext, resetCurrentGuest, transition]);

  const debugJump = useCallback(async (week: number, day: number, guestInDay = 1) => {
    requestCoordinatorRef.current.cancel();
    const normalizedWeek = Math.max(1, Math.floor(week) || 1);
    const normalizedDay = Math.min(DAYS_PER_WEEK, Math.max(1, Math.floor(day) || 1));
    const normalizedGuestInDay = Math.max(1, Math.floor(guestInDay) || 1);
    const guestsOnTargetDay = getGuestsForDay(normalizedWeek, normalizedDay);
    const targetVisit =
      guestsOnTargetDay.length > 0
        ? {
            week: normalizedWeek,
            day: normalizedDay,
            guestInDay: Math.min(normalizedGuestInDay, guestsOnTargetDay.length),
            exact: true,
          }
        : (() => {
            const nextVisit = findScheduledVisit(normalizedWeek, normalizedDay, 1, true);
            return nextVisit
              ? {
                  ...nextVisit,
                  exact: nextVisit.week === normalizedWeek && nextVisit.day === normalizedDay,
                }
              : null;
          })();

    if (!targetVisit) {
      return '未找到可跳转的剧情日期。';
    }

    debugJumpToVisit(targetVisit.week, targetVisit.day, targetVisit.guestInDay);
    closeTranscript();
    if (targetVisit.exact) {
      return `已跳转到第 ${targetVisit.week} 周 ${weekdayLabel(targetVisit.day)}。`;
    }

    return `指定日期没有客人，已跳转到最近的第 ${targetVisit.week} 周 ${weekdayLabel(targetVisit.day)}。`;
  }, [closeTranscript, debugJumpToVisit]);

  const finalizeGuestAdvance = useCallback((payload: GuestReflectionState) => {
    requestCoordinatorRef.current.cancel();
    resetCurrentGuest();
    closeTranscript();

    const nextContextPatch: Partial<GameContext> = {
      week: payload.nextWeek,
      day: payload.nextDay,
      guestInDay: payload.nextGuestInDay,
      pendingGuestReflection: null,
      guestInterludeText: payload.sameDay ? '居酒屋仍灯火通明。下一位客人即将到访...' : undefined,
    };

    if (payload.daySummary) {
      commitPendingStoryUnlocks();
      nextContextPatch.pendingDaySummary = payload.daySummary;
      nextContextPatch.journalHistory = [...game.journalHistory, payload.daySummary];
      nextContextPatch.currentDayRecords = [];
    } else {
      nextContextPatch.currentDayRecords = payload.nextDayRecords;
    }

    patchContext(nextContextPatch);
    transition(payload.sameDay ? 'dayLoop.intro' : 'dayLoop.daySummary');
  }, [closeTranscript, commitPendingStoryUnlocks, game.journalHistory, patchContext, resetCurrentGuest, transition]);

  const enterTailChatBeforeNodeEnd = useCallback((
    sourceNode: CharacterNode | null,
    resume: TailChatResume,
  ) => {
    if (!sourceNode || !resume) {
      return;
    }

    const resolvedTailChat = resolveLlmChatConfigForGuest(
      guest.id,
      sourceNode.event_id || sourceNode.id || null,
    );

    patchCurrentGuest({
      tailChat: {
        ...resolvedTailChat,
        turnsUsed: 0,
        resume,
        closed: false,
      },
    });
    patchNpcDialogue({
      status: 'idle',
      errorMessage: null,
      turnCount: 0,
      lastReplyLines: [resolvedTailChat.entryStatusText],
    });
    transition('dayLoop.guest.llmChatLobby');
  }, [guest.id, patchCurrentGuest, patchNpcDialogue, transition]);

  const enterMixing = useCallback((teachingCandidate: MixingCandidate, mixingCandidate: MixingCandidate) => {
    const teachingNextNodeId = getNextExitTarget(teachingCandidate);
    const normalizedMixingNode =
      asMixingNode(mixingCandidate) ||
      (teachingNextNodeId
        ? asMixingNode(findNodeForGuest(teachingNextNodeId, guest.id, guest.nodeMap))
        : null) ||
      asMixingNode(teachingCandidate) ||
      null;
    const normalizedTeachingNode = findTeachingNodeForMixing(
      guest,
      teachingCandidate,
      normalizedMixingNode || mixingCandidate,
    );
    const taughtRecipeId = normalizedTeachingNode?.teaching?.recipe?.id;
    const mixingRequest = normalizedMixingNode
      ? getMixingRequest(resolveNodeExit(normalizedMixingNode))
      : null;

    if (taughtRecipeId && !game.unlockedRecipes.includes(taughtRecipeId)) {
      patchContext({
        unlockedRecipes: [...game.unlockedRecipes, taughtRecipeId],
      });
    }

    appendCurrentGuestChallenge(
      normalizedTeachingNode?.teaching?.recipe?.name
        ? `向${guest.name}学习「${normalizedTeachingNode.teaching.recipe.name}」`
        : mixingRequest?.request_text || mixingRequest?.hint,
    );

    patchCurrentGuest({
      teachingNodeId: normalizedTeachingNode?.event_id || normalizedTeachingNode?.id || null,
      mixingNodeId: normalizedMixingNode?.event_id || normalizedMixingNode?.id || null,
      pendingMixingRetry: false,
      mixingPromptOverride: undefined,
    });
    transition('dayLoop.guest.mixing');
  }, [appendCurrentGuestChallenge, game.unlockedRecipes, guest, patchContext, patchCurrentGuest, transition]);

  const enterObservation = useCallback((trigger: { prompt: string; continue_node: string; feature_groups?: string[] }) => {
    patchCurrentGuest({
      observationRequest: {
        prompt: trigger.prompt,
        continueNodeId: trigger.continue_node || null,
        featureGroups: trigger.feature_groups,
      },
    });
    appendCurrentGuestChallenge(trigger.prompt);
    transition('dayLoop.guest.observation');
  }, [appendCurrentGuestChallenge, patchCurrentGuest, transition]);

  const completeObservation = useCallback((features: string[]) => {
    const normalizedFeatures = [...new Set(features)];
    const nextDiscovered = mergeUniqueStrings(game.currentGuest.discoveredFeatures, normalizedFeatures);
    const existingObserved = game.characterObservations[guest.id] || [];

    patchContext({
      characterObservations: {
        ...game.characterObservations,
        [guest.id]: mergeUniqueStrings(existingObserved, normalizedFeatures),
      },
    });
    patchCurrentGuest({
      discoveredFeatures: nextDiscovered,
      observationRequest: null,
      nodeId: game.currentGuest.observationRequest?.continueNodeId || game.currentGuest.nodeId,
    });
    transition('dayLoop.guest.story');
  }, [
    game.characterObservations,
    game.currentGuest.discoveredFeatures,
    game.currentGuest.nodeId,
    game.currentGuest.observationRequest,
    guest.id,
    patchContext,
    patchCurrentGuest,
    transition,
  ]);

  const rewardGuest = useCallback((reward: RewardPayload) => {
    const rewardDetails = reward?.details
      ? Array.isArray(reward.details)
        ? reward.details
        : [reward.details]
      : [];

    if (rewardDetails.length === 0) {
      return;
    }

    const nextInventory = [...game.inventory];
    const nextUnlockedRecipes = [...game.unlockedRecipes];

    rewardDetails.forEach(detail => {
      if ((detail.type === 'ingredient' || detail.type === 'item') && detail.id && !nextInventory.includes(detail.id)) {
        nextInventory.push(detail.id);
      }
      if (detail.type === 'recipe' && detail.id && !nextUnlockedRecipes.includes(detail.id)) {
        nextUnlockedRecipes.push(detail.id);
      }
    });

    const newRewardIds = rewardDetails
      .filter(detail => {
        if (detail.type === 'recipe') {
          return detail.id && !game.unlockedRecipes.includes(detail.id);
        }
        return detail.id && !game.inventory.includes(detail.id);
      })
      .map(detail => detail.id);

    patchContext({
      inventory: nextInventory,
      unlockedRecipes: nextUnlockedRecipes,
    });
    patchCurrentGuest({
      pendingRewards: rewardDetails,
      pendingRewardNewIds: newRewardIds,
      rewards: [...game.currentGuest.rewards, ...rewardDetails],
      rewardReturnState: snapshot.value === 'dayLoop.guest.chat' ? 'chat' : 'story',
    });
    transition('dayLoop.guest.reward');
  }, [
    game.currentGuest.rewards,
    game.inventory,
    game.unlockedRecipes,
    patchContext,
    patchCurrentGuest,
    snapshot.value,
    transition,
  ]);

  const serveDrink = useCallback((ingredients: string[]) => {
    const teachingNextNodeId = getNextExitTarget(teachingNode);
    const activeMixingNode =
      asMixingNode(mixingNode) ||
      (teachingNextNodeId
        ? asMixingNode(findNodeForGuest(teachingNextNodeId, guest.id, guest.nodeMap))
        : null) ||
      asMixingNode(teachingNode) ||
      null;
    const mixingRequest = activeMixingNode
      ? getMixingRequest(resolveNodeExit(activeMixingNode))
      : null;

    const idealFormula =
      mixingRequest?.preferred_drink?.formula || teachingNode?.teaching?.recipe?.formula || null;
    const expectedFormula = idealFormula ? [...idealFormula].filter(Boolean).sort() : null;
    const actualFormula = [...ingredients].filter(Boolean).sort();
    const success =
      !expectedFormula ||
      (expectedFormula.length === actualFormula.length &&
        expectedFormula.every((id, index) => id === actualFormula[index]));

    let nextUnlockedRecipes = game.unlockedRecipes;
    let mixedDrinkName: string | undefined;
    let isNewRecipe = false;
    let drinkLabel = formatMixedDrinkLabel(ingredients);

    const matchedRecipe = contentRegistry.recipes.recipes.find(recipe => {
      if (!Array.isArray(recipe.formula)) {
        return false;
      }
      const recipeFormula = [...recipe.formula].sort();
      return (
        recipeFormula.length === actualFormula.length &&
        recipeFormula.every((id, index) => id === actualFormula[index])
      );
    });

    if (matchedRecipe) {
      mixedDrinkName = matchedRecipe.name;
      drinkLabel = matchedRecipe.name;
      if (!game.unlockedRecipes.includes(matchedRecipe.id)) {
        nextUnlockedRecipes = [...game.unlockedRecipes, matchedRecipe.id];
        isNewRecipe = true;
      }
    }

    const nextNodeId = resolveMixingOutcomeNode(activeMixingNode, success);
    const shouldRetryMixing = shouldRetryMixingFailure({
      success,
      outcomeNodeId: nextNodeId,
      retryOnFail: mixingRequest?.retry_on_fail,
      isTeaching: Boolean(teachingNode?.teaching),
    });

    if (nextUnlockedRecipes !== game.unlockedRecipes) {
      patchContext({
        unlockedRecipes: nextUnlockedRecipes,
      });
    }

    patchCurrentGuest({
      isSuccess: success,
      nodeId: nextNodeId || null,
      pendingMixingRetry: shouldRetryMixing,
      mixingPromptOverride: shouldRetryMixing
        ? '这杯还不对。再想想客人想要的味道，重新调配一次吧。'
        : undefined,
      mixedDrinkName,
      isNewRecipe,
      drinkLabel,
      lastDrinkResult: {
        recipeId: matchedRecipe?.id ?? null,
        label: drinkLabel,
        mixedDrinkName,
        isSuccess: success,
        sourceNodeId: activeMixingNode?.event_id || activeMixingNode?.id || null,
      },
    });
    transition('dayLoop.guest.result');
  }, [game.unlockedRecipes, guest, mixingNode, patchContext, patchCurrentGuest, teachingNode, transition]);

  const nextGuest = useCallback(() => {
    requestCoordinatorRef.current.cancel();
    const currentStoryNode = resolveGuestNode(guest, game.currentGuest.nodeId);
    const currentDiaryNote = currentStoryNode?.diary_note;
    const currentStoryUnlocks = normalizeStoryUnlockEntries(currentStoryNode);

    if (currentStoryUnlocks.length > 0) {
      queueStoryUnlocks(guest.id, currentStoryUnlocks);
    }

    const completedGuestRecord = buildDailyGuestRecord({
      guest,
      discoveredFeatures: game.currentGuest.discoveredFeatures,
      rewards: game.currentGuest.rewards,
      challenges: game.currentGuest.challenges,
      drinkLabel: game.currentGuest.drinkLabel,
      isSuccess: game.currentGuest.isSuccess,
      mixedDrinkName: game.currentGuest.mixedDrinkName,
      diaryEntry: currentDiaryNote,
    });
    const nextDayRecords = [...game.currentDayRecords, completedGuestRecord];

    if (game.currentGuest.isSuccess) {
      patchContext({
        characterProgress: {
          ...game.characterProgress,
          [guest.id]: (game.characterProgress[guest.id] || 0) + 1,
        },
      });
    }

    const nextVisit = findScheduledVisit(game.week, game.day, game.guestInDay, false);
    const fallbackDay = game.day >= DAYS_PER_WEEK ? 1 : game.day + 1;
    const fallbackWeek = game.day >= DAYS_PER_WEEK ? game.week + 1 : game.week;
    const payload: GuestReflectionState = nextVisit
      ? {
          text: currentDiaryNote || '',
          sameDay: nextVisit.week === game.week && nextVisit.day === game.day,
          nextWeek: nextVisit.week,
          nextDay: nextVisit.day,
          nextGuestInDay: nextVisit.guestInDay,
          nextDayRecords,
          daySummary:
            nextVisit.week === game.week && nextVisit.day === game.day
              ? null
              : {
                  week: game.week,
                  day: game.day,
                  guests: nextDayRecords,
                },
        }
      : {
          text: currentDiaryNote || '',
          sameDay: false,
          nextWeek: fallbackWeek,
          nextDay: fallbackDay,
          nextGuestInDay: 1,
          nextDayRecords,
          daySummary: {
            week: game.week,
            day: game.day,
            guests: nextDayRecords,
          },
        };

    if (currentDiaryNote) {
      patchContext({
        pendingGuestReflection: payload,
      });
      transition('dayLoop.guest.reflection');
      return;
    }

    finalizeGuestAdvance(payload);
  }, [
    finalizeGuestAdvance,
    game.characterProgress,
    game.currentDayRecords,
    game.currentGuest.challenges,
    game.currentGuest.discoveredFeatures,
    game.currentGuest.drinkLabel,
    game.currentGuest.isSuccess,
    game.currentGuest.mixedDrinkName,
    game.currentGuest.nodeId,
    game.currentGuest.rewards,
    game.day,
    game.guestInDay,
    game.week,
    guest,
    patchContext,
    queueStoryUnlocks,
    transition,
  ]);

  const finishTailChatLobby = useCallback(() => {
    requestCoordinatorRef.current.cancel();
    const resume = game.currentGuest.tailChat.resume;

    if (resume?.kind === 'node') {
      patchCurrentGuest({
        nodeId: resume.nodeId,
        tailChat: {
          ...game.currentGuest.tailChat,
          resume: null,
        },
      });
      patchNpcDialogue({
        status: 'idle',
        errorMessage: null,
      });
      transition('dayLoop.guest.story');
      return;
    }

    if (resume?.kind === 'end_visit') {
      patchCurrentGuest({
        tailChat: { ...game.currentGuest.tailChat, resume: null },
      });
      patchNpcDialogue({ status: 'idle', errorMessage: null });
      nextGuest();
      return;
    }

    if (!game.pendingGuestReflection) {
      const currentNode = resolveGuestNode(guest, game.currentGuest.nodeId);
      const nextNodeId = getNextExitTarget(currentNode);
      if (nextNodeId) {
        patchCurrentGuest({
          nodeId: nextNodeId,
        });
        patchNpcDialogue({
          status: 'idle',
          errorMessage: null,
        });
        transition('dayLoop.guest.story');
        return;
      }

      if (game.currentGuest.nodeId) {
        patchNpcDialogue({
          status: 'idle',
          errorMessage: null,
        });
        transition('dayLoop.guest.story');
      }
      return;
    }

    if (game.pendingGuestReflection.text) {
      transition('dayLoop.guest.reflection');
      return;
    }

    finalizeGuestAdvance(game.pendingGuestReflection);
  }, [
    finalizeGuestAdvance,
    game.currentGuest.tailChat,
    game.pendingGuestReflection,
    patchCurrentGuest,
    patchNpcDialogue,
    transition,
  ]);

  const openTailChatSession = useCallback(() => {
    const tailChat = game.currentGuest.tailChat;

    if (!tailChat.enabled) {
      patchNpcDialogue({
        status: 'idle',
        errorMessage: null,
        turnCount: tailChat.turnsUsed,
        lastReplyLines: [tailChat.blockedMessage],
      });
      return;
    }

    if (tailChat.turnsUsed >= tailChat.maxTurns) {
      patchNpcDialogue({
        status: 'idle',
        errorMessage: null,
        turnCount: tailChat.turnsUsed,
        lastReplyLines: [tailChat.exhaustedMessage],
      });
      return;
    }

    if (tailChat.closed) {
      patchNpcDialogue({
        status: 'idle', errorMessage: null, turnCount: tailChat.turnsUsed,
        lastReplyLines: [tailChat.exhaustedMessage],
      });
      return;
    }

    patchNpcDialogue({
      status: 'idle',
      errorMessage: null,
      turnCount: tailChat.turnsUsed,
      lastReplyLines:
        game.npcDialogue.lastReplyLines.length > 0
          ? game.npcDialogue.lastReplyLines
          : [tailChat.entryStatusText],
    });
    transition('dayLoop.guest.llmChatSession');
  }, [game.currentGuest.tailChat, game.npcDialogue.lastReplyLines, patchNpcDialogue, transition]);

  const leaveTailChatSession = useCallback(() => {
    requestCoordinatorRef.current.cancel();
    transition('dayLoop.guest.llmChatLobby');
  }, [transition]);

  const sendTailChatMessage = useCallback(async (rawPlayerText: string) => {
    const playerText = rawPlayerText.trim();
    if (!canInteractWithTailChat({
      state: snapshot.value,
      closed: game.currentGuest.tailChat.closed,
      status: game.npcDialogue.status,
    })) {
      return { ok: false as const };
    }

    if (!playerText) {
      patchNpcDialogue({
        status: 'error',
        errorMessage: '先说点什么吧。',
      });
      return { ok: false as const };
    }

    if (playerText.length > 60) {
      patchNpcDialogue({
        status: 'error',
        errorMessage: '一次最多输入 60 个字。',
      });
      return { ok: false as const };
    }

    if (game.currentGuest.tailChat.turnsUsed >= game.currentGuest.tailChat.maxTurns) {
      patchNpcDialogue({
        status: 'idle',
        errorMessage: null,
        turnCount: game.currentGuest.tailChat.turnsUsed,
        lastReplyLines: [game.currentGuest.tailChat.exhaustedMessage],
      });
      return { ok: false as const };
    }

    const progress = buildDialogueProgressSnapshot({ snapshot, guest, playerText });
    const nextTurnIndex = progress.turnIndex;
    const requestPayload = {
      ...progress,
      state: 'dayLoop.guest.llmChatSession' as const,
      ...(options.debugDialogue === true ? { debug: true } : {}),
    };
    const lease = requestCoordinatorRef.current.begin(visitId);

    patchNpcDialogue({
      status: 'requesting',
      errorMessage: null,
    });
    let response;

    try {
      response = await requestNpcDialogue(requestPayload, { signal: lease.signal });
    } catch (error) {
      if (!requestCoordinatorRef.current.isCurrent(lease) || lease.signal.aborted ||
          (error instanceof Error && error.name === 'AbortError')) {
        return { ok: false as const };
      }
      patchNpcDialogue({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : '本地对话服务暂时不可用。',
      });
      requestCoordinatorRef.current.finish(lease);
      return { ok: false as const };
    }

    const latestSnapshot = snapshotRef.current;
    const latestGuest = selectGameRuntimeView(latestSnapshot).guest;
    const latestVisitId = `W${latestSnapshot.context.week}:D${latestSnapshot.context.day}:G${latestSnapshot.context.guestInDay}:${latestGuest.id}`;
    if (!requestCoordinatorRef.current.isCurrent(lease) || latestGuest.id !== guest.id ||
        latestVisitId !== visitId || latestSnapshot.value !== 'dayLoop.guest.llmChatSession') {
      return { ok: false as const };
    }

    appendCurrentGuestTranscriptEntries([
      { key: `llm-chat:${nextTurnIndex}:player`, speaker: '我', text: playerText },
      ...response.replyLines.map((line, lineIndex) => ({
        key: `llm-chat:${nextTurnIndex}:npc:${lineIndex}`, speaker: guest.name, text: line,
      })),
    ]);

    patchCurrentGuest({
      tailChat: {
        ...latestSnapshot.context.currentGuest.tailChat,
        turnsUsed: nextTurnIndex,
        closed: response.endChat,
      },
    });
    patchNpcDialogue({
      status: 'idle',
      errorMessage: null,
      turnCount: nextTurnIndex,
      lastReplyLines: response.replyLines,
    });
    setDialogueDiagnostics(response.diagnostics || null);
    requestCoordinatorRef.current.finish(lease);
    return {
      ok: true as const,
      playerText,
      replyLines: response.replyLines,
      endChat: response.endChat,
      diagnostics: response.diagnostics,
    };
  }, [
    appendCurrentGuestTranscriptEntries,
    game.currentGuest.tailChat,
    game.npcDialogue.status,
    guest.id,
    guest.name,
    options.debugDialogue,
    patchCurrentGuest,
    patchNpcDialogue,
    snapshot,
    visitId,
  ]);

  const completeConversation = useCallback(() => {
    if (snapshot.value === 'dayLoop.guest.chat' && game.currentGuest.returnNodeId) {
      patchCurrentGuest({
        nodeId: game.currentGuest.returnNodeId,
        returnNodeId: null,
      });
      transition('dayLoop.guest.story');
      return;
    }

    nextGuest();
  }, [game.currentGuest.returnNodeId, nextGuest, patchCurrentGuest, snapshot.value, transition]);

  const continueReward = useCallback(() => {
    const nextState =
      game.currentGuest.rewardReturnState === 'chat' ? 'dayLoop.guest.chat' : 'dayLoop.guest.story';

    patchCurrentGuest({
      pendingRewards: [],
      pendingRewardNewIds: [],
      rewardReturnState: null,
    });
    transition(nextState);
  }, [game.currentGuest.rewardReturnState, patchCurrentGuest, transition]);

  const continueResult = useCallback(() => {
    if (game.currentGuest.pendingMixingRetry) {
      transition('dayLoop.guest.mixing');
      return;
    }

    if (game.currentGuest.nodeId) {
      transition(game.currentGuest.returnNodeId ? 'dayLoop.guest.chat' : 'dayLoop.guest.story');
      return;
    }

    nextGuest();
  }, [
    game.currentGuest.nodeId,
    game.currentGuest.pendingMixingRetry,
    game.currentGuest.returnNodeId,
    nextGuest,
    transition,
  ]);

  const beginGuestArrival = useCallback(() => {
    requestCoordinatorRef.current.cancel();
    if (!startNodeId) {
      return;
    }

    patchContext({
      guestInterludeText: undefined,
      pendingGuestReflection: null,
    });
    resetCurrentGuest();
    patchCurrentGuest({
      nodeId: startNodeId,
    });
    closeTranscript();
    playSfx('door_bell');
    transition('dayLoop.guest.story');
  }, [closeTranscript, patchContext, patchCurrentGuest, playSfx, resetCurrentGuest, startNodeId, transition]);

  const openChat = useCallback(() => {
    const firstChatNode = availableChatNodes[0];
    const chatNodeId = firstChatNode?.event_id || firstChatNode?.id || null;

    if (!chatNodeId || !game.currentGuest.nodeId) {
      return;
    }

    patchCurrentGuest({
      returnNodeId: game.currentGuest.nodeId,
      nodeId: chatNodeId,
    });
    transition('dayLoop.guest.chat');
  }, [availableChatNodes, game.currentGuest.nodeId, patchCurrentGuest, transition]);

  const continueReflection = useCallback(() => {
    if (!game.pendingGuestReflection) {
      return;
    }

    finalizeGuestAdvance(game.pendingGuestReflection);
  }, [finalizeGuestAdvance, game.pendingGuestReflection]);

  const continueDaySummary = useCallback(() => {
    patchContext({
      pendingDaySummary: null,
    });
    transition('dayLoop.intro');
  }, [patchContext, transition]);

  useEffect(() => {
    if (game.characterProgress[guest.id] === undefined) {
      patchContext({
        characterProgress: {
          ...game.characterProgress,
          [guest.id]: 0,
        },
      });
    }
  }, [game.characterProgress, guest.id, patchContext]);

  useEffect(() => {
    if (
      snapshot.value === 'boot' ||
      snapshot.value === 'startScreen' ||
      snapshot.value === 'mainMenu' ||
      snapshot.value === 'introSequence'
    ) {
      return;
    }

    if (currentGuestData) {
      return;
    }

    const nextVisit = findScheduledVisit(game.week, game.day, game.guestInDay, true);
    if (!nextVisit) {
      return;
    }

    if (
      nextVisit.week === game.week &&
      nextVisit.day === game.day &&
      nextVisit.guestInDay === game.guestInDay
    ) {
      return;
    }

    jumpToVisit(nextVisit);
  }, [currentGuestData, game.day, game.guestInDay, game.week, jumpToVisit, snapshot.value]);

  useEffect(() => {
    if (
      (snapshot.value === 'dayLoop.guest.story' || snapshot.value === 'dayLoop.guest.chat') &&
      !game.currentGuest.nodeId &&
      startNodeId
    ) {
      patchCurrentGuest({
        nodeId: startNodeId,
      });
    }
  }, [game.currentGuest.nodeId, patchCurrentGuest, snapshot.value, startNodeId]);

  return {
    game,
    currentPhase,
    guest,
    currentGuestData,
    startNodeId,
    currentNode,
    teachingNode,
    mixingNode,
    availableChatNodes,
    canShowTranscriptButton,
    activeAudioNode,
    dialogueDiagnostics,
    cancelNpcDialogueRequests,
    recordNarrativeOption,
    recordNarrativeNodeCompletion,
    appendCurrentGuestTranscript,
    debugJump,
    beginGuestArrival,
    openChat,
    enterMixing,
    enterObservation,
    completeObservation,
    rewardGuest,
    serveDrink,
    nextGuest,
    enterTailChatBeforeNodeEnd,
    finishTailChatLobby,
    openTailChatSession,
    leaveTailChatSession,
    sendTailChatMessage,
    completeConversation,
    continueReward,
    continueResult,
    continueReflection,
    continueDaySummary,
  };
}
