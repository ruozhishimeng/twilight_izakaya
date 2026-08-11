import { getMixingOutcomeTarget, isMixingExit, resolveNodeExit } from '../data/content/narrative';
import type { CharacterNode } from '../data/content/types';

export function resolveMixingOutcomeNode(
  mixingNode: CharacterNode | null,
  success: boolean,
) {
  return mixingNode
    ? getMixingOutcomeTarget(resolveNodeExit(mixingNode), success)
    : null;
}

export function shouldRetryMixingFailure(params: {
  success: boolean;
  outcomeNodeId: string | null;
  retryOnFail?: boolean;
  isTeaching?: boolean;
}) {
  return !params.success &&
    !params.outcomeNodeId &&
    Boolean(params.retryOnFail || params.isTeaching);
}

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
