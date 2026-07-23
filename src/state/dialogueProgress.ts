import type { Guest } from '../data/content/types';
import type { DialogueProgressSnapshot, DialogueTranscriptEntry } from '../data/dialogue/types';
import type { GameSnapshot, GuestTranscriptEntry } from './gameState';
import { getRelationshipValue, selectNarrativeFactIds } from './narrativeEffects';

function transcriptRole(entry: GuestTranscriptEntry, guest: Guest): DialogueTranscriptEntry['role'] {
  if (entry.speaker === '我' || entry.speaker.toLowerCase() === 'player') return 'player';
  if (entry.speaker === '旁白' || entry.speaker === '内心' || entry.speaker.toLowerCase() === 'narration') return 'narration';
  if (entry.speaker === guest.name || entry.speaker.toLowerCase() === 'npc') return 'npc';
  return 'narration';
}

export function buildDialogueProgressSnapshot(input: {
  snapshot: GameSnapshot;
  guest: Guest;
  playerText: string;
}): DialogueProgressSnapshot {
  const { snapshot, guest } = input;
  const { context } = snapshot;
  const facts = selectNarrativeFactIds(context.narrativeEffects, guest.id);
  const observedFeatureIds = [...new Set([
    ...(context.characterObservations[guest.id] || []),
    ...context.currentGuest.discoveredFeatures,
  ].filter(Boolean))].sort();
  const unlockedChapterIds = [...new Set(context.unlockedStoryChapters[guest.id] || [])].sort();
  const recentTranscript = context.currentGuest.transcript
    .slice(-8)
    .map(entry => ({
      role: transcriptRole(entry, guest),
      source: entry.key.startsWith('llm-chat:') ? 'tail_chat' as const : 'story' as const,
      text: entry.text.trim().slice(0, 160),
    }))
    .filter(entry => entry.text);
  const lastDrink = context.currentGuest.lastDrinkResult;

  return {
    guestId: guest.id,
    week: context.week,
    day: context.day,
    guestInDay: context.guestInDay,
    currentNodeId: context.currentGuest.nodeId,
    relationshipValues: { affection: getRelationshipValue(context.narrativeEffects, guest.id) },
    ...facts,
    unlockedChapterIds,
    observedFeatureIds,
    lastDrink: lastDrink ? {
      recipeId: lastDrink.recipeId ?? null,
      isSuccess: lastDrink.isSuccess,
      sourceNodeId: lastDrink.sourceNodeId ?? null,
    } : null,
    recentTranscript,
    turnIndex: context.currentGuest.tailChat.turnsUsed + 1,
    playerText: input.playerText.trim().slice(0, 60),
  };
}
