# 调酒判定去卡关化 + 分级反馈 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current exact-formula-match / hard-fail-retry mixing judgment in `useGameFlowController.ts`'s `serveDrink` with a tier-based (`perfect`/`good`/`off`) scoring system that never blocks progression, uses the existing ingredient/recipe tags, and makes its judgment standard visible to the player via highlighted request text — while leaving all 12 existing real content nodes (aqiang ×3, yuki ×2, fox_uncle ×6, regulars ×5×1) working unmodified.

**Architecture:** A new pure function `scoreMixing` (`src/data/content/mixingScore.ts`) absorbs the formula-comparison + recipe-lookup logic currently inlined in `serveDrink`, and returns a `MixingTier` instead of a boolean. A new `resolveActiveMixingNode` helper (`src/app/narrativeRouting.ts`) absorbs the duplicated `asMixingNode`/`getNextExitTarget` `||`-chain that both `enterMixing` and `serveDrink` currently inline separately. `resolveMixingOutcomeNode` changes from boolean-based to tier-based, reading `exit.outcomes.{success,good,fail}` directly (it does **not** call the shared `getMixingOutcomeTarget` in `narrative.ts`, so that function's boolean signature and the independent pure narrative interpreter (`src/data/content/interpreter.ts`) that also consumes it are completely unaffected — see spec §12). `serveDrink` itself becomes a thin linear pipeline over these extracted functions. UI changes are additive: `MixingPhase`/`PixelDialogueBox` gain an optional highlight-rendering path, and `ResultPhase` gains a tier-aware reaction copy path, both backward compatible with the existing boolean-shaped callers during the transition commits.

**Tech Stack:** React + TypeScript + Vite, `node --import tsx --test` + `node:assert/strict` for unit tests, YAML-authored content consumed through `src/data/content/*` (loader/normalizer/interpreter/validation), Tailwind for styling.

## Global Constraints

- 调酒永远产出一杯酒，不存在因判定失败被打回重做的硬性卡关（spec §2.1, §4.3）。
- 判定标准对玩家可见：客人台词中划出的关键词就是评价依据，不是隐藏算法（spec §2.2, §4.1）。
- 判定结果分三档：`perfect` / `good` / `off`，影响客人当次反应文案与图鉴解锁，不影响好感度数值（spec §2.3, §3.5）。
- 现有三位主角（阿相、狐面大叔、雪）及五位常客的既有精确配方内容零改动，自动获得新行为（spec §2.4）。
- 判分逻辑是独立纯函数，不依赖 React、不依赖游戏状态，具备完整单元测试（spec §2.5, §6）。
- `serveDrink` 不再是揉合六件事的单一函数；`shouldRetryMixingFailure` 函数与其所有调用点整体删除，不保留死代码路径（spec §2.6, §4.3, §6.3）。
- 不修改 `narrativeEffects.ts` 的好感度消费逻辑、`schedule.yaml` 调度方式、`character_meta.yaml` 章节推进方式（spec §3.1-§3.3）。
- 不修改 `src/data/content/narrative.ts` 的 `getMixingOutcomeTarget`，不修改 `src/data/content/interpreter.ts`/`simulator.ts`（spec §12）。
- `named` 请求类型为缺省默认值，`kind` 字段省略时行为等价于现状（spec §4.2）。
- 每步提交前运行 `npm run content:check`、`npm run narrative:check`、`npm test`（至少覆盖新增/改动文件对应的定向测试）；最终提交前完整运行 `npm run lint`、`npm run build`（spec §10）。
- 新增测试文件必须手动追加到 `package.json` 的 `test` 脚本硬编码字符串中，否则永远不会被执行。

---

## Task 1: 数据模型扩展 — `kind`/`highlight`/`required_tags`/`good` 字段 + 校验放宽

**Files:**
- Modify: `src/data/content/types.ts:97-104` (`DrinkRequestSource`)
- Modify: `src/data/content/types.ts:118-121` (`NarrativeMixingOutcomes`)
- Modify: `src/data/content/validation.ts:553-589` (`validateDrinkRequest`)
- Test: `src/data/content/validation.test.ts` (append)

**Interfaces:**
- Produces: `DrinkRequestSource.kind?: 'named' | 'trait' | 'open'`, `DrinkRequestSource.highlight?: string`, `DrinkRequestSource.required_tags?: string[]`, `NarrativeMixingOutcomes.good?: string | null`.

The type extension itself is behavior-neutral, but `validateDrinkRequest` (`src/data/content/validation.ts:553-589`) currently **unconditionally** requires `preferred_drink` on every `drink_request`/`exit.mixing.request`, regardless of `kind`. Left as-is, this would reject any future `trait`/`open` content the new `kind` field exists to enable (a `trait` request has no `preferred_drink`, only `required_tags`; an `open` request has neither). This task loosens that check to be conditional on `kind`, so schema and validation land together and don't leave a half-usable field behind — consistent with the no-residue commit requirement. No existing content sets `kind`, so every real node still resolves to the `named` branch and keeps today's validation behavior exactly (verified by the existing `validation.test.ts` suite passing unchanged).

- [ ] **Step 1: Extend `DrinkRequestSource` and `NarrativeMixingOutcomes` in `types.ts`**

In `src/data/content/types.ts`, replace:

```ts
export interface DrinkRequestSource {
  mode?: string;
  request_text?: string;
  hint?: string;
  retry_on_fail?: boolean;
  preferred_drink?: PreferredDrinkSource;
  eval_branches?: DrinkRequestEvalBranches;
}
```

with:

```ts
export interface DrinkRequestSource {
  mode?: string;
  request_text?: string;
  hint?: string;
  retry_on_fail?: boolean;
  preferred_drink?: PreferredDrinkSource;
  eval_branches?: DrinkRequestEvalBranches;
  kind?: 'named' | 'trait' | 'open';
  highlight?: string;
  required_tags?: string[];
}
```

And replace:

```ts
export interface NarrativeMixingOutcomes {
  success: string | null;
  fail: string | null;
}
```

with:

```ts
export interface NarrativeMixingOutcomes {
  success: string | null;
  good?: string | null;
  fail: string | null;
}
```

- [ ] **Step 2: Write the failing tests for conditional `preferred_drink` validation**

Append to `src/data/content/validation.test.ts`:

```ts
test('trait requests do not require preferred_drink but do require required_tags', () => {
  const message = getValidationError([
    createNode('trait_request_missing_tags', {
      exit: {
        kind: 'mixing',
        request: {
          kind: 'trait',
          request_text: '要一杯烈的',
          highlight: '烈的',
        },
        outcomes: {
          success: 'mixing_success',
          fail: 'mixing_fail',
        },
      },
    }),
    createNode('mixing_success'),
    createNode('mixing_fail'),
  ]);

  assert.match(message, /required_tags must be a non-empty array/);
});

test('a well-formed trait request passes without preferred_drink', () => {
  const errors = validateContentRegistry(createRegistry([
    createNode('trait_request_ok', {
      exit: {
        kind: 'mixing',
        request: {
          kind: 'trait',
          request_text: '要一杯烈的',
          highlight: '烈的',
          required_tags: ['辛辣'],
        },
        outcomes: {
          success: 'mixing_success',
          fail: 'mixing_fail',
        },
      },
    }),
    createNode('mixing_success'),
    createNode('mixing_fail'),
  ]));

  assert.deepEqual(errors, []);
});

test('open requests do not require preferred_drink or required_tags', () => {
  const errors = validateContentRegistry(createRegistry([
    createNode('open_request_ok', {
      exit: {
        kind: 'mixing',
        request: {
          kind: 'open',
          request_text: '什么都可以',
          highlight: '什么都可以',
        },
        outcomes: {
          success: 'mixing_success',
          fail: 'mixing_fail',
        },
      },
    }),
    createNode('mixing_success'),
    createNode('mixing_fail'),
  ]));

  assert.deepEqual(errors, []);
});
```

Check the actual exported name of the "run validation and collect errors" helper used by existing tests around line 118-140 of `validation.test.ts` (likely `getValidationError`/`validateContentRegistry` called directly) and match its exact call signature — the snippets above assume `validateContentRegistry(createRegistry([...]))` returns an error array and `getValidationError([...])` is a local helper that runs the same and returns the first/joined message; use whichever one the existing "requires complete request metadata for an explicit mixing exit" test (line 347) actually uses, mirroring it exactly.

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --import tsx --test src/data/content/validation.test.ts`
Expected: FAIL — the first new test gets a `preferred drink is missing id`-style error instead of `required_tags must be a non-empty array`; the second and third get spurious `preferred_drink` errors instead of an empty array.

- [ ] **Step 4: Make `validateDrinkRequest` conditional on `kind` in `src/data/content/validation.ts`**

Replace `validateDrinkRequest` (lines 553-589):

```ts
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

  const kind = drinkRequest.kind || 'named';

  if (kind === 'trait') {
    if (!Array.isArray(drinkRequest.required_tags) || drinkRequest.required_tags.length === 0) {
      errors.push(`[${guest.id}] node ${nodeId} drink_request.required_tags must be a non-empty array for kind "trait"`);
    }
    return;
  }

  if (kind === 'open') {
    return;
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
```

This preserves the exact existing error messages/order for `kind` omitted or `'named'` (the only case any real content uses today), and adds two new narrow branches for `trait`/`open` that return early without touching `preferred_drink` at all.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --import tsx --test src/data/content/validation.test.ts`
Expected: PASS, all 3 new tests plus all pre-existing tests in the file green (in particular, "requires complete request metadata for an explicit mixing exit" at line 347 and "legacy mixing requires an explicit success target..." at line 143 must be unaffected since they don't set `kind`).

- [ ] **Step 6: Run the existing full test suite and content gates**

Run: `npm run content:check && npm run narrative:check && npm test`
Expected: All PASS (types-only + conditional-validation change; all 12 real content nodes still validate since none set `kind`).

- [ ] **Step 7: Run typecheck**

Run: `npm run lint`
Expected: PASS with no new type errors.

- [ ] **Step 8: Commit**

```bash
git add src/data/content/types.ts src/data/content/validation.ts src/data/content/validation.test.ts
git commit -m "feat(mixing): extend drink request schema with kind/highlight/required_tags"
```

---

## Task 2: `scoreMixing` pure function + unit tests

**Files:**
- Create: `src/data/content/mixingScore.ts`
- Test: `src/data/content/mixingScore.test.ts`
- Modify: `package.json:24` (append test file to the `test` script string)

**Interfaces:**
- Consumes: `DrinkRequestSource` (Task 1), `RecipesCatalog`/`RecipeCatalogEntry`/`IngredientCatalogEntry` (`src/data/content/types.ts`, existing), `formatMixedDrinkLabel(ingredients: string[]): string` (`src/app/flowHelpers.ts:85`, existing, unmodified).
- Produces: `export type MixingTier = 'perfect' | 'good' | 'off'`, `export interface MixingScoreResult { tier: MixingTier; matchedRecipeId: string | null; drinkLabel: string }`, `export function scoreMixing(request: DrinkRequestSource | null, selectedIngredientIds: string[], recipeCatalog: RecipesCatalog): MixingScoreResult`. Task 4 wires this into `serveDrink`.

`scoreMixing` needs per-ingredient tag lookup (`tag1`/`tag2`/`emotion_tag`) to compute tag overlap for `named`/`trait` judging. The catalog shape (`RecipesCatalog.ingredients.bases.{japanese,classic}`, `.mixers`, `.flavors`) is flat per-bucket, so this task builds a local id→tags index inside `mixingScore.ts` from the `recipeCatalog` argument (no new registry-level export needed — keeps the function pure and self-contained, consistent with spec §6's "不依赖游戏状态").

Recipe matching logic (exact formula → known recipe) is migrated verbatim from `useGameFlowController.ts:497-506` into this file, per spec §6.2 ("现有 `contentRegistry.recipes.recipes` 逻辑原样迁移到此文件").

- [ ] **Step 1: Write the failing tests**

Create `src/data/content/mixingScore.test.ts`:

```ts
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { scoreMixing } from './mixingScore';
import type { DrinkRequestSource, RecipesCatalog } from './types';

const recipeCatalog: RecipesCatalog = {
  ingredients: {
    bases: {
      japanese: [
        { id: 'bj01', name: '纯米清酒', tag1: '日式', tag2: '米香', emotion_tag: '怀旧' },
        { id: 'bj05', name: '烧酌', tag1: '日式', tag2: '辛辣', emotion_tag: '执念' },
      ],
      classic: [
        { id: 'bc01', name: '威士忌', tag1: '西式', tag2: '烟熏', emotion_tag: '孤独' },
      ],
    },
    mixers: [
      { id: 'm01', name: '苏打水', tag1: '通用', tag2: '清爽', emotion_tag: '平淡' },
      { id: 'm04', name: '姜汁汽水', tag1: '通用', tag2: '辛辣', emotion_tag: '刺激' },
    ],
    flavors: [
      { id: 'f03', name: '樱花糖浆', tag1: '日式', tag2: '甘甜', emotion_tag: '留恋' },
    ],
  },
  recipes: [
    { id: 'R001', name: '未竟的生诞', formula: ['bc01', 'm04', 'f03'] },
    { id: 'R021', name: '纯米嗨棒', formula: ['bj01', 'm01'] },
  ],
};

const namedRequest: DrinkRequestSource = {
  preferred_drink: { id: 'R021', name: '纯米嗨棒', formula: ['bj01', 'm01'] },
};

test('named request: exact formula match scores perfect', () => {
  const result = scoreMixing(namedRequest, ['bj01', 'm01'], recipeCatalog);
  assert.equal(result.tier, 'perfect');
  assert.equal(result.matchedRecipeId, 'R021');
  assert.equal(result.drinkLabel, '纯米嗨棒');
});

test('named request: formula order does not matter for perfect match', () => {
  const result = scoreMixing(namedRequest, ['m01', 'bj01'], recipeCatalog);
  assert.equal(result.tier, 'perfect');
});

test('named request: partial tag overlap at or above threshold scores good', () => {
  // target bj01+m01 tags: {日式,米香,怀旧,通用,清爽,平淡}
  // selection bj01+m04 tags: {日式,米香,怀旧,通用,辛辣,刺激} -> intersection {日式,米香,怀旧,通用} = 4/6 >= 0.5
  const result = scoreMixing(namedRequest, ['bj01', 'm04'], recipeCatalog);
  assert.equal(result.tier, 'good');
  assert.equal(result.matchedRecipeId, null);
  assert.equal(result.drinkLabel, '纯米清酒 + 姜汁汽水');
});

test('named request: low tag overlap scores off but still produces a drink label', () => {
  // target bj01+m01 tags: {日式,米香,怀旧,通用,清爽,平淡}
  // selection bc01+f03 tags: {西式,烟熏,孤独,日式,甘甜,留恋} -> intersection {日式} = 1/6 < 0.5
  const result = scoreMixing(namedRequest, ['bc01', 'f03'], recipeCatalog);
  assert.equal(result.tier, 'off');
  assert.equal(result.matchedRecipeId, null);
  assert.equal(result.drinkLabel, '威士忌 + 樱花糖浆');
});

test('null request treats every selection as perfect', () => {
  const result = scoreMixing(null, ['bj05'], recipeCatalog);
  assert.equal(result.tier, 'perfect');
});

test('trait request: full required_tags coverage scores perfect', () => {
  const traitRequest: DrinkRequestSource = { kind: 'trait', required_tags: ['辛辣'] };
  const result = scoreMixing(traitRequest, ['bj05'], recipeCatalog);
  assert.equal(result.tier, 'perfect');
});

test('trait request: partial required_tags coverage scores good', () => {
  const traitRequest: DrinkRequestSource = { kind: 'trait', required_tags: ['辛辣', '甘甜'] };
  const result = scoreMixing(traitRequest, ['bj05'], recipeCatalog);
  assert.equal(result.tier, 'good');
});

test('trait request: zero required_tags coverage scores off', () => {
  const traitRequest: DrinkRequestSource = { kind: 'trait', required_tags: ['甘甜'] };
  const result = scoreMixing(traitRequest, ['bj05'], recipeCatalog);
  assert.equal(result.tier, 'off');
});

test('open request is always perfect regardless of selection', () => {
  const openRequest: DrinkRequestSource = { kind: 'open' };
  const result = scoreMixing(openRequest, ['f03'], recipeCatalog);
  assert.equal(result.tier, 'perfect');
});

test('unmatched formula falls back to ingredient-name-joined drinkLabel', () => {
  const result = scoreMixing(null, ['bj05', 'f03'], recipeCatalog);
  assert.equal(result.matchedRecipeId, null);
  assert.equal(result.drinkLabel, '烧酌 + 樱花糖浆');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test src/data/content/mixingScore.test.ts`
Expected: FAIL — `Cannot find module './mixingScore'`.

- [ ] **Step 3: Implement `src/data/content/mixingScore.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test src/data/content/mixingScore.test.ts`
Expected: PASS, all 10 tests green.

- [ ] **Step 5: Register the new test file in `package.json`'s `test` script**

In `package.json`, the `test` script is a hardcoded space-separated list of file paths (not a glob). Find `src/data/content/narrative.test.ts src/data/content/simulator.test.ts` inside that list and insert `src/data/content/mixingScore.test.ts` immediately before `src/data/content/narrative.test.ts` (alphabetical placement, matching the existing ordering convention):

```
...src/data/content/graph.test.ts src/data/content/interpreter.test.ts src/data/content/mixingScore.test.ts src/data/content/narrative.test.ts src/data/content/simulator.test.ts src/data/content/validation.test.ts...
```

- [ ] **Step 6: Run the full test suite to verify the new file runs as part of `npm test`**

Run: `npm test`
Expected: PASS, count increases by the new `mixingScore.test.ts` cases.

- [ ] **Step 7: Commit**

```bash
git add src/data/content/mixingScore.ts src/data/content/mixingScore.test.ts package.json
git commit -m "feat(mixing): add scoreMixing pure function"
```

---

## Task 3: Extract `resolveActiveMixingNode` in `narrativeRouting.ts`

**Files:**
- Modify: `src/app/narrativeRouting.ts`
- Modify: `src/app/narrativeRouting.test.ts`

**Interfaces:**
- Consumes: `resolveNodeExit`, `isMixingExit` (`src/data/content/narrative.ts`, existing), `CharacterNode` (`src/data/content/types.ts`, existing).
- Produces: `export function resolveActiveMixingNode(params: { teachingCandidate: CharacterNode | null; mixingCandidate: CharacterNode | null; resolveFollowupNode: (nodeId: string) => CharacterNode | null }): CharacterNode | null`. Task 4 replaces `serveDrink`'s inline `||`-chain (lines 472-478) with a call to this function; `enterMixing`'s equivalent chain (lines 339-345) is also migrated to call it in the same task, since it is the second of the two duplicated call sites this extraction is meant to consolidate (spec §7).

The current duplicated logic (`useGameFlowController.ts:84-97` module-level helpers `getNextExitTarget`/`asMixingNode`, then inlined 3x in `enterMixing` and 3x in `serveDrink`) is:

```ts
const teachingNextNodeId = getNextExitTarget(teachingCandidate); // teachingCandidate resolves to exit.kind === 'next' ? exit.target : null
const normalizedMixingNode =
  asMixingNode(mixingCandidate) ||
  (teachingNextNodeId ? asMixingNode(findNodeForGuest(teachingNextNodeId, guest.id, guest.nodeMap)) : null) ||
  asMixingNode(teachingCandidate) ||
  null;
```

`resolveActiveMixingNode` reproduces this exact three-branch fallback chain as a single named function, taking a `resolveFollowupNode` callback so it doesn't need to import `findNodeForGuest`/`guest` directly (keeping it a narrow, dependency-light utility in `narrativeRouting.ts`, consistent with that file's existing style of small pure helpers over `CharacterNode`).

- [ ] **Step 1: Write the failing tests**

Append to `src/app/narrativeRouting.test.ts` (keep existing `resolveMixingOutcomeNode`/`shouldRetryMixingFailure` tests untouched for now — those are rewritten in Task 4):

```ts
import { resolveActiveMixingNode } from './narrativeRouting';

const teachingNode: CharacterNode = {
  event_id: 'teaching',
  exit: { kind: 'next', target: 'teaching_mixing' },
};

const teachingMixingNode: CharacterNode = {
  event_id: 'teaching_mixing',
  exit: {
    kind: 'mixing',
    request: { request_text: '照着刚才的步骤调一杯' },
    outcomes: { success: 'teaching_result', fail: null },
  },
};

const directMixingNode: CharacterNode = {
  event_id: 'direct_mixing',
  exit: {
    kind: 'mixing',
    request: { request_text: '直接调酒' },
    outcomes: { success: 'direct_result', fail: 'direct_fail' },
  },
};

const nonMixingNode: CharacterNode = {
  event_id: 'story_only',
  exit: { kind: 'next', target: 'somewhere_else' },
};

test('resolveActiveMixingNode prefers an explicit mixing candidate', () => {
  const result = resolveActiveMixingNode({
    teachingCandidate: null,
    mixingCandidate: directMixingNode,
    resolveFollowupNode: () => null,
  });
  assert.equal(result, directMixingNode);
});

test('resolveActiveMixingNode follows the teaching candidate\'s next target to find a mixing node', () => {
  const result = resolveActiveMixingNode({
    teachingCandidate: teachingNode,
    mixingCandidate: null,
    resolveFollowupNode: (nodeId) => (nodeId === 'teaching_mixing' ? teachingMixingNode : null),
  });
  assert.equal(result, teachingMixingNode);
});

test('resolveActiveMixingNode falls back to the teaching candidate itself if it is a mixing node', () => {
  const result = resolveActiveMixingNode({
    teachingCandidate: teachingMixingNode,
    mixingCandidate: null,
    resolveFollowupNode: () => null,
  });
  assert.equal(result, teachingMixingNode);
});

test('resolveActiveMixingNode returns null when nothing resolves to a mixing exit', () => {
  const result = resolveActiveMixingNode({
    teachingCandidate: nonMixingNode,
    mixingCandidate: null,
    resolveFollowupNode: () => null,
  });
  assert.equal(result, null);
});

test('resolveActiveMixingNode returns null for null/undefined candidates', () => {
  const result = resolveActiveMixingNode({
    teachingCandidate: null,
    mixingCandidate: null,
    resolveFollowupNode: () => null,
  });
  assert.equal(result, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test src/app/narrativeRouting.test.ts`
Expected: FAIL — `resolveActiveMixingNode is not a function` / import error.

- [ ] **Step 3: Implement `resolveActiveMixingNode` in `src/app/narrativeRouting.ts`**

Add to `src/app/narrativeRouting.ts` (alongside the existing `resolveMixingOutcomeNode`/`shouldRetryMixingFailure`):

```ts
function getNextTarget(node: CharacterNode | null): string | null {
  if (!node) {
    return null;
  }
  const exit = resolveNodeExit(node);
  return exit.kind === 'next' ? exit.target : null;
}

function asMixingNode(node: CharacterNode | null): CharacterNode | null {
  if (!node) {
    return null;
  }
  return isMixingExit(resolveNodeExit(node)) ? node : null;
}

export function resolveActiveMixingNode(params: {
  teachingCandidate: CharacterNode | null;
  mixingCandidate: CharacterNode | null;
  resolveFollowupNode: (nodeId: string) => CharacterNode | null;
}): CharacterNode | null {
  const { teachingCandidate, mixingCandidate, resolveFollowupNode } = params;
  const teachingNextNodeId = getNextTarget(teachingCandidate);

  return (
    asMixingNode(mixingCandidate) ||
    (teachingNextNodeId ? asMixingNode(resolveFollowupNode(teachingNextNodeId)) : null) ||
    asMixingNode(teachingCandidate) ||
    null
  );
}
```

Update the top-of-file import to add `isMixingExit`:

```ts
import { getMixingOutcomeTarget, isMixingExit, resolveNodeExit } from '../data/content/narrative';
```

(`getMixingOutcomeTarget` remains imported here only because the not-yet-modified `resolveMixingOutcomeNode` below still uses it in this task — Task 4 removes that usage.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test src/app/narrativeRouting.test.ts`
Expected: PASS, all tests including the pre-existing `resolveMixingOutcomeNode`/`shouldRetryMixingFailure` ones (unchanged, still using the boolean API at this point) and the 5 new `resolveActiveMixingNode` tests.

- [ ] **Step 5: Run the full test suite and content gates**

Run: `npm run content:check && npm run narrative:check && npm test`
Expected: All PASS (no consumer wired to `resolveActiveMixingNode` yet, so no other behavior changes).

- [ ] **Step 6: Commit**

```bash
git add src/app/narrativeRouting.ts src/app/narrativeRouting.test.ts
git commit -m "refactor(mixing): extract resolveActiveMixingNode"
```

---

## Task 4: Wire `scoreMixing` + `resolveActiveMixingNode` into `serveDrink`, remove retry-on-fail lockstep

**Files:**
- Modify: `src/app/narrativeRouting.ts` (change `resolveMixingOutcomeNode` signature, delete `shouldRetryMixingFailure`)
- Modify: `src/app/narrativeRouting.test.ts` (rewrite `resolveMixingOutcomeNode` tests, delete `shouldRetryMixingFailure` tests)
- Modify: `src/hooks/useGameFlowController.ts` (`serveDrink`, `enterMixing`, imports)
- Modify: `src/app/flowHelpers.ts` (`buildDailyGuestRecord`'s fallback label text)
- Modify: `src/state/gameState.ts` (`CurrentGuestRuntime`/`LastDrinkResult`: add `mixingTier`, keep `isSuccess` derived for backward compat)

**Interfaces:**
- Consumes: `scoreMixing` (Task 2), `resolveActiveMixingNode` (Task 3), `MixingTier`/`MixingScoreResult` (Task 2).
- Produces: `resolveMixingOutcomeNode(mixingNode: CharacterNode | null, tier: MixingTier): string | null`. `CurrentGuestRuntime.mixingTier: MixingTier` (new field). Task 6 (`ResultPhase`) consumes `game.currentGuest.mixingTier`.

### 4a. Change `resolveMixingOutcomeNode` to tier-based, delete `shouldRetryMixingFailure`

- [ ] **Step 1: Rewrite the failing test cases for the tier-based API in `src/app/narrativeRouting.test.ts`**

Replace the existing `resolveMixingOutcomeNode`/`shouldRetryMixingFailure` tests (the original file's lines 22-50) with:

```ts
test('resolveMixingOutcomeNode maps perfect to the success target', () => {
  assert.equal(resolveMixingOutcomeNode(mixingNode, 'perfect'), 'success_result');
});

test('resolveMixingOutcomeNode maps off to the fail target', () => {
  assert.equal(resolveMixingOutcomeNode(mixingNode, 'off'), 'fail_result');
});

test('resolveMixingOutcomeNode maps good to an explicit good target when present', () => {
  const nodeWithGood: CharacterNode = {
    event_id: 'mixing_with_good',
    exit: {
      kind: 'mixing',
      request: { request_text: '请调酒' },
      outcomes: { success: 'success_result', good: 'good_result', fail: 'fail_result' },
    },
  };
  assert.equal(resolveMixingOutcomeNode(nodeWithGood, 'good'), 'good_result');
});

test('resolveMixingOutcomeNode falls back good to the success target when no good target is declared', () => {
  assert.equal(resolveMixingOutcomeNode(mixingNode, 'good'), 'success_result');
});

test('resolveMixingOutcomeNode returns null for a null node', () => {
  assert.equal(resolveMixingOutcomeNode(null, 'perfect'), null);
});
```

Also remove the now-unused `shouldRetryMixingFailure` import at the top of the file:

```ts
import { resolveActiveMixingNode, resolveMixingOutcomeNode } from './narrativeRouting';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test src/app/narrativeRouting.test.ts`
Expected: FAIL — `resolveMixingOutcomeNode(mixingNode, 'perfect')` returns `undefined`/wrong value against the old boolean-based implementation, and `shouldRetryMixingFailure` import fails once deleted from the source file in the next step (run this step's test-fail check against source as it stands before Step 3, i.e. confirm the assertion values are wrong, not an import crash).

- [ ] **Step 3: Rewrite `resolveMixingOutcomeNode`, delete `shouldRetryMixingFailure`, in `src/app/narrativeRouting.ts`**

Replace the entire file's mixing-outcome section. New full content for `src/app/narrativeRouting.ts`:

```ts
import { isMixingExit, resolveNodeExit } from '../data/content/narrative';
import type { CharacterNode } from '../data/content/types';
import type { MixingTier } from '../data/content/mixingScore';

function getNextTarget(node: CharacterNode | null): string | null {
  if (!node) {
    return null;
  }
  const exit = resolveNodeExit(node);
  return exit.kind === 'next' ? exit.target : null;
}

function asMixingNode(node: CharacterNode | null): CharacterNode | null {
  if (!node) {
    return null;
  }
  return isMixingExit(resolveNodeExit(node)) ? node : null;
}

export function resolveActiveMixingNode(params: {
  teachingCandidate: CharacterNode | null;
  mixingCandidate: CharacterNode | null;
  resolveFollowupNode: (nodeId: string) => CharacterNode | null;
}): CharacterNode | null {
  const { teachingCandidate, mixingCandidate, resolveFollowupNode } = params;
  const teachingNextNodeId = getNextTarget(teachingCandidate);

  return (
    asMixingNode(mixingCandidate) ||
    (teachingNextNodeId ? asMixingNode(resolveFollowupNode(teachingNextNodeId)) : null) ||
    asMixingNode(teachingCandidate) ||
    null
  );
}

export function resolveMixingOutcomeNode(
  mixingNode: CharacterNode | null,
  tier: MixingTier,
): string | null {
  if (!mixingNode) {
    return null;
  }

  const exit = resolveNodeExit(mixingNode);
  if (!isMixingExit(exit)) {
    return null;
  }

  if (tier === 'perfect') {
    return exit.outcomes.success;
  }
  if (tier === 'good') {
    return exit.outcomes.good ?? exit.outcomes.success;
  }
  return exit.outcomes.fail;
}
```

Note this drops the `getMixingOutcomeTarget` import entirely — `resolveMixingOutcomeNode` now reads `exit.outcomes` directly, so `narrative.ts`'s `getMixingOutcomeTarget` (still boolean-based, still used by `interpreter.ts`) is untouched, per spec §12.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test src/app/narrativeRouting.test.ts`
Expected: PASS, all `resolveActiveMixingNode` tests (Task 3) and new tier-based `resolveMixingOutcomeNode` tests green; no `shouldRetryMixingFailure` references remain.

- [ ] **Step 5: Confirm `interpreter.ts` and its tests are unaffected**

Run: `node --import tsx --test src/data/content/interpreter.test.ts scripts/simulate-narrative.test.mjs`
Expected: PASS unchanged — this is the regression check for spec §12's boundary claim (`interpreter.ts` still imports and calls `getMixingOutcomeTarget(exit, success: boolean)` from `narrative.ts`, which this task did not modify).

### 4b. Wire into `serveDrink` and `enterMixing`, extend `CurrentGuestRuntime`

- [ ] **Step 6: Add `mixingTier` to `CurrentGuestRuntime` and `LastDrinkResult` in `src/state/gameState.ts`**

In `src/state/gameState.ts`, add the import and extend the two interfaces. Add near the top import block:

```ts
import type { MixingTier } from '../data/content/mixingScore';
```

Change `LastDrinkResult` (lines 102-108):

```ts
export interface LastDrinkResult {
  recipeId?: string | null;
  label?: string;
  mixedDrinkName?: string;
  isSuccess: boolean;
  mixingTier?: MixingTier;
  sourceNodeId?: string | null;
}
```

Change `CurrentGuestRuntime` (lines 117-138), adding one field after `isSuccess`:

```ts
export interface CurrentGuestRuntime {
  nodeId: string | null;
  returnNodeId: string | null;
  rewardReturnState: 'story' | 'chat' | null;
  discoveredFeatures: string[];
  teachingNodeId: string | null;
  mixingNodeId: string | null;
  observationRequest: ObservationRequest | null;
  pendingRewards: JournalReward[];
  pendingRewardNewIds: string[];
  pendingMixingRetry: boolean;
  mixingPromptOverride?: string;
  isSuccess: boolean;
  mixingTier: MixingTier;
  mixedDrinkName?: string;
  isNewRecipe: boolean;
  rewards: JournalReward[];
  drinkLabel?: string;
  challenges: string[];
  transcript: GuestTranscriptEntry[];
  tailChat: TailChatRuntime;
  lastDrinkResult: LastDrinkResult | null;
}
```

In `createEmptyCurrentGuestRuntime()`, add `mixingTier: 'perfect',` right after `isSuccess: false,`.

In `hydrateCurrentGuestRuntime()`, add tier hydration right after the existing `isSuccess` hydration line:

```ts
    isSuccess: typeof next.isSuccess === 'boolean' ? next.isSuccess : base.isSuccess,
    mixingTier: next.mixingTier === 'perfect' || next.mixingTier === 'good' || next.mixingTier === 'off'
      ? next.mixingTier
      : base.mixingTier,
```

In `deriveLastDrinkResultFromCurrentGuest`, add `mixingTier: currentGuest.mixingTier,` to the returned object (this keeps old saves without a stored `mixingTier` deriving a sensible default via `base.mixingTier` above, satisfying the additive/backward-compatible hydration pattern already used throughout this file — no `PERSISTED_GAME_SNAPSHOT_VERSION` bump needed since this is a purely additive optional-with-fallback field, consistent with how every other field in this function is handled).

`pendingMixingRetry` and `mixingPromptOverride` remain in the type (still read by `continueResult`) but Step 8 below makes `serveDrink` always write `pendingMixingRetry: false` — see the god-function-cleanup note in Step 8.

- [ ] **Step 7: Update `buildDailyGuestRecord`'s fallback text in `src/app/flowHelpers.ts`**

In `src/app/flowHelpers.ts`, `buildDailyGuestRecord` (lines 128-159) currently has:

```ts
    servedDrink:
      params.drinkLabel ||
      (params.isSuccess ? params.mixedDrinkName || '完成了一次调配' : '未能调出合适的酒'),
```

Since `serveDrink` now always computes a real `drinkLabel` via `scoreMixing` (even for `off` tier — spec §4.4), `params.drinkLabel` is always populated going forward, making the fallback branch dead for new records (it stays only for backward compatibility with any already-persisted record shape, which this function doesn't rehydrate — it's a one-shot record builder, not a hydrator). Simplify to:

```ts
    servedDrink: params.drinkLabel || '完成了一次调配',
```

Remove the now-unused `isSuccess`/`mixedDrinkName` fallback branch logic; keep the `isSuccess?: boolean` param and `success: !!params.isSuccess` line as-is (still consumed by `nextGuest`'s call site — see Step 8, `nextGuest` keeps passing `isSuccess: game.currentGuest.isSuccess` for now since the `DailyGuestRecord.success` field is a separate concern from mixing tier and out of this task's scope per spec §3.5).

- [ ] **Step 8: Rewrite `serveDrink` in `src/hooks/useGameFlowController.ts`**

Update imports (replace lines 3-32's relevant parts):

```ts
import type { CharacterNode, NodePlayerOption } from '../data/content/types';
import {
  getMixingRequest,
  resolveNodeExit,
} from '../data/content/narrative';
import { scoreMixing } from '../data/content/mixingScore';
import {
  compileNodeCompletionNarrativeTransaction,
  compileOptionNarrativeTransaction,
} from '../data/content/effects';
import type { NarrativeTransaction } from '../state/narrativeEffects';
import {
  contentRegistry,
  findNodeForGuest,
  getGuestsForDay,
  resolveLlmChatConfigForGuest,
} from '../data/gameData';
import {
  DAYS_PER_WEEK,
  buildDailyGuestRecord,
  findScheduledVisit,
  findTeachingNodeForMixing,
  normalizeStoryUnlockEntries,
  resolveGuestNode,
  type ScheduledVisit,
} from '../app/flowHelpers';
import {
  resolveActiveMixingNode,
  resolveMixingOutcomeNode,
} from '../app/narrativeRouting';
```

(Drops `isMixingExit` from the `narrative.ts` import — no longer used directly in this file, it's fully encapsulated in `narrativeRouting.ts` now. Drops `formatMixedDrinkLabel` from the `flowHelpers.ts` import — `scoreMixing` now owns label formatting internally.)

Delete the module-level `getNextExitTarget`/`asMixingNode`/`MixingCandidate` helpers (lines 71, 84-97) — fully superseded by `resolveActiveMixingNode`. Keep `MixingCandidate` type alias only if still referenced elsewhere in the file (grep confirms it's only used by these two helpers and the `enterMixing`/`serveDrink` parameter types — replace those parameter types with `CharacterNode | null | undefined` inline, or keep the type alias and just drop the two functions; keep the type alias since `enterMixing`'s public signature still needs a name for it).

Rewrite `enterMixing` (lines 337-375) to use `resolveActiveMixingNode`:

```ts
  const enterMixing = useCallback((teachingCandidate: MixingCandidate, mixingCandidate: MixingCandidate) => {
    const normalizedMixingNode = resolveActiveMixingNode({
      teachingCandidate: teachingCandidate || null,
      mixingCandidate: mixingCandidate || null,
      resolveFollowupNode: (nodeId) => findNodeForGuest(nodeId, guest.id, guest.nodeMap),
    });
    const normalizedTeachingNode = findTeachingNodeForMixing(
      guest,
      teachingCandidate || null,
      normalizedMixingNode || teachingCandidate || null,
    );
    const taughtRecipeId = normalizedTeachingNode?.teaching?.recipe?.id;
    const mixingRequest = normalizedMixingNode
      ? getMixingRequest(resolveNodeExit(normalizedMixingNode))
      : null;

    if (taughtRecipeId && !game.unlockedRecipes.includes(taughtRecipeId)) {
      patchContext({
        unlockedRecipes: [...game.unlockedRecipes, taughtRecipeId],
      });
    }

    appendCurrentGuestChallenge(
      normalizedTeachingNode?.teaching?.recipe?.name
        ? `向${guest.name}学习「${normalizedTeachingNode.teaching.recipe.name}」`
        : mixingRequest?.request_text || mixingRequest?.hint,
    );

    patchCurrentGuest({
      teachingNodeId: normalizedTeachingNode?.event_id || normalizedTeachingNode?.id || null,
      mixingNodeId: normalizedMixingNode?.event_id || normalizedMixingNode?.id || null,
      pendingMixingRetry: false,
      mixingPromptOverride: undefined,
    });
    transition('dayLoop.guest.mixing');
  }, [appendCurrentGuestChallenge, game.unlockedRecipes, guest, patchContext, patchCurrentGuest, transition]);
```

(Behavior-preserving: the original passed `normalizedMixingNode || mixingCandidate` as the third arg to `findTeachingNodeForMixing`; since `mixingCandidate` param is now folded into `resolveActiveMixingNode`'s internal chain and `normalizedMixingNode` already reflects that fallback, `normalizedMixingNode || teachingCandidate || null` preserves the original's effective fallback ordering for the teaching-node lookup — `findTeachingNodeForMixing`'s third parameter is used only to read `.teaching`/`.trigger_condition` off of it, and `teachingCandidate` was always in the original `mixingCandidate` fallback chain via `asMixingNode(teachingCandidate)`, so this is equivalent.)

Rewrite `serveDrink` (lines 470-550):

```ts
  const serveDrink = useCallback((ingredients: string[]) => {
    const activeMixingNode = resolveActiveMixingNode({
      teachingCandidate: teachingNode,
      mixingCandidate: mixingNode,
      resolveFollowupNode: (nodeId) => findNodeForGuest(nodeId, guest.id, guest.nodeMap),
    });
    const mixingRequest = activeMixingNode
      ? getMixingRequest(resolveNodeExit(activeMixingNode))
      : null;

    const scoreResult = scoreMixing(mixingRequest, ingredients, contentRegistry.recipes);
    const { tier, matchedRecipeId, drinkLabel } = scoreResult;
    const isSuccess = tier !== 'off';

    let nextUnlockedRecipes = game.unlockedRecipes;
    let isNewRecipe = false;
    if (matchedRecipeId && !game.unlockedRecipes.includes(matchedRecipeId)) {
      nextUnlockedRecipes = [...game.unlockedRecipes, matchedRecipeId];
      isNewRecipe = true;
    }

    const matchedRecipe = contentRegistry.recipes.recipes.find(recipe => recipe.id === matchedRecipeId);
    const mixedDrinkName = matchedRecipe?.name;

    const nextNodeId = resolveMixingOutcomeNode(activeMixingNode, tier);

    if (nextUnlockedRecipes !== game.unlockedRecipes) {
      patchContext({
        unlockedRecipes: nextUnlockedRecipes,
      });
    }

    patchCurrentGuest({
      isSuccess,
      mixingTier: tier,
      nodeId: nextNodeId || null,
      pendingMixingRetry: false,
      mixingPromptOverride: undefined,
      mixedDrinkName,
      isNewRecipe,
      drinkLabel,
      lastDrinkResult: {
        recipeId: matchedRecipeId,
        label: drinkLabel,
        mixedDrinkName,
        isSuccess,
        mixingTier: tier,
        sourceNodeId: activeMixingNode?.event_id || activeMixingNode?.id || null,
      },
    });
    transition('dayLoop.guest.result');
  }, [contentRegistry, game.unlockedRecipes, guest, mixingNode, patchContext, patchCurrentGuest, teachingNode, transition]);
```

Key changes from the original 80-line version: no inline formula comparison, no inline recipe-catalog scan, no `shouldRetryMixingFailure` call — `pendingMixingRetry`/`mixingPromptOverride` are unconditionally cleared since retry no longer exists. `isSuccess` is now derived (`tier !== 'off'`) purely for backward-compatible consumers (`nextGuest`'s `characterProgress` gate, `dialogueProgress.ts`'s LLM context, `DailyGuestRecord.success`) rather than being the judgment itself.

One deliberate behavior change: the original computed `idealFormula` as `mixingRequest?.preferred_drink?.formula || teachingNode?.teaching?.recipe?.formula` (a fallback to the teaching recipe's formula when the mixing request itself had none) — `scoreMixing` only reads `request?.preferred_drink?.formula` and has no equivalent fallback. This is safe to drop: all 6 of fox_uncle's `drink_request` nodes (the only teaching-flow content in the game) already set `preferred_drink.formula` explicitly on the mixing node itself (confirmed in `src/assets/character/fox_uncle/nodes_teaching.yaml`), so the teaching-recipe fallback is dead code against every real content node today. If a future teaching node omits `preferred_drink.formula`, `scoreMixing`'s `scoreNamed` treats a missing/empty formula as automatic `perfect` (see `mixingScore.ts`'s `if (!idealFormula || idealFormula.length === 0) { return 'perfect'; }`), which is a reasonable degradation, not a crash or dangling reference.

- [ ] **Step 9: Run the full test suite and content gates**

Run: `npm run content:check && npm run narrative:check && npm test`
Expected: All PASS. `narrative:check`/`content:check` must still validate all 12 real content nodes (aqiang, yuki, fox_uncle, 5 regulars) with zero content edits, confirming spec §2.4.

- [ ] **Step 10: Manual verification — start dev server and mix a drink**

Run: `npm run dev`, open the app, debug-jump to a guest with a mixing node (e.g. via DEV Inspector to W1_D1 aqiang), select ingredients that don't exactly match the formula, click "开始调配".
Expected: The mixing phase always proceeds to `ResultPhase` (no "重新选择" loop), regardless of ingredient choice.

- [ ] **Step 11: Commit**

```bash
git add src/app/narrativeRouting.ts src/app/narrativeRouting.test.ts src/hooks/useGameFlowController.ts src/app/flowHelpers.ts src/state/gameState.ts
git commit -m "feat(mixing): wire scoreMixing into serveDrink, remove retry-on-fail lockstep"
```

---

## Task 5: Highlight rendering in `MixingPhase`/`PixelDialogueBox`

**Files:**
- Modify: `src/components/PixelDialogueBox.tsx`
- Modify: `src/components/MixingPhase.tsx`

**Interfaces:**
- Consumes: `mixingRequest.highlight?: string` (Task 1), `mixingRequest.request_text?: string` (existing).
- Produces: `PixelDialogueBox`'s `Props.text` accepts a plain `string` as before (unchanged — backward compatible with all other callers: `StoryPhase`, `ObservationPhase`, `TailChatPhase`, etc.), plus a new optional `Props.highlight?: string`. When both `text` and `highlight` are provided and `highlight` is a substring of `text`, the matching substring renders wrapped in a `<mark>`-style span instead of plain text.

This task has no unit test file — `PixelDialogueBox`/`MixingPhase` have no existing test coverage (confirmed: no `.test.tsx` files exist in the repo, no React testing-library dependency), consistent with spec §9 ("不要求对 `serveDrink` 本身做 React hook 集成测试（现状也没有）") extending to the UI layer generally. Verification for this task is the manual browser check in Step 3, per this project's standing convention for untested UI components.

- [ ] **Step 1: Add highlight rendering to `PixelDialogueBox.tsx`**

In `src/components/PixelDialogueBox.tsx`, add `highlight?: string` to `Props`:

```ts
interface Props {
  speakerName?: string;
  speakerAvatarColor?: string;
  speakerAvatarUrl?: string;
  text: string;
  highlight?: string;
  options?: Option[];
  onNext?: () => void;
  onTypingStateChange?: (isTyping: boolean) => void;
  footer?: React.ReactNode;
}
```

Add `highlight` to the destructured props and add a render helper. Replace the "Text Area" block:

```tsx
        {/* Text Area */}
        <div className="flex-1 text-2xl leading-relaxed mt-2 whitespace-pre-wrap">
          {displayedText}
        </div>
```

with:

```tsx
        {/* Text Area */}
        <div className="flex-1 text-2xl leading-relaxed mt-2 whitespace-pre-wrap">
          {renderWithHighlight(displayedText, highlight)}
        </div>
```

Add above the component function:

```tsx
function renderWithHighlight(displayedText: string, highlight?: string): React.ReactNode {
  if (!highlight || !displayedText.includes(highlight)) {
    return displayedText;
  }

  const index = displayedText.indexOf(highlight);
  const before = displayedText.slice(0, index);
  const matched = displayedText.slice(index, index + highlight.length);
  const after = displayedText.slice(index + highlight.length);

  return (
    <>
      {before}
      <mark className="rounded bg-[#8b5a2b]/40 px-0.5 text-[#ffe9b3]">{matched}</mark>
      {after}
    </>
  );
}
```

Update the function signature to destructure `highlight`:

```ts
export default function PixelDialogueBox({
  speakerName,
  speakerAvatarColor,
  speakerAvatarUrl,
  text,
  highlight,
  options,
  onNext,
  onTypingStateChange,
  footer,
}: Props) {
```

(`renderWithHighlight` operates on `displayedText`, the typewriter-progressive substring, so the highlight only appears once the typewriter has revealed that portion of the text — matching the existing incremental-reveal UX rather than spoiling the highlight ahead of the typing animation.)

- [ ] **Step 2: Pass `highlight` through `MixingPhase.tsx`**

In `src/components/MixingPhase.tsx`, extend the local `MixingRequest` interface (lines 6-17):

```ts
interface MixingRequest {
  player_prompt?: string;
  request_text?: string;
  hint?: string;
  keywords?: string[];
  preferred_drink?: {
    id?: string;
    name?: string;
    formula?: string[];
  };
  retry_on_fail?: boolean;
  kind?: 'named' | 'trait' | 'open';
  highlight?: string;
  required_tags?: string[];
}
```

In the `PixelDialogueBox` JSX call (around line 444-473), add the `highlight` prop, only surfacing it when the currently-displayed `guidanceText` is the request text itself (not a teaching line or a system override, since `highlight` only makes sense as a substring of the guest's own request text):

```tsx
          <PixelDialogueBox
            speakerName={promptOverride && !isReviewingPrompt ? '系统' : teaching ? '老师' : '我'}
            speakerAvatarUrl={isTeacherSpeaking ? (guest.expressions.dialogue || guest.expressions.normal || guest.image) : undefined}
            speakerAvatarColor={isTeacherSpeaking ? guest.avatarColor : undefined}
            text={guidanceText}
            highlight={
              !promptOverride && !teaching && mixingRequest?.highlight
                ? mixingRequest.highlight
                : undefined
            }
            options={
```

(`guidanceText` is the plain request/hint/preferred-drink-name text built by `buildPlayerPrompt` when there's no `promptOverride`/`teaching` — that's the only branch where `mixingRequest.highlight`, a substring of `request_text`, is guaranteed to actually appear in the displayed string. `buildPlayerPrompt` itself is unchanged; `highlight` doesn't need to influence the fallback-chain — spec §4.1 only requires the substring be visually marked wherever it's shown, and `buildPlayerPrompt`'s priority chain already surfaces `request_text` directly whenever there's no `player_prompt`/`hint`/`preferred_drink.name` override, which is the common case for `open`/`trait` requests authored specifically for this feature.)

- [ ] **Step 3: Manual verification — author a test `highlight` value and view it in-game**

Since there's no automated UI test coverage for this component (matching the existing project convention), verify by temporarily setting `highlight: '什么都可以'` on a debug/test content node's `drink_request`, or by checking via React DevTools that the prop threads through correctly. Run `npm run dev`, navigate to a mixing phase, and visually confirm marked text renders with the amber highlight style when `highlight` is set, and confirm existing mixing nodes without a `highlight` field render exactly as before (no visual regression).
Expected: no console errors; highlighted substring visually distinct; nodes without `highlight` unaffected.

- [ ] **Step 4: Run full test suite and typecheck to confirm no regressions**

Run: `npm test && npm run lint`
Expected: PASS (no test file touches these two components, but typecheck must still pass with the new optional props).

- [ ] **Step 5: Commit**

```bash
git add src/components/PixelDialogueBox.tsx src/components/MixingPhase.tsx
git commit -m "feat(mixing): highlight request keywords in MixingPhase"
```

---

## Task 6: Tiered guest reaction copy in `ResultPhase`

**Files:**
- Modify: `src/components/ResultPhase.tsx`
- Modify: `src/App.tsx` (prop wiring)

**Interfaces:**
- Consumes: `game.currentGuest.mixingTier: MixingTier` (Task 4), `MixingTier` type (Task 2).
- Produces: `ResultPhase`'s `Props.tier: MixingTier` replaces `Props.isSuccess: boolean`.

Per spec §8: `perfect` 惊喜, `good` 将就着喝完还吐槽两句, `off` 也喝了但明显不对味 — three static text/visual variants, no persistence, no favorability changes (spec §3.5, §5's non-goals).

- [ ] **Step 1: Rewrite `ResultPhase.tsx` to be tier-driven**

Replace the full file content of `src/components/ResultPhase.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { getCocktailImage } from '../data/gameData';
import { useAudioSystem } from '../systems/audioSystem';
import type { MixingTier } from '../data/content/mixingScore';

interface Props {
  tier: MixingTier;
  mixedDrinkName?: string;
  isNewRecipe?: boolean;
  onContinue: () => void;
}

const TIER_HEADING: Record<MixingTier, string> = {
  perfect: '调配成功',
  good: '将就能喝',
  off: '味道不太对',
};

const TIER_REACTION: Record<MixingTier, string> = {
  perfect: '客人眼睛一亮，一饮而尽。',
  good: '客人皱了皱眉，还是喝完了，嘴里念叨了两句。',
  off: '客人愣了一下，还是喝了下去，表情有点微妙。',
};

const TIER_SFX: Record<MixingTier, string> = {
  perfect: 'mix_success',
  good: 'mix_success',
  off: 'mix_fail',
};

export default function ResultPhase({ tier, mixedDrinkName, isNewRecipe, onContinue }: Props) {
  const { playSfx } = useAudioSystem();
  const [show, setShow] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const hasPlayedResultSfxRef = useRef(false);
  const isPerfect = tier === 'perfect';
  const cocktailImage = getCocktailImage(undefined, mixedDrinkName);

  useEffect(() => {
    const timer = window.setTimeout(() => setShow(true), 100);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    hasPlayedResultSfxRef.current = false;
  }, [tier, mixedDrinkName]);

  useEffect(() => {
    if (show && !hasPlayedResultSfxRef.current) {
      hasPlayedResultSfxRef.current = true;
      playSfx(TIER_SFX[tier]);
    }
  }, [tier, playSfx, show]);

  const handleContinue = () => {
    if (!show || isClosing) {
      return;
    }

    setIsClosing(true);
    window.setTimeout(() => {
      onContinue();
    }, 180);
  };

  return (
    <div
      className={`absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm transition-opacity duration-1000 ${
        show ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleContinue}
    >
      <div className={`transition-all duration-200 ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
        <div className="group relative flex h-64 w-64 cursor-pointer items-center justify-center">
          {isPerfect && (
            <>
              <div className="absolute inset-[-62%] rounded-full bg-[radial-gradient(circle,rgba(253,224,71,0.28)_0%,rgba(253,224,71,0.16)_28%,rgba(253,224,71,0.06)_52%,rgba(253,224,71,0)_76%)] blur-md" />
              <div className="absolute inset-[-36%] rounded-full bg-[radial-gradient(circle,rgba(255,244,185,0.3)_0%,rgba(253,224,71,0.12)_38%,rgba(253,224,71,0)_72%)]" />
              <div className="success-rays absolute inset-[-50%] animate-spin-slow opacity-70" />
            </>
          )}

          <div
            className={`relative z-10 flex h-full w-full items-center justify-center transition-transform duration-500 group-hover:scale-110 ${
              tier === 'perfect'
                ? 'drop-shadow-[0_0_20px_rgba(253,224,71,0.8)]'
                : tier === 'good'
                  ? 'drop-shadow-[0_0_12px_rgba(148,163,184,0.5)]'
                  : 'animate-glitch grayscale contrast-125 sepia hue-rotate-[-50deg] opacity-80'
            }`}
          >
            {cocktailImage ? (
              <img
                src={cocktailImage}
                alt={mixedDrinkName || '调配结果'}
                className="h-52 w-52 object-contain drop-shadow-[0_0_24px_rgba(253,224,71,0.5)]"
              />
            ) : (
              <div className="text-8xl leading-none">{'🍸'}</div>
            )}
          </div>
        </div>

        <div className="relative mt-12 animate-slide-up text-center">
          <h2
            className={`mb-4 text-4xl font-bold ${
              tier === 'perfect' ? 'text-yellow-300' : tier === 'good' ? 'text-slate-300' : 'text-red-400'
            }`}
          >
            {TIER_HEADING[tier]}
          </h2>

          {mixedDrinkName && (
            <div className="mb-4 flex items-center justify-center gap-3 text-3xl font-bold text-amber-200">
              {mixedDrinkName}
              {isNewRecipe && (
                <span className="animate-pulse rounded bg-red-500 px-2 py-1 text-sm text-white shadow-[0_0_10px_rgba(239,68,68,0.8)]">
                  NEW
                </span>
              )}
            </div>
          )}

          <p className="text-base text-gray-400">{TIER_REACTION[tier]}</p>

          <p className="mt-8 text-lg text-gray-300 animate-pulse">点击继续</p>
        </div>
      </div>
    </div>
  );
}
```

Notable behavior change from the original: `mixedDrinkName` now displays for every tier (not just `isSuccess`), since `scoreMixing` always produces a `drinkLabel`/`mixedDrinkName` when a known recipe is matched, per spec §4.4 ("off 档位不是什么都不给"). `cocktailImage` lookup is likewise no longer gated on tier.

- [ ] **Step 2: Update the `ResultPhase` call site in `src/App.tsx`**

In `src/App.tsx` around line 624-631, replace:

```tsx
            {snapshot.value === 'dayLoop.guest.result' && (
              <ResultPhase
                isSuccess={game.currentGuest.isSuccess}
                mixedDrinkName={game.currentGuest.mixedDrinkName}
                isNewRecipe={game.currentGuest.isNewRecipe}
                onContinue={continueResult}
              />
            )}
```

with:

```tsx
            {snapshot.value === 'dayLoop.guest.result' && (
              <ResultPhase
                tier={game.currentGuest.mixingTier}
                mixedDrinkName={game.currentGuest.mixedDrinkName}
                isNewRecipe={game.currentGuest.isNewRecipe}
                onContinue={continueResult}
              />
            )}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run lint`
Expected: PASS — confirms `ResultPhase`'s new `Props.tier: MixingTier` matches `game.currentGuest.mixingTier: MixingTier` from Task 4's `gameState.ts` change with no type errors.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: PASS (no test file directly covers `ResultPhase`, consistent with the rest of the UI layer; this step is the regression guard for everything else).

- [ ] **Step 5: Manual verification — trigger all three tiers in the browser**

Run: `npm run dev`. Debug-jump to a mixing node. Serve an exact-formula match (expect "调配成功" heading, glow rays, `mix_success` SFX). Serve a partial-tag-overlap combination (expect "将就能喝" heading, no glow rays, `mix_success` SFX). Serve an unrelated combination (expect "味道不太对" heading, glitch effect, `mix_fail` SFX). Confirm `onContinue` (click) advances to the next phase in all three cases with no dead-end.
Expected: All three tiers render distinct copy/visuals; clicking continues past `ResultPhase` every time.

- [ ] **Step 6: Commit**

```bash
git add src/components/ResultPhase.tsx src/App.tsx
git commit -m "feat(mixing): tiered guest reaction copy in ResultPhase"
```

---

## Task 7: Documentation cross-reference

**Files:**
- Modify: `docs/代码审查问题清单.md`

**Interfaces:** None (docs-only).

`docs/项目系统与迭代说明.md` already cross-references the design spec (confirmed at line 163: "去卡关化 + 分级反馈设计已确认，详见 `docs/superpowers/specs/2026-08-10-mixing-tier-scoring-design.md`，对应问题清单 `MIX-001`"), and the spec itself was updated in this same work cycle with a §12 addendum documenting the `interpreter.ts` boundary decision — no further edit needed there. This task closes the loop on `docs/代码审查问题清单.md`'s `MIX-001` row, which currently reads `设计中` / 状态 pending implementation.

- [ ] **Step 1: Update the `MIX-001` row status in `docs/代码审查问题清单.md`**

In `docs/代码审查问题清单.md`, find the `MIX-001` row (line 39):

```
| MIX-001 | P2 | 调酒判定为精确配方 ID 比对，失败即卡关重调，原料/配方已有的 tag1/tag2/emotion_tag 语义标签未被判定使用 | 设计中 | 设计见 `docs/superpowers/specs/2026-08-10-mixing-tier-scoring-design.md`；永不卡关、按 tier 分档反馈、判定标准对玩家可见、现有精确配方内容零改动 |
```

Change the 状态 column from `设计中` to `已解决`, and append the plan file reference to the 验收条件 column:

```
| MIX-001 | P2 | 调酒判定为精确配方 ID 比对，失败即卡关重调，原料/配方已有的 tag1/tag2/emotion_tag 语义标签未被判定使用 | 已解决 | 设计见 `docs/superpowers/specs/2026-08-10-mixing-tier-scoring-design.md`，实施计划见 `docs/superpowers/plans/2026-08-10-mixing-tier-scoring-plan.md`；永不卡关、按 tier 分档反馈、判定标准对玩家可见、现有精确配方内容零改动均已验证 |
```

- [ ] **Step 2: Add a verification entry**

Append a new "最近一次验证" style note documenting this cycle's results. In `docs/代码审查问题清单.md`, under the existing `## 最近一次验证` section (after its last bullet, before the section ends), add:

```markdown

## MIX-001 调酒分级反馈验证（2026-08-10）

- `npm run content:check`、`npm run narrative:check`、`npm test`：全部通过，覆盖新增 `mixingScore.test.ts`（10 用例）与改写后的 `narrativeRouting.test.ts`。
- `src/data/content/interpreter.test.ts`、`scripts/simulate-narrative.test.mjs`：改动前后均通过，确认纯解释器的布尔式 `retry_on_fail` 路径枚举逻辑不受本次改动影响（见设计文档 §12）。
- 浏览器手动验收：`perfect`/`good`/`off` 三档均能从调酒界面推进到结果界面再到下一节点，无硬性卡关；`highlight` 字段在 `MixingPhase` 中正确高亮渲染，未设置 `highlight` 的既有节点显示不变。
- `npm run lint`、`npm run build`：通过。
```

- [ ] **Step 3: Commit**

```bash
git add docs/代码审查问题清单.md
git commit -m "docs(mixing): cross-reference design spec in issue list and iteration notes"
```

---

## Final Verification

- [ ] **Step 1: Run the complete gate sequence**

Run: `npm run content:check && npm run narrative:check && npm run narrative:simulate && npm test && npm run lint && npm run build`
Expected: All PASS. `narrative:simulate` in particular must still report the same guest/path/retry counts as the last verified baseline (74 paths, 27 recovered-retry paths, 0 failed visits — see `docs/代码审查问题清单.md`'s "最近一次验证" baseline) since `interpreter.ts`/`simulator.ts` were deliberately left untouched.

- [ ] **Step 2: Full manual playthrough smoke test**

Run: `npm run dev`. Play through at least one full guest visit per real content shape identified during research: (a) aqiang's explicit `exit: kind: mixing` node with both `retry_on_fail` and explicit `outcomes.fail`, (b) yuki's legacy `drink_request` + `on_mixing_fail`, (c) one of fox_uncle's teaching nodes (`retry_on_fail: true`, no fail target), (d) one regular's legacy `drink_request` + `on_mixing_fail`. For each, serve an intentionally mismatched formula and confirm the visit always reaches a result and then continues — no soft-lock, no repeated forced retry.
Expected: All four content shapes reach `ResultPhase` and continue past it regardless of ingredient choice.
