export type NpcDialogueState = 'dayLoop.guest.llmChatSession';

export interface NpcDialogueTranscriptEntry {
  speaker: string;
  text: string;
}

export interface NpcDialogueRequestLastDrink {
  label?: string;
  mixedDrinkName?: string;
  isSuccess: boolean;
  sourceNodeId?: string | null;
}

export interface NpcDialogueGuestProfile {
  identity: string;
  personality: string;
  description: string;
}

export interface NpcDialogueRequest {
  state: NpcDialogueState;
  guestId: string;
  guestName: string;
  guestProfile: NpcDialogueGuestProfile;
  playerText: string;
  week: number;
  day: number;
  guestInDay: number;
  currentNodeId: string | null;
  observedFeatures: string[];
  recentTranscript: NpcDialogueTranscriptEntry[];
  lastDrink: NpcDialogueRequestLastDrink | null;
  turnIndex: number;
}

export interface NpcDialogueUsage {
  provider: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  promptChars: number;
  completionChars: number;
}

export interface NpcDialogueResponse {
  replyLines: string[];
  mood: 'steady' | 'warm' | 'guarded' | 'awkward';
  endChat: boolean;
  usage?: NpcDialogueUsage;
}
