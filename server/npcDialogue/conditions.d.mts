import type { DialogueManifest, DialogueManifestCharacter, DialogueProgressSnapshot, DialogueWhenSource } from '../../src/data/dialogue/types.ts';

export function matchesDialogueCondition(condition: DialogueWhenSource, snapshot: DialogueProgressSnapshot): boolean;
export function resolveFirstMatchingRule<T extends { when: DialogueWhenSource }>(rules: readonly T[], snapshot: DialogueProgressSnapshot): T;
export function validateSnapshotReferences(manifest: DialogueManifest, character: DialogueManifestCharacter, snapshot: DialogueProgressSnapshot): { ok: true } | { ok: false; error: string };
