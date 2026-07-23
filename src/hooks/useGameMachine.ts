import { useCallback, useReducer } from 'react';
import {
  createInitialGameSnapshot,
  hydrateLoadedGameSnapshot,
  reduceGameEvent,
  type GameSnapshot,
  type GameContext,
  type GameRootStateValue,
  type GuestTranscriptEntry,
  type PersistedGameSnapshot,
} from '../state/gameState';
import type { NarrativeTransaction } from '../state/narrativeEffects';

export function useGameMachine() {
  const [snapshot, dispatch] = useReducer(reduceGameEvent, undefined, createInitialGameSnapshot);

  const transition = useCallback((value: GameRootStateValue) => {
    dispatch({ type: 'TRANSITION', value });
  }, []);

  const debugJumpToVisit = useCallback((week: number, day: number, guestInDay: number) => {
    dispatch({ type: 'DEBUG_JUMP', week, day, guestInDay });
  }, []);

  const reset = useCallback((value?: GameRootStateValue) => {
    dispatch({ type: 'RESET', value });
  }, []);

  const loadSnapshot = useCallback((nextSnapshot: PersistedGameSnapshot | GameSnapshot) => {
    dispatch({ type: 'LOAD', snapshot: hydrateLoadedGameSnapshot(nextSnapshot) });
  }, []);

  const patchContext = useCallback((patch: Partial<GameContext>) => {
    dispatch({ type: 'PATCH_CONTEXT', patch });
  }, []);

  const patchCurrentGuest = useCallback((patch: Partial<GameContext['currentGuest']>) => {
    dispatch({ type: 'PATCH_CURRENT_GUEST', patch });
  }, []);

  const applyNarrativeTransaction = useCallback((transaction: NarrativeTransaction) => {
    dispatch({ type: 'APPLY_NARRATIVE_TRANSACTION', transaction });
  }, []);

  const resetCurrentGuest = useCallback(() => {
    dispatch({ type: 'RESET_CURRENT_GUEST' });
  }, []);

  const patchNpcDialogue = useCallback((patch: Partial<GameContext['npcDialogue']>) => {
    dispatch({ type: 'PATCH_NPC_DIALOGUE', patch });
  }, []);

  const appendCurrentGuestTranscriptEntries = useCallback((entries: GuestTranscriptEntry[]) => {
    dispatch({ type: 'APPEND_CURRENT_GUEST_TRANSCRIPT', entries });
  }, []);

  return {
    snapshot,
    transition,
    debugJumpToVisit,
    reset,
    loadSnapshot,
    patchContext,
    patchCurrentGuest,
    applyNarrativeTransaction,
    patchNpcDialogue,
    appendCurrentGuestTranscriptEntries,
    resetCurrentGuest,
  };
}
