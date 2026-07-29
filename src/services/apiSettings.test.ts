import { strict as assert } from 'node:assert';
import { afterEach, test } from 'node:test';
import {
  clearMiniMaxKey,
  fetchApiKeyStatus,
  getApiKeySourceLabel,
  getMiniMaxApiKeyForRequest,
  isApiKeyConfiguredForGameStart,
  saveCustomMiniMaxKey,
} from './apiSettings';

afterEach(async () => {
  await clearMiniMaxKey();
});

test('game start does not require a player-supplied key when the server can provide one', async () => {
  const emptyStatus = await fetchApiKeyStatus();
  assert.equal(emptyStatus.provider, 'minimax');
  assert.equal(emptyStatus.model, 'MiniMax-M3');
  assert.deepEqual(emptyStatus.supportedProviders, ['MiniMax']);
  assert.equal(isApiKeyConfiguredForGameStart(emptyStatus), true);
  assert.equal(getApiKeySourceLabel(emptyStatus), '未使用玩家 KEY');

  const configuredStatus = await saveCustomMiniMaxKey('  player-minimax-key  ');
  assert.equal(configuredStatus.configured, true);
  assert.equal(configuredStatus.source, 'custom');
  assert.equal(isApiKeyConfiguredForGameStart(configuredStatus), true);
  assert.equal(getMiniMaxApiKeyForRequest(), 'player-minimax-key');
  assert.equal(getApiKeySourceLabel(configuredStatus), '本次运行的玩家 KEY');
  assert.equal(JSON.stringify(configuredStatus).includes('player-minimax-key'), false);
});

test('clearMiniMaxKey removes the in-memory request credential immediately', async () => {
  await saveCustomMiniMaxKey('player-minimax-key');
  const status = await clearMiniMaxKey();

  assert.equal(status.configured, false);
  assert.equal(status.source, 'none');
  assert.equal(getMiniMaxApiKeyForRequest(), '');
  assert.equal(getApiKeySourceLabel(status), '未使用玩家 KEY');
});

test('saveCustomMiniMaxKey rejects placeholders, whitespace, Unicode and empty values', async () => {
  for (const value of ['', 'yourAPIKEY', 'key with spaces', '含中文的-key']) {
    await assert.rejects(() => saveCustomMiniMaxKey(value), /有效/);
  }
  assert.equal(getMiniMaxApiKeyForRequest(), '');
});
