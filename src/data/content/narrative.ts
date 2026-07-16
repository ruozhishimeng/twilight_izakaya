import type {
  CharacterNode,
  DrinkRequestSource,
  NarrativeExit,
  NarrativeMixingExit,
} from './types';

function nodeLabel(node: CharacterNode) {
  return node.event_id || node.id || '<unknown>';
}

function normalizeTarget(target: string | null | undefined) {
  return typeof target === 'string' && target.trim() ? target.trim() : null;
}

function hasOwn(node: CharacterNode, key: string) {
  return Object.prototype.hasOwnProperty.call(node, key);
}

/**
 * The sole compatibility boundary between authored nodes and explicit narrative exits.
 * Runtime flow code should consume only the returned exit and must not inspect legacy fields.
 */
export function resolveNodeExit(node: CharacterNode): NarrativeExit {
  if (hasOwn(node, 'exit')) {
    if (!node.exit) {
      throw new Error(`[narrative] node "${nodeLabel(node)}" defines an invalid exit`);
    }
    return node.exit;
  }

  if (hasOwn(node, 'mixing')) {
    throw new Error(
      `[narrative] node "${nodeLabel(node)}" uses unsupported legacy field "mixing"; migrate it to an explicit exit`,
    );
  }

  if (node.drink_request) {
    return {
      kind: 'mixing',
      request: node.drink_request,
      outcomes: {
        success: normalizeTarget(node.on_mixing_complete) || normalizeTarget(node.next_node),
        fail:
          normalizeTarget(node.on_mixing_fail) ||
          normalizeTarget(node.drink_request.eval_branches?.fail),
      },
    };
  }

  if (node.on_mixing_complete || node.on_mixing_fail) {
    throw new Error(
      `[narrative] node "${nodeLabel(node)}" defines mixing outcomes without drink_request`,
    );
  }

  if (node.trigger_observation) {
    const prompt = normalizeTarget(node.trigger_observation.prompt);
    const continueNode = normalizeTarget(node.trigger_observation.continue_node);
    if (!prompt || !continueNode) {
      throw new Error(
        `[narrative] node "${nodeLabel(node)}" defines an incomplete observation exit`,
      );
    }

    return {
      kind: 'observation',
      prompt,
      continue_node: continueNode,
      feature_groups: node.trigger_observation.feature_groups,
    };
  }

  const nextTarget = normalizeTarget(node.next_node);
  if (nextTarget) {
    return {
      kind: 'next',
      target: nextTarget,
    };
  }

  return { kind: 'end_visit' };
}

export function getMixingRequest(exit: NarrativeExit): DrinkRequestSource | null {
  return exit.kind === 'mixing' ? exit.request : null;
}

export function getMixingOutcomeTarget(
  exit: NarrativeExit,
  success: boolean,
): string | null {
  if (exit.kind !== 'mixing') {
    return null;
  }
  return success ? exit.outcomes.success : exit.outcomes.fail;
}

export function getExitTargets(exit: NarrativeExit): string[] {
  switch (exit.kind) {
    case 'next':
      return [exit.target];
    case 'observation':
      return [exit.continue_node];
    case 'mixing':
      return [...new Set([exit.outcomes.success, exit.outcomes.fail].filter(
        (target): target is string => !!target,
      ))];
    case 'end_visit':
      return [];
  }
}

export function isMixingExit(exit: NarrativeExit): exit is NarrativeMixingExit {
  return exit.kind === 'mixing';
}
