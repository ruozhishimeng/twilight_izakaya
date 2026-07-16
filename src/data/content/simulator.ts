import {
  enumerateNarrativePaths,
  type EnumeratedNarrativePath,
  type EnumerateNarrativePathsOptions,
} from './interpreter';
import type { ContentRegistry } from './types';

export interface NarrativeSimulationTarget {
  day: string | null;
  guestId: string;
  startNodeId: string;
}

export type NarrativeSimulationIssueCode =
  | 'NO_END_VISIT'
  | 'SIMULATION_FAILED'
  | 'STEP_LIMIT'
  | 'UNEXPECTED_LOOP';

export interface NarrativeSimulationIssue {
  code: NarrativeSimulationIssueCode;
  message: string;
  pathIndex?: number;
}

export interface NarrativeSimulationPathStats {
  endVisit: number;
  recoveredRetryPaths: number;
  mixingRetryActions: number;
  unexpectedLoop: number;
  stepLimit: number;
}

export interface NarrativeSimulationVisit {
  day: string | null;
  guestId: string;
  startNodeId: string;
  status: 'ok' | 'error';
  pathCount: number;
  pathStats: NarrativeSimulationPathStats;
  issues: NarrativeSimulationIssue[];
  paths: readonly EnumeratedNarrativePath[];
}

export interface NarrativeSimulationSummary {
  visitCount: number;
  pathCount: number;
  endVisitCount: number;
  recoveredRetryPathCount: number;
  mixingRetryActionCount: number;
  unexpectedLoopCount: number;
  stepLimitCount: number;
  failedVisitCount: number;
  issueCount: number;
}

export interface NarrativeSimulationReport {
  scenario: {
    optionAvailability: 'all' | 'items';
    availableItemIds: readonly string[] | null;
  };
  summary: NarrativeSimulationSummary;
  visits: NarrativeSimulationVisit[];
}

export interface NarrativeSimulationSelection extends EnumerateNarrativePathsOptions {
  day?: string;
  guestId?: string;
  startNodeId?: string;
}

export class NarrativeSimulationSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NarrativeSimulationSelectionError';
  }
}

function emptyPathStats(): NarrativeSimulationPathStats {
  return {
    endVisit: 0,
    recoveredRetryPaths: 0,
    mixingRetryActions: 0,
    unexpectedLoop: 0,
    stepLimit: 0,
  };
}

export function countMixingRetryActions(path: EnumeratedNarrativePath) {
  return path.trace.filter(entry => (
    entry.action === 'mixing_fail' && entry.directive === 'mixing'
  )).length;
}

export function hasRecoveredMixingRetry(path: EnumeratedNarrativePath) {
  return path.terminal === 'end_visit' && countMixingRetryActions(path) > 0;
}

function simulateTarget(
  registry: ContentRegistry,
  target: NarrativeSimulationTarget,
  options: EnumerateNarrativePathsOptions,
): NarrativeSimulationVisit {
  const pathStats = emptyPathStats();
  const issues: NarrativeSimulationIssue[] = [];
  let paths: readonly EnumeratedNarrativePath[] = [];

  try {
    const guest = registry.guestById.get(target.guestId);
    if (!guest) {
      throw new Error(`guest "${target.guestId}" does not exist`);
    }

    paths = enumerateNarrativePaths(guest.nodeMap, target.startNodeId, options);
    paths.forEach((path, pathIndex) => {
      const mixingRetryActions = countMixingRetryActions(path);
      pathStats.mixingRetryActions += mixingRetryActions;
      switch (path.terminal) {
        case 'end_visit':
          pathStats.endVisit += 1;
          if (mixingRetryActions > 0) {
            pathStats.recoveredRetryPaths += 1;
          }
          return;
        case 'step_limit':
          pathStats.stepLimit += 1;
          issues.push({
            code: 'STEP_LIMIT',
            pathIndex,
            message: `path ${pathIndex + 1} reached the step limit`,
          });
          return;
        case 'loop':
          pathStats.unexpectedLoop += 1;
          issues.push({
            code: 'UNEXPECTED_LOOP',
            pathIndex,
            message: `path ${pathIndex + 1} loops at ${path.loopStateKey || 'an unknown state'}`,
          });
      }
    });

    if (pathStats.endVisit === 0) {
      issues.push({
        code: 'NO_END_VISIT',
        message: 'no enumerated path reaches end_visit',
      });
    }
  } catch (error) {
    issues.push({
      code: 'SIMULATION_FAILED',
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    ...target,
    status: issues.length === 0 ? 'ok' : 'error',
    pathCount: paths.length,
    pathStats,
    issues,
    paths,
  };
}

export function selectNarrativeSimulationTargets(
  registry: ContentRegistry,
  selection: Pick<NarrativeSimulationSelection, 'day' | 'guestId' | 'startNodeId'> = {},
) {
  if (selection.startNodeId && !selection.guestId) {
    throw new NarrativeSimulationSelectionError('--start requires --guest');
  }

  if (selection.startNodeId && selection.guestId) {
    return [{
      day: selection.day || null,
      guestId: selection.guestId,
      startNodeId: selection.startNodeId,
    }];
  }

  const targets = registry.schedule.schedule.flatMap(day => {
    if (selection.day && day.day !== selection.day) {
      return [];
    }
    return day.guests
      .filter(entry => !selection.guestId || entry.character_id === selection.guestId)
      .map(entry => ({
        day: day.day,
        guestId: entry.character_id,
        startNodeId: entry.start_node,
      }));
  });

  if (targets.length === 0) {
    const filters = [
      selection.day ? `day=${selection.day}` : null,
      selection.guestId ? `guest=${selection.guestId}` : null,
    ].filter(Boolean).join(', ');
    throw new NarrativeSimulationSelectionError(
      `no narrative simulation target matches${filters ? ` ${filters}` : ''}`,
    );
  }

  return targets;
}

export function simulateNarrativeRegistry(
  registry: ContentRegistry,
  selection: NarrativeSimulationSelection = {},
): NarrativeSimulationReport {
  const targets = selectNarrativeSimulationTargets(registry, selection);
  const options: EnumerateNarrativePathsOptions = {
    availableItemIds: selection.availableItemIds,
    maxMixingRetries: selection.maxMixingRetries,
    maxPaths: selection.maxPaths,
    maxSteps: selection.maxSteps,
    strategy: selection.strategy,
  };
  const visits = targets.map(target => simulateTarget(registry, target, options));
  const summary = visits.reduce<NarrativeSimulationSummary>((result, visit) => {
    result.visitCount += 1;
    result.pathCount += visit.pathCount;
    result.endVisitCount += visit.pathStats.endVisit;
    result.recoveredRetryPathCount += visit.pathStats.recoveredRetryPaths;
    result.mixingRetryActionCount += visit.pathStats.mixingRetryActions;
    result.unexpectedLoopCount += visit.pathStats.unexpectedLoop;
    result.stepLimitCount += visit.pathStats.stepLimit;
    result.failedVisitCount += visit.status === 'error' ? 1 : 0;
    result.issueCount += visit.issues.length;
    return result;
  }, {
    visitCount: 0,
    pathCount: 0,
    endVisitCount: 0,
    recoveredRetryPathCount: 0,
    mixingRetryActionCount: 0,
    unexpectedLoopCount: 0,
    stepLimitCount: 0,
    failedVisitCount: 0,
    issueCount: 0,
  });

  return {
    scenario: {
      optionAvailability: selection.availableItemIds === undefined ? 'all' : 'items',
      availableItemIds: selection.availableItemIds === undefined
        ? null
        : [...new Set(selection.availableItemIds)],
    },
    summary,
    visits,
  };
}
