export function matchesDialogueCondition(condition, snapshot = {}) {
  if (condition.always === true) return true;
  if (Array.isArray(condition.all)) return condition.all.every(entry => matchesDialogueCondition(entry, snapshot));
  if (Array.isArray(condition.any)) return condition.any.some(entry => matchesDialogueCondition(entry, snapshot));
  if (condition.relationship) {
    const value = Number(snapshot.relationshipValues?.[condition.relationship.axis] ?? 0);
    return (condition.relationship.min === undefined || value >= condition.relationship.min) && (condition.relationship.max === undefined || value <= condition.relationship.max);
  }
  const includes = (key, value) => Array.isArray(snapshot[key]) && snapshot[key].includes(value);
  if ('completed_event' in condition) return includes('completedEventIds', condition.completed_event);
  if ('selected_option' in condition) return includes('selectedOptionIds', condition.selected_option);
  if ('unlocked_chapter' in condition) return includes('unlockedChapterIds', condition.unlocked_chapter);
  if ('current_node' in condition) return snapshot.currentNodeId === condition.current_node;
  if ('observed_feature' in condition) return includes('observedFeatureIds', condition.observed_feature);
  if ('last_drink_success' in condition) return (snapshot.lastDrink?.isSuccess ?? snapshot.lastDrinkSuccess ?? null) === condition.last_drink_success;
  return false;
}

export function resolveFirstMatchingRule(rules, snapshot) {
  const rule = rules.find(candidate => matchesDialogueCondition(candidate.when, snapshot));
  if (!rule) throw new Error('No dialogue rule matched the progress snapshot');
  return rule;
}

export function validateSnapshotReferences(manifest, character, snapshot = {}) {
  const check = (ids, allowed, label) => {
    for (const id of ids || []) if (!allowed.includes(id)) return `${label} contains unknown id "${id}"`;
    return null;
  };
  const error = check(snapshot.completedEventIds, manifest.validIds.completedEventIds, 'completedEventIds')
    || check(snapshot.selectedOptionIds, manifest.validIds.selectedOptionIds, 'selectedOptionIds')
    || check(snapshot.unlockedChapterIds, manifest.validIds.unlockedChapterIds, 'unlockedChapterIds')
    || check(snapshot.observedFeatureIds, character.validIds.observedFeatureIds, 'observedFeatureIds');
  if (error) return { ok: false, error };
  if (snapshot.currentNodeId != null && !character.validIds.nodeIds.includes(snapshot.currentNodeId)) return { ok: false, error: `currentNodeId contains unknown id "${snapshot.currentNodeId}"` };
  return { ok: true };
}
