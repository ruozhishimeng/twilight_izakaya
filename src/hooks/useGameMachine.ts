import { useCallback, useReducer } from 'react';
import {
  createInitialGameSnapshot,
  hydrateLoadedGameSnapshot,
  reduceGameEvent,
  type GameSnapshot,
  type GameContext,
  type GameRootStateValue,
  type PersistedGameSnapshot,
} from '../state/gameState';

export function useGameMachine() {
  const [snapshot, dispatch] = useReducer(reduceGameEvent, undefined, createInitialGameSnapshot);

  const transition = useCallback((value: GameRootStateValue) => {
    dispatch({ type: 'TRANSITION', value });
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

  const resetCurrentGuest = useCallback(() => {
    dispatch({ type: 'RESET_CURRENT_GUEST' });
  }, []);

  const patchNpcDialogue = useCallback((patch: Partial<GameContext['npcDialogue']>) => {
    dispatch({ type: 'PATCH_NPC_DIALOGUE', patch });
  }, []);

  return {
    snapshot,
    transition,
    reset,
    loadSnapshot,
    patchContext,
    patchCurrentGuest,
    patchNpcDialogue,
    resetCurrentGuest,
  };
}
