import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  resolveActiveMixingNode,
  resolveMixingOutcomeNode,
  shouldRetryMixingFailure,
} from './narrativeRouting';
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

test('mixing outcome routing uses declared targets only', () => {
  assert.equal(resolveMixingOutcomeNode(mixingNode, true), 'success_result');
  assert.equal(resolveMixingOutcomeNode(mixingNode, false), 'fail_result');
  assert.equal(resolveMixingOutcomeNode(null, true), null);
});

test('an explicit failure target wins over retry flags and teaching fallback', () => {
  assert.equal(shouldRetryMixingFailure({
    success: false,
    outcomeNodeId: 'fail_result',
    retryOnFail: true,
    isTeaching: true,
  }), false);
  assert.equal(shouldRetryMixingFailure({
    success: false,
    outcomeNodeId: null,
    retryOnFail: true,
  }), true);
  assert.equal(shouldRetryMixingFailure({
    success: false,
    outcomeNodeId: null,
    isTeaching: true,
  }), true);
  assert.equal(shouldRetryMixingFailure({
    success: true,
    outcomeNodeId: null,
    retryOnFail: true,
  }), false);
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
