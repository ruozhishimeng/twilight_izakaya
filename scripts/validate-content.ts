import { normalizeContentRegistry } from '../src/data/content/normalizer';
import { validateContentRegistry } from '../src/data/content/validation';
import { loadContentSourceFromFs } from './loadContentFromFs';

function runContentValidation() {
  const registry = normalizeContentRegistry(loadContentSourceFromFs());
  validateContentRegistry(registry);

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
