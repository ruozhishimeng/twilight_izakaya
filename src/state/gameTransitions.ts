import type { GameRootStateValue } from './gameState';

type TransitionMap = Record<GameRootStateValue, readonly GameRootStateValue[]>;

export const GAME_STATE_TRANSITIONS: TransitionMap = {
  boot: ['startScreen'],
  startScreen: ['mainMenu'],
  mainMenu: ['startScreen', 'introSequence'],
  introSequence: ['dayLoop.intro'],
  'dayLoop.intro': ['dayLoop.guest.story', 'dayLoop.daySummary'],
  'dayLoop.guest.story': [
    'dayLoop.intro',
    'dayLoop.guest.chat',
    'dayLoop.guest.observation',
    'dayLoop.guest.mixing',
    'dayLoop.guest.reward',
    'dayLoop.guest.llmChatLobby',
    'dayLoop.guest.reflection',
    'dayLoop.daySummary',
  ],
  'dayLoop.guest.chat': [
    'dayLoop.intro',
    'dayLoop.guest.story',
    'dayLoop.guest.observation',
    'dayLoop.guest.mixing',
    'dayLoop.guest.reward',
    'dayLoop.guest.llmChatLobby',
    'dayLoop.guest.reflection',
    'dayLoop.daySummary',
  ],
  'dayLoop.guest.observation': ['dayLoop.intro', 'dayLoop.guest.story'],
  'dayLoop.guest.mixing': ['dayLoop.intro', 'dayLoop.guest.result'],
  'dayLoop.guest.result': [
    'dayLoop.intro',
    'dayLoop.guest.story',
    'dayLoop.guest.chat',
    'dayLoop.guest.mixing',
    'dayLoop.guest.llmChatLobby',
    'dayLoop.guest.reflection',
    'dayLoop.daySummary',
  ],
  'dayLoop.guest.reward': [
    'dayLoop.intro',
    'dayLoop.guest.story',
    'dayLoop.guest.chat',
    'dayLoop.guest.llmChatLobby',
  ],
  'dayLoop.guest.llmChatLobby': [
    'dayLoop.guest.llmChatSession',
    'dayLoop.guest.story',
    'dayLoop.intro',
    'dayLoop.guest.reflection',
    'dayLoop.daySummary',
  ],
  'dayLoop.guest.llmChatSession': [
    'dayLoop.guest.llmChatLobby',
    'dayLoop.intro',
    'dayLoop.guest.reflection',
    'dayLoop.daySummary',
  ],
  'dayLoop.guest.reflection': ['dayLoop.intro', 'dayLoop.daySummary'],
  'dayLoop.daySummary': ['dayLoop.intro'],
};

export function canTransitionState(
  from: GameRootStateValue,
  to: GameRootStateValue,
) {
  return GAME_STATE_TRANSITIONS[from].includes(to);
}

export function assertTransitionState(
  from: GameRootStateValue,
  to: GameRootStateValue,
) {
  if (canTransitionState(from, to)) {
    return;
  }

  throw new Error(`[gameState] illegal transition: ${from} -> ${to}`);
}
