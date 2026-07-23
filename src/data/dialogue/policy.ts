import {
  DIALOGUE_COGNITIONS, DIALOGUE_DISCLOSURE_LEVELS, DIALOGUE_MOODS,
  DIALOGUE_RESPONSE_MODES, type DialoguePolicyDocument, type DialogueWhenSource,
} from './types';

export interface DialogueReferenceIndex {
  characterId?: string;
  completedEventIds: Set<string>;
  selectedOptionIds: Set<string>;
  unlockedChapterIds: Set<string>;
  nodeIds: Set<string>;
  observedFeatureIds: Set<string>;
  recipeIds: Set<string>;
}

export function makeReferenceIndex(values: Partial<Record<keyof Omit<DialogueReferenceIndex, 'characterId'>, Iterable<string>>> & { characterId?: string } = {}): DialogueReferenceIndex {
  return {
    characterId: values.characterId,
    completedEventIds: new Set(values.completedEventIds || []),
    selectedOptionIds: new Set(values.selectedOptionIds || []),
    unlockedChapterIds: new Set(values.unlockedChapterIds || []),
    nodeIds: new Set(values.nodeIds || []),
    observedFeatureIds: new Set(values.observedFeatureIds || []),
    recipeIds: new Set(values.recipeIds || []),
  };
}

export function buildDialogueSelectedOptionId(guestId: string, eventId: string, optionId: string): string {
  return [guestId, eventId, optionId].map(part => {
    const value = part.trim();
    if (!value || value.includes('/')) throw new Error(`Invalid dialogue option identity part: ${JSON.stringify(part)}`);
    return value;
  }).join('/');
}

const has = <T extends readonly string[]>(values: T, value: unknown): value is T[number] => typeof value === 'string' && values.includes(value);
const string = (value: unknown, label: string) => { if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`); return value.trim(); };
const strings = (value: unknown, label: string) => { if (!Array.isArray(value)) throw new Error(`${label} must be an array`); return value.map((entry, index) => string(entry, `${label}[${index}]`)); };
const referenceIds = (value: unknown, label: string) => [...new Set(strings(value, label))].sort();
const idSort = <T extends { id: string }>(items: T[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
const assertUnique = (ids: string[], label: string) => { if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${label} id`); };

function normalizeWhen(raw: unknown, index: DialogueReferenceIndex, label: string): DialogueWhenSource {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${label} must be an object`);
  const source = raw as Record<string, unknown>;
  const keys = Object.keys(source);
  if (keys.length !== 1) throw new Error(`${label} must have exactly one condition`);
  const key = keys[0];
  if (key === 'always' && source.always === true) return { always: true };
  if ((key === 'all' || key === 'any') && Array.isArray(source[key])) return { [key]: source[key].map((entry, i) => normalizeWhen(entry, index, `${label}.${key}[${i}]`)) } as DialogueWhenSource;
  if (key === 'relationship' && source.relationship && typeof source.relationship === 'object') {
    const relation = source.relationship as Record<string, unknown>;
    if (relation.axis !== 'affection' || (relation.min !== undefined && typeof relation.min !== 'number') || (relation.max !== undefined && typeof relation.max !== 'number')) throw new Error(`${label}.relationship is invalid`);
    return { relationship: { axis: 'affection', ...(typeof relation.min === 'number' ? { min: relation.min } : {}), ...(typeof relation.max === 'number' ? { max: relation.max } : {}) } };
  }
  const mapping: Record<string, keyof DialogueReferenceIndex> = { completed_event: 'completedEventIds', selected_option: 'selectedOptionIds', unlocked_chapter: 'unlockedChapterIds', current_node: 'nodeIds', observed_feature: 'observedFeatureIds' };
  if (key in mapping) {
    const id = string(source[key], `${label}.${key}`);
    const set = index[mapping[key]] as Set<string>;
    if (!set.has(id)) throw new Error(`${label} references unknown ${key} "${id}"`);
    return { [key]: id } as DialogueWhenSource;
  }
  if (key === 'last_drink_success' && typeof source[key] === 'boolean') return { last_drink_success: source[key] };
  throw new Error(`${label} contains unsupported condition`);
}

export function normalizeDialoguePolicy(input: unknown, index: DialogueReferenceIndex): DialoguePolicyDocument {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Dialogue policy must be an object');
  const raw = input as Record<string, any>;
  if (raw.version !== 1) throw new Error('Dialogue policy version must be 1');
  const character_id = string(raw.character_id, 'character_id');
  if (index.characterId && character_id !== index.characterId) throw new Error(`Dialogue policy character_id must match ${index.characterId}`);
  const identity = raw.public_identity || {};
  const public_identity = { role: string(identity.role, 'public_identity.role'), appearance: string(identity.appearance, 'public_identity.appearance'), personality: string(identity.personality, 'public_identity.personality') };
  const voice = raw.voice || {};
  if (voice.sentence_length !== 'short' && voice.sentence_length !== 'medium') throw new Error('voice.sentence_length is invalid');
  if (!has(['low', 'medium', 'high'] as const, voice.initiative) || !has(['rare', 'occasional', 'frequent'] as const, voice.action_frequency)) throw new Error('voice is invalid');
  const normalizedVoice = { sentence_length: voice.sentence_length, rhythm: string(voice.rhythm, 'voice.rhythm'), initiative: voice.initiative, action_frequency: voice.action_frequency, preferred: strings(voice.preferred, 'voice.preferred'), avoid: strings(voice.avoid, 'voice.avoid'), banned_phrases: strings(voice.banned_phrases, 'voice.banned_phrases') } as DialoguePolicyDocument['voice'];
  if (!Array.isArray(raw.facts) || !Array.isArray(raw.protected_concepts) || !Array.isArray(raw.topics) || !Array.isArray(raw.examples)) throw new Error('Dialogue policy collections must be arrays');
  const facts = idSort(raw.facts.map((fact: any, i: number) => ({ id: string(fact?.id, `facts[${i}].id`), text: string(fact?.text, `facts[${i}].text`), ...(typeof fact?.hint_text === 'string' && fact.hint_text.trim() ? { hint_text: fact.hint_text.trim() } : {}), tags: strings(fact?.tags, `facts[${i}].tags`) })));
  const protected_concepts = idSort(raw.protected_concepts.map((concept: any, i: number) => ({ id: string(concept?.id, `protected_concepts[${i}].id`), capsule: string(concept?.capsule, `protected_concepts[${i}].capsule`), lexemes: strings(concept?.lexemes, `protected_concepts[${i}].lexemes`) })));
  assertUnique(facts.map(fact => fact.id), 'fact'); assertUnique(protected_concepts.map(concept => concept.id), 'protected concept');
  const factIds = new Set(facts.map(fact => fact.id)); const conceptIds = new Set(protected_concepts.map(concept => concept.id));
  const topics = idSort(raw.topics.map((topic: any, i: number) => {
    const topicId = string(topic?.id, `topics[${i}].id`);
    if (!Number.isFinite(topic?.priority)) throw new Error(`topics[${i}].priority must be a number`);
    const cognition = topic?.cognition || {};
    if (!has(DIALOGUE_COGNITIONS, cognition.default)) throw new Error(`topics[${i}].cognition.default is invalid`);
    const transitions = cognition.transitions === undefined ? undefined : (Array.isArray(cognition.transitions) ? cognition.transitions.map((transition: any, j: number) => {
      if (!has(DIALOGUE_COGNITIONS, transition?.state)) throw new Error(`topics[${i}].cognition.transitions[${j}].state is invalid`);
      return { when: normalizeWhen(transition.when, index, `topics[${i}].cognition.transitions[${j}].when`), state: transition.state };
    }) : (() => { throw new Error(`topics[${i}].cognition.transitions must be an array`); })());
    if (!Array.isArray(topic?.disclosure) || !topic.disclosure.length) throw new Error(`topics[${i}].disclosure must be a non-empty array`);
    const disclosure = topic.disclosure.map((rule: any, j: number) => {
      if (!has(DIALOGUE_DISCLOSURE_LEVELS, rule?.level) || !has(DIALOGUE_RESPONSE_MODES, rule?.response_mode)) throw new Error(`topics[${i}].disclosure[${j}] has invalid enum`);
      const normalizeIds = (value: unknown, kind: string, valid: Set<string>) => value === undefined ? undefined : referenceIds(value, kind).map(id => { if (!valid.has(id)) throw new Error(`${kind} references unknown id "${id}"`); return id; });
      const result = { when: normalizeWhen(rule.when, index, `topics[${i}].disclosure[${j}].when`), level: rule.level, response_mode: rule.response_mode, ...(normalizeIds(rule.fact_ids, `topics[${i}].disclosure[${j}].fact_ids`, factIds) ? { fact_ids: normalizeIds(rule.fact_ids, `topics[${i}].disclosure[${j}].fact_ids`, factIds) } : {}), ...(normalizeIds(rule.hint_fact_ids, `topics[${i}].disclosure[${j}].hint_fact_ids`, factIds) ? { hint_fact_ids: normalizeIds(rule.hint_fact_ids, `topics[${i}].disclosure[${j}].hint_fact_ids`, factIds) } : {}), ...(normalizeIds(rule.protected_concept_ids, `topics[${i}].disclosure[${j}].protected_concept_ids`, conceptIds) ? { protected_concept_ids: normalizeIds(rule.protected_concept_ids, `topics[${i}].disclosure[${j}].protected_concept_ids`, conceptIds) } : {}) };
      (result.hint_fact_ids || []).forEach(id => { if (!facts.find(fact => fact.id === id)?.hint_text) throw new Error(`hint_fact_ids requires independent safe hint_text for "${id}"`); });
      return result;
    });
    const alwaysCount = disclosure.filter(rule => 'always' in rule.when).length;
    if (alwaysCount !== 1 || !('always' in disclosure[disclosure.length - 1].when)) throw new Error(`topics[${i}].disclosure requires exactly one always rule last`);
    const repetition = topic?.repetition === undefined ? undefined : Object.fromEntries(Object.entries(topic.repetition).map(([key, value]) => { if (!['first', 'second', 'third'].includes(key) || !has(DIALOGUE_RESPONSE_MODES, value)) throw new Error(`topics[${i}].repetition is invalid`); return [key, value]; }));
    return { id: topicId, priority: topic.priority, cues: strings(topic?.cues, `topics[${i}].cues`), cognition: { default: cognition.default, ...(transitions ? { transitions } : {}) }, disclosure, ...(repetition ? { repetition } : {}) };
  }));
  assertUnique(topics.map(topic => topic.id), 'topic');
  const topicIds = new Set(topics.map(topic => topic.id)); const default_topic_id = string(raw.default_topic_id, 'default_topic_id'); if (!topicIds.has(default_topic_id)) throw new Error('default_topic_id references an unknown topic');
  const fallbacks = Object.fromEntries(Object.entries(raw.fallbacks || {}).sort(([a], [b]) => a.localeCompare(b)).map(([id, fallback]: [string, any]) => { if (!fallback || !has(DIALOGUE_MOODS, fallback.mood)) throw new Error(`fallback ${id} has invalid mood`); return [string(id, 'fallback id'), { reply_lines: strings(fallback.reply_lines, `fallback ${id}.reply_lines`), mood: fallback.mood }]; }));
  if (!Object.keys(fallbacks).length) throw new Error('Dialogue policy requires a fallback');
  const protectedFactIds = new Set(topics.flatMap(topic => topic.disclosure.flatMap(rule => rule.level === 'guarded' || rule.level === 'sealed' || (rule.protected_concept_ids || []).length > 0 ? [...(rule.fact_ids || []), ...(rule.hint_fact_ids || [])] : [...(rule.hint_fact_ids || [])])));
  const protectedMaterial = [...protected_concepts.flatMap(concept => concept.lexemes), ...facts.filter(fact => protectedFactIds.has(fact.id) || fact.tags.some(tag => /^(secret|protected)$/i.test(tag))).map(fact => fact.text)].filter(Boolean);
  const examples = idSort(raw.examples.map((example: any, i: number) => { const topic_id = string(example?.topic_id, `examples[${i}].topic_id`); if (!topicIds.has(topic_id) || !has(DIALOGUE_RESPONSE_MODES, example?.response_mode) || !has(DIALOGUE_MOODS, example?.mood) || (example?.kind !== 'positive' && example?.kind !== 'negative')) throw new Error(`examples[${i}] is invalid`); const player_text = string(example.player_text, `examples[${i}].player_text`); const reply_lines = strings(example.reply_lines, `examples[${i}].reply_lines`); if (protectedMaterial.some(material => player_text.includes(material) || reply_lines.some(line => line.includes(material)))) throw new Error(`examples[${i}] contains protected material`); return { id: string(example?.id, `examples[${i}].id`), topic_id, response_mode: example.response_mode, mood: example.mood, kind: example.kind, player_text, reply_lines }; }));
  assertUnique(examples.map(example => example.id), 'example');
  const end_chat_modes = strings(raw.conversation?.end_chat_modes, 'conversation.end_chat_modes').map(mode => { if (!has(DIALOGUE_RESPONSE_MODES, mode)) throw new Error('conversation.end_chat_modes has invalid mode'); return mode; });
  return { version: 1, character_id, public_identity, voice: normalizedVoice, facts, protected_concepts, default_topic_id, topics, fallbacks, examples, conversation: { end_chat_modes } };
}
