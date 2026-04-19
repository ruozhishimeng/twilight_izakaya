import yaml from 'js-yaml';
import recipesData from '../../assets/recipes/recipes.json';
import type {
  CharacterMetaDocument,
  CharacterNodeDocument,
  GalleryDocument,
  ObservationsDocument,
  ParsedCharacterSource,
  ParsedContentSource,
  RecipesCatalog,
  ScheduleData,
} from './types';

const metaFilesRaw = import.meta.glob('../../assets/character/**/character_meta.yaml', { eager: true, query: '?raw', import: 'default' });
const nodesMainRaw = import.meta.glob('../../assets/character/**/nodes_main.yaml', { eager: true, query: '?raw', import: 'default' });
const nodesTeachingRaw = import.meta.glob('../../assets/character/**/nodes_teaching.yaml', { eager: true, query: '?raw', import: 'default' });
const nodesChatRaw = import.meta.glob('../../assets/character/**/nodes_chat.yaml', { eager: true, query: '?raw', import: 'default' });
const nodesHiddenRaw = import.meta.glob('../../assets/character/**/nodes_hidden.yaml', { eager: true, query: '?raw', import: 'default' });
const observationsRaw = import.meta.glob('../../assets/character/**/observations.yaml', { eager: true, query: '?raw', import: 'default' });
const galleryRaw = import.meta.glob('../../assets/character/**/gallery.yaml', { eager: true, query: '?raw', import: 'default' });
const imageFiles = import.meta.glob('../../assets/character/**/media/*.png', { eager: true, query: '?url', import: 'default' });
const drinkImageFiles = import.meta.glob('../../assets/drink/**/*.png', { eager: true, query: '?url', import: 'default' });
const scheduleRaw = import.meta.glob('../../assets/schedule.yaml', { eager: true, query: '?raw', import: 'default' });

function parseYamlDocument<T>(raw: unknown): T | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  return yaml.load(raw) as T;
}

function extractCharacterIdFromPath(rawPath: string) {
  const normalized = rawPath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  const characterIndex = parts.findIndex(part => part === 'character');
  const next = parts[characterIndex + 1];
  if (next === 'regulars') {
    return parts[characterIndex + 2];
  }
  return next;
}

function extractCharacterDirectory(rawPath: string) {
  return rawPath.replace(/\\/g, '/').replace(/\/[^/]+$/, '');
}

function ensureCharacter(source: Record<string, ParsedCharacterSource>, rawPath: string) {
  const id = extractCharacterIdFromPath(rawPath);
  if (!id) {
    throw new Error(`Unable to derive character id from path "${rawPath}"`);
  }

  if (!source[id]) {
    source[id] = {
      id,
      directory: extractCharacterDirectory(rawPath),
      images: {},
    };
  }

  return source[id];
}

export function loadContentSource(): ParsedContentSource {
  const characters: Record<string, ParsedCharacterSource> = {};

  Object.entries(metaFilesRaw).forEach(([path, raw]) => {
    ensureCharacter(characters, path).meta = parseYamlDocument<CharacterMetaDocument>(raw);
  });

  Object.entries(nodesMainRaw).forEach(([path, raw]) => {
    ensureCharacter(characters, path).nodesMain = parseYamlDocument<CharacterNodeDocument>(raw);
  });

  Object.entries(nodesTeachingRaw).forEach(([path, raw]) => {
    ensureCharacter(characters, path).nodesTeaching = parseYamlDocument<CharacterNodeDocument>(raw);
  });

  Object.entries(nodesChatRaw).forEach(([path, raw]) => {
    ensureCharacter(characters, path).nodesChat = parseYamlDocument<CharacterNodeDocument>(raw);
  });

  Object.entries(nodesHiddenRaw).forEach(([path, raw]) => {
    ensureCharacter(characters, path).nodesHidden = parseYamlDocument<CharacterNodeDocument>(raw);
  });

  Object.entries(observationsRaw).forEach(([path, raw]) => {
    ensureCharacter(characters, path).observations = parseYamlDocument<ObservationsDocument>(raw);
  });

  Object.entries(galleryRaw).forEach(([path, raw]) => {
    ensureCharacter(characters, path).gallery = parseYamlDocument<GalleryDocument>(raw);
  });

  Object.entries(imageFiles).forEach(([path, url]) => {
    const character = ensureCharacter(characters, path);
    const normalized = path.replace(/\\/g, '/');
    const fileName = normalized.split('/').pop() || '';
    character.images[fileName] = String(url);
  });

  const scheduleEntry = Object.values(scheduleRaw)[0];
  if (!scheduleEntry) {
    throw new Error('Missing src/assets/schedule.yaml');
  }
  const scheduleDocument = parseYamlDocument<ScheduleData>(scheduleEntry);
  if (!scheduleDocument || typeof scheduleDocument !== 'object') {
    throw new Error('Invalid src/assets/schedule.yaml document');
  }
  const schedule = scheduleDocument;

  const drinkImages: Record<string, string> = {};
  Object.entries(drinkImageFiles).forEach(([path, url]) => {
    drinkImages[path.replace(/\\/g, '/')] = String(url);
  });

  return {
    characters,
    schedule,
    recipes: recipesData as RecipesCatalog,
    drinkImages,
  };
}
