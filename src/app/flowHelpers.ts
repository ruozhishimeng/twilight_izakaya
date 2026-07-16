import {
  BASE_LIQUORS,
  FLAVORS,
  MIXERS,
  findNodeForGuest,
  getGuestsForDay,
  type CharacterNode,
  type Guest,
} from '../data/gameData';
import type { DailyGuestRecord, JournalNote } from '../types/journal';
import type { StoryUnlockEntry } from '../state/gameState';

export const DAYS_PER_WEEK = 7;
const MAX_SCHEDULE_LOOKAHEAD = 365;

export interface ScheduledVisit {
  week: number;
  day: number;
  guestInDay: number;
}

export function findScheduledVisit(
  week: number,
  day: number,
  guestInDay: number,
  includeCurrentSlot: boolean,
): ScheduledVisit | null {
  let scanWeek = week;
  let scanDay = day;
  let scanGuestInDay = includeCurrentSlot ? guestInDay : guestInDay + 1;

  for (let i = 0; i < MAX_SCHEDULE_LOOKAHEAD; i += 1) {
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

export function findTeachingNodeForMixing(
  guest: Guest,
  teachingCandidate: CharacterNode | null,
  mixingCandidate: CharacterNode | null,
) {
  if (teachingCandidate?.teaching) {
    return teachingCandidate;
  }

  if (mixingCandidate?.teaching) {
    return mixingCandidate;
  }

  const upstreamIds = [
    ...(Array.isArray(mixingCandidate?.trigger_condition?.need_event)
      ? mixingCandidate.trigger_condition.need_event
      : []),
    ...(Array.isArray(teachingCandidate?.trigger_condition?.need_event)
      ? teachingCandidate.trigger_condition.need_event
      : []),
  ];

  for (const upstreamId of upstreamIds) {
    const upstreamNode = guest.nodeMap.get(upstreamId);
    if (upstreamNode?.teaching) {
      return upstreamNode;
    }
  }

  return null;
}

export function formatMixedDrinkLabel(ingredients: string[]) {
  const itemMap = new Map([...BASE_LIQUORS, ...MIXERS, ...FLAVORS].map(item => [item.id, item.name]));
  const names = ingredients.filter(Boolean).map(id => itemMap.get(id) || id);
  return names.length > 0 ? names.join(' + ') : '未命名的调配';
}

export function normalizeStoryUnlockEntries(node: CharacterNode | null): StoryUnlockEntry[] {
  const rawChapters = node?.story_unlocks?.chapters;
  if (!Array.isArray(rawChapters)) {
    return [];
  }

  return rawChapters
    .map((entry: unknown): StoryUnlockEntry | null => {
      const sourceNodeId = node?.event_id || node?.id;

      if (typeof entry === 'string' && entry.trim()) {
        return {
          chapterId: entry.trim(),
          sourceNodeId,
        };
      }

      if (
        entry &&
        typeof entry === 'object' &&
        'id' in entry &&
        typeof entry.id === 'string' &&
        entry.id.trim()
      ) {
        return {
          chapterId: entry.id.trim(),
          reason:
            'reason' in entry && typeof entry.reason === 'string' ? entry.reason.trim() : undefined,
          sourceNodeId,
        };
      }

      return null;
    })
    .filter((entry): entry is StoryUnlockEntry => entry !== null);
}

export function buildDailyGuestRecord(params: {
  guest: Guest;
  discoveredFeatures: string[];
  rewards: any[];
  challenges: string[];
  drinkLabel?: string;
  isSuccess?: boolean;
  mixedDrinkName?: string;
  diaryEntry?: string;
}): DailyGuestRecord {
  const notes: JournalNote[] = params.discoveredFeatures
    .map(id => params.guest.features.find(feature => feature.id === id))
    .filter(Boolean)
    .map(feature => ({
      id: feature!.id,
      name: feature!.name,
      desc: feature!.desc,
    }));

  return {
    guestId: params.guest.id,
    guestName: params.guest.name,
    servedDrink:
      params.drinkLabel ||
      (params.isSuccess ? params.mixedDrinkName || '完成了一次调配' : '未能调出合适的酒'),
    success: !!params.isSuccess,
    rewards: params.rewards,
    challenges: params.challenges,
    notes,
    diaryEntry: params.diaryEntry,
  };
}

export function resolveGuestNode(guest: Guest, nodeId: string | null) {
  if (!nodeId) {
    return null;
  }

  return findNodeForGuest(nodeId, guest.id, guest.nodeMap);
}
