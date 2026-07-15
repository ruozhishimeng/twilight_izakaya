import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { loadContentSourceFromFs } from '../../../scripts/loadContentFromFs';
import {
  analyzeNarrativeGraph,
  buildGuestNarrativeGraph,
  findNarrativePath,
} from './graph';
import { normalizeContentRegistry } from './normalizer';
import { validateContentRegistry } from './validation';
import type {
  CharacterNode,
  ContentRegistry,
  DrinkRequestSource,
  Guest,
  RecipesCatalog,
} from './types';

const mixingRequest: DrinkRequestSource = {
  request_text: '调一杯能让人想起重要之人的酒',
  preferred_drink: {
    id: 'R001',
    name: '未竟的生诞',
    formula: ['bc01', 'm04', 'f03'],
  },
};

const recipes: RecipesCatalog = {
  ingredients: {
    bases: {
      japanese: [{ id: 'bc01', name: '清酒' }],
      classic: [],
    },
    mixers: [{ id: 'm04', name: '苏打水' }],
    flavors: [{ id: 'f03', name: '樱花糖浆' }],
  },
  recipes: [{ id: 'R001', name: '未竟的生诞' }],
};

function createNode(id: string, patch: Partial<CharacterNode> = {}): CharacterNode {
  return {
    event_id: id,
    script_flow: [{ type: 'npc', content: [`${id} dialogue`] }],
    ...patch,
  };
}

function createRegistry(nodes: CharacterNode[], startNodeId: string): ContentRegistry {
  const nodeMap = new Map(
    nodes.map(node => [String(node.event_id || node.id), node]),
  );
  const guest: Guest = {
    id: 'test_guest',
    name: '测试客人',
    imagePlaceholderColor: '#000000',
    avatarColor: '#000000',
    image: '',
    expressions: {},
    features: [],
    correctFeatures: [],
    phases: [],
    type: 'Lost Soul',
    meta: {
      character_id: 'test_guest',
      base_info: {},
    },
    llmChatDefault: {
      enabled: false,
      maxTurns: 3,
      entryStatusText: '暂时不聊',
      blockedMessage: '现在不能聊',
      exhaustedMessage: '已经聊完了',
    },
    gallery: {
      baseInfo: {},
      chapters: [],
    },
    startNodeIds: [startNodeId],
    nodeMap,
    nodes: {
      main: nodes,
      teaching: [],
      chat: [],
      hidden: [],
      all: nodes,
    },
  };

  return {
    guests: [guest],
    guestById: new Map([[guest.id, guest]]),
    schedule: {
      schedule: [{
        day: 'W1_D1',
        guests: [{
          character_id: guest.id,
          start_node: startNodeId,
        }],
      }],
    },
    recipes,
    ingredientIds: new Set(['bc01', 'm04', 'f03']),
    recipeIds: new Set(['R001']),
  };
}

test('guest graph includes option next and fallback edges', () => {
  const registry = createRegistry([
    createNode('start', {
      player_options: [{
        text: '选择一条支线',
        next_node: 'choice_target',
        fallback_node: 'fallback_target',
      }],
      exit: { kind: 'end_visit' },
    }),
    createNode('choice_target', { exit: { kind: 'end_visit' } }),
    createNode('fallback_target', { exit: { kind: 'end_visit' } }),
  ], 'start');

  const { graph } = buildGuestNarrativeGraph(registry.guests[0]);
  const optionEdges = graph.edges.filter(edge => edge.from === 'start');

  assert.deepEqual(optionEdges, [
    { from: 'start', to: 'choice_target', kind: 'option_next' },
    { from: 'start', to: 'fallback_target', kind: 'option_fallback' },
  ]);
});

test('analysis rejects a missing scheduled start and warns for valid no-mixing visits', () => {
  const missingStart = analyzeNarrativeGraph(createRegistry([
    createNode('actual_start', { exit: { kind: 'end_visit' } }),
  ], 'missing_start'));
  assert.ok(missingStart.diagnostics.some(diagnostic => (
    diagnostic.code === 'SCHEDULED_START_MISSING' &&
    diagnostic.severity === 'error' &&
    diagnostic.nodeId === 'missing_start'
  )));

  const noMixing = analyzeNarrativeGraph(createRegistry([
    createNode('start', {
      exit: { kind: 'next', target: 'ending' },
    }),
    createNode('ending', { exit: { kind: 'end_visit' } }),
  ], 'start'));
  assert.ok(noMixing.diagnostics.some(diagnostic => (
    diagnostic.code === 'SCHEDULED_PATH_NO_MIXING' &&
    diagnostic.severity === 'warning'
  )));
});

test('analysis warns about unreachable main nodes', () => {
  const analysis = analyzeNarrativeGraph(createRegistry([
    createNode('start', {
      exit: {
        kind: 'mixing',
        request: mixingRequest,
        outcomes: { success: 'success', fail: 'fail' },
      },
    }),
    createNode('success', { exit: { kind: 'end_visit' } }),
    createNode('fail', { exit: { kind: 'end_visit' } }),
    createNode('orphan', { exit: { kind: 'end_visit' } }),
  ], 'start'));

  assert.ok(analysis.diagnostics.some(diagnostic => (
    diagnostic.code === 'UNREACHABLE_MAIN_NODE' &&
    diagnostic.severity === 'warning' &&
    diagnostic.nodeId === 'orphan'
  )));
});

test('analysis reports a reachable strongly connected component without an exit', () => {
  const analysis = analyzeNarrativeGraph(createRegistry([
    createNode('start', {
      exit: {
        kind: 'mixing',
        request: mixingRequest,
        outcomes: { success: 'loop_a', fail: 'ending' },
      },
    }),
    createNode('loop_a', {
      exit: { kind: 'next', target: 'loop_b' },
    }),
    createNode('loop_b', {
      exit: { kind: 'next', target: 'loop_a' },
    }),
    createNode('ending', { exit: { kind: 'end_visit' } }),
  ], 'start'));

  assert.ok(analysis.diagnostics.some(diagnostic => (
    diagnostic.code === 'CLOSED_CYCLE' &&
    diagnostic.severity === 'error' &&
    diagnostic.message.includes('loop_a -> loop_b')
  )));
});

test('real W1_D3 Aqiang graph proves dialogue-to-mixing success and fail paths', () => {
  const registry = normalizeContentRegistry(loadContentSourceFromFs());
  validateContentRegistry(registry);

  const aqiang = registry.guestById.get('aqiang');
  assert.ok(aqiang, 'expected real Aqiang content');
  const { graph, diagnostics } = buildGuestNarrativeGraph(aqiang);
  assert.equal(diagnostics.filter(diagnostic => diagnostic.severity === 'error').length, 0);

  const prefix = [
    'aqiang_001_dialogue_main',
    'aqiang_002_dialogue_main',
    'aqiang_003_drink_request',
  ];
  assert.deepEqual(
    findNarrativePath(graph, prefix[0], 'aqiang_phase1_success'),
    [...prefix, 'aqiang_phase1_success'],
  );
  assert.deepEqual(
    findNarrativePath(graph, prefix[0], 'aqiang_phase1_fail'),
    [...prefix, 'aqiang_phase1_fail'],
  );

  const analysis = analyzeNarrativeGraph(registry);
  const scheduledVisit = analysis.scheduledEntries.find(entry => (
    entry.day === 'W1_D3' && entry.guestId === 'aqiang'
  ));
  assert.ok(scheduledVisit, 'expected scheduled W1_D3 Aqiang visit');
  assert.ok(scheduledVisit.reachableMixingNodeIds.includes('aqiang_003_drink_request'));
  assert.equal(analysis.diagnostics.some(diagnostic => (
    diagnostic.code === 'SCHEDULED_PATH_NO_MIXING' &&
    diagnostic.guestId === 'aqiang' &&
    diagnostic.nodeId === 'aqiang_001_dialogue_main'
  )), false);
});
