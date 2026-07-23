import { validateSnapshotReferences } from './conditions.mjs';
import { dialogueManifest } from './manifest.mjs';

const SESSION_STATE = 'dayLoop.guest.llmChatSession';
const MAX_ID_COUNT = 256;
const MAX_ID_LENGTH = 120;
const TOP_LEVEL_KEYS = new Set([
  'state', 'guestId', 'week', 'day', 'guestInDay', 'currentNodeId',
  'relationshipValues', 'completedEventIds', 'selectedOptionIds',
  'unlockedChapterIds', 'observedFeatureIds', 'lastDrink',
  'recentTranscript', 'turnIndex', 'playerText', 'debug',
]);
const TRANSCRIPT_KEYS = new Set(['role', 'source', 'text']);
const LAST_DRINK_KEYS = new Set(['recipeId', 'isSuccess', 'sourceNodeId']);
const TRANSCRIPT_ROLES = new Set(['player', 'npc', 'narration']);
const TRANSCRIPT_SOURCES = new Set(['story', 'tail_chat']);

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function unsupportedKey(value, allowed) {
  return Object.keys(value).find(key => !allowed.has(key)) || null;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeIdArray(value, label) {
  if (!Array.isArray(value) || value.length > MAX_ID_COUNT) {
    return { ok: false, error: `${label} must contain at most ${MAX_ID_COUNT} ids.` };
  }
  const ids = [];
  for (const rawId of value) {
    const id = normalizeId(rawId);
    if (!id || id.length > MAX_ID_LENGTH) {
      return { ok: false, error: `${label} contains an invalid id.` };
    }
    if (!ids.includes(id)) ids.push(id);
  }
  return { ok: true, value: ids };
}

function normalizeRelationshipValues(value) {
  if (!isRecord(value) || Object.keys(value).length > MAX_ID_COUNT) {
    return { ok: false, error: 'relationshipValues must be an object of finite numbers.' };
  }
  const result = {};
  for (const [rawAxis, rawScore] of Object.entries(value)) {
    const axis = normalizeId(rawAxis);
    if (!axis || axis.length > MAX_ID_LENGTH || typeof rawScore !== 'number' || !Number.isFinite(rawScore)) {
      return { ok: false, error: 'relationshipValues must be an object of finite numbers.' };
    }
    result[axis] = Math.max(-100, Math.min(100, rawScore));
  }
  return { ok: true, value: result };
}

function normalizeTranscript(value) {
  if (!Array.isArray(value) || value.length > 8) {
    return { ok: false, error: 'recentTranscript must contain at most 8 entries.' };
  }
  const entries = [];
  for (const rawEntry of value) {
    if (!isRecord(rawEntry)) return { ok: false, error: 'recentTranscript contains an invalid entry.' };
    const unknown = unsupportedKey(rawEntry, TRANSCRIPT_KEYS);
    if (unknown) return { ok: false, error: `unsupported recentTranscript field: ${unknown}` };
    const text = typeof rawEntry.text === 'string' ? rawEntry.text.trim() : '';
    if (!TRANSCRIPT_ROLES.has(rawEntry.role) || !TRANSCRIPT_SOURCES.has(rawEntry.source) || !text || text.length > 160) {
      return { ok: false, error: 'recentTranscript contains an invalid entry.' };
    }
    entries.push({ role: rawEntry.role, source: rawEntry.source, text });
  }
  return { ok: true, value: entries };
}

function normalizeLastDrink(value, character) {
  if (value === null) return { ok: true, value: null };
  if (!isRecord(value)) return { ok: false, error: 'lastDrink must be null or an object.' };
  const unknown = unsupportedKey(value, LAST_DRINK_KEYS);
  if (unknown) return { ok: false, error: `unsupported lastDrink field: ${unknown}` };
  const recipeId = value.recipeId === null ? null : normalizeId(value.recipeId);
  const sourceNodeId = value.sourceNodeId === null ? null : normalizeId(value.sourceNodeId);
  if ((recipeId !== null && (!recipeId || recipeId.length > MAX_ID_LENGTH)) ||
      (sourceNodeId !== null && (!sourceNodeId || sourceNodeId.length > MAX_ID_LENGTH)) ||
      typeof value.isSuccess !== 'boolean') {
    return { ok: false, error: 'lastDrink contains invalid fields.' };
  }
  if (recipeId !== null && !character.validIds.recipeIds.includes(recipeId)) {
    return { ok: false, error: `lastDrink.recipeId contains unknown id "${recipeId}"` };
  }
  if (sourceNodeId !== null && !character.validIds.nodeIds.includes(sourceNodeId)) {
    return { ok: false, error: `lastDrink.sourceNodeId contains unknown id "${sourceNodeId}"` };
  }
  return { ok: true, value: { recipeId, isSuccess: value.isSuccess, sourceNodeId } };
}

export function validateNpcDialogueRequest(body, options = {}) {
  if (!isRecord(body)) return { ok: false, error: '请求体必须是 JSON 对象。' };
  const unknown = unsupportedKey(body, TOP_LEVEL_KEYS);
  if (unknown) return { ok: false, error: `unsupported request field: ${unknown}` };
  if (body.state !== SESSION_STATE) return { ok: false, error: '只有尾声聊天会话阶段可以调用对话服务。' };

  const manifest = options.manifest || dialogueManifest;
  const guestId = normalizeId(body.guestId);
  const character = manifest?.characters?.[guestId];
  if (!guestId || guestId.length > MAX_ID_LENGTH || !character) {
    return { ok: false, error: `guestId contains unknown id "${guestId}"` };
  }
  const playerText = typeof body.playerText === 'string' ? body.playerText.trim() : '';
  if (!playerText) return { ok: false, error: '玩家输入不能为空。' };
  if (playerText.length > 60) return { ok: false, error: '一次最多输入 60 个字。' };
  if (![body.week, body.day, body.guestInDay, body.turnIndex].every(isPositiveInteger)) {
    return { ok: false, error: 'week, day, guestInDay, and turnIndex must be positive integers.' };
  }
  if (body.currentNodeId !== null && (typeof body.currentNodeId !== 'string' || !body.currentNodeId.trim() || body.currentNodeId.trim().length > MAX_ID_LENGTH)) {
    return { ok: false, error: 'currentNodeId is invalid.' };
  }
  if (body.debug !== undefined && typeof body.debug !== 'boolean') {
    return { ok: false, error: 'debug must be a boolean.' };
  }

  const relationshipValues = normalizeRelationshipValues(body.relationshipValues);
  if (!relationshipValues.ok) return relationshipValues;
  const completedEventIds = normalizeIdArray(body.completedEventIds, 'completedEventIds');
  if (!completedEventIds.ok) return completedEventIds;
  const selectedOptionIds = normalizeIdArray(body.selectedOptionIds, 'selectedOptionIds');
  if (!selectedOptionIds.ok) return selectedOptionIds;
  const unlockedChapterIds = normalizeIdArray(body.unlockedChapterIds, 'unlockedChapterIds');
  if (!unlockedChapterIds.ok) return unlockedChapterIds;
  const observedFeatureIds = normalizeIdArray(body.observedFeatureIds, 'observedFeatureIds');
  if (!observedFeatureIds.ok) return observedFeatureIds;
  const recentTranscript = normalizeTranscript(body.recentTranscript);
  if (!recentTranscript.ok) return recentTranscript;

  const snapshot = {
    guestId,
    week: body.week,
    day: body.day,
    guestInDay: body.guestInDay,
    currentNodeId: body.currentNodeId === null ? null : body.currentNodeId.trim(),
    relationshipValues: relationshipValues.value,
    completedEventIds: completedEventIds.value,
    selectedOptionIds: selectedOptionIds.value,
    unlockedChapterIds: unlockedChapterIds.value,
    observedFeatureIds: observedFeatureIds.value,
    recentTranscript: recentTranscript.value,
    turnIndex: body.turnIndex,
    playerText,
  };
  const references = validateSnapshotReferences(manifest, character, snapshot);
  if (!references.ok) return references;
  const lastDrink = normalizeLastDrink(body.lastDrink, character);
  if (!lastDrink.ok) return lastDrink;

  return {
    ok: true,
    value: {
      state: SESSION_STATE,
      ...snapshot,
      lastDrink: lastDrink.value,
      ...(body.debug === true ? { debug: true } : {}),
    },
  };
}
