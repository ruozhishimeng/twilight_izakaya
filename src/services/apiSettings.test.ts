import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  getApiKeySourceLabel,
  isApiKeyConfiguredForGameStart,
  type ApiKeyStatus,
} from './apiSettings';

test('isApiKeyConfiguredForGameStart requires a configured MiniMax key', () => {
  assert.equal(isApiKeyConfiguredForGameStart(null), false);
  assert.equal(isApiKeyConfiguredForGameStart({
    provider: 'minimax',
    providerLabel: 'MiniMax',
    supportedProviders: ['MiniMax'],
    configured: false,
    source: 'none',
    supportsAuthorKey: true,
    model: 'MiniMax-M2.5',
  }), false);
  assert.equal(isApiKeyConfiguredForGameStart({
    provider: 'minimax',
    providerLabel: 'MiniMax',
    supportedProviders: ['MiniMax'],
    configured: true,
    source: 'author',
    supportsAuthorKey: true,
    model: 'MiniMax-M2.5',
  }), true);
});

test('getApiKeySourceLabel explains the active key source', () => {
  const baseStatus: ApiKeyStatus = {
    provider: 'minimax',
    providerLabel: 'MiniMax',
    supportedProviders: ['MiniMax'],
    configured: true,
    source: 'custom',
    supportsAuthorKey: true,
    model: 'MiniMax-M2.5',
  };

  assert.equal(getApiKeySourceLabel({ ...baseStatus, source: 'custom' }), '玩家自填 KEY');
  assert.equal(getApiKeySourceLabel({ ...baseStatus, source: 'author' }), '作者 KEY');
  assert.equal(getApiKeySourceLabel({ ...baseStatus, source: 'environment' }), '后端环境变量');
  assert.equal(getApiKeySourceLabel({ ...baseStatus, configured: false, source: 'none' }), '未配置');
});
