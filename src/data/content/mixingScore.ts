import type { DrinkRequestSource, IngredientCatalogEntry, RecipesCatalog } from './types';

export type MixingTier = 'perfect' | 'good' | 'off';

export interface MixingScoreResult {
  tier: MixingTier;
  matchedRecipeId: string | null;
  drinkLabel: string;
}

const TAG_OVERLAP_THRESHOLD = 0.5;

function collectIngredients(catalog: RecipesCatalog): IngredientCatalogEntry[] {
  return [
    ...catalog.ingredients.bases.japanese,
    ...catalog.ingredients.bases.classic,
    ...catalog.ingredients.mixers,
    ...catalog.ingredients.flavors,
  ];
}

function buildIngredientIndex(catalog: RecipesCatalog): Map<string, IngredientCatalogEntry> {
  return new Map(collectIngredients(catalog).map(item => [item.id, item]));
}

function tagsForIngredient(item: IngredientCatalogEntry | undefined): string[] {
  if (!item) {
    return [];
  }
  return [item.tag1, item.tag2, item.emotion_tag].filter((tag): tag is string => !!tag);
}

function tagSetForIds(ids: string[], index: Map<string, IngredientCatalogEntry>): Set<string> {
  const tags = new Set<string>();
  ids.forEach(id => {
    tagsForIngredient(index.get(id)).forEach(tag => tags.add(tag));
  });
  return tags;
}

function intersectionRatio(selected: Set<string>, target: Set<string>): number {
  if (target.size === 0) {
    return 0;
  }
  let hits = 0;
  target.forEach(tag => {
    if (selected.has(tag)) {
      hits += 1;
    }
  });
  return hits / target.size;
}

function formatDrinkLabel(ids: string[], index: Map<string, IngredientCatalogEntry>): string {
  const names = ids.filter(Boolean).map(id => index.get(id)?.name || id);
  return names.length > 0 ? names.join(' + ') : '未命名的调配';
}

function findMatchedRecipe(actualFormula: string[], catalog: RecipesCatalog) {
  return catalog.recipes.find(recipe => {
    if (!Array.isArray(recipe.formula)) {
      return false;
    }
    const recipeFormula = [...recipe.formula].sort();
    return (
      recipeFormula.length === actualFormula.length &&
      recipeFormula.every((id, index) => id === actualFormula[index])
    );
  }) || null;
}

function scoreNamed(
  request: DrinkRequestSource | null,
  selectedIds: string[],
  ingredientIndex: Map<string, IngredientCatalogEntry>,
): MixingTier {
  const idealFormula = request?.preferred_drink?.formula;
  if (!idealFormula || idealFormula.length === 0) {
    return 'perfect';
  }

  const expectedFormula = [...idealFormula].filter(Boolean).sort();
  const actualFormula = [...selectedIds].filter(Boolean).sort();
  const isExactMatch =
    expectedFormula.length === actualFormula.length &&
    expectedFormula.every((id, index) => id === actualFormula[index]);

  if (isExactMatch) {
    return 'perfect';
  }

  const targetTags = tagSetForIds(expectedFormula, ingredientIndex);
  const selectedTags = tagSetForIds(actualFormula, ingredientIndex);
  return intersectionRatio(selectedTags, targetTags) >= TAG_OVERLAP_THRESHOLD ? 'good' : 'off';
}

function scoreTrait(
  request: DrinkRequestSource,
  selectedIds: string[],
  ingredientIndex: Map<string, IngredientCatalogEntry>,
): MixingTier {
  const requiredTags = request.required_tags || [];
  if (requiredTags.length === 0) {
    return 'off';
  }

  const selectedTags = tagSetForIds(selectedIds, ingredientIndex);
  const requiredTagSet = new Set(requiredTags);
  const ratio = intersectionRatio(selectedTags, requiredTagSet);

  if (ratio >= 1) {
    return 'perfect';
  }
  return ratio > 0 ? 'good' : 'off';
}

export function scoreMixing(
  request: DrinkRequestSource | null,
  selectedIngredientIds: string[],
  recipeCatalog: RecipesCatalog,
): MixingScoreResult {
  const ingredientIndex = buildIngredientIndex(recipeCatalog);
  const actualFormula = [...selectedIngredientIds].filter(Boolean).sort();

  let tier: MixingTier;
  if (!request || !request.kind || request.kind === 'named') {
    tier = scoreNamed(request, selectedIngredientIds, ingredientIndex);
  } else if (request.kind === 'trait') {
    tier = scoreTrait(request, selectedIngredientIds, ingredientIndex);
  } else {
    tier = 'perfect';
  }

  const matchedRecipe = findMatchedRecipe(actualFormula, recipeCatalog);
  const drinkLabel = matchedRecipe
    ? matchedRecipe.name
    : formatDrinkLabel(selectedIngredientIds, ingredientIndex);

  return {
    tier,
    matchedRecipeId: matchedRecipe?.id ?? null,
    drinkLabel,
  };
}
