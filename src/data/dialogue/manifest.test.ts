import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeContentRegistry } from '../content/normalizer';
import { loadContentSourceFromFs } from '../../../scripts/loadContentFromFs';
import { compileDialogueManifest, serializeDialogueManifest } from './manifest';

test('manifest serialization is byte-for-byte deterministic', () => {
  const source = loadContentSourceFromFs();
  const registry = normalizeContentRegistry(source);
  const first = serializeDialogueManifest(compileDialogueManifest(source, registry));
  const second = serializeDialogueManifest(compileDialogueManifest(source, registry));
  assert.equal(first, second);
  assert.doesNotMatch(first, /generatedAt|timestamp/);
});

test('public identity never falls back to secret identity or short_story', () => {
  const source = loadContentSourceFromFs();
  const manifest = compileDialogueManifest(source, normalizeContentRegistry(source));
  assert.doesNotMatch(JSON.stringify(manifest.characters.aqiang.publicIdentity), /已经死|卡车撞|最后遗言/);
});

test('manifest includes authored option trigger events but ignores anonymous options', () => {
  const source = loadContentSourceFromFs();
  const manifest = compileDialogueManifest(source, normalizeContentRegistry(source));
  assert.ok(manifest.validIds.completedEventIds.includes('hidden_blue_dye'));
  assert.ok(manifest.characters.aqiang.validIds.nodeIds.includes('hidden_blue_dye'));
  assert.ok(manifest.validIds.selectedOptionIds.every(id => id.split('/').length === 3));
});

test('generic regular policy never copies personality metadata', () => {
  const source = loadContentSourceFromFs();
  source.characters.tired_salaryman.meta!.base_info!.personality = '绝密人格设定';
  const manifest = compileDialogueManifest(source, normalizeContentRegistry(source));
  assert.doesNotMatch(manifest.characters.tired_salaryman.policy!.public_identity.personality, /绝密人格设定/);
  assert.equal(manifest.characters.tired_salaryman.policy!.public_identity.personality, '平静而克制。');
});
