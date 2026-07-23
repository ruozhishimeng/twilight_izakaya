import type { CharacterNode, ContentRegistry, ParsedCharacterSource, ParsedContentSource } from '../content/types';
import type { DialogueManifest, DialogueManifestCharacter, DialoguePolicyDocument } from './types';
import { buildDialogueSelectedOptionId, makeReferenceIndex, normalizeDialoguePolicy } from './policy';

const sort = (ids: Iterable<string>) => [...new Set([...ids].map(id => id.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const nodeId = (node: CharacterNode) => text(node.event_id || node.id);
const nodeIds = (node: CharacterNode) => sort([text(node.event_id), text(node.id)]);
const allNodes = (character: ParsedCharacterSource) => [character.nodesMain, character.nodesTeaching, character.nodesChat, character.nodesHidden].flatMap(document => Array.isArray(document?.nodes) ? document.nodes : []);

function chapterIds(character: ParsedCharacterSource, registryCharacter: ContentRegistry['guests'][number]) {
  const metaStory = character.meta?.story as { chapters?: Array<{ id?: unknown }> } | undefined;
  const authored = Array.isArray(metaStory?.chapters) ? metaStory!.chapters!.map(chapter => text(chapter.id)) : [];
  return sort([...authored, ...registryCharacter.gallery.chapters.flatMap(chapter => [chapter.id, ...(chapter.legacyUnlockIds || [])])]);
}

function sceneForNode(node: CharacterNode) {
  const visible = [
    ...(Array.isArray(node.atmosphere_lines) ? node.atmosphere_lines : []),
    ...(Array.isArray(node.script_flow) ? node.script_flow.filter(step => step.type === 'env' || step.type === 'npc').flatMap(step => Array.isArray(step.content) ? step.content : [step.content]) : []),
    text(node.drink_request?.request_text),
  ].filter((line): line is string => typeof line === 'string' && line.trim().length > 0).join(' ').trim();
  return visible.slice(0, 180);
}

function genericRegularPolicy(character: ParsedCharacterSource, manifestCharacter: Omit<DialogueManifestCharacter, 'policy'>): DialoguePolicyDocument {
  const description = text(character.meta?.base_info?.description) || '一位来到居酒屋的常客。';
  const personality = '平静而克制。';
  return {
    version: 1, character_id: character.id,
    public_identity: { role: '居酒屋常客', appearance: description, personality },
    voice: { sentence_length: 'short', rhythm: '自然停顿', initiative: 'low', action_frequency: 'rare', preferred: [], avoid: [], banned_phrases: [] },
    facts: [], protected_concepts: [], default_topic_id: 'general',
    topics: [
      { id: 'general', priority: 1, cues: [], cognition: { default: 'known' }, disclosure: [{ when: { always: true }, level: 'open', response_mode: 'direct_answer' }] },
      { id: 'off_topic', priority: 0, cues: [], cognition: { default: 'unknown' }, disclosure: [{ when: { always: true }, level: 'guarded', response_mode: 'soft_deflection' }] },
    ],
    fallbacks: { default: { reply_lines: ['我想先安静坐一会儿。'], mood: 'steady' }, safety: { reply_lines: ['这个话题，我不太想谈。'], mood: 'guarded' } },
    examples: [], conversation: { end_chat_modes: ['silence_or_exit'] },
  };
}

export function compileDialogueManifest(source: ParsedContentSource, registry: ContentRegistry): DialogueManifest {
  const eventIds = new Set<string>(); const optionIds = new Set<string>(); const chapterIdsByCharacter = new Map<string, string[]>();
  Object.values(source.characters).forEach(character => {
    allNodes(character).forEach(node => {
      const id = nodeId(node); if (id) eventIds.add(id);
      (node.player_options || []).forEach(option => { if (id && text(option.id)) optionIds.add(buildDialogueSelectedOptionId(character.id, id, String(option.id))); });
      if (text((node as Record<string, unknown>).trigger_event)) eventIds.add(text((node as Record<string, unknown>).trigger_event));
    });
    const guest = registry.guestById.get(character.id); if (guest) chapterIdsByCharacter.set(character.id, chapterIds(character, guest));
  });
  const characters = Object.fromEntries(Object.values(source.characters).sort((a, b) => a.id.localeCompare(b.id)).map(character => {
    const guest = registry.guestById.get(character.id); if (!guest) throw new Error(`Missing normalized guest ${character.id}`);
    const nodes = allNodes(character); const ids = sort(nodes.flatMap(nodeIds));
    const validIds = { nodeIds: ids, observedFeatureIds: sort((character.observations?.observations || []).map(item => text(item.id))), recipeIds: sort(registry.recipeIds) };
    const nodeScenes = Object.fromEntries(nodes.flatMap(node => nodeIds(node).map(id => [id, sceneForNode(node)] as const)).sort(([a], [b]) => a.localeCompare(b)));
    const safeIdentity = { role: '居酒屋客人', appearance: '一位来到居酒屋的客人。', personality: '谨慎而克制。' };
    const envelope: Omit<DialogueManifestCharacter, 'policy'> = { characterId: character.id, name: guest.name, guestType: guest.type, publicIdentity: safeIdentity, validIds, nodeScenes };
    const references = makeReferenceIndex({ characterId: character.id, completedEventIds: eventIds, selectedOptionIds: optionIds, unlockedChapterIds: chapterIdsByCharacter.get(character.id) || [], nodeIds: ids, observedFeatureIds: validIds.observedFeatureIds, recipeIds: validIds.recipeIds });
    let policy: DialoguePolicyDocument | null = character.dialoguePolicy ? normalizeDialoguePolicy(character.dialoguePolicy, references) : null;
    if (!policy && guest.type === 'Regular Customer') policy = normalizeDialoguePolicy(genericRegularPolicy(character, envelope), references);
    return [character.id, { ...envelope, publicIdentity: policy?.public_identity || safeIdentity, policy } satisfies DialogueManifestCharacter];
  }));
  return { version: 1, characters, validIds: { completedEventIds: sort(eventIds), selectedOptionIds: sort(optionIds), unlockedChapterIds: sort([...chapterIdsByCharacter.values()].flat()) } };
}

export function serializeDialogueManifest(manifest: DialogueManifest): string {
  return ['// Generated by npm run dialogue:compile. Do not edit by hand.', `export const dialogueManifest = ${JSON.stringify(manifest, null, 2)};`, ''].join('\n');
}
