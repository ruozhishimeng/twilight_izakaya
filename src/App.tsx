import React, { useState, useEffect, useMemo, useCallback } from 'react';
import StartScreen from './components/StartScreen';
import MainMenu from './components/MainMenu';
import IntroSequence from './components/IntroSequence';
import ObservationPhase from './components/ObservationPhase';
import StoryPhase from './components/StoryPhase';
import MixingPhase from './components/MixingPhase';
import ResultPhase from './components/ResultPhase';
import RewardPhase from './components/RewardPhase';
import DaySummaryPhase from './components/DaySummaryPhase';
import Diary from './components/Diary';
import BookModal from './components/BookModal';
import SettingsModal from './components/SettingsModal';
import { BASE_LIQUORS, FLAVORS, GUESTS, getGuestsForDay, findNodeForGuest, MIXERS } from './data/gameData';
import { BookOpen, Settings, Book, ScrollText, X, BellRing } from 'lucide-react';
import { useImagePreloader } from './hooks/useImagePreloader';
import { saveSystem, type SaveData } from './systems/SaveSystem';
import { DailyGuestRecord, DailySummary, JournalNote, JournalReward } from './types/journal';

export type GamePhase = 'start_screen' | 'main_menu' | 'intro_sequence' | 'intro' | 'observation' | 'story' | 'mixing' | 'result' | 'day_summary' | 'guest_reflection';

const DAYS_PER_WEEK = 7;
const MAX_SCHEDULE_LOOKAHEAD = 365;

function findScheduledVisit(week: number, day: number, guestInDay: number, includeCurrentSlot: boolean) {
  let scanWeek = week;
  let scanDay = day;
  let scanGuestInDay = includeCurrentSlot ? guestInDay : guestInDay + 1;

  for (let i = 0; i < MAX_SCHEDULE_LOOKAHEAD; i++) {
    const guests = getGuestsForDay(scanWeek, scanDay);
    if (scanGuestInDay >= 1 && scanGuestInDay <= guests.length) {
      return {
        week: scanWeek,
        day: scanDay,
        guestInDay: scanGuestInDay,
      };
    }

    scanDay += 1;
    if (scanDay > DAYS_PER_WEEK) {
      scanDay = 1;
      scanWeek += 1;
    }
    scanGuestInDay = 1;
  }

  return null;
}

function getDependentOutcomeNodes(nodeMap: Map<string, any>, sourceNodeId: string) {
  return Array.from(nodeMap.values()).filter(node => {
    const needEvent = node?.trigger_condition?.need_event;
    return Array.isArray(needEvent) && needEvent.includes(sourceNodeId);
  });
}

function resolveMixingOutcomeNode(
  guest: { nodeMap?: Map<string, any> },
  mixingNode: any,
  success: boolean
) {
  const explicitNodeId = success
    ? (mixingNode?.on_mixing_complete || mixingNode?.next_node)
    : (mixingNode?.on_mixing_fail || mixingNode?.drink_request?.eval_branches?.fail);

  if (explicitNodeId) {
    return explicitNodeId;
  }

  const nodeMap = guest.nodeMap;
  const sourceNodeId = mixingNode?.event_id || mixingNode?.id;
  if (!nodeMap || !sourceNodeId) {
    return null;
  }

  const outcomeNodes = getDependentOutcomeNodes(nodeMap, sourceNodeId);
  const priorityPatterns = success
    ? ['most_loved_success', 'generally_liked_success', 'regular_success']
    : ['fail', 'regular_success', 'generally_liked_success'];

  for (const pattern of priorityPatterns) {
    const match = outcomeNodes.find(node => typeof node?.event_id === 'string' && node.event_id.includes(pattern));
    if (match?.event_id) {
      return match.event_id;
    }
  }

  return null;
}

function formatMixedDrinkLabel(base: string, addons: string[]) {
  const itemMap = new Map(
    [...BASE_LIQUORS, ...MIXERS, ...FLAVORS].map(item => [item.id, item.name])
  );
  const names = [base, ...addons].filter(Boolean).map(id => itemMap.get(id) || id);
  return names.length > 0 ? names.join(' + ') : '未命名的调配';
}

interface GuestReflectionState {
  text: string;
  sameDay: boolean;
  nextWeek: number;
  nextDay: number;
  nextGuestInDay: number;
  daySummary: DailySummary | null;
  nextDayRecords: DailyGuestRecord[];
}

interface GuestTranscriptEntry {
  key: string;
  speaker: string;
  text: string;
}

type ViteImportMeta = ImportMeta & {
  env?: {
    DEV?: boolean;
  };
};

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('start_screen');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentDay, setCurrentDay] = useState(1);
  const [currentGuestInDay, setCurrentGuestInDay] = useState(1); // 1 or 2
  const [characterProgress, setCharacterProgress] = useState<Record<string, number>>({});
  const [characterObservations, setCharacterObservations] = useState<Record<string, string[]>>({});
  const [discoveredFeatures, setDiscoveredFeatures] = useState<string[]>([]);
  const [isMixing, setIsMixing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [mixedDrinkName, setMixedDrinkName] = useState<string | undefined>();
  const [isNewRecipe, setIsNewRecipe] = useState(false);
  const [unlockedRecipes, setUnlockedRecipes] = useState<string[]>([]);
  const [inventory, setInventory] = useState<string[]>([]);

  const [isDiaryOpen, setIsDiaryOpen] = useState(false);
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [transitionState, setTransitionState] = useState<'idle' | 'fade-out' | 'fade-in'>('idle');

  // Story state
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [teachingNode, setTeachingNode] = useState<any>(null);
  const [mixingNode, setMixingNode] = useState<any>(null);

  // Observation state (triggered by nodes)
  const [showObservation, setShowObservation] = useState(false);
  const [observationPrompt, setObservationPrompt] = useState<string>('');
  const [observationContinueNode, setObservationContinueNode] = useState<string | null>(null);
  const [availableFeatureGroups, setAvailableFeatureGroups] = useState<string[] | undefined>();

  // Reward state
  const [showReward, setShowReward] = useState(false);
  const [pendingReward, setPendingReward] = useState<any>(null);
  const [pendingMixingRetry, setPendingMixingRetry] = useState(false);
  const [mixingPromptOverride, setMixingPromptOverride] = useState<string | undefined>();
  const [guestInterludeText, setGuestInterludeText] = useState<string | undefined>();
  const [currentGuestRewards, setCurrentGuestRewards] = useState<JournalReward[]>([]);
  const [currentGuestDrinkLabel, setCurrentGuestDrinkLabel] = useState<string | undefined>();
  const [currentGuestChallenges, setCurrentGuestChallenges] = useState<string[]>([]);
  const [currentDayRecords, setCurrentDayRecords] = useState<DailyGuestRecord[]>([]);
  const [journalHistory, setJournalHistory] = useState<DailySummary[]>([]);
  const [pendingDaySummary, setPendingDaySummary] = useState<DailySummary | null>(null);
  const [pendingGuestReflection, setPendingGuestReflection] = useState<GuestReflectionState | null>(null);
  const [currentGuestTranscript, setCurrentGuestTranscript] = useState<GuestTranscriptEntry[]>([]);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);

  // Determine current guest based on new schedule system
  const todayGuests = getGuestsForDay(currentWeek, currentDay);
  const currentGuestData = todayGuests[currentGuestInDay - 1] || null;
  const guestId = currentGuestData?.character_id || 'fox_uncle';
  const guest = GUESTS.find(g => g.id === guestId) || GUESTS[0];
  const useMixingBackground = phase === 'mixing' || phase === 'result';
  const isDebugMode = !!(import.meta as ViteImportMeta).env?.DEV;

  // Do not fall back to a character's first node when the schedule slot is empty.
  const startNodeId = currentGuestData?.start_node || null;

  const appendCurrentGuestChallenge = (challenge?: string) => {
    const normalized = challenge?.trim();
    if (!normalized) {
      return;
    }

    setCurrentGuestChallenges(prev => (prev.includes(normalized) ? prev : [...prev, normalized]));
  };

  const appendCurrentGuestTranscript = (entry: GuestTranscriptEntry) => {
    if (!entry.text.trim()) {
      return;
    }

    setCurrentGuestTranscript(prev => (
      prev.some(item => item.key === entry.key) ? prev : [...prev, entry]
    ));
  };

  const beginGuestArrival = useCallback(() => {
    if (!startNodeId) {
      return;
    }

    setGuestInterludeText(undefined);
    setDiscoveredFeatures([]);
    setCurrentGuestRewards([]);
    setCurrentGuestDrinkLabel(undefined);
    setCurrentGuestChallenges([]);
    setCurrentGuestTranscript([]);
    setIsTranscriptOpen(false);
    setIsSuccess(false);
    setMixedDrinkName(undefined);
    setIsNewRecipe(false);
    setCurrentNodeId(startNodeId);
    playSoundEffect('door_bell');
    transitionTo('story', 1500);
  }, [startNodeId]);

  const handleDebugJump = useCallback(async (week: number, day: number) => {
    const normalizedWeek = Math.max(1, Math.floor(week) || 1);
    const normalizedDay = Math.min(DAYS_PER_WEEK, Math.max(1, Math.floor(day) || 1));

    const guestsOnTargetDay = getGuestsForDay(normalizedWeek, normalizedDay);
    const targetVisit =
      guestsOnTargetDay.length > 0
        ? {
            week: normalizedWeek,
            day: normalizedDay,
            guestInDay: 1,
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

    transitionTo('intro', 300, () => {
      setCurrentNodeId(null);
      setTeachingNode(null);
      setMixingNode(null);
      setShowObservation(false);
      setObservationPrompt('');
      setObservationContinueNode(null);
      setAvailableFeatureGroups(undefined);
      setShowReward(false);
      setPendingReward(null);
      setPendingMixingRetry(false);
      setMixingPromptOverride(undefined);
      setGuestInterludeText(undefined);
      setCurrentGuestRewards([]);
      setCurrentGuestDrinkLabel(undefined);
      setCurrentGuestChallenges([]);
      setCurrentGuestTranscript([]);
      setIsTranscriptOpen(false);
      setDiscoveredFeatures([]);
      setCurrentDayRecords([]);
      setPendingDaySummary(null);
      setPendingGuestReflection(null);
      setIsMixing(false);
      setIsSuccess(false);
      setMixedDrinkName(undefined);
      setIsNewRecipe(false);
      setCurrentWeek(targetVisit.week);
      setCurrentDay(targetVisit.day);
      setCurrentGuestInDay(targetVisit.guestInDay);
    });

    if (targetVisit.exact) {
      return `已跳转到第 ${targetVisit.week} 周 星期${['一', '二', '三', '四', '五', '六', '日'][targetVisit.day - 1]}。`;
    }

    return `指定日期没有客人，已跳转到最近的第 ${targetVisit.week} 周 星期${['一', '二', '三', '四', '五', '六', '日'][targetVisit.day - 1]}。`;
  }, []);

  const buildCurrentGuestRecord = (diaryEntry?: string): DailyGuestRecord => {
    const notes: JournalNote[] = discoveredFeatures
      .map(id => guest.features.find(feature => feature.id === id))
      .filter(Boolean)
      .map(feature => ({
        id: feature!.id,
        name: feature!.name,
        desc: feature!.desc,
      }));

    return {
      guestId: guest.id,
      guestName: guest.name,
      servedDrink: currentGuestDrinkLabel || (isSuccess ? mixedDrinkName || '完成了一次调配' : '未能调出合适的酒'),
      success: isSuccess,
      rewards: currentGuestRewards,
      challenges: currentGuestChallenges,
      notes,
      diaryEntry,
    };
  };

  const imagesToPreload = useMemo(() => {
    const urls = [
      '/assets/back_grounds/main_page.png',
      '/assets/back_grounds/table.png',
    ];
    GUESTS.forEach(g => {
      urls.push(g.image);
    });
    return urls;
  }, []);

  const { imagesPreloaded } = useImagePreloader(imagesToPreload);

  // 音效占位函数（后续接入音效系统）
  const playSoundEffect = (sfx: string) => {
    // TODO: 后续接入真实音效系统
    console.log(`[SFX] ${sfx}`);
  };

  const transitionTo = (nextPhase: GamePhase, delay = 800, onBeforePhaseChange?: () => void) => {
    setTransitionState('fade-out');
    setTimeout(() => {
      onBeforePhaseChange?.();
      setPhase(nextPhase);
      setTransitionState('fade-in');
      setTimeout(() => {
        setTransitionState('idle');
      }, delay);
    }, delay);
  };

  const transitionWithCleanup = (nextPhase: GamePhase, cleanup: () => void, delay = 800) => {
    transitionTo(nextPhase, delay, cleanup);
  };

  const resetGameState = () => {
    setCurrentWeek(1);
    setCurrentDay(1);
    setCurrentGuestInDay(1);
    setCharacterProgress({});
    setCharacterObservations({});
    setDiscoveredFeatures([]);
    setIsMixing(false);
    setIsSuccess(false);
    setMixedDrinkName(undefined);
    setIsNewRecipe(false);
    setUnlockedRecipes([]);
    setInventory([]);
    setIsDiaryOpen(false);
    setIsBookOpen(false);
    setIsSettingsOpen(false);
    setTransitionState('idle');
    setCurrentNodeId(null);
    setTeachingNode(null);
    setMixingNode(null);
    setShowObservation(false);
    setObservationPrompt('');
    setObservationContinueNode(null);
    setAvailableFeatureGroups(undefined);
    setShowReward(false);
    setPendingReward(null);
    setPendingMixingRetry(false);
    setMixingPromptOverride(undefined);
    setGuestInterludeText(undefined);
    setCurrentGuestRewards([]);
    setCurrentGuestDrinkLabel(undefined);
    setCurrentGuestChallenges([]);
    setCurrentDayRecords([]);
    setJournalHistory([]);
    setPendingDaySummary(null);
    setPendingGuestReflection(null);
    setCurrentGuestTranscript([]);
    setIsTranscriptOpen(false);
  };

  const finalizeGuestAdvance = (payload: GuestReflectionState) => {
    setCurrentNodeId(null);
    setTeachingNode(null);
    setMixingNode(null);
    setPendingMixingRetry(false);
    setMixingPromptOverride(undefined);
    setCurrentGuestRewards([]);
    setCurrentGuestDrinkLabel(undefined);
    setCurrentGuestChallenges([]);
    setIsSuccess(false);
    setMixedDrinkName(undefined);
    setIsNewRecipe(false);
    setCurrentGuestTranscript([]);
    setIsTranscriptOpen(false);
    if (payload.daySummary) {
      setPendingDaySummary(payload.daySummary);
      setJournalHistory(prev => [...prev, payload.daySummary!]);
      setCurrentDayRecords([]);
    } else {
      setCurrentDayRecords(payload.nextDayRecords);
    }

    setGuestInterludeText(
      payload.sameDay
        ? '\u5c45\u9152\u5c4b\u4ecd\u706f\u706b\u901a\u660e\u3002\u4e0b\u4e00\u4f4d\u5ba2\u4eba\u5373\u5c06\u5230\u8bbf...'
        : undefined
    );
    setCurrentWeek(payload.nextWeek);
    setCurrentDay(payload.nextDay);
    setCurrentGuestInDay(payload.nextGuestInDay);
    transitionTo(payload.sameDay ? 'intro' : 'day_summary', 800, () => {
      setPendingGuestReflection(null);
    });
  };

  const handleEnterMixing = (tNode: any, mNode: any) => {
    setPendingMixingRetry(false);
    setMixingPromptOverride(undefined);
    const normalizedTeachingNode =
      (tNode?.teaching ? tNode : null) ||
      (mNode?.teaching ? mNode : null);
    const normalizedMixingNode =
      ((mNode?.drink_request || mNode?.on_mixing_complete || mNode?.on_mixing_fail) ? mNode : null) ||
      (normalizedTeachingNode?.next_node
        ? findNodeForGuest(normalizedTeachingNode.next_node, guest.id, guest.nodeMap!)
        : null) ||
      ((tNode?.drink_request || tNode?.on_mixing_complete || tNode?.on_mixing_fail) ? tNode : null) ||
      ((normalizedTeachingNode?.drink_request || normalizedTeachingNode?.on_mixing_complete || normalizedTeachingNode?.on_mixing_fail)
        ? normalizedTeachingNode
        : null);
    const taughtRecipeId = normalizedTeachingNode?.teaching?.recipe?.id;
    if (taughtRecipeId) {
      setUnlockedRecipes(prev => (prev.includes(taughtRecipeId) ? prev : [...prev, taughtRecipeId]));
    }
    appendCurrentGuestChallenge(
      normalizedTeachingNode?.teaching?.recipe?.name
        ? `向${guest.name}学习「${normalizedTeachingNode.teaching.recipe.name}」`
        : normalizedMixingNode?.drink_request?.request_text || normalizedMixingNode?.drink_request?.hint
    );
    setTeachingNode(normalizedTeachingNode);
    setMixingNode(normalizedMixingNode);
    transitionTo('mixing');
  };

  const handleEnterObservation = (trigger: { prompt: string; continue_node: string; feature_groups?: string[] }) => {
    setObservationPrompt(trigger.prompt);
    setObservationContinueNode(trigger.continue_node);
    setAvailableFeatureGroups(trigger.feature_groups);
    setShowObservation(true);
    appendCurrentGuestChallenge(trigger.prompt);
  };

  const handleObservationComplete = (features: string[]) => {
    const normalizedFeatures = [...new Set(features)];
    setDiscoveredFeatures(prev => [...new Set([...prev, ...normalizedFeatures])]);
    setCharacterObservations(prev => {
      const existing = prev[guest.id] || [];
      return {
        ...prev,
        [guest.id]: [...new Set([...existing, ...normalizedFeatures])],
      };
    });
    setShowObservation(false);
    if (observationContinueNode) {
      setCurrentNodeId(observationContinueNode);
    }
    setObservationContinueNode(null);
  };

  const handleServe = (base: string, addons: string[]) => {
    let success = false;
    const activeMixingNode =
      mixingNode ||
      (teachingNode?.next_node ? findNodeForGuest(teachingNode.next_node, guest.id, guest.nodeMap!) : null) ||
      ((teachingNode?.drink_request || teachingNode?.on_mixing_complete || teachingNode?.on_mixing_fail) ? teachingNode : null);

    let idealDrink;
    if (activeMixingNode?.drink_request?.preferred_drink?.formula) {
      idealDrink = {
        base: activeMixingNode.drink_request.preferred_drink.formula[0],
        addons: activeMixingNode.drink_request.preferred_drink.formula.slice(1)
      };
    } else if (teachingNode?.teaching?.recipe?.formula) {
      idealDrink = {
        base: teachingNode.teaching.recipe.formula[0],
        addons: teachingNode.teaching.recipe.formula.slice(1)
      };
    }

    if (!idealDrink) {
      success = true;
    } else {
      const isBaseCorrect = base === idealDrink.base;
      const isAddonsCorrect = addons.length === idealDrink.addons.length && addons.every(a => idealDrink.addons.includes(a));
      success = isBaseCorrect && isAddonsCorrect;
    }

    setIsSuccess(success);

    const nextNodeId = resolveMixingOutcomeNode(guest, activeMixingNode, success);
    const shouldRetryMixing = !success && !!(
      activeMixingNode?.drink_request?.retry_on_fail ||
      (!nextNodeId && teachingNode?.teaching)
    );
    setPendingMixingRetry(shouldRetryMixing);
    setMixingPromptOverride(
      shouldRetryMixing
        ? '这杯还不对。再想想客人想要的味道，重新调配一次吧。'
        : undefined
    );
    setCurrentNodeId(nextNodeId || null);

    // Find if it matches a known recipe
    import('./assets/recipes/recipes.json').then(recipesData => {
      const mixedFormula = [base, ...addons].filter(Boolean).sort();
      const fallbackDrinkLabel = formatMixedDrinkLabel(base, addons);
      const matchedRecipe = recipesData.recipes.find(r => {
        if (!r.formula) return false;
        const rFormula = [...r.formula].sort();
        return rFormula.length === mixedFormula.length && rFormula.every((id, i) => id === mixedFormula[i]);
      });

      if (matchedRecipe) {
        setMixedDrinkName(matchedRecipe.name);
        setCurrentGuestDrinkLabel(matchedRecipe.name);
        if (!unlockedRecipes.includes(matchedRecipe.id)) {
          setIsNewRecipe(true);
          setUnlockedRecipes(prev => [...prev, matchedRecipe.id]);
        } else {
          setIsNewRecipe(false);
        }
      } else {
        setMixedDrinkName(undefined);
        setIsNewRecipe(false);
        setCurrentGuestDrinkLabel(fallbackDrinkLabel);
      }

      setTimeout(() => {
        transitionTo('result', 1000);
      }, 700);
    });
  };

  // Initialize progress for current guest if not exists
  useEffect(() => {
    if (guest && characterProgress[guest.id] === undefined) {
      setCharacterProgress(prev => ({
        ...prev,
        [guest.id]: 0
      }));
    }
  }, [guest, characterProgress]);

  useEffect(() => {
    if (phase === 'start_screen' || phase === 'main_menu' || phase === 'intro_sequence') {
      return;
    }

    if (currentGuestData) {
      return;
    }

    const nextVisit = findScheduledVisit(currentWeek, currentDay, currentGuestInDay, true);
    if (!nextVisit) {
      return;
    }

    if (
      nextVisit.week === currentWeek &&
      nextVisit.day === currentDay &&
      nextVisit.guestInDay === currentGuestInDay
    ) {
      return;
    }

    setCurrentWeek(nextVisit.week);
    setCurrentDay(nextVisit.day);
    setCurrentGuestInDay(nextVisit.guestInDay);
  }, [phase, currentWeek, currentDay, currentGuestInDay, currentGuestData]);

  useEffect(() => {
    if (phase !== 'mixing' && isMixing) {
      setIsMixing(false);
    }
  }, [phase, isMixing]);

  const handleNextGuest = () => {
    const currentDiaryNote =
      currentNodeId && guest.nodeMap
        ? findNodeForGuest(currentNodeId, guest.id, guest.nodeMap)?.diary_note
        : undefined;
    const completedGuestRecord = buildCurrentGuestRecord(currentDiaryNote);
    const nextDayRecords = [...currentDayRecords, completedGuestRecord];

    if (isSuccess) {
      setCharacterProgress(prev => ({
        ...prev,
        [guest.id]: (prev[guest.id] || 0) + 1
      }));
    }

    const nextVisit = findScheduledVisit(currentWeek, currentDay, currentGuestInDay, false);
    if (nextVisit) {
      const isSameDay = nextVisit.week === currentWeek && nextVisit.day === currentDay;
      const payload: GuestReflectionState = {
        text: currentDiaryNote || '',
        sameDay: isSameDay,
        nextWeek: nextVisit.week,
        nextDay: nextVisit.day,
        nextGuestInDay: nextVisit.guestInDay,
        nextDayRecords,
        daySummary: isSameDay
          ? null
          : {
              week: currentWeek,
              day: currentDay,
              guests: nextDayRecords,
            },
      };

      if (currentDiaryNote) {
        setPendingGuestReflection(payload);
        transitionTo('guest_reflection');
      } else {
        finalizeGuestAdvance(payload);
      }
    } else {
      let nextDay = currentDay + 1;
      let nextWeek = currentWeek;
      if (nextDay > DAYS_PER_WEEK) {
        nextDay = 1;
        nextWeek++;
      }

      const payload: GuestReflectionState = {
        text: currentDiaryNote || '',
        sameDay: false,
        nextWeek,
        nextDay,
        nextGuestInDay: 1,
        nextDayRecords,
        daySummary: {
          week: currentWeek,
          day: currentDay,
          guests: nextDayRecords,
        },
      };

      if (currentDiaryNote) {
        setPendingGuestReflection(payload);
        transitionTo('guest_reflection');
      } else {
        finalizeGuestAdvance(payload);
      }
    }
  };

  const handleReward = (reward: any) => {
    const rewardDetails = reward?.details
      ? (Array.isArray(reward.details) ? reward.details : [reward.details])
      : [];

    if (rewardDetails.length > 0) {
      const normalizedRewardDetails = rewardDetails as JournalReward[];
      setPendingReward(rewardDetails[0]);
      setShowReward(true);
      setCurrentGuestRewards(prev => [...prev, ...normalizedRewardDetails]);
      setInventory(prev => {
        const nextInventory = [...prev];
        for (const detail of normalizedRewardDetails) {
          if ((detail.type === 'ingredient' || detail.type === 'item') && detail.id && !nextInventory.includes(detail.id)) {
            nextInventory.push(detail.id);
          }
        }
        return nextInventory;
      });
      setUnlockedRecipes(prev => {
        const nextRecipes = [...prev];
        for (const detail of normalizedRewardDetails) {
          if (detail.type === 'recipe' && detail.id && !nextRecipes.includes(detail.id)) {
            nextRecipes.push(detail.id);
          }
        }
        return nextRecipes;
      });
    }
  };

  const handleSave = async (slotId: string, slotName: string) => {
    const saveData: SaveData = {
      phase,
      currentWeek,
      currentDay,
      currentGuestInDay,
      characterProgress,
      characterObservations,
      discoveredFeatures,
      unlockedRecipes,
      inventory,
      isSuccess,
      currentNodeId,
      showObservation,
      observationPrompt,
      observationContinueNode,
      availableFeatureGroups,
      isMixing,
      mixedDrinkName,
      teachingNodeId: teachingNode?.event_id || null,
      mixingNodeId: mixingNode?.event_id || null,
      currentGuestRewards,
      currentGuestDrinkLabel,
      currentGuestChallenges,
      currentDayRecords,
      journalHistory,
      pendingDaySummary,
      pendingGuestReflection,
      currentGuestTranscript,
    };
    await saveSystem.saveGame(slotId, slotName, saveData);
  };

  const handleLoad = async (slotId: string) => {
    const slot = await saveSystem.getSave(slotId);
    if (!slot) return;

    const d = slot.data;
    setPhase(d.phase);
    setCurrentWeek(d.currentWeek);
    setCurrentDay(d.currentDay);
    setCurrentGuestInDay(d.currentGuestInDay);
    setCharacterProgress(d.characterProgress);
    setCharacterObservations(d.characterObservations || {});
    setDiscoveredFeatures(d.discoveredFeatures || []);
    setUnlockedRecipes(d.unlockedRecipes || []);
    setInventory(d.inventory || []);
    setIsSuccess(d.isSuccess || false);
    setCurrentNodeId(d.currentNodeId);
    setShowObservation(d.showObservation || false);
    setObservationPrompt(d.observationPrompt || '');
    setObservationContinueNode(d.observationContinueNode || null);
    setAvailableFeatureGroups(d.availableFeatureGroups);
    setIsMixing(d.isMixing || false);
    setMixedDrinkName(d.mixedDrinkName);
    setPendingMixingRetry(false);
    setMixingPromptOverride(undefined);
    setCurrentGuestRewards(d.currentGuestRewards || []);
    setCurrentGuestDrinkLabel(d.currentGuestDrinkLabel);
    setCurrentGuestChallenges(d.currentGuestChallenges || []);
    setCurrentDayRecords(d.currentDayRecords || []);
    setJournalHistory(d.journalHistory || []);
    setPendingDaySummary(d.pendingDaySummary || null);
    setPendingGuestReflection(d.pendingGuestReflection || null);
    setCurrentGuestTranscript(d.currentGuestTranscript || []);
    setIsTranscriptOpen(false);
    // Re-derive teachingNode and mixingNode from nodeMap
    if (d.teachingNodeId) {
      setTeachingNode(findNodeForGuest(d.teachingNodeId, guest.id, guest.nodeMap!));
    }
    if (d.mixingNodeId) {
      setMixingNode(findNodeForGuest(d.mixingNodeId, guest.id, guest.nodeMap!));
    }
  };

  if (!imagesPreloaded) {
    return (
      <div className="min-h-screen bg-[#000] text-gray-200 font-mono flex items-center justify-center p-4 pixel-art-container">
        <div className="text-2xl animate-pulse">加载中...</div>
      </div>
    );
  }

  const canShowTranscriptButton =
    currentGuestTranscript.length > 0 &&
    (phase === 'story' || phase === 'mixing' || phase === 'result' || showObservation);

  return (
    <div className="min-h-screen bg-[#000] text-gray-200 font-mono flex items-center justify-center p-4 pixel-art-container relative">

      {/* Transition Overlay */}
      <div
        className={`absolute inset-0 bg-black z-[100] pointer-events-none transition-opacity duration-[800ms] ${
          transitionState === 'fade-out' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Start Screen - rendered outside main container */}
      {phase === 'start_screen' && (
        <StartScreen onStart={() => setPhase('main_menu')} />
      )}

      {/* Main Menu - rendered outside main container */}
      {phase === 'main_menu' && (
        <MainMenu
          onNewGame={() => {
            resetGameState();
            setPhase('intro_sequence');
          }}
          onLoadGame={async (slotId) => {
            await handleLoad(slotId);
          }}
          onBack={() => transitionTo('start_screen')}
        />
      )}

      {/* Intro Sequence - rendered outside main container */}
      {phase === 'intro_sequence' && (
        <IntroSequence onComplete={() => transitionTo('intro')} />
      )}

      {/* Main Game Container */}
      <div className="w-full max-w-7xl h-[850px] border-8 border-[#3e2723] rounded-lg shadow-2xl flex relative overflow-hidden bg-[#1c1411]">

        {/* Background Layers for Cross-fading */}
        <div
          className={`absolute inset-0 transition-opacity duration-1000 opacity-100 bg-center bg-cover bg-no-repeat ${useMixingBackground ? '' : 'bg-table'}`}
          style={useMixingBackground ? { backgroundImage: "url('/assets/back_grounds/mixing.png')" } : undefined}
        />

        {/* UI Overlay (Time, Settings, Book) */}
        {phase !== 'start_screen' && phase !== 'main_menu' && (
          <>
            {/* Time Indicator */}
            {phase !== 'mixing' && (
              <div className="absolute top-4 left-4 z-40 bg-[#e6b87d] border-4 border-[#8b5a2b] border-b-8 border-b-[#5a3a1a] px-6 py-3 shadow-[inset_-4px_-4px_0px_0px_rgba(0,0,0,0.15),inset_4px_4px_0px_0px_rgba(255,255,255,0.4),0_4px_0_0_#5a3a1a] pixel-rounded flex items-center gap-4">
                <div className="text-[#3e2723] font-bold text-2xl">
                  第{['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][currentWeek - 1]}周
                </div>
                <div className="w-1 h-8 bg-[#8b5a2b] rounded-full"></div>
                <div className="text-[#3e2723] font-bold text-2xl">
                  星期{['一', '二', '三', '四', '五', '六', '日'][currentDay - 1]}
                </div>
              </div>
            )}

            {/* Top Right Buttons */}
            <div className="absolute top-4 right-4 z-40 flex gap-4">
              {canShowTranscriptButton && (
                <button
                  onClick={() => setIsTranscriptOpen(prev => !prev)}
                  className="w-16 h-16 bg-[#e6b87d] border-4 border-[#8b5a2b] border-b-8 border-b-[#5a3a1a] shadow-[inset_-4px_-4px_0px_0px_rgba(0,0,0,0.15),inset_4px_4px_0px_0px_rgba(255,255,255,0.4),0_4px_0_0_#5a3a1a] pixel-rounded flex items-center justify-center hover:bg-[#fcd3a1] hover:scale-105 active:scale-95 transition-all group"
                  title={isTranscriptOpen ? '收起已过剧情' : '查看已过剧情'}
                >
                  <ScrollText size={30} className="text-[#3e2723] pixel-icon" />
                </button>
              )}
              <button
                onClick={() => setIsDiaryOpen(true)}
                className="w-16 h-16 bg-[#e6b87d] border-4 border-[#8b5a2b] border-b-8 border-b-[#5a3a1a] shadow-[inset_-4px_-4px_0px_0px_rgba(0,0,0,0.15),inset_4px_4px_0px_0px_rgba(255,255,255,0.4),0_4px_0_0_#5a3a1a] pixel-rounded flex items-center justify-center hover:bg-[#fcd3a1] hover:scale-105 active:scale-95 transition-all group"
                title="日记"
              >
                <BookOpen size={32} className="text-[#3e2723] pixel-icon" />
              </button>
              <button
                onClick={() => setIsBookOpen(true)}
                className="w-16 h-16 bg-[#e6b87d] border-4 border-[#8b5a2b] border-b-8 border-b-[#5a3a1a] shadow-[inset_-4px_-4px_0px_0px_rgba(0,0,0,0.15),inset_4px_4px_0px_0px_rgba(255,255,255,0.4),0_4px_0_0_#5a3a1a] pixel-rounded flex items-center justify-center hover:bg-[#fcd3a1] hover:scale-105 active:scale-95 transition-all group"
                title="图鉴与配方"
              >
                <Book size={32} className="text-[#3e2723] pixel-icon" />
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-16 h-16 bg-[#e6b87d] border-4 border-[#8b5a2b] border-b-8 border-b-[#5a3a1a] shadow-[inset_-4px_-4px_0px_0px_rgba(0,0,0,0.15),inset_4px_4px_0px_0px_rgba(255,255,255,0.4),0_4px_0_0_#5a3a1a] pixel-rounded flex items-center justify-center hover:bg-[#fcd3a1] hover:scale-105 active:scale-95 transition-all group"
                title="系统设置"
              >
                <Settings size={32} className="text-[#3e2723] pixel-icon" />
              </button>
            </div>
          </>
        )}

        {/* Main Content Area */}
        <div className="relative w-full h-full">

          {canShowTranscriptButton && isTranscriptOpen && (
            <div className="absolute right-4 top-24 z-50 w-[420px] overflow-hidden border-4 border-[#8b5a2b] bg-[#140e0bd9] text-[#f3e5c5] shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm pixel-rounded">
              <div className="flex items-center justify-between border-b-4 border-[#5a3a1a] bg-[#2c1e16]/90 px-4 py-3">
                <div>
                  <div className="text-xs tracking-[0.28em] text-[#c79c63]">TRANSCRIPT</div>
                  <div className="mt-1 text-lg font-bold text-[#f6e7c7]">当前客人已过剧情</div>
                </div>
                <button
                  onClick={() => setIsTranscriptOpen(false)}
                  className="flex h-10 w-10 items-center justify-center border-2 border-[#8b5a2b] bg-[#4a3123] text-[#f6e7c7] hover:bg-[#5d3d2b] transition-colors pixel-rounded"
                  title="关闭剧情记录"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="max-h-[360px] overflow-y-auto px-4 py-4 custom-scrollbar">
                <div className="space-y-3">
                  {currentGuestTranscript.map(entry => (
                    <div key={entry.key} className="bg-black/15 px-3 py-3 pixel-rounded">
                      <div className="text-xs tracking-[0.18em] text-[#c79c63]">{entry.speaker}</div>
                      <p className="mt-2 whitespace-pre-wrap leading-relaxed text-[#f3e5c5]">{entry.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {phase === 'day_summary' && pendingDaySummary && (
            <DaySummaryPhase
              summary={pendingDaySummary}
              onContinue={() => {
                transitionWithCleanup('intro', () => {
                  setPendingDaySummary(null);
                });
              }}
            />
          )}

          {phase === 'guest_reflection' && pendingGuestReflection && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90">
              <div className="max-w-4xl px-10 text-center animate-fade-in">
                <div className="text-sm tracking-[0.35em] text-[#8b7355]">INNER NOTE</div>
                <p className="mt-8 text-3xl leading-relaxed text-[#e8dcc4] italic">
                  {pendingGuestReflection.text}
                </p>
                <button
                  type="button"
                  onClick={beginGuestArrival}
                  className="mt-10 px-8 py-3 bg-[#e6b87d] border-4 border-[#8b5a2b] border-b-8 border-b-[#5a3a1a] shadow-[inset_-4px_-4px_0px_0px_rgba(0,0,0,0.15),inset_4px_4px_0px_0px_rgba(255,255,255,0.4),0_4px_0_0_#5a3a1a] pixel-rounded text-[#3e2723] font-bold hover:bg-[#fcd3a1] hover:scale-105 active:scale-95 transition-all"
                >
                  准备接待
                </button>
                <button
                  onClick={() => finalizeGuestAdvance(pendingGuestReflection)}
                  className="mt-12 px-8 py-3 bg-[#e6b87d] border-4 border-[#8b5a2b] border-b-8 border-b-[#5a3a1a] shadow-[inset_-4px_-4px_0px_0px_rgba(0,0,0,0.15),inset_4px_4px_0px_0px_rgba(255,255,255,0.4),0_4px_0_0_#5a3a1a] pixel-rounded text-[#3e2723] font-bold hover:bg-[#fcd3a1] hover:scale-105 active:scale-95 transition-all"
                >
                  记下这一页
                </button>
              </div>
            </div>
          )}

          {/* Guest Interlude */}
          {phase === 'intro' && guestInterludeText && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center animate-fade-in max-w-3xl px-8">
                <h2 className="text-4xl font-bold text-amber-200 mb-6">
                  {'\u534a\u6b65\u4eba\u95f4\uff0c\u4f59\u5149\u5f7c\u5cb8\u3002'}
                </h2>
                <p className="text-2xl text-amber-100 mb-10 leading-relaxed">
                  {guestInterludeText}
                </p>
                <button
                  onClick={() => setGuestInterludeText(undefined)}
                  className="px-8 py-3 bg-[#e6b87d] border-4 border-[#8b5a2b] border-b-8 border-b-[#5a3a1a] shadow-[inset_-4px_-4px_0px_0px_rgba(0,0,0,0.15),inset_4px_4px_0px_0px_rgba(255,255,255,0.4),0_4px_0_0_#5a3a1a] pixel-rounded text-[#3e2723] font-bold hover:bg-[#fcd3a1] hover:scale-105 active:scale-95 transition-all"
                >
                  {'\u7ee7\u7eed\u8425\u4e1a'}
                </button>
              </div>
            </div>
          )}

          {/* Intro Phase */}
          {phase === 'intro' && currentGuestData && startNodeId && !guestInterludeText && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center animate-fade-in">
                <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-[radial-gradient(circle,rgba(230,184,125,0.18)_0%,rgba(230,184,125,0.08)_45%,rgba(230,184,125,0)_72%)]">
                  <BellRing size={84} className="animate-shake text-amber-200 drop-shadow-[0_0_24px_rgba(251,191,36,0.55)]" />
                </div>
                <p className="hidden">
                  门铃轻响
                </p>
                <p className="mt-8 text-xl tracking-[0.35em] text-amber-100/80">
                  门铃轻响
                </p>
                <button
                  type="button"
                  onClick={beginGuestArrival}
                  className="mt-10 px-8 py-3 bg-[#e6b87d] border-4 border-[#8b5a2b] border-b-8 border-b-[#5a3a1a] shadow-[inset_-4px_-4px_0px_0px_rgba(0,0,0,0.15),inset_4px_4px_0px_0px_rgba(255,255,255,0.4),0_4px_0_0_#5a3a1a] pixel-rounded text-[#3e2723] font-bold hover:bg-[#fcd3a1] hover:scale-105 active:scale-95 transition-all"
                >
                  准备接待
                </button>
              </div>
            </div>
          )}

          {/* Story Phase */}
          {phase === 'story' && currentGuestData && startNodeId && !showObservation && (
            <StoryPhase
              guest={guest}
              startNodeId={startNodeId}
              currentNodeId={currentNodeId}
              discoveredFeatures={discoveredFeatures}
              onNodeChange={setCurrentNodeId}
              onEnterMixing={handleEnterMixing}
              onEnterObservation={handleEnterObservation}
              onComplete={handleNextGuest}
              onReward={handleReward}
              showReward={showReward}
              onTranscriptLine={appendCurrentGuestTranscript}
            />
          )}

          {/* Observation Phase (triggered by nodes) */}
          {showObservation && (
            <ObservationPhase
              guest={guest}
              availableGroups={availableFeatureGroups}
              prompt={observationPrompt}
              onComplete={handleObservationComplete}
            />
          )}

          {/* Mixing Phase */}
          {phase === 'mixing' && currentGuestData && (
            <MixingPhase
              guest={guest}
              onServe={handleServe}
              isMixing={isMixing}
              setIsMixing={setIsMixing}
              inventory={inventory}
              promptOverride={mixingPromptOverride}
              startAtServe={pendingMixingRetry}
              mixingRequest={mixingNode?.drink_request}
              teaching={teachingNode?.teaching}
            />
          )}

          {/* Mixing Animation Overlay */}
          {phase === 'mixing' && isMixing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-50 animate-fade-in bg-black/80 backdrop-blur-sm">
              <div className="text-8xl animate-shake mb-8">🍸</div>
              <div className="text-3xl font-bold text-amber-200 animate-pulse">调配中...</div>
            </div>
          )}

          {/* Result Phase (Cocktail Display) */}
          {phase === 'result' && (
            <ResultPhase
              isSuccess={isSuccess}
              mixedDrinkName={mixedDrinkName}
              isNewRecipe={isNewRecipe}
              onContinue={() => {
                if (pendingMixingRetry) {
                  transitionTo('mixing');
                } else if (currentNodeId) {
                  transitionTo('story');
                } else {
                  handleNextGuest();
                }
              }}
            />
          )}

          {/* Reward Phase */}
          {showReward && pendingReward && (
            <RewardPhase
              reward={pendingReward}
              onContinue={() => {
                setShowReward(false);
                setPendingReward(null);
              }}
            />
          )}

        </div>
      </div>

      {/* Modals - rendered outside main container to cover full viewport */}
      {isDiaryOpen && (
        <Diary
          guest={guest}
          discoveredFeatures={discoveredFeatures}
          journalHistory={journalHistory}
          currentWeek={currentWeek}
          currentDay={currentDay}
          onClose={() => setIsDiaryOpen(false)}
        />
      )}
      {isBookOpen && (
        <BookModal
          onClose={() => setIsBookOpen(false)}
          characterProgress={characterProgress}
          characterObservations={characterObservations}
          inventory={inventory}
          unlockedRecipes={unlockedRecipes}
        />
      )}
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} onReturnToMenu={() => {
        transitionWithCleanup('main_menu', () => {
          setIsSettingsOpen(false);
        });
      }} onSave={handleSave} onLoad={handleLoad} currentPhase={phase} currentWeek={currentWeek} currentDay={currentDay} enableDebugTools={isDebugMode} onDebugJump={async (week, day) => {
        const message = await handleDebugJump(week, day);
        setIsSettingsOpen(false);
        return message;
      }} />}
    </div>
  );
}
