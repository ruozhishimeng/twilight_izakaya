import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { resolveActiveMixingNode, resolveMixingOutcomeNode } from './narrativeRouting';
import type { CharacterNode } from '../data/content/types';

const mixingNode: CharacterNode = {
  event_id: 'mixing',
  script_flow: [{ type: 'npc', content: ['请调酒'] }],
  exit: {
    kind: 'mixing',
    request: { request_text: '请调酒', retry_on_fail: true },
    outcomes: {
      success: 'success_result',
      fail: 'fail_result',
    },
  },
};

test('resolveMixingOutcomeNode maps perfect to the success target', () => {
  assert.equal(resolveMixingOutcomeNode(mixingNode, 'perfect'), 'success_result');
});

test('resolveMixingOutcomeNode maps off to the fail target', () => {
  assert.equal(resolveMixingOutcomeNode(mixingNode, 'off'), 'fail_result');
});

test('resolveMixingOutcomeNode falls back off to the success target when no fail target is declared', () => {
  const nodeWithoutFail: CharacterNode = {
    event_id: 'mixing_without_fail',
    exit: {
      kind: 'mixing',
      request: { request_text: '请调酒' },
      outcomes: { success: 'success_result', fail: null },
    },
  };
  assert.equal(resolveMixingOutcomeNode(nodeWithoutFail, 'off'), 'success_result');
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
