import {
  GUESTS,
  findNodeForGuest,
  getChatNodesForGuest,
  getGuestById,
  getGuestsForDay,
  type CharacterNode,
  type Guest,
  type ScheduleGuest,
} from '../data/gameData';
import type { GameSnapshot, GameRootStateValue } from './gameState';

export interface GameRuntimeView {
  guest: Guest;
  guestId: string;
  todayGuests: ScheduleGuest[];
  currentGuestData: ScheduleGuest | null;
  startNodeId: string | null;
  currentNode: CharacterNode | null;
  teachingNode: CharacterNode | null;
  mixingNode: CharacterNode | null;
  visitedNodeIds: Set<string>;
  availableChatNodes: CharacterNode[];
  canShowTranscriptButton: boolean;
  activeAudioNode: CharacterNode | null;
}

export function isStoryLikeState(value: GameRootStateValue) {
  return (
    value === 'dayLoop.guest.story' ||
    value === 'dayLoop.guest.chat' ||
    value === 'dayLoop.guest.reward' ||
    value === 'dayLoop.guest.llmChatLobby' ||
    value === 'dayLoop.guest.llmChatSession'
  );
}

export function selectGameRuntimeView(snapshot: GameSnapshot): GameRuntimeView {
  const game = snapshot.context;
  const fallbackGuest = GUESTS[0]!;
  const todayGuests = getGuestsForDay(game.week, game.day);
  const currentGuestData = todayGuests[game.guestInDay - 1] || null;
  const guestId = currentGuestData?.character_id || fallbackGuest.id || 'fox_uncle';
  const guest = getGuestById(guestId) || fallbackGuest;
  const startNodeId = currentGuestData?.start_node || null;
  const currentNode = game.currentGuest.nodeId
    ? findNodeForGuest(game.currentGuest.nodeId, guest.id, guest.nodeMap)
    : null;
  const teachingNode = game.currentGuest.teachingNodeId
    ? findNodeForGuest(game.currentGuest.teachingNodeId, guest.id, guest.nodeMap)
    : null;
  const mixingNode = game.currentGuest.mixingNodeId
    ? findNodeForGuest(game.currentGuest.mixingNodeId, guest.id, guest.nodeMap)
    : null;

  const visitedNodeIds = new Set<string>();
  if (game.currentGuest.nodeId) {
    visitedNodeIds.add(game.currentGuest.nodeId);
  }
  game.currentGuest.transcript.forEach(entry => {
    const nodeId = entry.key.split(':')[0];
    if (nodeId) {
      visitedNodeIds.add(nodeId);
    }
  });

  const availableChatNodes = getChatNodesForGuest(guest.id).filter(node => {
    const requiredEvents = node?.trigger_condition?.need_event;
    if (!Array.isArray(requiredEvents) || requiredEvents.length === 0) {
      return true;
    }
    return requiredEvents.every((eventId: string) => visitedNodeIds.has(eventId));
  });

  let activeAudioNode: CharacterNode | null = null;
  if (snapshot.value === 'dayLoop.guest.mixing') {
    activeAudioNode =
      mixingNode ||
      (teachingNode?.next_node
        ? findNodeForGuest(teachingNode.next_node, guest.id, guest.nodeMap)
        : null) ||
      teachingNode ||
      null;
  } else if (isStoryLikeState(snapshot.value) || snapshot.value === 'dayLoop.guest.observation') {
    activeAudioNode = currentNode;
  }

  return {
    guest,
    guestId,
    todayGuests,
    currentGuestData,
    startNodeId,
    currentNode,
    teachingNode,
    mixingNode,
    visitedNodeIds,
    availableChatNodes,
    canShowTranscriptButton:
      game.currentGuest.transcript.length > 0 &&
      (isStoryLikeState(snapshot.value) ||
        snapshot.value === 'dayLoop.guest.observation' ||
        snapshot.value === 'dayLoop.guest.mixing' ||
        snapshot.value === 'dayLoop.guest.result'),
    activeAudioNode,
  };
}
