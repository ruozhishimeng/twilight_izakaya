import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import recipesData from '../src/assets/recipes/recipes.json';
import { normalizeContentRegistry } from '../src/data/content/normalizer';
import type {
  CharacterNodeDocument,
  GalleryDocument,
  ObservationsDocument,
  ParsedCharacterSource,
  ParsedContentSource,
  RecipesCatalog,
  ScheduleData,
} from '../src/data/content/types';
import { validateContentRegistry } from '../src/data/content/validation';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, '..');
const characterRoot = path.join(repoRoot, 'src', 'assets', 'character');
const schedulePath = path.join(repoRoot, 'src', 'assets', 'schedule.yaml');

function extractCharacterIdFromDirectory(directoryPath: string) {
  const normalized = directoryPath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  const characterIndex = parts.findIndex(part => part === 'character');
  const next = parts[characterIndex + 1];
  if (next === 'regulars') {
    return parts[characterIndex + 2];
  }
  return next;
}

function ensureCharacter(source: Record<string, ParsedCharacterSource>, directoryPath: string) {
  const id = extractCharacterIdFromDirectory(directoryPath);
  if (!id) {
    throw new Error(`Unable to derive character id from "${directoryPath}"`);
  }

  if (!source[id]) {
    source[id] = {
      id,
      directory: directoryPath,
      images: {},
    };
  }

  return source[id];
}

function walkDirectory(root: string, onFile: (filePath: string) => void) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  entries.forEach(entry => {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(absolutePath, onFile);
      return;
    }
    onFile(absolutePath);
  });
}

function loadYamlDocument<T>(filePath: string) {
  return yaml.load(fs.readFileSync(filePath, 'utf8')) as T;
}

export function loadContentSourceFromFs(): ParsedContentSource {
  const characters: Record<string, ParsedCharacterSource> = {};

  walkDirectory(characterRoot, filePath => {
    if (filePath.endsWith('character_meta.yaml')) {
      ensureCharacter(characters, path.dirname(filePath)).meta =
        loadYamlDocument<ParsedCharacterSource['meta']>(filePath);
      return;
    }

    if (filePath.endsWith('nodes_main.yaml')) {
      ensureCharacter(characters, path.dirname(filePath)).nodesMain =
        loadYamlDocument<CharacterNodeDocument>(filePath);
      return;
    }

    if (filePath.endsWith('nodes_teaching.yaml')) {
      ensureCharacter(characters, path.dirname(filePath)).nodesTeaching =
        loadYamlDocument<CharacterNodeDocument>(filePath);
      return;
    }

    if (filePath.endsWith('nodes_chat.yaml')) {
      ensureCharacter(characters, path.dirname(filePath)).nodesChat =
        loadYamlDocument<CharacterNodeDocument>(filePath);
      return;
    }

    if (filePath.endsWith('nodes_hidden.yaml')) {
      ensureCharacter(characters, path.dirname(filePath)).nodesHidden =
        loadYamlDocument<CharacterNodeDocument>(filePath);
      return;
    }

    if (filePath.endsWith('observations.yaml')) {
      ensureCharacter(characters, path.dirname(filePath)).observations =
        loadYamlDocument<ObservationsDocument>(filePath);
      return;
    }

    if (filePath.endsWith('gallery.yaml')) {
      ensureCharacter(characters, path.dirname(filePath)).gallery =
        loadYamlDocument<GalleryDocument>(filePath);
      return;
    }

    if (filePath.endsWith('.png') && filePath.replace(/\\/g, '/').includes('/media/')) {
      ensureCharacter(characters, path.dirname(path.dirname(filePath))).images[path.basename(filePath)] = filePath;
    }
  });

  return {
    characters,
    schedule: loadYamlDocument<ScheduleData>(schedulePath),
    recipes: recipesData as RecipesCatalog,
    drinkImages: {},
  };
}

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
