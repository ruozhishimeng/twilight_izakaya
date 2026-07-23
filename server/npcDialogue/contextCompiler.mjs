import { matchesDialogueCondition, resolveFirstMatchingRule } from './conditions.mjs';

const strictness = { open: 0, partial: 1, hint: 2, guarded: 3, sealed: 4 };
const responseStrength = { direct_answer: 0, partial_answer: 1, emotional_hint: 2, soft_deflection: 3, guarded_refusal: 4, explicit_boundary: 5, silence_or_exit: 6 };
const emptyPolicy = { public_identity: { role: '居酒屋客人', appearance: '一位来到居酒屋的客人。', personality: '谨慎而克制。' }, voice: { sentence_length: 'short', rhythm: '自然停顿', initiative: 'low', action_frequency: 'rare', preferred: [], avoid: [], banned_phrases: [] }, facts: [], protected_concepts: [], default_topic_id: 'general', topics: [{ id: 'general', priority: 0, cues: [], cognition: { default: 'unknown' }, disclosure: [{ when: { always: true }, level: 'guarded', response_mode: 'soft_deflection' }] }], examples: [], conversation: { end_chat_modes: [] } };

function normalizedCueText(value) {
  return String(value || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}
function topicMatches(topic, normalizedPlayerText) {
  const cues = (topic.cues || []).map(cue => normalizedCueText(cue)).filter(Boolean);
  const matching = cues.filter(cue => normalizedPlayerText.includes(cue));
  return { matches: matching.length > 0, longestCue: Math.max(0, ...matching.map(cue => cue.length)) };
}
function resolveTopic(topic, snapshot) {
  const transition = (topic.cognition.transitions || []).find(entry => matchesDialogueCondition(entry.when, snapshot));
  return { topic, cognition: transition?.state || topic.cognition.default, rule: resolveFirstMatchingRule(topic.disclosure, snapshot) };
}
function topicFromOffTopic(policy) { return policy.topics.find(topic => topic.id === 'off_topic') || policy.topics.find(topic => topic.id === policy.default_topic_id) || policy.topics[0]; }
function repetitionFor(topic, playerText, transcript, baseMode) {
  const normalizedEntries = (transcript || []).filter(entry => String(entry?.role || entry?.speaker || '').toLowerCase() === 'player').map(entry => normalizedCueText(entry.text));
  const cues = (topic.cues || []).map(normalizedCueText).filter(Boolean);
  const prior = cues.length ? normalizedEntries.filter(entry => cues.some(cue => entry.includes(cue))).length : 0;
  const level = Math.min(3, prior + 1);
  const requested = topic.repetition?.[level === 1 ? 'first' : level === 2 ? 'second' : 'third'];
  return { level, responseMode: requested && responseStrength[requested] >= responseStrength[baseMode] ? requested : baseMode };
}

function protectedMaterial(policy) {
  const protectedFactIds = new Set(policy.topics.flatMap(topic => topic.disclosure.flatMap(rule => rule.level === 'guarded' || rule.level === 'sealed' || (rule.protected_concept_ids || []).length > 0 ? [...(rule.fact_ids || []), ...(rule.hint_fact_ids || [])] : [...(rule.hint_fact_ids || [])])));
  return [...policy.protected_concepts.flatMap(concept => concept.lexemes || []), ...policy.facts.filter(fact => protectedFactIds.has(fact.id) || (fact.tags || []).some(tag => /^(secret|protected)$/i.test(tag))).map(fact => fact.text)].filter(Boolean);
}

export function compileDialogueTurnContext(character, snapshot = {}, options) {
  const policy = character.policy || emptyPolicy;
  const playerText = normalizedCueText(snapshot.playerText);
  const matched = options.inputKind === 'off_topic'
    ? [{ ...resolveTopic(topicFromOffTopic(policy), snapshot), longestCue: 0 }]
    : policy.topics.map(topic => ({ ...resolveTopic(topic, snapshot), ...topicMatches(topic, playerText) })).filter(entry => entry.matches);
  const resolved = matched.length ? matched : [{ ...resolveTopic(policy.topics.find(topic => topic.id === policy.default_topic_id) || policy.topics[0], snapshot), longestCue: 0 }];
  resolved.sort((a, b) => strictness[b.rule.level] - strictness[a.rule.level] || b.topic.priority - a.topic.priority || b.longestCue - a.longestCue || a.topic.id.localeCompare(b.topic.id));
  const primary = resolved[0];
  const repetition = repetitionFor(primary.topic, playerText, snapshot.recentTranscript, primary.rule.response_mode);
  const factById = new Map(policy.facts.map(fact => [fact.id, fact]));
  const conceptById = new Map(policy.protected_concepts.map(concept => [concept.id, concept]));
  const allowedFacts = []; const hintableFacts = [];
  resolved.forEach(entry => {
    if (entry.rule.level === 'open' || entry.rule.level === 'partial') (entry.rule.fact_ids || []).forEach(id => { const fact = factById.get(id); if (fact && !allowedFacts.some(item => item.id === id)) allowedFacts.push({ id, text: fact.text }); });
    if (entry.rule.level === 'hint') (entry.rule.hint_fact_ids || []).forEach(id => { const fact = factById.get(id); if (fact?.hint_text && !hintableFacts.some(item => item.id === id)) hintableFacts.push({ id, hintText: fact.hint_text }); });
  });
  const protectedTopics = resolved.map(entry => ({ topicId: entry.topic.id, cognition: entry.cognition, rule: entry.rule.level, forbiddenConceptIds: [...(entry.rule.protected_concept_ids || [])] }));
  const protectedLexemes = [...new Set(protectedTopics.flatMap(topic => topic.forbiddenConceptIds.flatMap(id => conceptById.get(id)?.lexemes || [])))];
  const recentStyleSummary = (snapshot.recentTranscript || []).slice(-3).map(entry => `${String(entry.role || entry.speaker || 'player')}: ${String(entry.text || '').slice(0, 80)}`);
  const protectedExamplesMaterial = protectedMaterial(policy);
  const relevantExamples = policy.examples.filter(example => example.kind === 'positive' && resolved.some(entry => entry.topic.id === example.topic_id) && example.response_mode === repetition.responseMode && !protectedExamplesMaterial.some(material => String(example.player_text).includes(material) || example.reply_lines.some(line => String(line).includes(material))));
  return {
    character,
    actorContext: { characterIdentity: character.publicIdentity, voiceProfile: policy.voice, sceneSummary: character.nodeScenes?.[snapshot.currentNodeId] || '', relationshipPosture: `affection:${Number(snapshot.relationshipValues?.affection || 0)}`, cognitionStates: resolved.map(entry => ({ topicId: entry.topic.id, state: entry.cognition })), allowedFacts, hintableFacts, responseMode: repetition.responseMode, refusalEscalation: Math.min(3, repetition.level), recentStyleSummary, relevantExamples },
    directorContext: { voiceProfile: policy.voice, allowedFactIds: allowedFacts.map(fact => fact.id), hintableFactIds: hintableFacts.map(fact => fact.id), protectedTopics: protectedTopics.map(topic => ({ ...topic, rule: topic.forbiddenConceptIds.map(id => conceptById.get(id)?.capsule).filter(Boolean).join('\n') || topic.rule })), recentStyleSummary },
    guardRules: { protectedLexemes, bannedPhrases: [...policy.voice.banned_phrases], allowedMoods: ['steady', 'warm', 'guarded', 'awkward', 'cryptic', 'nostalgic'] },
    decision: { topicIds: resolved.map(entry => entry.topic.id), primaryTopicId: primary.topic.id, cognition: primary.cognition, disclosureLevel: primary.rule.level, responseMode: repetition.responseMode, repetitionLevel: repetition.level, endChat: policy.conversation.end_chat_modes.includes(repetition.responseMode) },
  };
}
