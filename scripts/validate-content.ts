import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeContentRegistry } from '../src/data/content/normalizer';
import { validateContentRegistry } from '../src/data/content/validation';
import { compileDialogueManifest, serializeDialogueManifest } from '../src/data/dialogue/manifest';
import { loadContentSourceFromFs } from './loadContentFromFs';

function runContentValidation() {
  const source = loadContentSourceFromFs();
  const registry = normalizeContentRegistry(source);
  validateContentRegistry(registry);
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const manifestPath = path.join(repoRoot, 'server', 'generated', 'dialogueManifest.mjs');
  const expected = serializeDialogueManifest(compileDialogueManifest(source, registry));
  const actual = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : '';
  if (actual !== expected) throw new Error('Dialogue manifest is stale. Run npm run dialogue:compile.');

  console.log(
    `[content:check] validated ${registry.guests.length} guests across ${registry.schedule.schedule.length} schedule days`,
  );
}

try {
  runContentValidation();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[content:check] failed\n${message}`);
  process.exitCode = 1;
}
