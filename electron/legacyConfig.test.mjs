import { strict as assert } from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, test } from 'node:test';
import { scrubLegacyPlaintextMiniMaxKey } from './legacyConfig.mjs';

const tempDirs = [];

afterEach(() => {
  tempDirs.splice(0).forEach(dir => fs.rmSync(dir, { recursive: true, force: true }));
});

function createTempConfig(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'twilight-key-migration-'));
  tempDirs.push(dir);
  const configPath = path.join(dir, 'config.json');
  fs.writeFileSync(configPath, content, 'utf8');
  return configPath;
}

test('desktop migration removes a legacy plaintext MiniMax key and preserves non-secret fields', () => {
  const configPath = createTempConfig(JSON.stringify({
    MINIMAX_API_KEY: 'legacy-sensitive-key',
    TWILIGHT_AUTHOR_MINIMAX_API_KEY: 'legacy-author-sensitive-key',
    AUTHOR_MINIMAX_API_KEY: 'legacy-compatible-author-key',
    MINIMAX_TIMEOUT_MS: '20000',
  }));

  assert.equal(scrubLegacyPlaintextMiniMaxKey(configPath), true);
  const rewritten = fs.readFileSync(configPath, 'utf8');
  assert.equal(rewritten.includes('legacy-sensitive-key'), false);
  assert.equal(rewritten.includes('legacy-author-sensitive-key'), false);
  assert.equal(rewritten.includes('legacy-compatible-author-key'), false);
  assert.deepEqual(JSON.parse(rewritten), { MINIMAX_TIMEOUT_MS: '20000' });
});

test('desktop migration removes a malformed legacy config that may contain a plaintext key', () => {
  const configPath = createTempConfig('{"MINIMAX_API_KEY":"legacy-sensitive-key"');

  assert.equal(scrubLegacyPlaintextMiniMaxKey(configPath), true);
  assert.equal(fs.existsSync(configPath), false);
});
