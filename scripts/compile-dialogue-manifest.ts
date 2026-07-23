import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeContentRegistry } from '../src/data/content/normalizer';
import { compileDialogueManifest, serializeDialogueManifest } from '../src/data/dialogue/manifest';
import { loadContentSourceFromFs } from './loadContentFromFs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(repoRoot, 'server', 'generated', 'dialogueManifest.mjs');
const source = loadContentSourceFromFs({ repoRoot });
const serialized = serializeDialogueManifest(compileDialogueManifest(source, normalizeContentRegistry(source)));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, serialized, 'utf8');
console.log(`[dialogue:compile] wrote ${path.relative(repoRoot, outputPath)}`);
