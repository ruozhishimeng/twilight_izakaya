import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isMiniMaxKeySubmitDisabled } from './ApiSettingsPanel';

test('MiniMax key action is disabled for empty input or while submitting', () => {
  assert.equal(isMiniMaxKeySubmitDisabled('', false), true);
  assert.equal(isMiniMaxKeySubmitDisabled('   ', false), true);
  assert.equal(isMiniMaxKeySubmitDisabled('player-key', true), true);
  assert.equal(isMiniMaxKeySubmitDisabled('player-key', false), false);
});
