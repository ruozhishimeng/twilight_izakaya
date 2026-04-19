import { loadContentSource } from './loader';
import { DEFAULT_LLM_CHAT_CONFIG, normalizeContentRegistry } from './normalizer';
import type {
  CharacterNode,
  GalleryChapter,
  ResolvedLlmChatConfig,
  ScheduleDay,
  ScheduleGuest,
} from './types';

const source = loadContentSource();
const registry = normalizeContentRegistry(source);

type DrinkImageBucket = 'base' | 'mixer' | 'flavor' | 'cocktail';

const drinkImageMap: Record<DrinkImageBucket, Map<string, string>> = {
  base: new Map(),
  mixer: new Map(),
  flavor: new Map(),
  cocktail: new Map(),
};

const cocktailIdByName = new Map<string, string>();

Object.entries(source.drinkImages).forEach(([path, url]) => {
  const match = path.match(/\/drink\/(base|mixer|flavor|cocktail)\/([^/]+)\.png$/i);
  if (!match) {
    return;
  }

  const bucket = match[1].toLowerCase() as DrinkImageBucket;
  const key = match[2];
  drinkImageMap[bucket].set(key, url);
});

registry.recipes.recipes.forEach(recipe => {
  if (recipe?.id && recipe?.name) {
    cocktailIdByName.set(String(recipe.name), String(recipe.id));
  }
});

export type {
  CharacterNode,
  ContentRegistry,
  Feature,
  GalleryChapter,
  Guest,
  GuestGallery,
  RecipesCatalog,
  ScheduleData,
  ScheduleDay,
  ScheduleGuest,
} from './types';

export const contentRegistry = registry;
export const GUESTS = registry.guests;
export const schedule = registry.schedule;

export function getIngredientImage(id: string) {
  if (!id) {
    return undefined;
  }

  if (id.startsWith('b')) {
    return drinkImageMap.base.get(id);
  }
  if (id.startsWith('m')) {
    return drinkImageMap.mixer.get(id);
  }
  if (id.startsWith('f')) {
    return drinkImageMap.flavor.get(id);
  }

  return undefined;
}

export function getCocktailImage(id?: string, name?: string) {
  const normalizedId = typeof id === 'string' ? id.trim() : '';
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const resolvedId = normalizedId || (normalizedName ? cocktailIdByName.get(normalizedName) ?? '' : '');

  if (resolvedId && drinkImageMap.cocktail.has(resolvedId)) {
    return drinkImageMap.cocktail.get(resolvedId);
  }
  if (normalizedName && drinkImageMap.cocktail.has(normalizedName)) {
    return drinkImageMap.cocktail.get(normalizedName);
  }
  return undefined;
}

export function getGuestById(guestId: string) {
  return registry.guestById.get(guestId);
}

export function getScheduleDay(week: number, day: number): ScheduleDay | undefined {
  const dayKey = `W${week}_D${day}`;
  return schedule.schedule.find(entry => entry.day === dayKey);
}

export function getGuestsForDay(week: number, day: number): ScheduleGuest[] {
  return getScheduleDay(week, day)?.guests || [];
}

export function findNodeForGuest(ref: string, _charId: string, nodeMap: Map<string, CharacterNode>) {
  if (!ref) {
    return null;
  }
  return nodeMap.get(ref) || null;
}

export function findNodeById(charId: string, nodeId: string) {
  const guest = registry.guestById.get(charId);
  return guest?.nodeMap.get(nodeId) || null;
}

export function getGalleryChaptersForGuest(guestId: string): GalleryChapter[] {
  return registry.guestById.get(guestId)?.gallery.chapters || [];
}

export function chapterMatchesUnlockId(chapter: GalleryChapter, unlockId: string) {
  return chapter.id === unlockId || chapter.legacyUnlockIds?.includes(unlockId);
}

export function getChatNodesForGuest(guestId: string) {
  return registry.guestById.get(guestId)?.nodes.chat || [];
}

export function getHiddenNodesForGuest(guestId: string) {
  return registry.guestById.get(guestId)?.nodes.hidden || [];
}

export function getDefaultLlmChatConfigForGuest(guestId: string): ResolvedLlmChatConfig {
  const guest = registry.guestById.get(guestId);
  if (!guest) {
    return { ...DEFAULT_LLM_CHAT_CONFIG };
  }

  return { ...guest.llmChatDefault };
}

export function resolveLlmChatConfigForGuest(
  guestId: string,
  finalNodeId?: string | null,
): ResolvedLlmChatConfig {
  const guest = registry.guestById.get(guestId);
  if (!guest) {
    return { ...DEFAULT_LLM_CHAT_CONFIG };
  }

  const resolved = { ...guest.llmChatDefault };
  const finalNode =
    typeof finalNodeId === 'string' && finalNodeId.trim()
      ? guest.nodeMap.get(finalNodeId.trim()) || null
      : null;
  const override = finalNode?.llm_chat;

  if (!override) {
    return resolved;
  }

  return {
    enabled: typeof override.enabled === 'boolean' ? override.enabled : resolved.enabled,
    maxTurns:
      typeof override.max_turns === 'number' && Number.isFinite(override.max_turns)
        ? Math.max(1, Math.floor(override.max_turns))
        : resolved.maxTurns,
    entryStatusText:
      typeof override.entry_status_text === 'string' && override.entry_status_text.trim()
        ? override.entry_status_text.trim()
        : resolved.entryStatusText,
    blockedMessage:
      typeof override.blocked_message === 'string' && override.blocked_message.trim()
        ? override.blocked_message.trim()
        : resolved.blockedMessage,
    exhaustedMessage:
      typeof override.exhausted_message === 'string' && override.exhausted_message.trim()
        ? override.exhausted_message.trim()
        : resolved.exhaustedMessage,
  };
}

export const BASE_LIQUORS = registry.recipes.ingredients.bases.japanese
  .map(item => ({
    id: item.id,
    name: item.name,
    desc: item.gallery_description,
    color: '#e0f2fe',
    image: getIngredientImage(item.id),
    icon: '🍶',
    unlocked: item.unlocked,
    type: '日式基酒',
  }))
  .concat(
    registry.recipes.ingredients.bases.classic.map(item => ({
      id: item.id,
      name: item.name,
      desc: item.gallery_description,
      color: '#fef08a',
      image: getIngredientImage(item.id),
      icon: '🥃',
      unlocked: item.unlocked,
      type: '经典基酒',
    })),
  )
  .sort((a, b) => (a.unlocked === b.unlocked ? 0 : a.unlocked ? -1 : 1));

export const MIXERS = registry.recipes.ingredients.mixers
  .map(item => ({
    id: item.id,
    name: item.name,
    type: item.category,
    desc: item.gallery_description,
    color: '#86efac',
    image: getIngredientImage(item.id),
    icon: '🥤',
    unlocked: item.unlocked,
  }))
  .sort((a, b) => (a.unlocked === b.unlocked ? 0 : a.unlocked ? -1 : 1));

export const FLAVORS = registry.recipes.ingredients.flavors
  .map(item => ({
    id: item.id,
    name: item.name,
    type: item.category,
    desc: item.gallery_description,
    color: '#fca5a5',
    image: getIngredientImage(item.id),
    icon: '🍒',
    unlocked: item.unlocked,
  }))
  .sort((a, b) => (a.unlocked === b.unlocked ? 0 : a.unlocked ? -1 : 1));

export const ADD_ONS = [...MIXERS, ...FLAVORS];
