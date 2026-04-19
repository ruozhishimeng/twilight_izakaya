import { useCallback, useEffect, useMemo } from 'react';
import type { CharacterNode } from '../data/content/types';
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
  resolveMixingOutcomeNode,
  type ScheduledVisit,
} from '../app/flowHelpers';
import { selectGameRuntimeView } from '../state/gameSelectors';
import {
  toGamePhase,
  type GameContext,
  type GameRootStateValue,
  type GameSnapshot,
  type GuestReflectionState,
  type GuestTranscriptEntry,
  type StoryUnlockEntry,
} from '../state/gameState';
import type { JournalReward } from '../types/journal';
import { requestNpcDialogue } from '../services/npcDialogue';
import type { NpcDialogueRequest } from '../types/npcDialogue';

interface GameMachineController {
  snapshot: GameSnapshot;
  transition: (value: GameRootStateValue) => void;
  patchContext: (patch: Partial<GameContext>) => void;
  patchCurrentGuest: (patch: Partial<GameContext['currentGuest']>) => void;
  patchNpcDialogue: (patch: Partial<GameContext['npcDialogue']>) => void;
  resetCurrentGuest: () => void;
}

interface GameFlowControllerOptions {
  closeTranscript?: () => void;
  playSfx?: (soundId: string) => void;
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

export function useGameFlowController(
  machine: GameMachineController,
  options: GameFlowControllerOptions = {},
) {
  const {
    snapshot,
    transition,
    patchContext,
    patchCurrentGuest,
    patchNpcDialogue,
    resetCurrentGuest,
  } = machine;
  const closeTranscript = options.closeTranscript || (() => {});
  const playSfx = options.playSfx || (() => {});

  const game = snapshot.context;
  const currentPhase = toGamePhase(snapshot.value);
  const runtime = useMemo(() => selectGameRuntimeView(snapshot), [snapshot]);
  const {
    guest,
    currentGuestData,
    startNodeId,
    teachingNode,
    mixingNode,
    availableChatNodes,
    canShowTranscriptButton,
    activeAudioNode,
  } = runtime;

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
    if (!entry.text.trim() || game.currentGuest.transcript.some(item => item.key === entry.key)) {
      return;
    }

    patchCurrentGuest({
      transcript: [...game.currentGuest.transcript, entry],
    });
  }, [game.currentGuest.transcript, patchCurrentGuest]);

  const jumpToVisit = useCallback((targetVisit: ScheduledVisit) => {
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

    jumpToVisit(targetVisit);
    if (targetVisit.exact) {
      return `已跳转到第 ${targetVisit.week} 周 ${weekdayLabel(targetVisit.day)}。`;
    }

    return `指定日期没有客人，已跳转到最近的第 ${targetVisit.week} 周 ${weekdayLabel(targetVisit.day)}。`;
  }, [jumpToVisit]);

  const finalizeGuestAdvance = useCallback((payload: GuestReflectionState) => {
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

  const enterTailChatBeforeNodeEnd = useCallback((sourceNode: CharacterNode | null) => {
    if (!sourceNode?.next_node) {
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
        resumeNodeId: sourceNode.next_node,
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
    const normalizedMixingNode =
      ((mixingCandidate?.drink_request ||
        mixingCandidate?.on_mixing_complete ||
        mixingCandidate?.on_mixing_fail) &&
        mixingCandidate) ||
      (teachingCandidate?.next_node
        ? findNodeForGuest(teachingCandidate.next_node, guest.id, guest.nodeMap)
        : null) ||
      ((teachingCandidate?.drink_request ||
        teachingCandidate?.on_mixing_complete ||
        teachingCandidate?.on_mixing_fail) &&
        teachingCandidate) ||
      null;
    const normalizedTeachingNode = findTeachingNodeForMixing(
      guest,
      teachingCandidate,
      normalizedMixingNode || mixingCandidate,
    );
    const taughtRecipeId = normalizedTeachingNode?.teaching?.recipe?.id;

    if (taughtRecipeId && !game.unlockedRecipes.includes(taughtRecipeId)) {
      patchContext({
        unlockedRecipes: [...game.unlockedRecipes, taughtRecipeId],
      });
    }

    appendCurrentGuestChallenge(
      normalizedTeachingNode?.teaching?.recipe?.name
        ? `向${guest.name}学习「${normalizedTeachingNode.teaching.recipe.name}」`
        : normalizedMixingNode?.drink_request?.request_text || normalizedMixingNode?.drink_request?.hint,
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
    const activeMixingNode =
      mixingNode ||
      (teachingNode?.next_node ? findNodeForGuest(teachingNode.next_node, guest.id, guest.nodeMap) : null) ||
      ((teachingNode?.drink_request || teachingNode?.on_mixing_complete || teachingNode?.on_mixing_fail) &&
        teachingNode) ||
      null;

    const idealFormula =
      activeMixingNode?.drink_request?.preferred_drink?.formula || teachingNode?.teaching?.recipe?.formula || null;
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

    const nextNodeId = resolveMixingOutcomeNode(guest, activeMixingNode, success);
    const shouldRetryMixing =
      !success &&
      !!(activeMixingNode?.drink_request?.retry_on_fail || (!nextNodeId && teachingNode?.teaching));

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
        label: drinkLabel,
        mixedDrinkName,
        isSuccess: success,
        sourceNodeId: activeMixingNode?.event_id || activeMixingNode?.id || null,
      },
    });
    transition('dayLoop.guest.result');
  }, [game.unlockedRecipes, guest, mixingNode, patchContext, patchCurrentGuest, teachingNode, transition]);

  const nextGuest = useCallback(() => {
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
    const resumeNodeId = game.currentGuest.tailChat.resumeNodeId;

    if (resumeNodeId) {
      patchCurrentGuest({
        nodeId: resumeNodeId,
        tailChat: {
          ...game.currentGuest.tailChat,
          resumeNodeId: null,
        },
      });
      patchNpcDialogue({
        status: 'idle',
        errorMessage: null,
      });
      transition('dayLoop.guest.story');
      return;
    }

    if (!game.pendingGuestReflection) {
      const currentNode = resolveGuestNode(guest, game.currentGuest.nodeId);
      if (currentNode?.next_node) {
        patchCurrentGuest({
          nodeId: currentNode.next_node,
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
    transition('dayLoop.guest.llmChatLobby');
  }, [transition]);

  const sendTailChatMessage = useCallback(async (rawPlayerText: string) => {
    const playerText = rawPlayerText.trim();
    if (snapshot.value !== 'dayLoop.guest.llmChatSession') {
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

    const nextTurnIndex = game.currentGuest.tailChat.turnsUsed + 1;
    const baseInfo = guest.meta.base_info || {};
    const requestPayload: NpcDialogueRequest = {
      state: 'dayLoop.guest.llmChatSession',
      guestId: guest.id,
      guestName: guest.name,
      guestProfile: {
        identity: [
          guest.name,
          typeof baseInfo.type === 'string' && baseInfo.type.trim() ? baseInfo.type.trim() : guest.type,
          typeof baseInfo.age === 'string' && baseInfo.age.trim() ? `年龄：${baseInfo.age.trim()}` : null,
        ]
          .filter(Boolean)
          .join('，'),
        personality:
          (typeof guest.meta.personality === 'string' && guest.meta.personality.trim()) ||
          '性格信息未补全，请保持克制、自然并贴近当前剧情状态。',
        description:
          (typeof baseInfo.description === 'string' && baseInfo.description.trim()) ||
          (typeof guest.meta.description === 'string' && guest.meta.description.trim()) ||
          `${guest.name}是店里的${guest.type}客人。`,
      },
      playerText,
      week: game.week,
      day: game.day,
      guestInDay: game.guestInDay,
      currentNodeId: game.currentGuest.nodeId,
      observedFeatures: game.currentGuest.discoveredFeatures,
      recentTranscript: game.currentGuest.transcript
        .slice(-8)
        .map(entry => ({
          speaker: entry.speaker,
          text: entry.text,
        })),
      lastDrink: game.currentGuest.lastDrinkResult,
      turnIndex: nextTurnIndex,
    };

    patchNpcDialogue({
      status: 'requesting',
      errorMessage: null,
    });
    let replyLines: string[];

    try {
      const response = await requestNpcDialogue(requestPayload);
      replyLines = response.replyLines;
    } catch (error) {
      patchNpcDialogue({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : '本地对话服务暂时不可用。',
      });
      return { ok: false as const };
    }

    appendCurrentGuestTranscript({
      key: `llm-chat:${nextTurnIndex}:player`,
      speaker: '我',
      text: playerText,
    });

    replyLines.forEach((line, lineIndex) => {
      appendCurrentGuestTranscript({
        key: `llm-chat:${nextTurnIndex}:npc:${lineIndex}`,
        speaker: guest.name,
        text: line,
      });
    });

    patchCurrentGuest({
      tailChat: {
        ...game.currentGuest.tailChat,
        turnsUsed: nextTurnIndex,
      },
    });
    patchNpcDialogue({
      status: 'idle',
      errorMessage: null,
      turnCount: nextTurnIndex,
      lastReplyLines: replyLines,
    });
    return {
      ok: true as const,
      playerText,
      replyLines,
    };
  }, [
    appendCurrentGuestTranscript,
    game.currentGuest.discoveredFeatures,
    game.currentGuest.lastDrinkResult,
    game.currentGuest.nodeId,
    game.currentGuest.tailChat,
    game.currentGuest.transcript,
    game.day,
    game.guestInDay,
    game.week,
    guest.id,
    guest.name,
    patchCurrentGuest,
    patchNpcDialogue,
    snapshot.value,
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
    teachingNode,
    mixingNode,
    availableChatNodes,
    canShowTranscriptButton,
    activeAudioNode,
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
