import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNpmRunSpawnConfig,
  createAuthorKeyFilePayload,
  describeAuthorKeySelection,
  resolveDesktopAuthorKey,
} from './desktopAuthorKey.mjs';

test('resolveDesktopAuthorKey prefers TWILIGHT_AUTHOR_MINIMAX_API_KEY', () => {
  const result = resolveDesktopAuthorKey({
    MINIMAX_API_KEY: 'fallback-minimax-key',
    AUTHOR_MINIMAX_API_KEY: 'legacy-author-key',
    TWILIGHT_AUTHOR_MINIMAX_API_KEY: 'twilight-author-key',
  });

  assert.deepEqual(result, {
    authorApiKey: 'twilight-author-key',
    source: 'TWILIGHT_AUTHOR_MINIMAX_API_KEY',
  });
});

test('resolveDesktopAuthorKey falls back to MINIMAX_API_KEY', () => {
  const result = resolveDesktopAuthorKey({
    MINIMAX_API_KEY: 'fallback-minimax-key',
  });

  assert.deepEqual(result, {
    authorApiKey: 'fallback-minimax-key',
    source: 'MINIMAX_API_KEY',
  });
});

test('resolveDesktopAuthorKey rejects empty and placeholder keys without leaking values', () => {
  assert.throws(
    () => resolveDesktopAuthorKey({
      MINIMAX_API_KEY: 'yourAPIKEY',
      AUTHOR_MINIMAX_API_KEY: '',
      TWILIGHT_AUTHOR_MINIMAX_API_KEY: '   ',
    }),
    error => {
      assert(error instanceof Error);
      assert.match(error.message, /作者 KEY/);
      assert.equal(error.message.includes('yourAPIKEY'), false);
      return true;
    },
  );
});

test('author key packaging log omits secret material', () => {
  const selection = {
    authorApiKey: 'sensitive-author-secret',
    source: 'TWILIGHT_AUTHOR_MINIMAX_API_KEY',
  };
  const payload = createAuthorKeyFilePayload(selection);
  const logMessage = describeAuthorKeySelection(selection);

  assert.deepEqual(payload, {
    authorApiKey: 'sensitive-author-secret',
    source: 'TWILIGHT_AUTHOR_MINIMAX_API_KEY',
  });
  assert.match(logMessage, /TWILIGHT_AUTHOR_MINIMAX_API_KEY/);
  assert.equal(logMessage.includes('sensitive-author-secret'), false);
});

test('npm script spawning uses cmd.exe on Windows without shell=true args', () => {
  assert.deepEqual(
    createNpmRunSpawnConfig('desktop:pack', {
      platform: 'win32',
      comspec: 'C:\\Windows\\System32\\cmd.exe',
    }),
    {
      command: 'C:\\Windows\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', 'npm.cmd run desktop:pack'],
    },
  );

  assert.deepEqual(
    createNpmRunSpawnConfig('desktop:pack', {
      platform: 'linux',
      comspec: '',
    }),
    {
      command: 'npm',
      args: ['run', 'desktop:pack'],
    },
  );
});
