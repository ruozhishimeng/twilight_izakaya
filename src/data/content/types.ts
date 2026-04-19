import type { JournalReward } from '../../types/journal';
import type { NodeAudioConfig } from '../../systems/audioCatalog';

export interface Feature {
  id: string;
  name: string;
  type: 'status' | 'experience' | 'trait';
  desc: string;
  x: number;
  y: number;
  group?: string;
}

export interface ScriptFlowStep {
  type: 'env' | 'npc' | 'inner';
  content: string[] | string;
}

export interface PlayerOptionCondition {
  need_item: string;
  locked_text: string;
}

export interface NodePlayerOption {
  option?: string;
  text: string;
  branch_type?: 'flavor' | 'plot' | 'choice' | null;
  branchType?: 'flavor' | 'plot' | 'choice' | null;
  script_flow?: ScriptFlowStep[];
  immediate_response?: string | null;
  next_node?: string | null;
  fallback_node?: string | null;
  impact_log?: string;
  trigger_event?: string;
  condition?: PlayerOptionCondition;
}

export interface GuestPhase {
  enterDesc: string;
  intro: string;
  turns: NodePlayerOption[][];
}

export interface NodeTriggerCondition {
  need_event?: string[];
  need_time?: string;
  need_item?: string[];
}

export interface StoryUnlockEntrySource {
  id: string;
  reason?: string;
}

export interface StoryUnlocksSource {
  chapters?: StoryUnlockEntrySource[];
}

export type CharacterRewardDetail = JournalReward;

export interface CharacterReward {
  details: CharacterRewardDetail | CharacterRewardDetail[];
}

export interface PreferredDrinkSource {
  id?: string;
  name?: string;
  formula?: string[];
}

export interface DrinkRequestEvalBranches {
  fail?: string | null;
}

export interface DrinkRequestSource {
  mode?: string;
  request_text?: string;
  hint?: string;
  retry_on_fail?: boolean;
  preferred_drink?: PreferredDrinkSource;
  eval_branches?: DrinkRequestEvalBranches;
}

export interface TeachingRecipeSource {
  id?: string;
  name?: string;
  ingredients?: string[];
  formula?: string[];
  steps?: string[];
}

export interface TeachingGameActionSource {
  trigger?: string;
  action?: string;
  type?: string;
  params?: Record<string, unknown>;
}

export interface TeachingSource {
  recipe?: TeachingRecipeSource;
  mixing_steps_display?: string[];
  game_action?: TeachingGameActionSource;
  tip?: string;
}

export interface NodePresentation {
  portrait?: 'show' | 'hide' | 'keep';
  expression?: string;
  speaker?: 'npc' | 'system' | 'player';
}

export interface ObservationTriggerSource {
  prompt?: string;
  continue_node?: string;
  feature_groups?: string[];
}

export interface CharacterLlmChatSource {
  enabled?: boolean;
  max_turns_per_visit?: number;
  entry_status_text?: string;
  blocked_message?: string;
  exhausted_message?: string;
}

export interface NodeLlmChatSource {
  enabled?: boolean;
  max_turns?: number;
  entry_status_text?: string;
  blocked_message?: string;
  exhausted_message?: string;
  entry_mode?: 'before_next_node' | 'after_node';
}

export interface ResolvedLlmChatConfig {
  enabled: boolean;
  maxTurns: number;
  entryStatusText: string;
  blockedMessage: string;
  exhaustedMessage: string;
}

export interface CharacterNode {
  event_id?: string;
  id?: string;
  next_node?: string | null;
  trigger_condition?: NodeTriggerCondition;
  script_flow?: ScriptFlowStep[];
  player_options?: NodePlayerOption[];
  reward?: CharacterReward;
  drink_request?: DrinkRequestSource;
  teaching?: TeachingSource;
  presentation?: NodePresentation;
  audio?: NodeAudioConfig;
  diary_note?: string;
  unlock_gallery?: string;
  story_unlocks?: StoryUnlocksSource;
  trigger_observation?: ObservationTriggerSource;
  atmosphere_lines?: string[];
  speaker?: string | null;
  content?: string[];
  npc_talking?: string[];
  player_inner?: string[];
  bartender_reflection?: string;
  bartender_inner?: string;
  on_mixing_complete?: string | null;
  on_mixing_fail?: string | null;
  unlock_next_phase?: string;
  complete_teaching?: boolean;
  game_action?: TeachingGameActionSource;
  llm_chat?: NodeLlmChatSource;
  [key: string]: unknown;
}

export interface GallerySection {
  id: string;
  subtitle?: string;
  content: string;
}

export interface GalleryChapter {
  id: string;
  title: string;
  summary: string;
  content?: string;
  sections?: GallerySection[];
  unlockCondition?: string;
  depthLevel: number;
  legacyUnlockIds?: string[];
}

export interface GuestGallery {
  baseInfo: Record<string, unknown>;
  chapters: GalleryChapter[];
}

export type GuestNodeGroupName = 'main' | 'teaching' | 'chat' | 'hidden';

export interface GuestNodeGroups {
  main: CharacterNode[];
  teaching: CharacterNode[];
  chat: CharacterNode[];
  hidden: CharacterNode[];
  all: CharacterNode[];
}

export interface CharacterBaseInfoSource {
  name?: string;
  age?: string;
  description?: string;
  type?: string;
  short_story?: string;
  intro?: string;
  summary?: string;
  [key: string]: unknown;
}

export interface CharacterMetaDocument {
  character_id?: string;
  base_info?: CharacterBaseInfoSource;
  description?: string;
  personality?: string;
  llm_chat?: CharacterLlmChatSource;
  [key: string]: unknown;
}

export interface ObservationEntrySource {
  id?: string;
  area?: string;
  group?: string;
  objective?: string;
  subjective?: string;
  hint?: string;
  revealed_at?: string;
  x?: number;
  y?: number;
}

export interface ObservationsDocument {
  character_id?: string;
  observations?: ObservationEntrySource[];
}

export interface GalleryProfileSectionSource {
  id?: string;
  title?: string;
  name?: string;
  summary?: string;
  content?: string;
  unlock_condition?: string;
  depth_level?: number;
}

export interface GalleryDocument {
  character_id?: string;
  base_info?: Record<string, unknown>;
  profile_sections?: GalleryProfileSectionSource[];
}

export interface CharacterNodeDocument {
  character_id?: string;
  nodes?: CharacterNode[];
}

export interface IngredientCatalogEntry {
  id: string;
  name: string;
  category?: string;
  tag1?: string;
  tag2?: string;
  emotion_tag?: string;
  gallery_description?: string;
  unlocked?: boolean;
}

export interface RecipeCatalogEntry {
  id: string;
  name: string;
  formula?: string[];
  tag1?: string;
  tag2?: string;
  emotion_tags?: string[];
  gallery_description?: string;
  target_npc?: string;
  series?: string;
  unlocked?: boolean;
}

export interface RecipesCatalog {
  meta?: Record<string, unknown>;
  ingredients: {
    bases: {
      japanese: IngredientCatalogEntry[];
      classic: IngredientCatalogEntry[];
    };
    mixers: IngredientCatalogEntry[];
    flavors: IngredientCatalogEntry[];
  };
  recipes: RecipeCatalogEntry[];
}

export interface Guest {
  id: string;
  name: string;
  imagePlaceholderColor: string;
  avatarColor: string;
  image: string;
  expressions: Record<string, string>;
  features: Feature[];
  correctFeatures: string[];
  phases: GuestPhase[];
  type: 'Regular Customer' | 'Lost Soul' | 'Ghost';
  meta: CharacterMetaDocument;
  llmChatDefault: ResolvedLlmChatConfig;
  gallery: GuestGallery;
  startNodeIds: string[];
  nodeMap: Map<string, CharacterNode>;
  nodes: GuestNodeGroups;
}

export interface ScheduleGuest {
  character_id: string;
  start_node: string;
}

export interface ScheduleDay {
  day: string;
  guests: ScheduleGuest[];
}

export interface ScheduleData {
  schedule: ScheduleDay[];
}

export interface ParsedCharacterSource {
  id: string;
  directory: string;
  meta?: CharacterMetaDocument;
  nodesMain?: CharacterNodeDocument;
  nodesTeaching?: CharacterNodeDocument;
  nodesChat?: CharacterNodeDocument;
  nodesHidden?: CharacterNodeDocument;
  observations?: ObservationsDocument;
  gallery?: GalleryDocument;
  images: Record<string, string>;
}

export interface ParsedContentSource {
  characters: Record<string, ParsedCharacterSource>;
  schedule: ScheduleData;
  recipes: RecipesCatalog;
  drinkImages: Record<string, string>;
}

export interface ContentRegistry {
  guests: Guest[];
  guestById: Map<string, Guest>;
  schedule: ScheduleData;
  recipes: RecipesCatalog;
  ingredientIds: Set<string>;
  recipeIds: Set<string>;
}
