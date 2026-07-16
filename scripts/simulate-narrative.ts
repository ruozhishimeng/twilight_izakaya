import { normalizeContentRegistry } from '../src/data/content/normalizer';
import {
  NarrativeSimulationSelectionError,
  hasRecoveredMixingRetry,
  simulateNarrativeRegistry,
  type NarrativeSimulationReport,
} from '../src/data/content/simulator';
import { validateContentRegistry } from '../src/data/content/validation';
import { loadContentSourceFromFs } from './loadContentFromFs';

interface CliOptions {
  availableItemIds?: string[];
  noItems: boolean;
  day?: string;
  guestId?: string;
  startNodeId?: string;
  maxSteps?: number;
  maxPaths?: number;
  maxMixingRetries?: number;
  json: boolean;
  trace: boolean;
  help: boolean;
}

class CliUsageError extends Error {}

const HELP = `Usage: npm run narrative:simulate -- [options]

Simulate every selectable option, observation continuation, and mixing outcome
without opening the game UI.

Options:
  --day <W1_D3>       simulate scheduled visits on one day
  --guest <id>        simulate scheduled visits for one guest
  --start <node-id>   simulate a custom start node (requires --guest)
  --max-steps <n>     maximum transitions per path (default: 100)
  --max-paths <n>     branch explosion guard (default: 10000)
  --max-retries <n>   failed teaching mixes explored before success (default: 1)
  --item <id>          make one need_item condition available (repeatable)
  --no-items           make every need_item option unavailable
  --trace             print every path and transition
  --json              emit stable machine-readable JSON
  --help              show this help
`;

function requireValue(args: string[], index: number, flag: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new CliUsageError(`${flag} requires a value`);
  }
  return value;
}

function positiveInteger(value: string, flag: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliUsageError(`${flag} must be a positive integer`);
  }
  return parsed;
}

function nonNegativeInteger(value: string, flag: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new CliUsageError(`${flag} must be a non-negative integer`);
  }
  return parsed;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    trace: false,
    help: false,
    noItems: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    switch (argument) {
      case '--json':
        options.json = true;
        break;
      case '--trace':
        options.trace = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--day':
        options.day = requireValue(args, index, argument);
        index += 1;
        break;
      case '--guest':
        options.guestId = requireValue(args, index, argument);
        index += 1;
        break;
      case '--start':
        options.startNodeId = requireValue(args, index, argument);
        index += 1;
        break;
      case '--max-steps': {
        const value = requireValue(args, index, argument);
        options.maxSteps = positiveInteger(value, argument);
        index += 1;
        break;
      }
      case '--max-paths': {
        const value = requireValue(args, index, argument);
        options.maxPaths = positiveInteger(value, argument);
        index += 1;
        break;
      }
      case '--max-retries': {
        const value = requireValue(args, index, argument);
        options.maxMixingRetries = nonNegativeInteger(value, argument);
        index += 1;
        break;
      }
      case '--item': {
        if (options.noItems) {
          throw new CliUsageError('--item cannot be combined with --no-items');
        }
        const value = requireValue(args, index, argument);
        options.availableItemIds = [...(options.availableItemIds || []), value];
        index += 1;
        break;
      }
      case '--no-items':
        if ((options.availableItemIds?.length || 0) > 0) {
          throw new CliUsageError('--no-items cannot be combined with --item');
        }
        options.noItems = true;
        options.availableItemIds = [];
        break;
      default:
        throw new CliUsageError(`unknown option "${argument}"`);
    }
  }

  if (options.startNodeId && !options.guestId) {
    throw new CliUsageError('--start requires --guest');
  }

  return options;
}

function targetLabel(day: string | null, guestId: string, startNodeId: string) {
  return `${day || 'CUSTOM'} ${guestId}/${startNodeId}`;
}

function printTrace(report: NarrativeSimulationReport) {
  report.visits.forEach(visit => {
    visit.paths.forEach((path, pathIndex) => {
      const terminal = hasRecoveredMixingRetry(path) ? 'end_visit_after_retry' : path.terminal;
      console.log(`  PATH ${pathIndex + 1} ${terminal}`);
      path.trace.forEach(entry => {
        const option = entry.optionKey ? ` option=${entry.optionKey}` : '';
        const target = entry.targetNodeId ? ` -> ${entry.targetNodeId}` : '';
        console.log(
          `    ${entry.step}. ${entry.state}:${entry.nodeId || '-'} ` +
          `${entry.action}${option} => ${entry.directive}${target}`,
        );
      });
    });
  });
}

function printHumanReport(report: NarrativeSimulationReport, trace: boolean) {
  const { summary } = report;
  const availability = report.scenario.optionAvailability === 'all'
    ? 'all-items'
    : report.scenario.availableItemIds?.length
      ? `items=${report.scenario.availableItemIds.join(',')}`
      : 'no-items';
  console.log(
    `[narrative:simulate] ${summary.visitCount} visits, ${summary.pathCount} paths, ` +
    `${summary.endVisitCount} end visits, ` +
    `${summary.recoveredRetryPathCount} recovered-retry paths ` +
    `(${summary.mixingRetryActionCount} retry actions), ` +
    `${summary.failedVisitCount} failed visits, ${summary.issueCount} issues, ` +
    `${summary.stepLimitCount} step limits, availability=${availability}`,
  );

  report.visits.forEach(visit => {
    const marker = visit.status === 'error'
      ? 'ERROR'
      : visit.pathStats.recoveredRetryPaths > 0 ? 'RETRY' : 'OK';
    console.log(
      `${marker} ${targetLabel(visit.day, visit.guestId, visit.startNodeId)} ` +
      `${visit.pathCount} paths (${visit.pathStats.endVisit} end, ` +
      `${visit.pathStats.recoveredRetryPaths} recovered-retry paths)`,
    );
    visit.issues.forEach(issue => {
      console.log(`  ${issue.code}: ${issue.message}`);
    });
  });

  if (trace) {
    printTrace(report);
  }
}

const rawArgs = process.argv.slice(2);
const wantsJson = rawArgs.includes('--json');
let parsedOptions: CliOptions | null = null;

try {
  parsedOptions = parseArgs(rawArgs);
  if (parsedOptions.help) {
    console.log(HELP);
  } else {
    const registry = normalizeContentRegistry(loadContentSourceFromFs());
    validateContentRegistry(registry);
    const report = simulateNarrativeRegistry(registry, {
      availableItemIds: parsedOptions.availableItemIds,
      day: parsedOptions.day,
      guestId: parsedOptions.guestId,
      startNodeId: parsedOptions.startNodeId,
      maxMixingRetries: parsedOptions.maxMixingRetries,
      maxPaths: parsedOptions.maxPaths,
      maxSteps: parsedOptions.maxSteps,
      strategy: 'bfs',
    });

    if (parsedOptions.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printHumanReport(report, parsedOptions.trace);
    }

    if (report.summary.issueCount > 0) {
      process.exitCode = 1;
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const isUsageError = error instanceof CliUsageError ||
    error instanceof NarrativeSimulationSelectionError;

  if (wantsJson) {
    console.log(JSON.stringify({ error: message, kind: isUsageError ? 'usage' : 'runtime' }, null, 2));
  } else {
    console.error(`[narrative:simulate] ${isUsageError ? 'usage error' : 'failed'}: ${message}`);
    if (isUsageError) {
      console.error('Run with --help for usage.');
    }
  }
  process.exitCode = isUsageError ? 2 : 1;
}
