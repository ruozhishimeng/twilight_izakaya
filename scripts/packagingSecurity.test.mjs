import { strict as assert } from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, test } from 'node:test';
import { assertDesktopPackagingIsSafe } from './checkDesktopPackageSecurity.mjs';

const tempDirs = [];

afterEach(() => {
  tempDirs.splice(0).forEach(dir => fs.rmSync(dir, { recursive: true, force: true }));
});

function createFixture({ includeExclusion = true, includeStaleKey = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'twilight-package-security-'));
  tempDirs.push(root);
  fs.mkdirSync(path.join(root, 'electron'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    scripts: { 'desktop:pack': 'electron-builder' },
    build: {
      files: [
        'electron/**/*',
        ...(includeExclusion ? ['!electron/author-key.local.json'] : []),
      ],
    },
  }), 'utf8');

  if (includeStaleKey) {
    fs.writeFileSync(path.join(root, 'electron', 'author-key.local.json'), 'sensitive-canary', 'utf8');
  }

  return root;
}

test('desktop packaging guard accepts BYOK-only inputs', () => {
  assert.doesNotThrow(() => assertDesktopPackagingIsSafe(createFixture()));
});

test('desktop packaging guard fails closed when a stale author key file exists', () => {
  assert.throws(
    () => assertDesktopPackagingIsSafe(createFixture({ includeStaleKey: true })),
    /中止封包/,
  );
});

test('desktop packaging guard requires a permanent exclusion for the former key path', () => {
  assert.throws(
    () => assertDesktopPackagingIsSafe(createFixture({ includeExclusion: false })),
    /必须显式排除/,
  );
});
