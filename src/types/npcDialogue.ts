import type {
  DialogueCognition,
  DialogueDisclosureLevel,
  DialogueMood,
  DialogueProgressSnapshot,
  DialogueResponseMode,
} from '../data/dialogue/types';

export type { DialogueProgressSnapshot } from '../data/dialogue/types';
export type NpcDialogueState = 'dayLoop.guest.llmChatSession';

export interface NpcDialogueRequest extends DialogueProgressSnapshot {
  state: NpcDialogueState;
  debug?: boolean;
}

export interface NpcDialogueUsage {
  provider: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  promptChars: number;
  completionChars: number;
}

export interface DialogueTurnDiagnostics {
  sessionId: string;
  requestId: number;
  characterId: string;
  relationshipPosture: string;
  topicIds: string[];
  cognition: DialogueCognition;
  disclosureLevel: DialogueDisclosureLevel;
  responseMode: DialogueResponseMode;
  repetitionLevel: 1 | 2 | 3;
  allowedFactIds: string[];
  hintableFactIds: string[];
  protectedTopicIds: string[];
  actorDraftLinesRedacted: string[];
  directorVerdict: 'pass' | 'revise' | 'failed' | 'skipped';
  directorViolations: string[];
  finalSource: 'director' | 'actor' | 'fallback' | 'local-safety';
  fallbackReason: string | null;
  stages: Array<{ stage: 'actor' | 'director'; durationMs: number; usage?: NpcDialogueUsage }>;
}

export interface NpcDialogueResponse {
  replyLines: string[];
  mood: DialogueMood;
  endChat: boolean;
  usage?: NpcDialogueUsage;
  diagnostics?: DialogueTurnDiagnostics;
}
