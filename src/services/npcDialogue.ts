import type {
  DialogueTurnDiagnostics,
  NpcDialogueRequest,
  NpcDialogueResponse,
  NpcDialogueUsage,
} from '../types/npcDialogue';
import {
  DIALOGUE_COGNITIONS,
  DIALOGUE_DISCLOSURE_LEVELS,
  DIALOGUE_RESPONSE_MODES,
} from '../data/dialogue/types';
import { getMiniMaxApiKeyForRequest } from './apiSettings';

interface ErrorPayload { error?: string; }
const MOODS = new Set(['steady', 'warm', 'guarded', 'awkward', 'cryptic', 'nostalgic']);
const COGNITIONS = new Set<string>(DIALOGUE_COGNITIONS);
const DISCLOSURE_LEVELS = new Set<string>(DIALOGUE_DISCLOSURE_LEVELS);
const RESPONSE_MODES = new Set<string>(DIALOGUE_RESPONSE_MODES);
const DIRECTOR_VERDICTS = new Set(['pass', 'revise', 'failed', 'skipped']);
const FINAL_SOURCES = new Set(['director', 'actor', 'fallback', 'local-safety']);
const RESPONSE_KEYS = new Set(['replyLines', 'mood', 'endChat', 'usage', 'diagnostics']);
const USAGE_KEYS = new Set(['provider', 'promptTokens', 'completionTokens', 'totalTokens', 'promptChars', 'completionChars']);
const DIAGNOSTIC_KEYS = new Set([
  'sessionId', 'requestId', 'characterId', 'relationshipPosture', 'topicIds', 'cognition',
  'disclosureLevel', 'responseMode', 'repetitionLevel', 'allowedFactIds', 'hintableFactIds',
  'protectedTopicIds', 'actorDraftLinesRedacted', 'directorVerdict', 'directorViolations',
  'finalSource', 'fallbackReason', 'stages',
]);
const STAGE_KEYS = new Set(['stage', 'durationMs', 'usage']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function getErrorMessage(value: unknown): string | null {
  return isRecord(value) && typeof value.error === 'string' ? value.error : null;
}
function rejectUnknown(value: Record<string, unknown>, allowed: Set<string>) {
  const key = Object.keys(value).find(candidate => !allowed.has(candidate));
  if (key) throw new Error(`forbidden response field: ${key}`);
}
function strings(value: unknown): string[] | null {
  return Array.isArray(value) && value.every(item => typeof item === 'string') ? [...value] : null;
}
function optionalNumber(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (value === undefined) return {};
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`invalid response field: ${key}`);
  return { [key]: value };
}
function parseUsage(value: unknown): NpcDialogueUsage {
  if (!isRecord(value)) throw new Error('invalid response field: usage');
  rejectUnknown(value, USAGE_KEYS);
  if (typeof value.provider !== 'string' || typeof value.promptChars !== 'number' || typeof value.completionChars !== 'number') {
    throw new Error('invalid response field: usage');
  }
  return {
    provider: value.provider,
    promptChars: value.promptChars,
    completionChars: value.completionChars,
    ...optionalNumber(value, 'promptTokens'),
    ...optionalNumber(value, 'completionTokens'),
    ...optionalNumber(value, 'totalTokens'),
  };
}
function parseDiagnostics(value: unknown): DialogueTurnDiagnostics {
  if (!isRecord(value)) throw new Error('invalid response field: diagnostics');
  rejectUnknown(value, DIAGNOSTIC_KEYS);
  const topicIds = strings(value.topicIds); const allowedFactIds = strings(value.allowedFactIds);
  const hintableFactIds = strings(value.hintableFactIds); const protectedTopicIds = strings(value.protectedTopicIds);
  const actorDraftLinesRedacted = strings(value.actorDraftLinesRedacted); const directorViolations = strings(value.directorViolations);
  if (![value.sessionId, value.characterId, value.relationshipPosture, value.cognition, value.disclosureLevel, value.responseMode, value.directorVerdict, value.finalSource]
      .every(item => typeof item === 'string') || typeof value.requestId !== 'number' ||
      !COGNITIONS.has(String(value.cognition)) ||
      !DISCLOSURE_LEVELS.has(String(value.disclosureLevel)) ||
      !RESPONSE_MODES.has(String(value.responseMode)) ||
      !DIRECTOR_VERDICTS.has(String(value.directorVerdict)) ||
      !FINAL_SOURCES.has(String(value.finalSource)) ||
      ![1, 2, 3].includes(value.repetitionLevel as number) || !topicIds || !allowedFactIds ||
      !hintableFactIds || !protectedTopicIds || !actorDraftLinesRedacted || !directorViolations ||
      (value.fallbackReason !== null && typeof value.fallbackReason !== 'string') || !Array.isArray(value.stages)) {
    throw new Error('invalid response field: diagnostics');
  }
  const stages = value.stages.map(rawStage => {
    if (!isRecord(rawStage)) throw new Error('invalid response field: stages');
    rejectUnknown(rawStage, STAGE_KEYS);
    if (!['actor', 'director'].includes(String(rawStage.stage)) || typeof rawStage.durationMs !== 'number') {
      throw new Error('invalid response field: stages');
    }
    return {
      stage: rawStage.stage as 'actor' | 'director', durationMs: rawStage.durationMs,
      ...(rawStage.usage === undefined ? {} : { usage: parseUsage(rawStage.usage) }),
    };
  });
  return {
    sessionId: value.sessionId as string, requestId: value.requestId, characterId: value.characterId as string,
    relationshipPosture: value.relationshipPosture as string, topicIds,
    cognition: value.cognition as DialogueTurnDiagnostics['cognition'],
    disclosureLevel: value.disclosureLevel as DialogueTurnDiagnostics['disclosureLevel'],
    responseMode: value.responseMode as DialogueTurnDiagnostics['responseMode'],
    repetitionLevel: value.repetitionLevel as 1 | 2 | 3, allowedFactIds, hintableFactIds,
    protectedTopicIds, actorDraftLinesRedacted,
    directorVerdict: value.directorVerdict as DialogueTurnDiagnostics['directorVerdict'],
    directorViolations, finalSource: value.finalSource as DialogueTurnDiagnostics['finalSource'],
    fallbackReason: value.fallbackReason as string | null, stages,
  };
}
function parseResponse(value: unknown): NpcDialogueResponse {
  if (!isRecord(value)) throw new Error('本地对话服务返回了无效内容。');
  rejectUnknown(value, RESPONSE_KEYS);
  const replyLines = strings(value.replyLines);
  if (!replyLines || replyLines.length < 1 || replyLines.length > 5 ||
      replyLines.some(line => !line.trim()) || replyLines.join('').length > 120 ||
      typeof value.mood !== 'string' || !MOODS.has(value.mood) || typeof value.endChat !== 'boolean') {
    throw new Error('本地对话服务返回了无效内容。');
  }
  return {
    replyLines, mood: value.mood as NpcDialogueResponse['mood'], endChat: value.endChat,
    ...(value.usage === undefined ? {} : { usage: parseUsage(value.usage) }),
    ...(value.diagnostics === undefined ? {} : { diagnostics: parseDiagnostics(value.diagnostics) }),
  };
}

export async function requestNpcDialogue(
  payload: NpcDialogueRequest,
  options: { signal?: AbortSignal } = {},
): Promise<NpcDialogueResponse> {
  const apiKey = getMiniMaxApiKeyForRequest();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch('/api/npc-dialogue', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: options.signal,
  });
  const raw = (await response.json().catch(() => null)) as NpcDialogueResponse | ErrorPayload | null;
  if (!response.ok) throw new Error(getErrorMessage(raw) || '本地对话服务暂时不可用。');
  return parseResponse(raw);
}
