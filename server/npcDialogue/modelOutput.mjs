import { isCompoundReplyLine, normalizeReplyLines } from './responseParser.mjs';

const MOODS = new Set(['steady', 'warm', 'guarded', 'awkward', 'cryptic', 'nostalgic']);
const ACTOR_KEYS = new Set(['replyLines', 'mood', 'addressedTopics', 'responseMode', 'usedFactIds']);
const DIRECTOR_KEYS = new Set(['verdict', 'violations', 'finalReplyLines', 'mood']);
export const DIRECTOR_VIOLATIONS = new Set([
  'irrelevant', 'persona_drift', 'cognition_conflict', 'disclosure_violation',
  'fact_conflict', 'uncharacterized_refusal', 'ai_tone', 'repetition',
  'state_mutation', 'invalid_structure',
]);
const MUTATION_KEYS = new Set([
  'state', 'gamestate', 'gamestatepatch', 'statepatch', 'patch',
  'nextnode', 'next_node', 'nodeid',
  'relationshipchanges', 'relationshipvalues', 'affection',
  'inventory', 'completedevents', 'selectedoptions', 'unlocks', 'rewards',
  'lastdrink', 'turnsused', 'closed',
]);
const DERIVED_MUTATION_KEY = /^(?:unlocked|completed|selected|observed)\w*$/i;

function isRecord(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function exactKeys(value, allowed) {
  const keys = Object.keys(value);
  return keys.length === allowed.size && keys.every(key => allowed.has(key));
}
function stringArray(value, { min = 0, max = Infinity } = {}) {
  return Array.isArray(value) && value.length >= min && value.length <= max && value.every(item => typeof item === 'string' && item.trim());
}
function isMutationKey(key) {
  return MUTATION_KEYS.has(key.toLowerCase()) || DERIVED_MUTATION_KEY.test(key);
}

export function findForbiddenMutationKey(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  for (const [key, nested] of Object.entries(value)) {
    if (isMutationKey(key)) return key;
    const found = findForbiddenMutationKey(nested, seen);
    if (found) return found;
  }
  return null;
}

export function validateActorOutput(value, compilation) {
  if (!isRecord(value) || !exactKeys(value, ACTOR_KEYS) || findForbiddenMutationKey(value)) {
    return { ok: false, error: 'actor output structure is invalid.' };
  }
  if (!stringArray(value.replyLines, { min: 1, max: 5 }) || !MOODS.has(value.mood) ||
      !stringArray(value.addressedTopics) || !stringArray(value.usedFactIds)) {
    return { ok: false, error: 'actor output fields are invalid.' };
  }
  if (value.replyLines.some(isCompoundReplyLine)) return { ok: false, error: 'actor replyLines are invalid.' };
  const compiledTopics = new Set(compilation.decision.topicIds);
  if (!value.addressedTopics.every(id => compiledTopics.has(id))) return { ok: false, error: 'actor used an unknown topic.' };
  if (value.responseMode !== compilation.decision.responseMode || value.responseMode !== compilation.actorContext.responseMode) {
    return { ok: false, error: 'actor responseMode conflicts with the decision.' };
  }
  const actorFactIds = new Set([
    ...compilation.actorContext.allowedFacts.map(fact => fact.id),
    ...compilation.actorContext.hintableFacts.map(fact => fact.id),
  ]);
  if (!value.usedFactIds.every(id => actorFactIds.has(id))) return { ok: false, error: 'actor used a non-whitelisted fact.' };
  const replyLines = normalizeReplyLines(value.replyLines);
  if (replyLines.length < 1 || replyLines.length > 5) return { ok: false, error: 'actor replyLines are invalid.' };
  return { ok: true, value: { ...value, replyLines } };
}

export function validateDirectorOutput(value) {
  if (!isRecord(value) || !exactKeys(value, DIRECTOR_KEYS) || findForbiddenMutationKey(value)) {
    return { ok: false, error: 'director output structure is invalid.' };
  }
  if (!['pass', 'revise'].includes(value.verdict) || !stringArray(value.violations) ||
      !value.violations.every(code => DIRECTOR_VIOLATIONS.has(code)) ||
      !stringArray(value.finalReplyLines, { min: 1, max: 5 }) || !MOODS.has(value.mood)) {
    return { ok: false, error: 'director output fields are invalid.' };
  }
  if (value.finalReplyLines.some(isCompoundReplyLine)) {
    return { ok: false, error: 'director replyLines are invalid.' };
  }
  const finalReplyLines = normalizeReplyLines(value.finalReplyLines);
  if (finalReplyLines.length < 1 || finalReplyLines.length > 5) return { ok: false, error: 'director replyLines are invalid.' };
  return { ok: true, value: { ...value, finalReplyLines } };
}
