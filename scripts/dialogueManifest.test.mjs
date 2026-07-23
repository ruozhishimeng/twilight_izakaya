import assert from 'node:assert/strict';
import test from 'node:test';

test('generated module is native ESM importable', async () => {
  const outputUrl = new URL('../server/generated/dialogueManifest.mjs', import.meta.url);
  const generated = await import(`${outputUrl.href}?test=${Date.now()}`);
  assert.equal(generated.dialogueManifest.version, 1);
});
