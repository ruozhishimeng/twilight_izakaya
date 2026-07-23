import {
  getMixingOutcomeTarget,
  getMixingRequest,
  resolveNodeExit,
} from './narrative';
import type {
  CharacterNode,
  DrinkRequestSource,
  NarrativeMixingExit,
  NodePlayerOption,
} from './types';

const DEFAULT_MAX_STEPS = 100;
const DEFAULT_MAX_PATHS = 10_000;

export type NarrativeOptionSelection = string | number;

export interface NarrativeChoice {
  key: string;
  index: number;
  id: string | null;
  text: string;
  available: boolean;
  completed: boolean;
  option: NodePlayerOption;
}

export interface AwaitChoiceDirective {
  kind: 'await_choice';
  mode: 'select_one' | 'inspect_all';
  options: readonly NarrativeChoice[];
  completedOptionKeys: readonly string[];
}

export interface NodeDirective {
  kind: 'node';
  nodeId: string;
}

export type TailChatResume =
  | { kind: 'node'; nodeId: string }
  | { kind: 'end_visit' };

export interface TailChatDirective {
  kind: 'tail_chat';
  resume: TailChatResume;
}

export interface ObservationDirective {
  kind: 'observation';
  prompt: string;
  continueNodeId: string;
  featureGroups?: string[];
}

export interface MixingDirective {
  kind: 'mixing';
  request: DrinkRequestSource;
  exit: NarrativeMixingExit;
}

export interface EndVisitDirective {
  kind: 'end_visit';
}

export type NarrativeDirective =
  | AwaitChoiceDirective
  | NodeDirective
  | TailChatDirective
  | ObservationDirective
  | MixingDirective
  | EndVisitDirective;

export type NarrativeInterpreterState =
  | { kind: 'node'; nodeId: string; completedOptionKeys?: readonly string[] }
  | {
      kind: 'observation';
      sourceNodeId: string;
      prompt: string;
      continueNodeId: string;
      featureGroups?: string[];
    }
  | {
      kind: 'mixing';
      sourceNodeId: string;
      exit: NarrativeMixingExit;
      retryCount: number;
    }
  | { kind: 'tail_chat'; sourceNodeId: string; resume: TailChatResume }
  | { kind: 'end_visit'; sourceNodeId: string | null };

export type NarrativeInterpreterAction =
  | { type: 'complete_node'; selectedOption?: NarrativeOptionSelection }
  | { type: 'complete_observation' }
  | { type: 'complete_mixing'; success: boolean }
  | { type: 'complete_tail_chat' };

export interface NarrativeInterpreterStep {
  state: NarrativeInterpreterState;
  directive: NarrativeDirective;
}

export type NarrativePathTerminal = 'end_visit' | 'loop' | 'step_limit';

export interface NarrativeTraceEntry {
  step: number;
  state: NarrativeInterpreterState['kind'];
  nodeId: string | null;
  action:
    | 'complete_node'
    | 'select_option'
    | 'complete_observation'
    | 'mixing_success'
    | 'mixing_fail'
    | 'complete_tail_chat';
  directive: NarrativeDirective['kind'];
  optionKey?: string;
  targetNodeId?: string;
}

export interface EnumeratedNarrativePath {
  terminal: NarrativePathTerminal;
  terminalState: NarrativeInterpreterState;
  trace: readonly NarrativeTraceEntry[];
  loopStateKey?: string;
}

export interface EnumerateNarrativePathsOptions {
  availableItemIds?: readonly string[];
  maxMixingRetries?: number;
  maxSteps?: number;
  maxPaths?: number;
  strategy?: 'bfs' | 'dfs';
}

export interface NarrativeOptionContext {
  completedOptionKeys?: readonly string[];
  availableOptionKeys?: readonly string[];
}

export interface NarrativeInterpreterEnvironment {
  /** Undefined means structural coverage with every conditional option available. */
  availableItemIds?: readonly string[];
}

interface FrontierItem {
  state: NarrativeInterpreterState;
  trace: NarrativeTraceEntry[];
  seenStateKeys: Set<string>;
  steps: number;
}

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function requireNonEmptyString(value: unknown, label: string) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error(`[narrativeInterpreter] ${label} must be a non-empty string`);
  }
  return normalized;
}

function nodeLabel(node: CharacterNode) {
  return node.event_id || node.id || '<unknown>';
}

function optionText(option: NodePlayerOption, index: number) {
  const text = option.text || option.option;
  return requireNonEmptyString(text, `option ${index + 1} text`);
}

export function getNarrativeOptionKey(option: NodePlayerOption, index: number) {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error('[narrativeInterpreter] option index must be a non-negative integer');
  }
  if (option.id === undefined || option.id === null) {
    return `index:${index}`;
  }
  return `id:${requireNonEmptyString(option.id, `option ${index + 1} id`)}`;
}

function optionBranchType(option: NodePlayerOption) {
  return option.branchType ?? option.branch_type ?? null;
}

function choiceMode(node: CharacterNode, choices: readonly NarrativeChoice[]) {
  const inspectCount = choices.filter(choice => optionBranchType(choice.option) === 'choice').length;
  if (inspectCount > 0 && inspectCount !== choices.length) {
    throw new Error(
      `[narrativeInterpreter] node "${nodeLabel(node)}" cannot mix inspect-all and select-one options`,
    );
  }
  return inspectCount > 0 ? 'inspect_all' as const : 'select_one' as const;
}

function normalizeOptionKeySet(
  node: CharacterNode,
  choices: readonly NarrativeChoice[],
  rawKeys: readonly string[] | undefined,
  label: string,
) {
  const validKeys = new Set(choices.map(choice => choice.key));
  const normalized = new Set<string>();
  (rawKeys || []).forEach(rawKey => {
    const key = requireNonEmptyString(rawKey, `${label} key`);
    if (!validKeys.has(key)) {
      throw new Error(
        `[narrativeInterpreter] node "${nodeLabel(node)}" ${label} contains unknown option "${key}"`,
      );
    }
    normalized.add(key);
  });
  return normalized;
}

function buildNarrativeChoices(
  node: CharacterNode,
  context: NarrativeOptionContext = {},
): NarrativeChoice[] {
  if (node.player_options === undefined) {
    return [];
  }
  if (!Array.isArray(node.player_options)) {
    throw new Error(
      `[narrativeInterpreter] node "${nodeLabel(node)}" player_options must be an array`,
    );
  }

  const keys = new Set<string>();
  const choices = node.player_options.map((option, index) => {
    const key = getNarrativeOptionKey(option, index);
    if (keys.has(key)) {
      throw new Error(
        `[narrativeInterpreter] node "${nodeLabel(node)}" contains duplicate option key "${key}"`,
      );
    }
    keys.add(key);

    return {
      key,
      index,
      id: option.id?.trim() || null,
      text: optionText(option, index),
      available: true,
      completed: false,
      option,
    };
  });

  const completedKeys = normalizeOptionKeySet(
    node,
    choices,
    context.completedOptionKeys,
    'completedOptionKeys',
  );
  const availableKeys = context.availableOptionKeys === undefined
    ? new Set(choices.map(choice => choice.key))
    : normalizeOptionKeySet(
        node,
        choices,
        context.availableOptionKeys,
        'availableOptionKeys',
      );

  return choices.map(choice => ({
    ...choice,
    available: availableKeys.has(choice.key),
    completed: completedKeys.has(choice.key),
  }));
}

function availableOptionKeysForEnvironment(
  node: CharacterNode,
  environment: NarrativeInterpreterEnvironment,
) {
  if (environment.availableItemIds === undefined) {
    return undefined;
  }

  const availableItems = new Set(environment.availableItemIds.map(itemId => (
    requireNonEmptyString(itemId, 'available item id')
  )));
  return (node.player_options || [])
    .map((option, index) => ({ option, key: getNarrativeOptionKey(option, index) }))
    .filter(({ option }) => (
      !option.condition?.need_item || availableItems.has(option.condition.need_item)
    ))
    .map(({ key }) => key);
}

function selectNarrativeChoice(
  node: CharacterNode,
  choices: NarrativeChoice[],
  selection: NarrativeOptionSelection,
) {
  if (typeof selection === 'number') {
    if (!Number.isInteger(selection) || selection < 0 || selection >= choices.length) {
      throw new Error(
        `[narrativeInterpreter] node "${nodeLabel(node)}" option index ${String(selection)} is out of range`,
      );
    }
    return choices[selection]!;
  }
  if (typeof selection !== 'string' || !selection.trim()) {
    throw new Error(
      `[narrativeInterpreter] node "${nodeLabel(node)}" option selection must be a key or index`,
    );
  }

  const normalized = selection.trim();
  const match = choices.find(choice => choice.key === normalized || choice.id === normalized);
  if (!match) {
    throw new Error(
      `[narrativeInterpreter] node "${nodeLabel(node)}" has no option "${normalized}"; expected one of ${choices.map(choice => choice.key).join(', ')}`,
    );
  }
  return match;
}

function withTailChat(
  node: CharacterNode,
  directive: NodeDirective | EndVisitDirective,
): NodeDirective | EndVisitDirective | TailChatDirective {
  const mode = node.llm_chat?.entry_mode;
  if ((mode !== 'before_next_node' && mode !== 'after_node') ||
      (mode === 'before_next_node' && directive.kind !== 'node')) {
    return directive;
  }
  return {
    kind: 'tail_chat',
    resume: directive.kind === 'node'
      ? { kind: 'node', nodeId: directive.nodeId }
      : { kind: 'end_visit' },
  };
}

export function interpretNodeExit(node: CharacterNode): NarrativeDirective {
  const exit = resolveNodeExit(node);
  switch (exit.kind) {
    case 'next':
      return withTailChat(node, {
        kind: 'node',
        nodeId: requireNonEmptyString(exit.target, `node "${nodeLabel(node)}" next target`),
      });
    case 'observation':
      return {
        kind: 'observation',
        prompt: requireNonEmptyString(exit.prompt, `node "${nodeLabel(node)}" observation prompt`),
        continueNodeId: requireNonEmptyString(
          exit.continue_node,
          `node "${nodeLabel(node)}" observation target`,
        ),
        featureGroups: exit.feature_groups,
      };
    case 'mixing': {
      const request = getMixingRequest(exit);
      if (!request) {
        throw new Error(
          `[narrativeInterpreter] node "${nodeLabel(node)}" mixing exit is missing request`,
        );
      }
      return {
        kind: 'mixing',
        request,
        exit,
      };
    }
    case 'end_visit':
      return withTailChat(node, { kind: 'end_visit' });
    default: {
      const unsupported: never = exit;
      throw new Error(
        `[narrativeInterpreter] node "${nodeLabel(node)}" has unsupported exit ${String(unsupported)}`,
      );
    }
  }
}

export function interpretNodeCompletion(
  node: CharacterNode,
  selectedOption?: NarrativeOptionSelection,
  context: NarrativeOptionContext = {},
): NarrativeDirective {
  if (!node || typeof node !== 'object') {
    throw new Error('[narrativeInterpreter] node must be an object');
  }

  const choices = buildNarrativeChoices(node, context);
  if (choices.length === 0) {
    if (selectedOption !== undefined) {
      throw new Error(
        `[narrativeInterpreter] node "${nodeLabel(node)}" has no selectable options`,
      );
    }
    return interpretNodeExit(node);
  }

  const mode = choiceMode(node, choices);
  const completedOptionKeys = choices
    .filter(choice => choice.completed)
    .map(choice => choice.key);
  const availableChoices = choices.filter(choice => choice.available);

  if (selectedOption === undefined) {
    if (
      availableChoices.length === 0 ||
      (mode === 'inspect_all' && availableChoices.every(choice => choice.completed))
    ) {
      return interpretNodeExit(node);
    }
    return {
      kind: 'await_choice',
      mode,
      options: choices,
      completedOptionKeys,
    };
  }

  const selected = selectNarrativeChoice(node, choices, selectedOption);
  if (!selected.available) {
    throw new Error(
      `[narrativeInterpreter] node "${nodeLabel(node)}" option "${selected.key}" is unavailable`,
    );
  }
  if (selected.completed) {
    throw new Error(
      `[narrativeInterpreter] node "${nodeLabel(node)}" option "${selected.key}" is already completed`,
    );
  }

  if (mode === 'inspect_all') {
    const nextCompletedKeys = new Set([...completedOptionKeys, selected.key]);
    if (availableChoices.every(choice => nextCompletedKeys.has(choice.key))) {
      return interpretNodeExit(node);
    }
    return {
      kind: 'await_choice',
      mode,
      options: choices.map(choice => ({
        ...choice,
        completed: nextCompletedKeys.has(choice.key),
      })),
      completedOptionKeys: [...nextCompletedKeys],
    };
  }

  if (hasOwn(selected.option, 'next_node') && selected.option.next_node !== undefined) {
    if (selected.option.next_node === null) {
      return withTailChat(node, { kind: 'end_visit' });
    }
    return withTailChat(node, {
      kind: 'node',
      nodeId: requireNonEmptyString(
        selected.option.next_node,
        `node "${nodeLabel(node)}" option "${selected.key}" next target`,
      ),
    });
  }

  return interpretNodeExit(node);
}

export function createNarrativeInterpreterState(
  startNodeId: string,
): Extract<NarrativeInterpreterState, { kind: 'node' }> {
  return {
    kind: 'node',
    nodeId: requireNonEmptyString(startNodeId, 'startNodeId'),
  };
}

function stateFromDirective(
  sourceNodeId: string,
  directive: NarrativeDirective,
): NarrativeInterpreterState {
  switch (directive.kind) {
    case 'await_choice':
      return {
        kind: 'node',
        nodeId: sourceNodeId,
        completedOptionKeys: directive.completedOptionKeys,
      };
    case 'node':
      return { kind: 'node', nodeId: directive.nodeId };
    case 'tail_chat':
      return {
        kind: 'tail_chat',
        sourceNodeId,
        resume: directive.resume,
      };
    case 'observation':
      return {
        kind: 'observation',
        sourceNodeId,
        prompt: directive.prompt,
        continueNodeId: directive.continueNodeId,
        featureGroups: directive.featureGroups,
      };
    case 'mixing':
      return {
        kind: 'mixing',
        sourceNodeId,
        exit: directive.exit,
        retryCount: 0,
      };
    case 'end_visit':
      return { kind: 'end_visit', sourceNodeId };
  }
}

function requireActionType<T extends NarrativeInterpreterAction['type']>(
  state: NarrativeInterpreterState,
  action: NarrativeInterpreterAction | undefined,
  type: T,
): Extract<NarrativeInterpreterAction, { type: T }> {
  if (!action || action.type !== type) {
    throw new Error(
      `[narrativeInterpreter] state "${state.kind}" requires action "${type}"`,
    );
  }
  return action as Extract<NarrativeInterpreterAction, { type: T }>;
}

function requireExistingTarget(
  nodeMap: ReadonlyMap<string, CharacterNode>,
  nodeId: string,
  context: string,
) {
  if (!nodeMap.has(nodeId)) {
    throw new Error(
      `[narrativeInterpreter] ${context} points to missing node "${nodeId}"`,
    );
  }
}

export function stepNarrativeInterpreter(
  nodeMap: ReadonlyMap<string, CharacterNode>,
  state: NarrativeInterpreterState,
  action?: NarrativeInterpreterAction,
  environment: NarrativeInterpreterEnvironment = {},
): NarrativeInterpreterStep {
  if (!nodeMap || typeof nodeMap.get !== 'function') {
    throw new Error('[narrativeInterpreter] nodeMap must be a ReadonlyMap');
  }

  switch (state.kind) {
    case 'node': {
      const completeAction = requireActionType(state, action, 'complete_node');
      const node = nodeMap.get(state.nodeId);
      if (!node) {
        throw new Error(`[narrativeInterpreter] node "${state.nodeId}" does not exist`);
      }
      const directive = interpretNodeCompletion(node, completeAction.selectedOption, {
        availableOptionKeys: availableOptionKeysForEnvironment(node, environment),
        completedOptionKeys: state.completedOptionKeys,
      });
      const nextState = stateFromDirective(state.nodeId, directive);
      if (nextState.kind === 'node') {
        requireExistingTarget(nodeMap, nextState.nodeId, `node "${state.nodeId}"`);
      }
      return {
        state: nextState,
        directive,
      };
    }
    case 'tail_chat': {
      requireActionType(state, action, 'complete_tail_chat');
      if (state.resume.kind === 'end_visit') {
        const directive: EndVisitDirective = { kind: 'end_visit' };
        return { state: { kind: 'end_visit', sourceNodeId: state.sourceNodeId }, directive };
      }
      const directive: NodeDirective = {
        kind: 'node',
        nodeId: requireNonEmptyString(state.resume.nodeId, 'tail chat resume nodeId'),
      };
      requireExistingTarget(
        nodeMap,
        directive.nodeId,
        `tail chat from "${state.sourceNodeId}"`,
      );
      return {
        state: { kind: 'node', nodeId: directive.nodeId },
        directive,
      };
    }
    case 'observation': {
      requireActionType(state, action, 'complete_observation');
      const directive: NodeDirective = {
        kind: 'node',
        nodeId: requireNonEmptyString(state.continueNodeId, 'observation continueNodeId'),
      };
      requireExistingTarget(
        nodeMap,
        directive.nodeId,
        `observation from "${state.sourceNodeId}"`,
      );
      return {
        state: { kind: 'node', nodeId: directive.nodeId },
        directive,
      };
    }
    case 'mixing': {
      const completeAction = requireActionType(state, action, 'complete_mixing');
      if (typeof completeAction.success !== 'boolean') {
        throw new Error('[narrativeInterpreter] complete_mixing success must be a boolean');
      }
      const target = getMixingOutcomeTarget(state.exit, completeAction.success);
      const outcome = completeAction.success ? 'success' : 'fail';
      if (!target && !completeAction.success && state.exit.request.retry_on_fail) {
        const directive: MixingDirective = {
          kind: 'mixing',
          request: state.exit.request,
          exit: state.exit,
        };
        return {
          state: {
            ...state,
            retryCount: state.retryCount + 1,
          },
          directive,
        };
      }
      const directive: NodeDirective = {
        kind: 'node',
        nodeId: requireNonEmptyString(
          target,
          `mixing node "${state.sourceNodeId}" ${outcome} target`,
        ),
      };
      requireExistingTarget(
        nodeMap,
        directive.nodeId,
        `mixing ${outcome} from "${state.sourceNodeId}"`,
      );
      return {
        state: { kind: 'node', nodeId: directive.nodeId },
        directive,
      };
    }
    case 'end_visit':
      if (action !== undefined) {
        throw new Error('[narrativeInterpreter] end_visit state does not accept actions');
      }
      return {
        state,
        directive: { kind: 'end_visit' },
      };
  }
}

function stateKey(state: NarrativeInterpreterState) {
  switch (state.kind) {
    case 'node': {
      const completed = [...(state.completedOptionKeys || [])].sort().join(',');
      return `node:${state.nodeId}:${completed}`;
    }
    case 'observation':
      return `observation:${state.sourceNodeId}:${state.continueNodeId}`;
    case 'mixing':
      return `mixing:${state.sourceNodeId}:retry=${state.retryCount}`;
    case 'tail_chat':
      return `tail_chat:${state.sourceNodeId}:${state.resume.kind === 'node' ? state.resume.nodeId : 'end_visit'}`;
    case 'end_visit':
      return `end_visit:${state.sourceNodeId || ''}`;
  }
}

function stateNodeId(state: NarrativeInterpreterState) {
  return state.kind === 'node' ? state.nodeId : state.sourceNodeId;
}

function targetFromDirective(directive: NarrativeDirective) {
  switch (directive.kind) {
    case 'node':
      return directive.nodeId;
    case 'tail_chat':
      return directive.resume.kind === 'node' ? directive.resume.nodeId : undefined;
    case 'observation':
      return directive.continueNodeId;
    default:
      return undefined;
  }
}

function buildTraceEntry(
  step: number,
  state: NarrativeInterpreterState,
  action: NarrativeInterpreterAction,
  directive: NarrativeDirective,
): NarrativeTraceEntry {
  let traceAction: NarrativeTraceEntry['action'];
  let optionKey: string | undefined;

  switch (action.type) {
    case 'complete_node':
      traceAction = action.selectedOption === undefined ? 'complete_node' : 'select_option';
      optionKey =
        action.selectedOption === undefined ? undefined : String(action.selectedOption);
      break;
    case 'complete_observation':
      traceAction = 'complete_observation';
      break;
    case 'complete_mixing':
      traceAction = action.success ? 'mixing_success' : 'mixing_fail';
      break;
    case 'complete_tail_chat':
      traceAction = 'complete_tail_chat';
      break;
  }

  return {
    step,
    state: state.kind,
    nodeId: stateNodeId(state),
    action: traceAction,
    directive: directive.kind,
    optionKey,
    targetNodeId: targetFromDirective(directive),
  };
}

function validateEnumerationOptions(options: EnumerateNarrativePathsOptions) {
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  if (!Number.isInteger(maxSteps) || maxSteps <= 0) {
    throw new Error('[narrativeInterpreter] maxSteps must be a positive integer');
  }
  const strategy = options.strategy ?? 'bfs';
  if (strategy !== 'bfs' && strategy !== 'dfs') {
    throw new Error('[narrativeInterpreter] strategy must be "bfs" or "dfs"');
  }
  const maxPaths = options.maxPaths ?? DEFAULT_MAX_PATHS;
  if (!Number.isInteger(maxPaths) || maxPaths <= 0) {
    throw new Error('[narrativeInterpreter] maxPaths must be a positive integer');
  }
  const maxMixingRetries = options.maxMixingRetries ?? 1;
  if (!Number.isInteger(maxMixingRetries) || maxMixingRetries < 0) {
    throw new Error('[narrativeInterpreter] maxMixingRetries must be a non-negative integer');
  }
  const availableItemIds = options.availableItemIds?.map(itemId => (
    requireNonEmptyString(itemId, 'available item id')
  ));
  return { availableItemIds, maxMixingRetries, maxPaths, maxSteps, strategy };
}

export function enumerateNarrativePaths(
  nodeMap: ReadonlyMap<string, CharacterNode>,
  startNodeId: string,
  options: EnumerateNarrativePathsOptions = {},
): EnumeratedNarrativePath[] {
  const {
    availableItemIds,
    maxMixingRetries,
    maxPaths,
    maxSteps,
    strategy,
  } = validateEnumerationOptions(options);
  const environment: NarrativeInterpreterEnvironment = { availableItemIds };
  const startState = createNarrativeInterpreterState(startNodeId);
  if (!nodeMap.has(startState.nodeId)) {
    throw new Error(`[narrativeInterpreter] start node "${startState.nodeId}" does not exist`);
  }

  const frontier: FrontierItem[] = [{
    state: startState,
    trace: [],
    seenStateKeys: new Set([stateKey(startState)]),
    steps: 0,
  }];
  const paths: EnumeratedNarrativePath[] = [];

  const enqueueTransitions = (
    item: FrontierItem,
    transitions: Array<{ action: NarrativeInterpreterAction; result: NarrativeInterpreterStep }>,
  ) => {
    const nextItems: FrontierItem[] = [];

    transitions.forEach(({ action, result }) => {
      const nextSteps = item.steps + 1;
      const nextTrace = [
        ...item.trace,
        buildTraceEntry(nextSteps, item.state, action, result.directive),
      ];

      if (result.state.kind === 'end_visit') {
        paths.push({
          terminal: 'end_visit',
          terminalState: result.state,
          trace: nextTrace,
        });
        return;
      }

      const nextStateKey = stateKey(result.state);
      if (item.seenStateKeys.has(nextStateKey)) {
        paths.push({
          terminal: 'loop',
          terminalState: result.state,
          trace: nextTrace,
          loopStateKey: nextStateKey,
        });
        return;
      }

      if (nextSteps >= maxSteps) {
        paths.push({
          terminal: 'step_limit',
          terminalState: result.state,
          trace: nextTrace,
        });
        return;
      }

      nextItems.push({
        state: result.state,
        trace: nextTrace,
        seenStateKeys: new Set([...item.seenStateKeys, nextStateKey]),
        steps: nextSteps,
      });
    });

    if (paths.length + frontier.length + nextItems.length > maxPaths) {
      throw new Error(
        `[narrativeInterpreter] path count exceeds maxPaths ${maxPaths}; ` +
        'raise the limit only after reviewing the branch explosion',
      );
    }

    if (strategy === 'dfs') {
      frontier.push(...nextItems.reverse());
    } else {
      frontier.push(...nextItems);
    }
  };

  while (frontier.length > 0) {
    const item = strategy === 'dfs' ? frontier.pop()! : frontier.shift()!;

    switch (item.state.kind) {
      case 'node': {
        const node = nodeMap.get(item.state.nodeId);
        if (!node) {
          throw new Error(`[narrativeInterpreter] node "${item.state.nodeId}" does not exist`);
        }
        const initialDirective = interpretNodeCompletion(node, undefined, {
          availableOptionKeys: availableOptionKeysForEnvironment(node, environment),
          completedOptionKeys: item.state.completedOptionKeys,
        });
        if (initialDirective.kind === 'await_choice') {
          enqueueTransitions(
            item,
            initialDirective.options
              .filter(choice => choice.available && !choice.completed)
              .map(choice => {
              const action: NarrativeInterpreterAction = {
                type: 'complete_node',
                selectedOption: choice.key,
              };
              return {
                action,
                result: stepNarrativeInterpreter(nodeMap, item.state, action, environment),
              };
            }),
          );
        } else {
          const action: NarrativeInterpreterAction = { type: 'complete_node' };
          enqueueTransitions(item, [{
            action,
            result: stepNarrativeInterpreter(nodeMap, item.state, action, environment),
          }]);
        }
        break;
      }
      case 'tail_chat': {
        const action: NarrativeInterpreterAction = { type: 'complete_tail_chat' };
        enqueueTransitions(item, [{
          action,
          result: stepNarrativeInterpreter(nodeMap, item.state, action, environment),
        }]);
        break;
      }
      case 'observation': {
        const action: NarrativeInterpreterAction = { type: 'complete_observation' };
        enqueueTransitions(item, [{
          action,
          result: stepNarrativeInterpreter(nodeMap, item.state, action, environment),
        }]);
        break;
      }
      case 'mixing': {
        const isRetryOnlyFailure = Boolean(
          item.state.exit.request.retry_on_fail &&
          !item.state.exit.outcomes.fail,
        );
        const outcomes = isRetryOnlyFailure && item.state.retryCount >= maxMixingRetries
          ? [true]
          : [true, false];
        enqueueTransitions(
          item,
          outcomes.map(success => {
            const action: NarrativeInterpreterAction = {
              type: 'complete_mixing',
              success,
            };
            return {
              action,
              result: stepNarrativeInterpreter(nodeMap, item.state, action, environment),
            };
          }),
        );
        break;
      }
      case 'end_visit':
        paths.push({
          terminal: 'end_visit',
          terminalState: item.state,
          trace: item.trace,
        });
        break;
    }
  }

  return paths;
}
