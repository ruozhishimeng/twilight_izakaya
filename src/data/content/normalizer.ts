import type {
  CharacterNode,
  CharacterLlmChatSource,
  CharacterMetaDocument,
  ContentRegistry,
  Feature,
  GalleryChapter,
  GalleryDocument,
  ObservationEntrySource,
  ObservationsDocument,
  Guest,
  ParsedContentSource,
  ResolvedLlmChatConfig,
  RecipeCatalogEntry,
  IngredientCatalogEntry,
} from './types';

const LEGACY_GALLERY_ALIAS_MAP: Record<string, Record<string, string>> = {
  fox_uncle: {
    fox_uncle_story_01: 'appearance_basic',
    fox_uncle_story_02: 'identity_reveal',
    fox_uncle_story_03: 'true_god_form',
  },
  aqiang: {
    aqiang_story_01: 'surface',
    aqiang_story_02: 'little_snow',
    aqiang_story_03: 'true_story',
  },
  yuki: {
    yuki_story_01: 'surface',
    yuki_story_02: 'brother',
    yuki_story_03: 'full_story',
  },
};

export const DEFAULT_LLM_CHAT_CONFIG: ResolvedLlmChatConfig = {
  enabled: true,
  maxTurns: 3,
  entryStatusText: '不说话可太无聊了……',
  blockedMessage: '现在还是不太适合聊天……',
  exhaustedMessage: '聊得够多了……',
};

function normalizeGuestType(rawType: string | undefined) {
  if (rawType === '普通人') {
    return 'Regular Customer' as const;
  }
  if (rawType === '迷失者' || rawType === '滞留者') {
    return 'Lost Soul' as const;
  }
  return 'Ghost' as const;
}

function firstParagraph(text: string) {
  return (
    text
      .split(/\n+/)
      .map(line => line.trim())
      .find(Boolean) || ''
  );
}

function requireNonEmptyString(value: unknown, context: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${context}`);
  }

  return value.trim();
}

function normalizeCharacterLlmChatConfig(config?: CharacterLlmChatSource): ResolvedLlmChatConfig {
  return {
    enabled: typeof config?.enabled === 'boolean' ? config.enabled : DEFAULT_LLM_CHAT_CONFIG.enabled,
    maxTurns:
      typeof config?.max_turns_per_visit === 'number' && Number.isFinite(config.max_turns_per_visit)
        ? Math.max(1, Math.floor(config.max_turns_per_visit))
        : DEFAULT_LLM_CHAT_CONFIG.maxTurns,
    entryStatusText:
      typeof config?.entry_status_text === 'string' && config.entry_status_text.trim()
        ? config.entry_status_text.trim()
        : DEFAULT_LLM_CHAT_CONFIG.entryStatusText,
    blockedMessage:
      typeof config?.blocked_message === 'string' && config.blocked_message.trim()
        ? config.blocked_message.trim()
        : DEFAULT_LLM_CHAT_CONFIG.blockedMessage,
    exhaustedMessage:
      typeof config?.exhausted_message === 'string' && config.exhausted_message.trim()
        ? config.exhausted_message.trim()
        : DEFAULT_LLM_CHAT_CONFIG.exhaustedMessage,
  };
}

function normalizeGallery(charId: string, meta: CharacterMetaDocument, gallery: GalleryDocument | undefined) {
  if (!gallery) {
    throw new Error(`Missing gallery.yaml for ${charId}`);
  }

  const profileSections = Array.isArray(gallery.profile_sections) ? gallery.profile_sections : [];
  if (profileSections.length === 0) {
    throw new Error(`Missing gallery profile_sections for ${charId}`);
  }

  const chapters = profileSections.map((section, index): GalleryChapter => {
    const content = requireNonEmptyString(section.content, `${charId} gallery section ${index + 1} content`);
    const title = requireNonEmptyString(
      section.title || section.name,
      `${charId} gallery section ${index + 1} title`,
    );
    const chapterId = requireNonEmptyString(
      section.id,
      `${charId} gallery section ${index + 1} id`,
    );
    const explicitSummary = typeof section.summary === 'string' ? section.summary.trim() : '';
    const depthLevel = Number(section.depth_level);
    if (!Number.isFinite(depthLevel) || depthLevel <= 0) {
      throw new Error(`Invalid ${charId} gallery section ${chapterId} depth_level`);
    }

    return {
      id: chapterId,
      title,
      summary: explicitSummary || firstParagraph(content) || `来自 ${charId} 的档案片段。`,
      content: content || undefined,
      unlockCondition: typeof section.unlock_condition === 'string' ? section.unlock_condition : undefined,
      depthLevel,
      legacyUnlockIds: [],
    };
  });

  const aliasMap = LEGACY_GALLERY_ALIAS_MAP[charId];
  if (aliasMap) {
    Object.entries(aliasMap).forEach(([legacyId, chapterId]) => {
      const chapter = chapters.find(entry => entry.id === chapterId);
      if (chapter) {
        chapter.legacyUnlockIds = [...new Set([...(chapter.legacyUnlockIds || []), legacyId])];
      }
    });
  }

  return {
    baseInfo: gallery.base_info || meta.base_info || {},
    chapters,
  };
}

function normalizeFeature(observation: ObservationEntrySource, index: number): Feature {
  const id = requireNonEmptyString(observation.id, `observation ${index + 1} id`);
  const name = requireNonEmptyString(observation.area, `observation ${id} area`);
  const objective = requireNonEmptyString(observation.objective, `observation ${id} objective`);
  const subjective = requireNonEmptyString(observation.subjective, `observation ${id} subjective`);

  return {
    id,
    name,
    type: 'trait',
    desc: [objective, subjective].join('。'),
    x: Number(observation.x ?? (index % 2 === 0 ? 30 : 70)),
    y: Number(observation.y ?? (20 + index * 15)),
    group: observation.group || 'default',
  };
}

function normalizeFeatures(observationsDocument: ObservationsDocument | undefined): Feature[] {
  const observations = observationsDocument?.observations;
  if (!Array.isArray(observations)) {
    return [];
  }

  return observations.map((obs, index) => normalizeFeature(obs, index));
}

function normalizeExpressions(images: Record<string, string>) {
  const expressions: Record<string, string> = {};
  let image = '';

  Object.entries(images).forEach(([name, url]) => {
    const normalized = name.replace(/\.png$/i, '');
    expressions[normalized] = url;
    if (normalized === 'main') {
      image = url;
    }
    if (!image && normalized === 'normal') {
      image = url;
    }
  });

  return {
    expressions,
    image: image || Object.values(images)[0] || '',
  };
}

function normalizeStartNodeIds(nodes: CharacterNode[]) {
  return nodes
    .filter(node => {
      const needEvent = node?.trigger_condition?.need_event;
      return !Array.isArray(needEvent) || needEvent.length === 0;
    })
    .map(node => String(node.event_id || node.id))
    .filter(Boolean);
}

function requireNodeIdentifier(node: CharacterNode, guestId: string) {
  const nodeId = node.event_id || node.id;
  if (!nodeId) {
    throw new Error(`Guest ${guestId} contains a node without id/event_id`);
  }
  return String(nodeId);
}

function buildNodeMap(nodes: CharacterNode[], guestId: string) {
  const nodeMap = new Map<string, CharacterNode>();

  nodes.forEach(node => {
    const nodeId = requireNodeIdentifier(node, guestId);
    if (nodeMap.has(nodeId)) {
      throw new Error(`Guest ${guestId} contains duplicate node id "${nodeId}"`);
    }
    nodeMap.set(nodeId, node);
  });

  return nodeMap;
}

function requireRecipeCatalogEntries(entries: RecipeCatalogEntry[], context: string) {
  entries.forEach((recipe, index) => {
    requireNonEmptyString(recipe.id, `${context}[${index}] recipe id`);
    requireNonEmptyString(recipe.name, `${context}[${index}] recipe name`);
  });
}

function requireIngredientCatalogEntries(entries: IngredientCatalogEntry[], context: string) {
  entries.forEach((ingredient, index) => {
    requireNonEmptyString(ingredient.id, `${context}[${index}] ingredient id`);
    requireNonEmptyString(ingredient.name, `${context}[${index}] ingredient name`);
  });
}

export function normalizeContentRegistry(source: ParsedContentSource): ContentRegistry {
  requireIngredientCatalogEntries(source.recipes.ingredients.bases.japanese, 'recipes.ingredients.bases.japanese');
  requireIngredientCatalogEntries(source.recipes.ingredients.bases.classic, 'recipes.ingredients.bases.classic');
  requireIngredientCatalogEntries(source.recipes.ingredients.mixers, 'recipes.ingredients.mixers');
  requireIngredientCatalogEntries(source.recipes.ingredients.flavors, 'recipes.ingredients.flavors');
  requireRecipeCatalogEntries(source.recipes.recipes, 'recipes.recipes');

  const guests: Guest[] = Object.values(source.characters)
    .map(character => {
      const meta = character.meta;
      if (!meta) {
        throw new Error(`Missing character_meta.yaml for ${character.id}`);
      }
      if (!meta.base_info) {
        throw new Error(`Missing base_info in character_meta.yaml for ${character.id}`);
      }

      const mainNodes = Array.isArray(character.nodesMain?.nodes) ? character.nodesMain!.nodes! : [];
      const teachingNodes = Array.isArray(character.nodesTeaching?.nodes) ? character.nodesTeaching!.nodes! : [];
      const chatNodes = Array.isArray(character.nodesChat?.nodes) ? character.nodesChat!.nodes! : [];
      const hiddenNodes = Array.isArray(character.nodesHidden?.nodes) ? character.nodesHidden!.nodes! : [];
      const allNodes = [...mainNodes, ...teachingNodes, ...chatNodes, ...hiddenNodes];
      const nodeMap = buildNodeMap(allNodes, character.id);
      const features = normalizeFeatures(character.observations);
      const { expressions, image } = normalizeExpressions(character.images);
      const guestName = requireNonEmptyString(meta.base_info.name, `${character.id} base_info.name`);
      const guestType = normalizeGuestType(requireNonEmptyString(meta.base_info.type, `${character.id} base_info.type`));

      return {
        id: character.id,
        name: guestName,
        imagePlaceholderColor: '#475569',
        avatarColor: '#334155',
        image,
        expressions,
        features,
        correctFeatures: features.map(feature => feature.id),
        phases: [],
        type: guestType,
        meta,
        llmChatDefault: normalizeCharacterLlmChatConfig(meta.llm_chat),
        gallery: normalizeGallery(character.id, meta, character.gallery),
        startNodeIds: normalizeStartNodeIds(allNodes),
        nodeMap,
        nodes: {
          main: mainNodes,
          teaching: teachingNodes,
          chat: chatNodes,
          hidden: hiddenNodes,
          all: allNodes,
        },
      } satisfies Guest;
    });

  guests.sort((a, b) => {
    if (a.id === 'fox_uncle') return -1;
    if (b.id === 'fox_uncle') return 1;
    return a.name.localeCompare(b.name, 'zh-Hans-CN');
  });

  const ingredientIds = new Set<string>();
  source.recipes.ingredients.bases.japanese.forEach(item => ingredientIds.add(item.id));
  source.recipes.ingredients.bases.classic.forEach(item => ingredientIds.add(item.id));
  source.recipes.ingredients.mixers.forEach(item => ingredientIds.add(item.id));
  source.recipes.ingredients.flavors.forEach(item => ingredientIds.add(item.id));

  const recipeIds = new Set<string>(source.recipes.recipes.map(recipe => recipe.id));

  return {
    guests,
    guestById: new Map(guests.map(guest => [guest.id, guest])),
    schedule: source.schedule,
    recipes: source.recipes,
    ingredientIds,
    recipeIds,
  };
}
