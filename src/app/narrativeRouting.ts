import { isMixingExit, resolveNodeExit } from '../data/content/narrative';
import type { CharacterNode } from '../data/content/types';
import type { MixingTier } from '../data/content/mixingScore';

function getNextTarget(node: CharacterNode | null): string | null {
  if (!node) {
    return null;
  }
  const exit = resolveNodeExit(node);
  return exit.kind === 'next' ? exit.target : null;
}

function asMixingNode(node: CharacterNode | null): CharacterNode | null {
  if (!node) {
    return null;
  }
  return isMixingExit(resolveNodeExit(node)) ? node : null;
}

export function resolveActiveMixingNode(params: {
  teachingCandidate: CharacterNode | null;
  mixingCandidate: CharacterNode | null;
  resolveFollowupNode: (nodeId: string) => CharacterNode | null;
}): CharacterNode | null {
  const { teachingCandidate, mixingCandidate, resolveFollowupNode } = params;
  const teachingNextNodeId = getNextTarget(teachingCandidate);

  return (
    asMixingNode(mixingCandidate) ||
    (teachingNextNodeId ? asMixingNode(resolveFollowupNode(teachingNextNodeId)) : null) ||
    asMixingNode(teachingCandidate) ||
    null
  );
}

export function resolveMixingOutcomeNode(
  mixingNode: CharacterNode | null,
  tier: MixingTier,
): string | null {
  if (!mixingNode) {
    return null;
  }

  const exit = resolveNodeExit(mixingNode);
  if (!isMixingExit(exit)) {
    return null;
  }

  if (tier === 'perfect') {
    return exit.outcomes.success;
  }
  if (tier === 'good') {
    return exit.outcomes.good ?? exit.outcomes.success;
  }
  return exit.outcomes.fail ?? exit.outcomes.success;
}
