import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  getExitTargets,
  getMixingOutcomeTarget,
  getMixingRequest,
  isMixingExit,
  resolveNodeExit,
} from './narrative';
import type { CharacterNode, NarrativeMixingExit } from './types';

const request = {
  mode: 'normal',
  request_text: '给我一杯能让人想起重要之人的酒',
  retry_on_fail: true,
  preferred_drink: {
    id: 'R001',
    name: '未竟的生诞',
    formula: ['bc01', 'm04', 'f03'],
  },
};

test('explicit mixing exit wins over every legacy routing field', () => {
  const explicitExit: NarrativeMixingExit = {
    kind: 'mixing',
    request,
    outcomes: {
      success: 'aqiang_phase1_success',
      fail: 'aqiang_phase1_fail',
    },
  };
  const node: CharacterNode = {
    event_id: 'aqiang_003_drink_request',
    exit: explicitExit,
    next_node: 'wrong_next',
    trigger_observation: {
      prompt: 'wrong observation',
      continue_node: 'wrong_observation_target',
    },
    drink_request: {
      request_text: 'wrong request',
    },
    on_mixing_complete: 'wrong_success',
    on_mixing_fail: 'wrong_fail',
    mixing: { legacy: true },
  };

  const exit = resolveNodeExit(node);

  assert.equal(exit, explicitExit);
  assert.equal(isMixingExit(exit), true);
  assert.equal(getMixingRequest(exit), request);
  assert.equal(getMixingOutcomeTarget(exit, true), 'aqiang_phase1_success');
  assert.equal(getMixingOutcomeTarget(exit, false), 'aqiang_phase1_fail');
  assert.deepEqual(getExitTargets(exit), ['aqiang_phase1_success', 'aqiang_phase1_fail']);
});

test('formal legacy drink_request fields compile to a mixing exit', () => {
  const node: CharacterNode = {
    event_id: 'regular_001_mixing',
    drink_request: request,
    next_node: 'regular_001_success',
    on_mixing_fail: 'regular_001_fail',
  };

  assert.deepEqual(resolveNodeExit(node), {
    kind: 'mixing',
    request,
    outcomes: {
      success: 'regular_001_success',
      fail: 'regular_001_fail',
    },
  });
});

test('legacy observation fields compile to an observation exit', () => {
  const exit = resolveNodeExit({
    event_id: 'fox_uncle_001_dialogue_main',
    trigger_observation: {
      prompt: '仔细观察这位客人',
      continue_node: 'fox_uncle_001_after_observation',
      feature_groups: ['phase_1'],
    },
  });

  assert.deepEqual(exit, {
    kind: 'observation',
    prompt: '仔细观察这位客人',
    continue_node: 'fox_uncle_001_after_observation',
    feature_groups: ['phase_1'],
  });
  assert.deepEqual(getExitTargets(exit), ['fox_uncle_001_after_observation']);
  assert.equal(getMixingRequest(exit), null);
  assert.equal(getMixingOutcomeTarget(exit, true), null);
});

test('legacy next_node compiles to next and a missing target compiles to end_visit', () => {
  const nextExit = resolveNodeExit({
    event_id: 'node_with_next',
    next_node: 'next_node',
  });
  const endExit = resolveNodeExit({
    event_id: 'terminal_node',
    next_node: null,
  });

  assert.deepEqual(nextExit, { kind: 'next', target: 'next_node' });
  assert.deepEqual(getExitTargets(nextExit), ['next_node']);
  assert.deepEqual(endExit, { kind: 'end_visit' });
  assert.deepEqual(getExitTargets(endExit), []);
});

test('unsupported legacy mixing field fails at the compatibility boundary', () => {
  assert.throws(
    () => resolveNodeExit({ event_id: 'legacy_mixing', mixing: { mode: 'normal' } }),
    /unsupported legacy field "mixing"/,
  );
});
