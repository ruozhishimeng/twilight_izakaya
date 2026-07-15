import type {
  CharacterNode,
  CharacterReward,
  CharacterLlmChatSource,
  ContentRegistry,
  DrinkRequestSource,
  GalleryChapter,
  Guest,
  GuestNodeGroupName,
  NodeLlmChatSource,
  NodePlayerOption,
  NodeTriggerCondition,
  ObservationTriggerSource,
  ScriptFlowStep,
  TeachingRecipeSource,
  TeachingSource,
} from './types';
import { getExitTargets, resolveNodeExit } from './narrative';

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasPositiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasNextNarrativeExit(node: CharacterNode | undefined) {
  if (!node) {
    return false;
  }
  try {
    return resolveNodeExit(node).kind === 'next';
  } catch {
    return false;
  }
}

function nodeRefId(node: CharacterNode) {
  return String(node.event_id || node.id || 'unknown-node');
}

function chapterMatchesUnlockId(chapter: GalleryChapter, unlockId: string) {
  return chapter.id === unlockId || chapter.legacyUnlockIds?.includes(unlockId);
}

function guestHasGalleryUnlock(guest: Guest, unlockId: string) {
  return guest.gallery.chapters.some(chapter => chapterMatchesUnlockId(chapter, unlockId));
}

function normalizeRewardDetails(reward?: CharacterReward) {
  if (!reward?.details) {
    return [];
  }
  return Array.isArray(reward.details) ? reward.details : [reward.details];
}

function validateFormula(formula: string[] | undefined, registry: ContentRegistry, context: string, errors: string[]) {
  if (!Array.isArray(formula) || formula.length === 0) {
    errors.push(`${context} is missing a non-empty formula`);
    return;
  }

  formula.forEach(itemId => {
    if (!registry.ingredientIds.has(String(itemId))) {
      errors.push(`${context} references unknown ingredient id "${itemId}"`);
    }
  });
}

function validateTriggerCondition(
  guest: Guest,
  nodeId: string,
  triggerCondition: NodeTriggerCondition | undefined,
  errors: string[],
) {
  if (!triggerCondition) {
    return;
  }

  if (
    triggerCondition.need_event !== undefined &&
    !Array.isArray(triggerCondition.need_event)
  ) {
    errors.push(`[${guest.id}] node ${nodeId} trigger_condition.need_event must be an array`);
  }

  if (
    triggerCondition.need_item !== undefined &&
    !Array.isArray(triggerCondition.need_item)
  ) {
    errors.push(`[${guest.id}] node ${nodeId} trigger_condition.need_item must be an array`);
  }

  if (
    triggerCondition.need_time !== undefined &&
    !hasNonEmptyString(triggerCondition.need_time)
  ) {
    errors.push(`[${guest.id}] node ${nodeId} trigger_condition.need_time must be a non-empty string`);
  }

  if (Array.isArray(triggerCondition.need_event)) {
    triggerCondition.need_event.forEach(eventId => {
      if (!guest.nodeMap.has(String(eventId))) {
        errors.push(`[${guest.id}] node ${nodeId} requires missing event "${eventId}"`);
      }
    });
  }
}

function validateScriptFlow(
  guest: Guest,
  nodeId: string,
  scriptFlow: ScriptFlowStep[] | undefined,
  errors: string[],
) {
  if (!Array.isArray(scriptFlow) || scriptFlow.length === 0) {
    errors.push(`[${guest.id}] node ${nodeId} is missing script_flow`);
    return;
  }

  scriptFlow.forEach((entry, index) => {
    if (entry.type !== 'env' && entry.type !== 'npc' && entry.type !== 'inner') {
      errors.push(`[${guest.id}] node ${nodeId} script_flow[${index}] has unsupported type "${String(entry.type)}"`);
    }

    const lines = Array.isArray(entry.content) ? entry.content : [entry.content];
    if (lines.length === 0 || lines.some(line => !hasNonEmptyString(line))) {
      errors.push(`[${guest.id}] node ${nodeId} script_flow[${index}] must contain non-empty content`);
    }
  });
}

function validateAmbientNodeContent(
  guest: Guest,
  nodeId: string,
  node: CharacterNode,
  errors: string[],
) {
  if (!Array.isArray(node.atmosphere_lines) || node.atmosphere_lines.length === 0) {
    errors.push(`[${guest.id}] node ${nodeId} is missing atmosphere_lines`);
  } else if (node.atmosphere_lines.some(line => !hasNonEmptyString(line))) {
    errors.push(`[${guest.id}] node ${nodeId} atmosphere_lines must contain non-empty strings`);
  }

  if (!Array.isArray(node.content) || node.content.length === 0) {
    errors.push(`[${guest.id}] node ${nodeId} is missing content`);
  } else if (node.content.some(line => !hasNonEmptyString(line))) {
    errors.push(`[${guest.id}] node ${nodeId} content must contain non-empty strings`);
  }
}

function validateCharacterLlmChatConfig(
  guest: Guest,
  config: CharacterLlmChatSource | undefined,
  errors: string[],
) {
  if (config === undefined) {
    return;
  }

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    errors.push(`[${guest.id}] character_meta llm_chat must be an object`);
    return;
  }

  const allowedKeys = new Set([
    'enabled',
    'max_turns_per_visit',
    'entry_status_text',
    'blocked_message',
    'exhausted_message',
  ]);

  Object.keys(config).forEach(key => {
    if (!allowedKeys.has(key)) {
      errors.push(`[${guest.id}] character_meta llm_chat contains unsupported key "${key}"`);
    }
  });

  if ('enabled' in config && typeof config.enabled !== 'boolean') {
    errors.push(`[${guest.id}] character_meta llm_chat.enabled must be a boolean`);
  }

  if ('max_turns_per_visit' in config && !hasPositiveInteger(config.max_turns_per_visit)) {
    errors.push(`[${guest.id}] character_meta llm_chat.max_turns_per_visit must be a positive integer`);
  }

  if ('entry_status_text' in config && !hasNonEmptyString(config.entry_status_text)) {
    errors.push(`[${guest.id}] character_meta llm_chat.entry_status_text must be a non-empty string`);
  }

  if ('blocked_message' in config && !hasNonEmptyString(config.blocked_message)) {
    errors.push(`[${guest.id}] character_meta llm_chat.blocked_message must be a non-empty string`);
  }

  if ('exhausted_message' in config && !hasNonEmptyString(config.exhausted_message)) {
    errors.push(`[${guest.id}] character_meta llm_chat.exhausted_message must be a non-empty string`);
  }
}

function validateNodeLlmChatConfig(
  guest: Guest,
  nodeId: string,
  config: NodeLlmChatSource | undefined,
  errors: string[],
) {
  if (config === undefined) {
    return;
  }

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    errors.push(`[${guest.id}] node ${nodeId} llm_chat must be an object`);
    return;
  }

  const allowedKeys = new Set([
    'enabled',
    'max_turns',
    'entry_status_text',
    'blocked_message',
    'exhausted_message',
    'entry_mode',
  ]);

  Object.keys(config).forEach(key => {
    if (!allowedKeys.has(key)) {
      errors.push(`[${guest.id}] node ${nodeId} llm_chat contains unsupported key "${key}"`);
    }
  });

  if ('enabled' in config && typeof config.enabled !== 'boolean') {
    errors.push(`[${guest.id}] node ${nodeId} llm_chat.enabled must be a boolean`);
  }

  if ('max_turns' in config && !hasPositiveInteger(config.max_turns)) {
    errors.push(`[${guest.id}] node ${nodeId} llm_chat.max_turns must be a positive integer`);
  }

  if ('entry_status_text' in config && !hasNonEmptyString(config.entry_status_text)) {
    errors.push(`[${guest.id}] node ${nodeId} llm_chat.entry_status_text must be a non-empty string`);
  }

  if ('blocked_message' in config && !hasNonEmptyString(config.blocked_message)) {
    errors.push(`[${guest.id}] node ${nodeId} llm_chat.blocked_message must be a non-empty string`);
  }

  if ('exhausted_message' in config && !hasNonEmptyString(config.exhausted_message)) {
    errors.push(`[${guest.id}] node ${nodeId} llm_chat.exhausted_message must be a non-empty string`);
  }

  if (
    'entry_mode' in config &&
    config.entry_mode !== 'before_next_node' &&
    config.entry_mode !== 'after_node'
  ) {
    errors.push(`[${guest.id}] node ${nodeId} llm_chat.entry_mode must be "before_next_node" or "after_node"`);
  }

  const sourceNode = guest.nodeMap.get(nodeId);
  if (
    config.entry_mode === 'before_next_node' &&
    !hasNextNarrativeExit(sourceNode)
  ) {
    errors.push(`[${guest.id}] node ${nodeId} llm_chat.entry_mode=before_next_node requires a next exit`);
  }
}

function validatePlayerOptions(
  guest: Guest,
  nodeId: string,
  playerOptions: NodePlayerOption[] | undefined,
  errors: string[],
) {
  if (playerOptions === undefined) {
    return;
  }

  if (!Array.isArray(playerOptions)) {
    errors.push(`[${guest.id}] node ${nodeId} player_options must be an array`);
    return;
  }

  playerOptions.forEach((option, index) => {
    if (!hasNonEmptyString(option.text) && !hasNonEmptyString(option.option)) {
      errors.push(`[${guest.id}] node ${nodeId} option ${index + 1} is missing text`);
    }

    if (option.next_node && !guest.nodeMap.has(String(option.next_node))) {
      errors.push(`[${guest.id}] node ${nodeId} option ${index + 1} points to missing next_node "${option.next_node}"`);
    }

    if (option.fallback_node && !guest.nodeMap.has(String(option.fallback_node))) {
      errors.push(`[${guest.id}] node ${nodeId} option ${index + 1} points to missing fallback_node "${option.fallback_node}"`);
    }

    if (option.script_flow && (!Array.isArray(option.script_flow) || option.script_flow.length === 0)) {
      errors.push(`[${guest.id}] node ${nodeId} option ${index + 1} script_flow must be a non-empty array`);
    }
  });
}

function validateNarrativeEffectScope(
  value: unknown,
  context: string,
  errors: string[],
) {
  if (value !== undefined && value !== 'game' && value !== 'visit') {
    errors.push(`${context} effect_scope must be "game" or "visit"`);
  }
}

function validateNarrativeEffectsBlock(
  value: unknown,
  context: string,
  errors: string[],
) {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push(`${context} effects must be an array`);
    return;
  }

  const effectIds = new Set<string>();
  value.forEach((effect, index) => {
    const effectContext = `${context} effect ${index + 1}`;
    if (!isRecord(effect)) {
      errors.push(`${effectContext} must be an object`);
      return;
    }

    const effectId = effect.id;
    if (!hasNonEmptyString(effectId)) {
      errors.push(`${effectContext} id must be a non-empty string`);
    } else if (effectIds.has(effectId)) {
      errors.push(`${context} contains duplicate effect id "${effectId}"`);
    } else {
      effectIds.add(effectId);
    }

    if (effect.type !== 'relationship.change') {
      errors.push(`${effectContext} type must be "relationship.change"`);
    }
    if (!hasNonEmptyString(effect.target)) {
      errors.push(`${effectContext} target must be a non-empty string`);
    }
    if (effect.axis !== undefined && !hasNonEmptyString(effect.axis)) {
      errors.push(`${effectContext} axis must be a non-empty string`);
    }
    if (
      typeof effect.amount !== 'number' ||
      !Number.isFinite(effect.amount) ||
      effect.amount === 0
    ) {
      errors.push(`${effectContext} amount must be a finite non-zero number`);
    }
    if (effect.feedback !== undefined && !hasNonEmptyString(effect.feedback)) {
      errors.push(`${effectContext} feedback must be a non-empty string`);
    }
  });
}

export function validateNarrativeEffectDeclarations(
  guestId: string,
  nodeId: string,
  node: CharacterNode,
): string[] {
  const errors: string[] = [];
  const optionIds = new Set<string>();

  if (Array.isArray(node.player_options)) {
    node.player_options.forEach((option, index) => {
      const context = `[${guestId}] node ${nodeId} option ${index + 1}`;
      const optionId = option.id;
      const definesEffects = hasOwn(option, 'effects');

      if (optionId !== undefined && !hasNonEmptyString(optionId)) {
        errors.push(`${context} id must be a non-empty string`);
      } else if (hasNonEmptyString(optionId)) {
        if (optionIds.has(optionId)) {
          errors.push(`[${guestId}] node ${nodeId} contains duplicate option id "${optionId}"`);
        } else {
          optionIds.add(optionId);
        }
      }

      if (definesEffects && !hasNonEmptyString(optionId)) {
        errors.push(`${context} with effects requires a stable id`);
      }

      validateNarrativeEffectScope(option.effect_scope, context, errors);
      validateNarrativeEffectsBlock(option.effects, context, errors);
    });
  }

  if (node.on_complete !== undefined) {
    const context = `[${guestId}] node ${nodeId} on_complete`;
    if (!isRecord(node.on_complete)) {
      errors.push(`${context} must be an object`);
    } else {
      validateNarrativeEffectScope(node.on_complete.effect_scope, context, errors);
      validateNarrativeEffectsBlock(node.on_complete.effects, context, errors);
    }
  }

  return errors;
}

function validateObservationTrigger(
  guest: Guest,
  nodeId: string,
  trigger: ObservationTriggerSource | undefined,
  errors: string[],
) {
  if (!trigger) {
    return;
  }

  if (!hasNonEmptyString(trigger.prompt)) {
    errors.push(`[${guest.id}] node ${nodeId} trigger_observation.prompt must be a non-empty string`);
  }

  if (!hasNonEmptyString(trigger.continue_node)) {
    errors.push(`[${guest.id}] node ${nodeId} trigger_observation.continue_node must be a non-empty string`);
  } else if (!guest.nodeMap.has(String(trigger.continue_node))) {
    errors.push(`[${guest.id}] node ${nodeId} trigger_observation points to missing continue_node "${trigger.continue_node}"`);
  }

  if (
    trigger.feature_groups !== undefined &&
    !Array.isArray(trigger.feature_groups)
  ) {
    errors.push(`[${guest.id}] node ${nodeId} trigger_observation.feature_groups must be an array`);
  }
}

function validateTeachingRecipe(
  guest: Guest,
  nodeId: string,
  recipe: TeachingRecipeSource | undefined,
  registry: ContentRegistry,
  errors: string[],
) {
  if (!recipe) {
    errors.push(`[${guest.id}] node ${nodeId} teaching is missing recipe`);
    return;
  }

  if (!hasNonEmptyString(recipe.id) || !registry.recipeIds.has(String(recipe.id))) {
    errors.push(`[${guest.id}] node ${nodeId} teaching recipe id "${String(recipe.id)}" is unknown`);
  }

  if (!hasNonEmptyString(recipe.name)) {
    errors.push(`[${guest.id}] node ${nodeId} teaching recipe is missing name`);
  }

  if (!Array.isArray(recipe.steps) || recipe.steps.length === 0 || recipe.steps.some(step => !hasNonEmptyString(step))) {
    errors.push(`[${guest.id}] node ${nodeId} teaching recipe is missing non-empty steps`);
  }

  validateFormula(recipe.formula, registry, `[${guest.id}] node ${nodeId} teaching recipe`, errors);
}

function validateTeaching(
  guest: Guest,
  nodeId: string,
  teaching: TeachingSource | undefined,
  registry: ContentRegistry,
  errors: string[],
) {
  if (!teaching) {
    return;
  }

  validateTeachingRecipe(guest, nodeId, teaching.recipe, registry, errors);

  if (
    teaching.mixing_steps_display !== undefined &&
    (!Array.isArray(teaching.mixing_steps_display) ||
      teaching.mixing_steps_display.length === 0 ||
      teaching.mixing_steps_display.some(step => !hasNonEmptyString(step)))
  ) {
    errors.push(`[${guest.id}] node ${nodeId} teaching.mixing_steps_display must be a non-empty string array`);
  }

  if (teaching.tip !== undefined && !hasNonEmptyString(teaching.tip)) {
    errors.push(`[${guest.id}] node ${nodeId} teaching.tip must be a non-empty string`);
  }
}

function validateDrinkRequest(
  guest: Guest,
  nodeId: string,
  drinkRequest: DrinkRequestSource | undefined,
  registry: ContentRegistry,
  errors: string[],
) {
  if (!drinkRequest) {
    return;
  }

  if (!hasNonEmptyString(drinkRequest.request_text)) {
    errors.push(`[${guest.id}] node ${nodeId} drink_request.request_text must be a non-empty string`);
  }

  if (!drinkRequest.preferred_drink) {
    errors.push(`[${guest.id}] node ${nodeId} drink_request is missing preferred_drink`);
    return;
  }

  if (!hasNonEmptyString(drinkRequest.preferred_drink.id)) {
    errors.push(`[${guest.id}] node ${nodeId} preferred drink is missing id`);
  } else if (!registry.recipeIds.has(String(drinkRequest.preferred_drink.id))) {
    errors.push(`[${guest.id}] node ${nodeId} preferred drink id "${drinkRequest.preferred_drink.id}" is unknown`);
  }

  if (!hasNonEmptyString(drinkRequest.preferred_drink.name)) {
    errors.push(`[${guest.id}] node ${nodeId} preferred drink is missing name`);
  }

  validateFormula(
    drinkRequest.preferred_drink.formula,
    registry,
    `[${guest.id}] node ${nodeId} preferred drink`,
    errors,
  );
}

function validateNarrativeExit(
  guest: Guest,
  nodeId: string,
  node: CharacterNode,
  registry: ContentRegistry,
  errors: string[],
) {
  let exit: ReturnType<typeof resolveNodeExit>;

  try {
    exit = resolveNodeExit(node);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`[${guest.id}] node ${nodeId} has invalid narrative exit: ${message}`);
    return;
  }

  switch (exit.kind) {
    case 'next':
      if (!hasNonEmptyString(exit.target)) {
        errors.push(`[${guest.id}] node ${nodeId} exit.next target must be a non-empty string`);
      }
      break;
    case 'observation':
      if (!hasNonEmptyString(exit.prompt)) {
        errors.push(`[${guest.id}] node ${nodeId} exit.observation prompt must be a non-empty string`);
      }
      if (!hasNonEmptyString(exit.continue_node)) {
        errors.push(`[${guest.id}] node ${nodeId} exit.observation continue_node must be a non-empty string`);
      }
      if (
        exit.feature_groups !== undefined &&
        !Array.isArray(exit.feature_groups)
      ) {
        errors.push(`[${guest.id}] node ${nodeId} exit.observation feature_groups must be an array`);
      }
      break;
    case 'mixing': {
      if (!exit.request || typeof exit.request !== 'object' || Array.isArray(exit.request)) {
        errors.push(`[${guest.id}] node ${nodeId} exit.mixing is missing request`);
      } else {
        validateDrinkRequest(guest, nodeId, exit.request, registry, errors);
      }

      const outcomes = exit.outcomes;
      if (!outcomes || typeof outcomes !== 'object' || Array.isArray(outcomes)) {
        errors.push(`[${guest.id}] node ${nodeId} exit.mixing is missing outcomes`);
        return;
      }

      const hasSuccessTarget = hasNonEmptyString(outcomes.success);
      const hasFailTarget = hasNonEmptyString(outcomes.fail);

      if (hasOwn(node, 'exit')) {
        if (!hasSuccessTarget) {
          errors.push(`[${guest.id}] node ${nodeId} exit.mixing outcomes.success must be a non-empty target`);
        }
        if (!hasFailTarget) {
          errors.push(`[${guest.id}] node ${nodeId} exit.mixing outcomes.fail must be a non-empty target`);
        }
      } else if (!hasSuccessTarget && !hasFailTarget) {
        errors.push(`[${guest.id}] mixing node ${nodeId} must define at least one success or fail target`);
      }
      break;
    }
    case 'end_visit':
      break;
    default:
      errors.push(
        `[${guest.id}] node ${nodeId} has unsupported exit kind "${String((exit as { kind?: unknown }).kind)}"`,
      );
      return;
  }

  let targets: string[];
  try {
    targets = getExitTargets(exit);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`[${guest.id}] node ${nodeId} cannot enumerate exit targets: ${message}`);
    return;
  }

  targets.forEach(target => {
    if (!hasNonEmptyString(target)) {
      errors.push(`[${guest.id}] node ${nodeId} exit target must be a non-empty string`);
    } else if (!guest.nodeMap.has(target)) {
      errors.push(`[${guest.id}] node ${nodeId} exit points to missing target "${target}"`);
    }
  });
}

function validateRewards(
  guest: Guest,
  nodeId: string,
  reward: CharacterReward | undefined,
  registry: ContentRegistry,
  errors: string[],
) {
  normalizeRewardDetails(reward).forEach(detail => {
    if (!detail?.type || !detail?.id || !detail?.name || !detail?.description) {
      errors.push(`[${guest.id}] node ${nodeId} contains malformed reward detail`);
      return;
    }
    if (detail.type === 'recipe' && !registry.recipeIds.has(String(detail.id))) {
      errors.push(`[${guest.id}] node ${nodeId} rewards unknown recipe "${detail.id}"`);
    }
    if ((detail.type === 'ingredient' || detail.type === 'item') && !registry.ingredientIds.has(String(detail.id))) {
      errors.push(`[${guest.id}] node ${nodeId} rewards unknown inventory item "${detail.id}"`);
    }
  });
}

function validateStoryUnlocks(
  guest: Guest,
  nodeId: string,
  node: CharacterNode,
  errors: string[],
) {
  const storyUnlocks = node.story_unlocks?.chapters;
  if (!storyUnlocks) {
    return;
  }

  if (!Array.isArray(storyUnlocks) || storyUnlocks.length === 0) {
    errors.push(`[${guest.id}] node ${nodeId} story_unlocks.chapters must be a non-empty array`);
    return;
  }

  storyUnlocks.forEach(entry => {
    const unlockId = entry?.id;
    if (!unlockId || !guestHasGalleryUnlock(guest, String(unlockId))) {
      errors.push(`[${guest.id}] node ${nodeId} unlocks unknown gallery chapter "${unlockId}"`);
    }
  });
}

function validateCommonNodeReferences(
  guest: Guest,
  nodeId: string,
  node: CharacterNode,
  registry: ContentRegistry,
  errors: string[],
) {
  validateNarrativeExit(guest, nodeId, node, registry, errors);
  validateTriggerCondition(guest, nodeId, node.trigger_condition, errors);
  validatePlayerOptions(guest, nodeId, node.player_options, errors);
  errors.push(...validateNarrativeEffectDeclarations(guest.id, nodeId, node));
  if (!hasOwn(node, 'exit')) {
    validateObservationTrigger(guest, nodeId, node.trigger_observation, errors);
  }
  validateStoryUnlocks(guest, nodeId, node, errors);
  validateRewards(guest, nodeId, node.reward, registry, errors);
  validateNodeLlmChatConfig(guest, nodeId, node.llm_chat, errors);

  if (node.diary_note !== undefined && typeof node.diary_note !== 'string') {
    errors.push(`[${guest.id}] node ${nodeId} diary_note must be a string`);
  }

  if (
    typeof node.unlock_gallery === 'string' &&
    !guest.gallery.chapters.some(chapter => chapter.id === node.unlock_gallery)
  ) {
    errors.push(`[${guest.id}] node ${nodeId} unlock_gallery "${node.unlock_gallery}" does not exist in gallery`);
  }
}

function validateNodeByGroup(
  guest: Guest,
  group: GuestNodeGroupName,
  node: CharacterNode,
  registry: ContentRegistry,
  errors: string[],
) {
  const nodeId = nodeRefId(node);

  validateCommonNodeReferences(guest, nodeId, node, registry, errors);

  if (group === 'main' || group === 'teaching') {
    validateScriptFlow(guest, nodeId, node.script_flow, errors);
  }

  if (group === 'chat' || group === 'hidden') {
    validateAmbientNodeContent(guest, nodeId, node, errors);
  }

  if (group === 'teaching' && node.teaching) {
    validateTeaching(guest, nodeId, node.teaching, registry, errors);
    if (!hasNextNarrativeExit(node)) {
      errors.push(`[${guest.id}] teaching node ${nodeId} must point to a next exit`);
    }
  }
}

function validateSchedule(registry: ContentRegistry, errors: string[]) {
  registry.schedule.schedule.forEach(day => {
    if (!hasNonEmptyString(day.day) || !/^W\d+_D\d+$/.test(day.day)) {
      errors.push(`[schedule] invalid day key "${String(day.day)}"`);
    }

    if (!Array.isArray(day.guests)) {
      errors.push(`[schedule:${day.day}] guests must be an array`);
      return;
    }

    day.guests.forEach(guestEntry => {
      const guest = registry.guestById.get(guestEntry.character_id);
      if (!guest) {
        errors.push(`[schedule:${day.day}] references unknown character "${guestEntry.character_id}"`);
        return;
      }

      if (!hasNonEmptyString(guestEntry.start_node)) {
        errors.push(`[schedule:${day.day}] character "${guestEntry.character_id}" is missing start_node`);
        return;
      }

      if (!guest.nodeMap.has(guestEntry.start_node)) {
        errors.push(`[schedule:${day.day}] character "${guestEntry.character_id}" start_node "${guestEntry.start_node}" does not exist`);
      }
    });
  });
}

export function validateContentRegistry(registry: ContentRegistry) {
  const errors: string[] = [];

  validateSchedule(registry, errors);

  registry.guests.forEach(guest => {
    validateCharacterLlmChatConfig(guest, guest.meta.llm_chat, errors);
    (['main', 'teaching', 'chat', 'hidden'] as const).forEach(group => {
      guest.nodes[group].forEach(node => validateNodeByGroup(guest, group, node, registry, errors));
    });
  });

  if (errors.length > 0) {
    throw new Error(['Content validation failed:', ...errors].join('\n'));
  }
}
