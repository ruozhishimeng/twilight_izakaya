import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type {
  CharacterNode,
  ContentRegistry,
  DrinkRequestSource,
  Guest,
  RecipesCatalog,
} from './types';
import {
  validateContentRegistry,
  validateNarrativeEffectDeclarations,
} from './validation';

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

test('legacy mixing requires an explicit success target and allows retry-only failure', () => {
  const retryingNodes = [
    createNode('teaching_mixing', {
      drink_request: {
        ...validMixingRequest,
        retry_on_fail: true,
      },
      on_mixing_complete: 'teaching_success',
    }),
    createNode('teaching_success'),
  ];
  assert.doesNotThrow(() => validateContentRegistry(createRegistry(retryingNodes)));

  const message = getValidationError([
    createNode('missing_success', {
      drink_request: validMixingRequest,
      on_mixing_fail: 'mixing_fail',
    }),
    createNode('mixing_fail'),
  ]);
  assert.match(message, /must define a success target/);
});

test('explicit mixing may use retry-only failure but otherwise requires a fail target', () => {
  const retryOnlyNodes = [
    createNode('explicit_retry_mixing', {
      exit: {
        kind: 'mixing',
        request: {
          ...validMixingRequest,
          retry_on_fail: true,
        },
        outcomes: {
          success: 'explicit_retry_success',
          fail: null,
        },
      },
    }),
    createNode('explicit_retry_success', { exit: { kind: 'end_visit' } }),
  ];
  assert.doesNotThrow(() => validateContentRegistry(createRegistry(retryOnlyNodes)));

  assert.match(getValidationError([
    createNode('explicit_missing_fail', {
      exit: {
        kind: 'mixing',
        request: validMixingRequest,
        outcomes: {
          success: 'explicit_success',
          fail: null,
        },
      },
    }),
    createNode('explicit_success', { exit: { kind: 'end_visit' } }),
  ]), /unless retry_on_fail is true/);
});

test('inspect-all choice groups are uniform and return through the node exit', () => {
  const validNodes = [
    createNode('inspect_all', {
      player_options: [
        { id: 'left', text: '问左边', branch_type: 'choice' },
        {
          id: 'right',
          text: '问右边',
          branch_type: 'choice',
          condition: { need_item: 'clue', locked_text: '需要线索' },
        },
      ],
      exit: { kind: 'next', target: 'after_inspection' },
    }),
    createNode('after_inspection', { exit: { kind: 'end_visit' } }),
  ];
  assert.doesNotThrow(() => validateContentRegistry(createRegistry(validNodes)));

  assert.match(getValidationError([
    createNode('mixed_choices', {
      player_options: [
        { id: 'inspect', text: '逐项问', branch_type: 'choice' },
        { id: 'leave', text: '直接走', branch_type: 'plot' },
      ],
      exit: { kind: 'end_visit' },
    }),
  ]), /cannot mix branch_type=choice/);

  assert.match(getValidationError([
    createNode('inspect_with_target', {
      player_options: [{
        id: 'invalid',
        text: '不该跳转',
        branch_type: 'choice',
        next_node: 'target',
      }],
      exit: { kind: 'next', target: 'target' },
    }),
    createNode('target', { exit: { kind: 'end_visit' } }),
  ]), /must return to the choice group/);
});

test('before-next tail chat accepts an option-specific resume target', () => {
  const nodes = [
    createNode('tail_source', {
      llm_chat: { entry_mode: 'before_next_node' },
      player_options: [{
        id: 'custom_route',
        text: '走专属路线',
        next_node: 'tail_target',
      }],
      exit: { kind: 'end_visit' },
    }),
    createNode('tail_target', { exit: { kind: 'end_visit' } }),
  ];

  assert.doesNotThrow(() => validateContentRegistry(createRegistry(nodes)));
});

test('non-null fallback_node is rejected until a condition resolver can execute it', () => {
  const message = getValidationError([
    createNode('fallback_source', {
      player_options: [{
        id: 'fallback_option',
        text: '尝试分支',
        next_node: 'primary_target',
        fallback_node: 'fallback_target',
      }],
      exit: { kind: 'end_visit' },
    }),
    createNode('primary_target', { exit: { kind: 'end_visit' } }),
    createNode('fallback_target', { exit: { kind: 'end_visit' } }),
  ]);

  assert.match(message, /fallback_node is not executable/);
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

test('valid option and node relationship effects pass declaration validation', () => {
  const node: CharacterNode = {
    event_id: 'aqiang_relationship_event',
    player_options: [
      {
        id: 'show_concern',
        text: '关心他的状态',
        effects: [
          {
            id: 'affection_up',
            type: 'relationship.change',
            target: 'self',
            axis: 'affection',
            amount: 2,
            feedback: '阿相感受到了你的关心',
          },
        ],
      },
    ],
    on_complete: {
      effect_scope: 'visit',
      effects: [
        {
          id: 'visit_complete',
          type: 'relationship.change',
          target: 'aqiang',
          amount: 1,
        },
      ],
    },
  };

  assert.deepEqual(
    validateNarrativeEffectDeclarations('aqiang', 'aqiang_relationship_event', node),
    [],
  );
});

test('relationship effect axes must be registered before content can use them', () => {
  const node = {
    event_id: 'unknown_axis',
    player_options: [{
      id: 'trust_option',
      text: '建立信任',
      effects: [{
        id: 'trust_up',
        type: 'relationship.change',
        target: 'self',
        axis: 'trust',
        amount: 1,
      }],
    }],
  } as CharacterNode;

  assert.match(
    validateNarrativeEffectDeclarations('aqiang', 'unknown_axis', node).join('\n'),
    /axis "trust" is not registered/,
  );
});

test('an option effects block requires a stable and unique option id', () => {
  const node: CharacterNode = {
    event_id: 'unstable_options',
    player_options: [
      { text: '没有 ID', effects: [] },
      { id: 'same', text: '重复一' },
      { id: 'same', text: '重复二' },
    ],
  };

  const errors = validateNarrativeEffectDeclarations('aqiang', 'unstable_options', node);
  assert.ok(errors.some(error => error.includes('option 1 with effects requires a stable id')));
  assert.ok(errors.some(error => error.includes('duplicate option id "same"')));
});

test('effect blocks reject duplicate ids, invalid relationship fields and illegal scope', () => {
  const node = {
    event_id: 'invalid_effects',
    player_options: [
      {
        id: 'invalid_option',
        text: '错误效果',
        effect_scope: 'session',
        effects: [
          {
            id: 'duplicate',
            type: 'unknown.effect',
            target: '',
            axis: '',
            amount: 0,
            feedback: '',
          },
          {
            id: 'duplicate',
            type: 'relationship.change',
            target: 'self',
            amount: Number.POSITIVE_INFINITY,
          },
        ],
      },
    ],
  } as unknown as CharacterNode;

  const errors = validateNarrativeEffectDeclarations('aqiang', 'invalid_effects', node);
  const message = errors.join('\n');
  assert.match(message, /effect_scope must be "game" or "visit"/);
  assert.match(message, /duplicate effect id "duplicate"/);
  assert.match(message, /type must be "relationship\.change"/);
  assert.match(message, /target must be a non-empty string/);
  assert.match(message, /axis must be a non-empty string/);
  assert.match(message, /amount must be a finite non-zero number/);
  assert.match(message, /feedback must be a non-empty string/);
});

test('node on_complete uses the same validation rules', () => {
  const malformedBlock = {
    event_id: 'bad_on_complete',
    on_complete: {
      effect_scope: 'forever',
      effects: [
        {
          id: '',
          type: 'relationship.change',
          target: 'self',
          amount: Number.NaN,
        },
      ],
    },
  } as unknown as CharacterNode;

  const errors = validateNarrativeEffectDeclarations('aqiang', 'bad_on_complete', malformedBlock);
  assert.ok(errors.some(error => error.includes('on_complete effect_scope')));
  assert.ok(errors.some(error => error.includes('id must be a non-empty string')));
  assert.ok(errors.some(error => error.includes('amount must be a finite non-zero number')));

  assert.deepEqual(
    validateNarrativeEffectDeclarations(
      'aqiang',
      'invalid_on_complete_shape',
      { on_complete: [] } as unknown as CharacterNode,
    ),
    ['[aqiang] node invalid_on_complete_shape on_complete must be an object'],
  );
});
