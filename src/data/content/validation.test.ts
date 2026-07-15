import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type {
  CharacterNode,
  ContentRegistry,
  DrinkRequestSource,
  Guest,
  RecipesCatalog,
} from './types';
import { validateContentRegistry } from './validation';

const ingredientIds = ['bc01', 'm04', 'f03'];

const validMixingRequest: DrinkRequestSource = {
  mode: 'normal',
  request_text: '调一杯能让阿相想起妹妹的酒',
  preferred_drink: {
    id: 'R001',
    name: '未竟的生诞',
    formula: ingredientIds,
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
  recipes: [{ id: 'R001', name: '未竟的生诞', formula: ingredientIds }],
};

function createNode(id: string, patch: Partial<CharacterNode> = {}): CharacterNode {
  return {
    event_id: id,
    script_flow: [{ type: 'npc', content: [`${id} dialogue`] }],
    ...patch,
  };
}

function createRegistry(nodes: CharacterNode[]): ContentRegistry {
  const nodeMap = new Map(
    nodes.map(node => [String(node.event_id || node.id), node]),
  );
  const guest: Guest = {
    id: 'aqiang',
    name: '阿相',
    imagePlaceholderColor: '#000000',
    avatarColor: '#000000',
    image: '',
    expressions: {},
    features: [],
    correctFeatures: [],
    phases: [],
    type: 'Lost Soul',
    meta: {
      character_id: 'aqiang',
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
    startNodeIds: [String(nodes[0]?.event_id || nodes[0]?.id)],
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
        day: 'W1_D3',
        guests: [{
          character_id: guest.id,
          start_node: String(nodes[0]?.event_id || nodes[0]?.id),
        }],
      }],
    },
    recipes,
    ingredientIds: new Set(ingredientIds),
    recipeIds: new Set(['R001']),
  };
}

function getValidationError(nodes: CharacterNode[]) {
  let caught: unknown;
  try {
    validateContentRegistry(createRegistry(nodes));
  } catch (error) {
    caught = error;
  }

  assert.ok(caught instanceof Error, 'expected content validation to fail');
  return caught.message;
}

test('accepts Aqiang explicit mixing exit with complete request and outcomes', () => {
  const nodes = [
    createNode('aqiang_003_drink_request', {
      exit: {
        kind: 'mixing',
        request: validMixingRequest,
        outcomes: {
          success: 'aqiang_phase1_success',
          fail: 'aqiang_phase1_fail',
        },
      },
    }),
    createNode('aqiang_phase1_success', {
      diary_note: '阿相想起了妹妹。',
      exit: { kind: 'end_visit' },
    }),
    createNode('aqiang_phase1_fail', {
      diary_note: '这杯酒没能触及他的记忆。',
      exit: { kind: 'end_visit' },
    }),
  ];

  assert.doesNotThrow(() => validateContentRegistry(createRegistry(nodes)));
});

test('rejects legacy mixing field when the node has no explicit exit', () => {
  const message = getValidationError([
    createNode('aqiang_003_drink_request', {
      mixing: {
        request_text: 'legacy request',
      },
    }),
  ]);

  assert.match(message, /unsupported legacy field "mixing"/);
});

test('rejects object-shaped diary_note', () => {
  const node = createNode('aqiang_phase1_success');
  (node as unknown as { diary_note: unknown }).diary_note = {
    title: '不受支持的旧日记结构',
    content: '必须迁移为字符串',
  };

  const message = getValidationError([node]);

  assert.match(message, /diary_note must be a string/);
});

test('rejects dangling targets from explicit next, observation, and mixing exits', () => {
  const message = getValidationError([
    createNode('dangling_next', {
      exit: {
        kind: 'next',
        target: 'missing_next_target',
      },
    }),
    createNode('dangling_observation', {
      exit: {
        kind: 'observation',
        prompt: '仔细观察',
        continue_node: 'missing_observation_target',
      },
    }),
    createNode('dangling_mixing', {
      exit: {
        kind: 'mixing',
        request: validMixingRequest,
        outcomes: {
          success: 'missing_success_target',
          fail: 'missing_fail_target',
        },
      },
    }),
  ]);

  assert.match(message, /missing_next_target/);
  assert.match(message, /missing_observation_target/);
  assert.match(message, /missing_success_target/);
  assert.match(message, /missing_fail_target/);
});

test('requires complete request metadata for an explicit mixing exit', () => {
  const message = getValidationError([
    createNode('incomplete_mixing_request', {
      exit: {
        kind: 'mixing',
        request: {
          preferred_drink: {},
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

  assert.match(message, /drink_request\.request_text must be a non-empty string/);
  assert.match(message, /preferred drink is missing id/);
  assert.match(message, /preferred drink is missing name/);
  assert.match(message, /preferred drink is missing a non-empty formula/);
});
