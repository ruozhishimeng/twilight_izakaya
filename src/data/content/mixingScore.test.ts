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
