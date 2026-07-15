import { getExitTargets, resolveNodeExit } from './narrative';
import type { CharacterNode, ContentRegistry, Guest } from './types';

export type NarrativeDiagnosticSeverity = 'error' | 'warning';

export type NarrativeDiagnosticCode =
  | 'INVALID_NODE_EXIT'
  | 'MISSING_EDGE_TARGET'
  | 'SCHEDULED_GUEST_MISSING'
  | 'SCHEDULED_START_MISSING'
  | 'SCHEDULED_PATH_NO_MIXING'
  | 'UNREACHABLE_MAIN_NODE'
  | 'CLOSED_CYCLE'
  | 'NARRATIVE_CHECK_FAILED';

export interface NarrativeDiagnostic {
  code: NarrativeDiagnosticCode;
  severity: NarrativeDiagnosticSeverity;
  guestId: string | null;
  nodeId: string | null;
  message: string;
}

export type NarrativeGraphEdgeKind =
  | 'next'
  | 'observation'
  | 'mixing'
  | 'option_next'
  | 'option_fallback';

export interface NarrativeGraphEdge {
  from: string;
  to: string;
  kind: NarrativeGraphEdgeKind;
}

export interface GuestNarrativeGraph {
  guestId: string;
  nodes: ReadonlyMap<string, CharacterNode>;
  mainNodeIds: ReadonlySet<string>;
  mixingNodeIds: ReadonlySet<string>;
  edges: readonly NarrativeGraphEdge[];
  adjacency: ReadonlyMap<string, readonly string[]>;
}

export interface GuestNarrativeGraphBuildResult {
  graph: GuestNarrativeGraph;
  diagnostics: NarrativeDiagnostic[];
}

export interface ScheduledNarrativeAnalysis {
  day: string;
  guestId: string;
  startNodeId: string;
  reachableNodeIds: string[];
  reachableMixingNodeIds: string[];
}

export interface NarrativeGraphAnalysis {
  diagnostics: NarrativeDiagnostic[];
  scheduledEntries: ScheduledNarrativeAnalysis[];
}

function normalizedTarget(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function nodeIdOf(node: CharacterNode) {
  return normalizedTarget(node.event_id) || normalizedTarget(node.id);
}

function exitEdgeKind(kind: ReturnType<typeof resolveNodeExit>['kind']): NarrativeGraphEdgeKind | null {
  switch (kind) {
    case 'next':
      return 'next';
    case 'observation':
      return 'observation';
    case 'mixing':
      return 'mixing';
    case 'end_visit':
      return null;
  }
}

function sortDiagnostics(diagnostics: NarrativeDiagnostic[]) {
  const severityOrder: Record<NarrativeDiagnosticSeverity, number> = {
    error: 0,
    warning: 1,
  };

  diagnostics.sort((left, right) => {
    return (
      severityOrder[left.severity] - severityOrder[right.severity] ||
      left.code.localeCompare(right.code) ||
      (left.guestId || '').localeCompare(right.guestId || '') ||
      (left.nodeId || '').localeCompare(right.nodeId || '') ||
      left.message.localeCompare(right.message)
    );
  });

  return diagnostics;
}

export function buildGuestNarrativeGraph(guest: Guest): GuestNarrativeGraphBuildResult {
  const diagnostics: NarrativeDiagnostic[] = [];
  const edges: NarrativeGraphEdge[] = [];
  const edgeKeys = new Set<string>();
  const mixingNodeIds = new Set<string>();
  const mainNodeIds = new Set(
    guest.nodes.main
      .map(nodeIdOf)
      .filter((nodeId): nodeId is string => !!nodeId),
  );

  const addEdge = (
    from: string,
    rawTarget: unknown,
    kind: NarrativeGraphEdgeKind,
  ) => {
    const target = normalizedTarget(rawTarget);
    if (!target) {
      diagnostics.push({
        code: 'MISSING_EDGE_TARGET',
        severity: 'error',
        guestId: guest.id,
        nodeId: from,
        message: `${kind} edge from "${from}" has an empty target`,
      });
      return;
    }

    const key = `${from}\u0000${kind}\u0000${target}`;
    if (edgeKeys.has(key)) {
      return;
    }
    edgeKeys.add(key);
    edges.push({ from, to: target, kind });
  };

  for (const [mapNodeId, node] of guest.nodeMap) {
    const nodeId = nodeIdOf(node) || mapNodeId;

    try {
      const exit = resolveNodeExit(node);
      if (exit.kind === 'mixing') {
        mixingNodeIds.add(nodeId);
      }

      const kind = exitEdgeKind(exit.kind);
      if (kind) {
        getExitTargets(exit).forEach(target => addEdge(nodeId, target, kind));
      }
    } catch (error) {
      diagnostics.push({
        code: 'INVALID_NODE_EXIT',
        severity: 'error',
        guestId: guest.id,
        nodeId,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if (Array.isArray(node.player_options)) {
      node.player_options.forEach(option => {
        if (option.next_node !== undefined && option.next_node !== null) {
          addEdge(nodeId, option.next_node, 'option_next');
        }
        if (option.fallback_node !== undefined && option.fallback_node !== null) {
          addEdge(nodeId, option.fallback_node, 'option_fallback');
        }
      });
    }
  }

  edges.forEach(edge => {
    if (!guest.nodeMap.has(edge.to)) {
      diagnostics.push({
        code: 'MISSING_EDGE_TARGET',
        severity: 'error',
        guestId: guest.id,
        nodeId: edge.from,
        message: `${edge.kind} edge from "${edge.from}" points to missing node "${edge.to}"`,
      });
    }
  });

  const adjacency = new Map<string, string[]>();
  [...guest.nodeMap.keys()].sort().forEach(nodeId => adjacency.set(nodeId, []));
  edges.forEach(edge => {
    if (!guest.nodeMap.has(edge.to)) {
      return;
    }
    const targets = adjacency.get(edge.from) || [];
    if (!targets.includes(edge.to)) {
      targets.push(edge.to);
      targets.sort();
    }
    adjacency.set(edge.from, targets);
  });

  edges.sort((left, right) => {
    return (
      left.from.localeCompare(right.from) ||
      left.to.localeCompare(right.to) ||
      left.kind.localeCompare(right.kind)
    );
  });

  return {
    graph: {
      guestId: guest.id,
      nodes: guest.nodeMap,
      mainNodeIds,
      mixingNodeIds,
      edges,
      adjacency,
    },
    diagnostics: sortDiagnostics(diagnostics),
  };
}

function reachableNodeIds(graph: GuestNarrativeGraph, startNodeId: string) {
  const reachable = new Set<string>();
  if (!graph.nodes.has(startNodeId)) {
    return reachable;
  }

  const queue = [startNodeId];
  reachable.add(startNodeId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const target of graph.adjacency.get(current) || []) {
      if (!reachable.has(target)) {
        reachable.add(target);
        queue.push(target);
      }
    }
  }

  return reachable;
}

function stronglyConnectedComponents(graph: GuestNarrativeGraph) {
  let nextIndex = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  const visit = (nodeId: string) => {
    indices.set(nodeId, nextIndex);
    lowLinks.set(nodeId, nextIndex);
    nextIndex += 1;
    stack.push(nodeId);
    onStack.add(nodeId);

    for (const target of graph.adjacency.get(nodeId) || []) {
      if (!indices.has(target)) {
        visit(target);
        lowLinks.set(
          nodeId,
          Math.min(lowLinks.get(nodeId)!, lowLinks.get(target)!),
        );
      } else if (onStack.has(target)) {
        lowLinks.set(
          nodeId,
          Math.min(lowLinks.get(nodeId)!, indices.get(target)!),
        );
      }
    }

    if (lowLinks.get(nodeId) !== indices.get(nodeId)) {
      return;
    }

    const component: string[] = [];
    let member: string;
    do {
      member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
    } while (member !== nodeId);

    component.sort();
    components.push(component);
  };

  [...graph.nodes.keys()].sort().forEach(nodeId => {
    if (!indices.has(nodeId)) {
      visit(nodeId);
    }
  });

  return components.sort((left, right) => left[0].localeCompare(right[0]));
}

function appendClosedCycleDiagnostics(
  graph: GuestNarrativeGraph,
  scheduledReachable: ReadonlySet<string>,
  diagnostics: NarrativeDiagnostic[],
) {
  stronglyConnectedComponents(graph).forEach(component => {
    const componentSet = new Set(component);
    const isCycle =
      component.length > 1 ||
      (graph.adjacency.get(component[0]) || []).includes(component[0]);
    if (!isCycle) {
      return;
    }

    const hasExternalExit = component.some(nodeId => {
      return (graph.adjacency.get(nodeId) || []).some(target => !componentSet.has(target));
    });
    if (hasExternalExit) {
      return;
    }

    const reachableFromSchedule = component.some(nodeId => scheduledReachable.has(nodeId));
    diagnostics.push({
      code: 'CLOSED_CYCLE',
      severity: reachableFromSchedule ? 'error' : 'warning',
      guestId: graph.guestId,
      nodeId: component[0],
      message: `closed narrative cycle has no exit: ${component.join(' -> ')}`,
    });
  });
}

export function findNarrativePath(
  graph: GuestNarrativeGraph,
  startNodeId: string,
  targetNodeId: string,
): string[] | null {
  if (!graph.nodes.has(startNodeId) || !graph.nodes.has(targetNodeId)) {
    return null;
  }
  if (startNodeId === targetNodeId) {
    return [startNodeId];
  }

  const queue = [startNodeId];
  const previous = new Map<string, string | null>([[startNodeId, null]]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const target of graph.adjacency.get(current) || []) {
      if (previous.has(target)) {
        continue;
      }
      previous.set(target, current);
      if (target === targetNodeId) {
        const path: string[] = [];
        let cursor: string | null = target;
        while (cursor) {
          path.push(cursor);
          cursor = previous.get(cursor) ?? null;
        }
        return path.reverse();
      }
      queue.push(target);
    }
  }

  return null;
}

export function analyzeNarrativeGraph(registry: ContentRegistry): NarrativeGraphAnalysis {
  const diagnostics: NarrativeDiagnostic[] = [];
  const graphByGuestId = new Map<string, GuestNarrativeGraph>();
  const scheduledReachableByGuestId = new Map<string, Set<string>>();
  const scheduledEntries: ScheduledNarrativeAnalysis[] = [];

  [...registry.guests]
    .sort((left, right) => left.id.localeCompare(right.id))
    .forEach(guest => {
      const result = buildGuestNarrativeGraph(guest);
      graphByGuestId.set(guest.id, result.graph);
      scheduledReachableByGuestId.set(guest.id, new Set());
      diagnostics.push(...result.diagnostics);
    });

  registry.schedule.schedule.forEach(day => {
    day.guests.forEach(entry => {
      const guest = registry.guestById.get(entry.character_id);
      if (!guest) {
        diagnostics.push({
          code: 'SCHEDULED_GUEST_MISSING',
          severity: 'error',
          guestId: entry.character_id,
          nodeId: entry.start_node || null,
          message: `${day.day} schedules missing guest "${entry.character_id}"`,
        });
        scheduledEntries.push({
          day: day.day,
          guestId: entry.character_id,
          startNodeId: entry.start_node,
          reachableNodeIds: [],
          reachableMixingNodeIds: [],
        });
        return;
      }

      const graph = graphByGuestId.get(guest.id)!;
      if (!graph.nodes.has(entry.start_node)) {
        diagnostics.push({
          code: 'SCHEDULED_START_MISSING',
          severity: 'error',
          guestId: guest.id,
          nodeId: entry.start_node,
          message: `${day.day} start_node "${entry.start_node}" does not exist`,
        });
        scheduledEntries.push({
          day: day.day,
          guestId: guest.id,
          startNodeId: entry.start_node,
          reachableNodeIds: [],
          reachableMixingNodeIds: [],
        });
        return;
      }

      const reachable = reachableNodeIds(graph, entry.start_node);
      const reachableMixingNodeIds = [...reachable]
        .filter(nodeId => graph.mixingNodeIds.has(nodeId))
        .sort();
      reachable.forEach(nodeId => scheduledReachableByGuestId.get(guest.id)!.add(nodeId));

      scheduledEntries.push({
        day: day.day,
        guestId: guest.id,
        startNodeId: entry.start_node,
        reachableNodeIds: [...reachable].sort(),
        reachableMixingNodeIds,
      });

      if (reachableMixingNodeIds.length === 0) {
        diagnostics.push({
          code: 'SCHEDULED_PATH_NO_MIXING',
          severity: 'warning',
          guestId: guest.id,
          nodeId: entry.start_node,
          message: `${day.day} scheduled path from "${entry.start_node}" cannot reach a mixing exit`,
        });
      }
    });
  });

  graphByGuestId.forEach((graph, guestId) => {
    const scheduledReachable = scheduledReachableByGuestId.get(guestId) || new Set<string>();
    graph.mainNodeIds.forEach(nodeId => {
      if (!scheduledReachable.has(nodeId)) {
        diagnostics.push({
          code: 'UNREACHABLE_MAIN_NODE',
          severity: 'warning',
          guestId,
          nodeId,
          message: `main node "${nodeId}" is unreachable from every scheduled start_node`,
        });
      }
    });
    appendClosedCycleDiagnostics(graph, scheduledReachable, diagnostics);
  });

  scheduledEntries.sort((left, right) => {
    return (
      left.day.localeCompare(right.day) ||
      left.guestId.localeCompare(right.guestId) ||
      left.startNodeId.localeCompare(right.startNodeId)
    );
  });

  return {
    diagnostics: sortDiagnostics(diagnostics),
    scheduledEntries,
  };
}
