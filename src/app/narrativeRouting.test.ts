import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
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
