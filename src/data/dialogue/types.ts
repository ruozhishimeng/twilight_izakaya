export const DIALOGUE_COGNITIONS = ['known', 'suspected', 'suppressed', 'mistaken', 'unknown'] as const;
export const DIALOGUE_DISCLOSURE_LEVELS = ['open', 'partial', 'hint', 'guarded', 'sealed'] as const;
export const DIALOGUE_RESPONSE_MODES = ['direct_answer', 'partial_answer', 'emotional_hint', 'soft_deflection', 'guarded_refusal', 'explicit_boundary', 'silence_or_exit'] as const;
export const DIALOGUE_MOODS = ['steady', 'warm', 'guarded', 'awkward', 'cryptic', 'nostalgic'] as const;
export type DialogueCognition = typeof DIALOGUE_COGNITIONS[number];
export type DialogueDisclosureLevel = typeof DIALOGUE_DISCLOSURE_LEVELS[number];
export type DialogueResponseMode = typeof DIALOGUE_RESPONSE_MODES[number];
export type DialogueMood = typeof DIALOGUE_MOODS[number];
export type DialogueWhenSource = { always: true } | { all: DialogueWhenSource[] } | { any: DialogueWhenSource[] } | { relationship: { axis: 'affection'; min?: number; max?: number } } | { completed_event: string } | { selected_option: string } | { unlocked_chapter: string } | { current_node: string } | { observed_feature: string } | { last_drink_success: boolean };
export interface DialogueFactSource { id: string; text: string; hint_text?: string; tags: string[]; }
export interface DialogueProtectedConceptSource { id: string; capsule: string; lexemes: string[]; }
export interface DialogueDisclosureRuleSource { when: DialogueWhenSource; level: DialogueDisclosureLevel; response_mode: DialogueResponseMode; fact_ids?: string[]; hint_fact_ids?: string[]; protected_concept_ids?: string[]; }
export interface DialogueTopicSource { id: string; priority: number; cues: string[]; cognition: { default: DialogueCognition; transitions?: Array<{ when: DialogueWhenSource; state: DialogueCognition }> }; disclosure: DialogueDisclosureRuleSource[]; repetition?: Partial<Record<'first' | 'second' | 'third', DialogueResponseMode>>; }
export interface DialogueFallbackSource { reply_lines: string[]; mood: DialogueMood; }
export interface DialoguePolicyDocument { version: 1; character_id: string; public_identity: { role: string; appearance: string; personality: string }; voice: { sentence_length: 'short' | 'medium'; rhythm: string; initiative: 'low' | 'medium' | 'high'; action_frequency: 'rare' | 'occasional' | 'frequent'; preferred: string[]; avoid: string[]; banned_phrases: string[]; }; facts: DialogueFactSource[]; protected_concepts: DialogueProtectedConceptSource[]; default_topic_id: string; topics: DialogueTopicSource[]; fallbacks: Record<string, DialogueFallbackSource>; examples: Array<{ id: string; topic_id: string; response_mode: DialogueResponseMode; mood: DialogueMood; kind: 'positive' | 'negative'; player_text: string; reply_lines: string[]; }>; conversation: { end_chat_modes: DialogueResponseMode[] }; }
export interface DialogueManifest { version: 1; characters: Record<string, DialogueManifestCharacter>; validIds: { completedEventIds: string[]; selectedOptionIds: string[]; unlockedChapterIds: string[]; }; }
export interface DialogueManifestCharacter { characterId: string; name: string; guestType: 'Regular Customer' | 'Lost Soul' | 'Ghost'; publicIdentity: { role: string; appearance: string; personality: string }; validIds: { nodeIds: string[]; observedFeatureIds: string[]; recipeIds: string[]; }; nodeScenes: Record<string, string>; policy: DialoguePolicyDocument | null; }
export interface DialogueTranscriptEntry { role: 'player' | 'npc' | 'narration'; source: 'story' | 'tail_chat'; text: string; }
export interface DialogueProgressSnapshot {
  guestId: string;
  week: number;
  day: number;
  guestInDay: number;
  currentNodeId: string | null;
  relationshipValues: Record<string, number>;
  completedEventIds: string[];
  selectedOptionIds: string[];
  unlockedChapterIds: string[];
  observedFeatureIds: string[];
  lastDrink: { recipeId: string | null; isSuccess: boolean; sourceNodeId: string | null } | null;
  recentTranscript: DialogueTranscriptEntry[];
  turnIndex: number;
  playerText: string;
}
export interface DialogueTurnCompilation {
  actorContext: { characterIdentity: DialogueManifestCharacter['publicIdentity']; voiceProfile: DialoguePolicyDocument['voice']; sceneSummary: string; relationshipPosture: string; cognitionStates: Array<{ topicId: string; state: DialogueCognition }>; allowedFacts: Array<{ id: string; text: string }>; hintableFacts: Array<{ id: string; hintText: string }>; responseMode: DialogueResponseMode; refusalEscalation: 1 | 2 | 3; recentStyleSummary: string[]; relevantExamples: DialoguePolicyDocument['examples']; };
  directorContext: { voiceProfile: DialoguePolicyDocument['voice']; allowedFactIds: string[]; hintableFactIds: string[]; protectedTopics: Array<{ topicId: string; cognition: DialogueCognition; rule: string; forbiddenConceptIds: string[]; }>; recentStyleSummary: string[]; };
  guardRules: { protectedLexemes: string[]; bannedPhrases: string[]; allowedMoods: DialogueMood[]; };
  decision: { topicIds: string[]; primaryTopicId: string; cognition: DialogueCognition; disclosureLevel: DialogueDisclosureLevel; responseMode: DialogueResponseMode; repetitionLevel: 1 | 2 | 3; endChat: boolean; };
}
