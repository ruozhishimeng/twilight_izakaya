export interface TailChatPlaybackState {
  stage: 'player' | 'npc';
  playerText: string;
  npcLines: string[];
  npcIndex: number;
  endChatAfterPlayback: boolean;
}

export type TailChatPlaybackAction =
  | { action: 'show_npc'; npcIndex: number }
  | { action: 'input' }
  | { action: 'close_session' };

export function advanceTailChatPlayback(state: TailChatPlaybackState): TailChatPlaybackAction {
  if (state.stage === 'player') return { action: 'show_npc', npcIndex: 0 };
  if (state.npcIndex < state.npcLines.length - 1) return { action: 'show_npc', npcIndex: state.npcIndex + 1 };
  return state.endChatAfterPlayback ? { action: 'close_session' } : { action: 'input' };
}
