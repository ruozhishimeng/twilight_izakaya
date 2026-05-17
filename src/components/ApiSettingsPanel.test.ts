import assert from 'node:assert/strict';
import test from 'node:test';
import { isAuthorKeyButtonDisabled } from './ApiSettingsPanel';
import type { ApiKeyStatus } from '../services/apiSettings';

const availableAuthorStatus: ApiKeyStatus = {
  provider: 'minimax',
  providerLabel: 'MiniMax',
  supportedProviders: ['MiniMax'],
  configured: false,
  source: 'none',
  supportsAuthorKey: true,
  model: 'MiniMax-M2.5',
};

test('author key action remains clickable while status is refreshing', () => {
  assert.equal(
    isAuthorKeyButtonDisabled(null, {
      isRefreshingStatus: true,
      isSubmitting: false,
    }),
    false,
  );
});

test('author key action is disabled only while submitting or when explicitly unsupported', () => {
  assert.equal(
    isAuthorKeyButtonDisabled(availableAuthorStatus, {
      isRefreshingStatus: false,
      isSubmitting: true,
    }),
    true,
  );
  assert.equal(
    isAuthorKeyButtonDisabled(
      { ...availableAuthorStatus, supportsAuthorKey: false },
      {
        isRefreshingStatus: false,
        isSubmitting: false,
      },
    ),
    true,
  );
});
