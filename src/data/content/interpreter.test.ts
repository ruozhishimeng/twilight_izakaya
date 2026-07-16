import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  createNarrativeInterpreterState,
  enumerateNarrativePaths,
  getNarrativeOptionKey,
  interpretNodeCompletion,
  stepNarrativeInterpreter,
} from './interpreter';
import type { CharacterNode } from './types';

function node(id: string, patch: Partial<CharacterNode> = {}): CharacterNode {
  return {
    event_id: id,
    script_flow: [{ type: 'npc', content: [id] }],
    ...patch,
  };
}

function nodeMap(nodes: CharacterNode[]) {
  return new Map(nodes.map(entry => [String(entry.event_id || entry.id), entry]));
}

const aqiangMixingNode = node('aqiang_003_drink_request', {
  exit: {
    kind: 'mixing',
    request: {
      mode: 'normal',
      request_text: '调一杯能让阿相想起妹妹的酒',
      preferred_drink: {
        id: 'R001',
        name: '未竟的生诞',
        formula: ['bc01', 'm04', 'f03'],
      },
    },
    outcomes: {
      success: 'aqiang_phase1_success',
      fail: 'aqiang_phase1_fail',
    },
  },
});

test('interpretNodeCompletion exposes Aqiang mixing request through the unified exit', () => {
  const directive = interpretNodeCompletion(aqiangMixingNode);

  assert.equal(directive.kind, 'mixing');
  if (directive.kind !== 'mixing') return;
  assert.equal(directive.request.preferred_drink?.id, 'R001');
  assert.deepEqual(directive.exit.outcomes, {
    success: 'aqiang_phase1_success',
    fail: 'aqiang_phase1_fail',
  });
});

test('choices expose stable keys, use index keys for legacy options, and prefer option next', () => {
  const branchNode = node('branch_start', {
    player_options: [
      {
        id: 'direct_branch',
        text: '走独立分支',
        next_node: 'branch_a',
      },
      {
        text: '沿用节点出口',
      },
    ],
    exit: { kind: 'next', target: 'branch_b' },
  });

  const waiting = interpretNodeCompletion(branchNode);
  assert.equal(waiting.kind, 'await_choice');
  if (waiting.kind !== 'await_choice') return;
  assert.deepEqual(waiting.options.map(option => option.key), [
    'id:direct_branch',
    'index:1',
  ]);
  assert.equal(getNarrativeOptionKey(branchNode.player_options![1]!, 1), 'index:1');

  assert.deepEqual(interpretNodeCompletion(branchNode, 'id:direct_branch'), {
    kind: 'node',
    nodeId: 'branch_a',
  });
  assert.deepEqual(interpretNodeCompletion(branchNode, 'index:1'), {
    kind: 'node',
    nodeId: 'branch_b',
  });
});

test('stateful interpreter advances through observation and is stable at end_visit', () => {
  const nodes = nodeMap([
    node('observe_start', {
      exit: {
        kind: 'observation',
        prompt: '仔细看看他的袖口',
        continue_node: 'after_observation',
        feature_groups: ['phase_1'],
      },
    }),
    node('after_observation', { exit: { kind: 'end_visit' } }),
  ]);

  const observationStep = stepNarrativeInterpreter(
    nodes,
    createNarrativeInterpreterState('observe_start'),
    { type: 'complete_node' },
  );
  assert.equal(observationStep.directive.kind, 'observation');
  assert.equal(observationStep.state.kind, 'observation');

  const resumeStep = stepNarrativeInterpreter(nodes, observationStep.state, {
    type: 'complete_observation',
  });
  assert.deepEqual(resumeStep.state, { kind: 'node', nodeId: 'after_observation' });

  const endStep = stepNarrativeInterpreter(nodes, resumeStep.state, {
    type: 'complete_node',
  });
  assert.equal(endStep.state.kind, 'end_visit');
  const stableEnd = stepNarrativeInterpreter(nodes, endStep.state);
  assert.equal(stableEnd.directive.kind, 'end_visit');
  assert.equal(stableEnd.state, endStep.state);
});

test('stateful mixing resolves success and fail exclusively through getMixingOutcomeTarget semantics', () => {
  const nodes = nodeMap([
    aqiangMixingNode,
    node('aqiang_phase1_success', { exit: { kind: 'end_visit' } }),
    node('aqiang_phase1_fail', { exit: { kind: 'end_visit' } }),
  ]);
  const mixingStep = stepNarrativeInterpreter(
    nodes,
    createNarrativeInterpreterState('aqiang_003_drink_request'),
    { type: 'complete_node' },
  );
  assert.equal(mixingStep.state.kind, 'mixing');

  assert.deepEqual(
    stepNarrativeInterpreter(nodes, mixingStep.state, {
      type: 'complete_mixing',
      success: true,
    }).state,
    { kind: 'node', nodeId: 'aqiang_phase1_success' },
  );
  assert.deepEqual(
    stepNarrativeInterpreter(nodes, mixingStep.state, {
      type: 'complete_mixing',
      success: false,
    }).state,
    { kind: 'node', nodeId: 'aqiang_phase1_fail' },
  );
});

test('mixing retries only when failure has no explicit outcome target', () => {
  const teachingMixing = node('teaching_mixing', {
    exit: {
      kind: 'mixing',
      request: {
        request_text: '再试一次',
        retry_on_fail: true,
      },
      outcomes: {
        success: 'teaching_success',
        fail: null,
      },
    },
  });
  const nodes = nodeMap([
    teachingMixing,
    node('teaching_success', { exit: { kind: 'end_visit' } }),
  ]);
  const mixing = stepNarrativeInterpreter(
    nodes,
    createNarrativeInterpreterState('teaching_mixing'),
    { type: 'complete_node' },
  );
  const retry = stepNarrativeInterpreter(nodes, mixing.state, {
    type: 'complete_mixing',
    success: false,
  });

  assert.equal(retry.directive.kind, 'mixing');
  assert.deepEqual(retry.state, {
    ...mixing.state,
    retryCount: 1,
  });

  const paths = enumerateNarrativePaths(nodes, 'teaching_mixing');
  assert.equal(paths.length, 2);
  assert.ok(paths.every(path => path.terminal === 'end_visit'));
  assert.equal(paths.some(path => (
    path.trace.some(entry => entry.action === 'mixing_fail' && entry.directive === 'mixing') &&
    path.trace.some(entry => entry.action === 'mixing_success')
  )), true);
});

test('inspect-all choices carry progress in interpreter state and finish after available options', () => {
  const inspectNode = node('inspect', {
    player_options: [
      { id: 'ask_left', text: '问左边', branch_type: 'choice' },
      { id: 'ask_right', text: '问右边', branch_type: 'choice' },
      {
        id: 'locked_clue',
        text: '交出线索',
        branch_type: 'choice',
        condition: { need_item: 'clue', locked_text: '需要线索' },
      },
    ],
    exit: { kind: 'next', target: 'after_inspection' },
  });

  const initial = interpretNodeCompletion(inspectNode, undefined, {
    availableOptionKeys: ['id:ask_left', 'id:ask_right'],
  });
  assert.equal(initial.kind, 'await_choice');
  if (initial.kind !== 'await_choice') return;
  assert.equal(initial.mode, 'inspect_all');

  const afterLeft = interpretNodeCompletion(inspectNode, 'id:ask_left', {
    availableOptionKeys: ['id:ask_left', 'id:ask_right'],
  });
  assert.equal(afterLeft.kind, 'await_choice');
  if (afterLeft.kind !== 'await_choice') return;
  assert.deepEqual(afterLeft.completedOptionKeys, ['id:ask_left']);

  assert.deepEqual(interpretNodeCompletion(inspectNode, 'id:ask_right', {
    availableOptionKeys: ['id:ask_left', 'id:ask_right'],
    completedOptionKeys: afterLeft.completedOptionKeys,
  }), {
    kind: 'node',
    nodeId: 'after_inspection',
  });

  const inspectNodes = nodeMap([
    inspectNode,
    node('after_inspection', { exit: { kind: 'end_visit' } }),
  ]);
  const paths = enumerateNarrativePaths(inspectNodes, 'inspect');
  assert.equal(paths.length, 6);
  assert.ok(paths.every(path => path.terminal === 'end_visit'));

  const noItemsPaths = enumerateNarrativePaths(inspectNodes, 'inspect', {
    availableItemIds: [],
  });
  assert.equal(noItemsPaths.length, 2);
  assert.ok(noItemsPaths.every(path => (
    path.terminal === 'end_visit' &&
    path.trace.every(entry => entry.optionKey !== 'id:locked_clue')
  )));
});

test('before-next tail chat is an explicit interpreter step with the exact resume target', () => {
  const chatNode = node('chat_source', {
    llm_chat: { entry_mode: 'before_next_node' },
    player_options: [{
      id: 'custom_route',
      text: '走专属路线',
      next_node: 'custom_target',
    }],
    exit: { kind: 'next', target: 'default_target' },
  });
  assert.deepEqual(interpretNodeCompletion(chatNode, 'id:custom_route'), {
    kind: 'tail_chat',
    resumeNodeId: 'custom_target',
  });

  const nodes = nodeMap([
    chatNode,
    node('custom_target', { exit: { kind: 'end_visit' } }),
    node('default_target', { exit: { kind: 'end_visit' } }),
  ]);
  const tailChat = stepNarrativeInterpreter(
    nodes,
    createNarrativeInterpreterState('chat_source'),
    { type: 'complete_node', selectedOption: 'id:custom_route' },
  );
  assert.deepEqual(tailChat.state, {
    kind: 'tail_chat',
    sourceNodeId: 'chat_source',
    resumeNodeId: 'custom_target',
  });
  assert.deepEqual(stepNarrativeInterpreter(nodes, tailChat.state, {
    type: 'complete_tail_chat',
  }).state, { kind: 'node', nodeId: 'custom_target' });
});

test('enumerateNarrativePaths traverses every option and both mixing outcomes', () => {
  const nodes = nodeMap([
    node('aqiang_001_dialogue_main', {
      player_options: [
        { id: 'ask_sister', text: '询问妹妹' },
        { text: '询问导航' },
      ],
      exit: { kind: 'next', target: 'aqiang_003_drink_request' },
    }),
    aqiangMixingNode,
    node('aqiang_phase1_success', { exit: { kind: 'end_visit' } }),
    node('aqiang_phase1_fail', { exit: { kind: 'end_visit' } }),
  ]);

  const paths = enumerateNarrativePaths(nodes, 'aqiang_001_dialogue_main');
  const depthFirstPaths = enumerateNarrativePaths(nodes, 'aqiang_001_dialogue_main', {
    strategy: 'dfs',
  });

  assert.equal(paths.length, 4);
  assert.equal(depthFirstPaths.length, 4);
  assert.ok(depthFirstPaths.every(path => path.terminal === 'end_visit'));
  assert.ok(paths.every(path => path.terminal === 'end_visit'));
  assert.deepEqual(
    new Set(paths.map(path => path.trace.find(entry => entry.state === 'node')?.optionKey)),
    new Set(['id:ask_sister', 'index:1']),
  );
  assert.deepEqual(
    new Set(paths.flatMap(path => path.trace.map(entry => entry.action)).filter(action => action.startsWith('mixing_'))),
    new Set(['mixing_success', 'mixing_fail']),
  );
  assert.ok(paths.every(path => path.trace.some(entry => entry.nodeId === 'aqiang_003_drink_request')));
});

test('enumerateNarrativePaths reports loops and step limits without hanging', () => {
  const loopNodes = nodeMap([
    node('loop_a', { exit: { kind: 'next', target: 'loop_b' } }),
    node('loop_b', { exit: { kind: 'next', target: 'loop_a' } }),
  ]);
  const loopPaths = enumerateNarrativePaths(loopNodes, 'loop_a');
  assert.equal(loopPaths.length, 1);
  assert.equal(loopPaths[0]!.terminal, 'loop');
  assert.equal(loopPaths[0]!.loopStateKey, 'node:loop_a:');

  const longChain = nodeMap([
    node('step_1', { exit: { kind: 'next', target: 'step_2' } }),
    node('step_2', { exit: { kind: 'next', target: 'step_3' } }),
    node('step_3', { exit: { kind: 'next', target: 'step_4' } }),
    node('step_4', { exit: { kind: 'end_visit' } }),
  ]);
  const limitedPaths = enumerateNarrativePaths(longChain, 'step_1', { maxSteps: 2 });
  assert.equal(limitedPaths.length, 1);
  assert.equal(limitedPaths[0]!.terminal, 'step_limit');
  assert.deepEqual(limitedPaths[0]!.terminalState, { kind: 'node', nodeId: 'step_3' });

  const branchingNode = nodeMap([
    node('branching', {
      player_options: [
        { id: 'left', text: '左', next_node: 'left_end' },
        { id: 'right', text: '右', next_node: 'right_end' },
      ],
    }),
    node('left_end', { exit: { kind: 'end_visit' } }),
    node('right_end', { exit: { kind: 'end_visit' } }),
  ]);
  assert.throws(
    () => enumerateNarrativePaths(branchingNode, 'branching', { maxPaths: 1 }),
    /path count exceeds maxPaths 1/,
  );
});

test('invalid selections, state actions, missing nodes and invalid limits fail clearly', () => {
  const choiceNode = node('choice', {
    player_options: [{ id: 'valid', text: '有效选项' }],
    exit: { kind: 'end_visit' },
  });
  assert.throws(
    () => interpretNodeCompletion(choiceNode, 'id:missing'),
    /has no option "id:missing"/,
  );

  const nodes = nodeMap([choiceNode]);
  assert.throws(
    () => stepNarrativeInterpreter(nodes, createNarrativeInterpreterState('choice'), {
      type: 'complete_observation',
    }),
    /state "node" requires action "complete_node"/,
  );
  assert.throws(
    () => enumerateNarrativePaths(nodes, 'missing'),
    /start node "missing" does not exist/,
  );
  assert.throws(
    () => stepNarrativeInterpreter(
      nodeMap([node('dangling', { exit: { kind: 'next', target: 'missing_target' } })]),
      createNarrativeInterpreterState('dangling'),
      { type: 'complete_node' },
    ),
    /points to missing node "missing_target"/,
  );
  assert.throws(
    () => enumerateNarrativePaths(nodes, 'choice', { maxSteps: 0 }),
    /maxSteps must be a positive integer/,
  );
  assert.throws(
    () => enumerateNarrativePaths(nodes, 'choice', { maxPaths: 0 }),
    /maxPaths must be a positive integer/,
  );
  assert.throws(
    () => enumerateNarrativePaths(nodes, 'choice', { maxMixingRetries: -1 }),
    /maxMixingRetries must be a non-negative integer/,
  );
  assert.throws(
    () => enumerateNarrativePaths(nodes, 'choice', { availableItemIds: [''] }),
    /available item id must be a non-empty string/,
  );
});
