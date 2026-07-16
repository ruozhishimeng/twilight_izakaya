import { getMixingOutcomeTarget, resolveNodeExit } from '../data/content/narrative';
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
