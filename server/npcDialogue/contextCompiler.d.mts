import type { DialogueManifestCharacter, DialogueProgressSnapshot, DialogueTurnCompilation } from '../../src/data/dialogue/types.ts';

export function compileDialogueTurnContext(character: DialogueManifestCharacter, snapshot: DialogueProgressSnapshot, options: { inputKind: 'in_world' | 'off_topic' }): DialogueTurnCompilation;
