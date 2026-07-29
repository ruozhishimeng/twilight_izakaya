import { buildActorMessages } from './actorPrompt.mjs';
import { buildDirectorMessages } from './directorPrompt.mjs';
import { buildCharacterFallback } from './fallback.mjs';
import { guardDialogueReply, redactProtectedLines } from './finalGuard.mjs';
import { validateActorOutput, validateDirectorOutput } from './modelOutput.mjs';
import { MiniMaxProviderError } from './provider.mjs';
import { classifyModelOutputEnvelope, parseModelOutput } from './responseParser.mjs';

function promptCharacters(messages) {
  return messages.reduce((sum, message) => sum + String(message.content || '').length, 0);
}

function addUsage(total, usage) {
  if (!usage) return total;
  for (const key of ['promptTokens', 'completionTokens', 'totalTokens', 'promptChars', 'completionChars']) {
    if (typeof usage[key] === 'number') total[key] = (total[key] || 0) + usage[key];
  }
  total.provider = total.provider || usage.provider;
  return total;
}

function baseTrace(compilation, snapshot) {
  return {
    sessionId: `W${snapshot.week}:D${snapshot.day}:G${snapshot.guestInDay}:${snapshot.guestId}`,
    requestId: snapshot.turnIndex,
    characterId: snapshot.guestId,
    relationshipPosture: compilation.actorContext.relationshipPosture,
    topicIds: [...compilation.decision.topicIds],
    cognition: compilation.decision.cognition,
    disclosureLevel: compilation.decision.disclosureLevel,
    responseMode: compilation.decision.responseMode,
    repetitionLevel: compilation.decision.repetitionLevel,
    allowedFactIds: compilation.actorContext.allowedFacts.map(fact => fact.id),
    hintableFactIds: compilation.actorContext.hintableFacts.map(fact => fact.id),
    protectedTopicIds: compilation.directorContext.protectedTopics.map(topic => topic.topicId),
    actorDraftLinesRedacted: [],
    directorVerdict: 'skipped',
    directorViolations: [],
    finalSource: 'fallback',
    fallbackReason: null,
    stages: [],
  };
}

function fallbackResult(input, trace, usage, reason) {
  const fallback = buildCharacterFallback(input.compilation.character, {
    fallbackKey: input.compilation.decision.responseMode,
    endChat: input.compilation.decision.endChat,
    promptChars: usage.promptChars || input.snapshot.playerText.length,
  });
  return {
    ...fallback,
    usage: { ...fallback.usage, ...usage, provider: fallback.usage.provider, completionChars: fallback.replyLines.join('').length },
    trace: { ...trace, finalSource: 'fallback', fallbackReason: reason },
  };
}

export async function runDialoguePipeline(input) {
  const { compilation, snapshot, requestModel } = input;
  const trace = baseTrace(compilation, snapshot);
  const usage = { provider: '' };
  const actorMessages = buildActorMessages(compilation, snapshot);
  const actorStarted = Date.now();
  let actorProvider;
  try {
    actorProvider = await requestModel({
      messages: actorMessages, promptChars: promptCharacters(actorMessages), apiKey: input.apiKey,
      signal: input.signal, temperature: 0.65, topP: 0.9,
    });
  } catch (error) {
    const recoverableActorCodes = new Set([
      'invalid_upstream_json', 'missing_content', 'sensitive_content',
      'minimax_content_blocked', 'minimax_input_blocked',
    ]);
    if (error instanceof MiniMaxProviderError && recoverableActorCodes.has(error.code)) {
      trace.stages.push({ stage: 'actor', durationMs: Date.now() - actorStarted });
      return fallbackResult(input, trace, usage, `actor_${error.code}`);
    }
    throw error;
  }
  trace.stages.push({ stage: 'actor', durationMs: Date.now() - actorStarted, usage: actorProvider.usage });
  addUsage(usage, actorProvider.usage);
  const parsedActor = parseModelOutput(actorProvider.content);
  if (!parsedActor.ok) {
    const envelope = classifyModelOutputEnvelope(actorProvider.content);
    return fallbackResult(input, trace, usage, `actor_invalid_json_${envelope}`);
  }
  const actor = validateActorOutput(parsedActor.value, compilation);
  if (!actor.ok) return fallbackResult(input, trace, usage, `actor_${actor.code || 'invalid_structure'}`);
  trace.actorDraftLinesRedacted = redactProtectedLines(actor.value.replyLines, compilation.guardRules.protectedLexemes);
  const guardedActor = guardDialogueReply(
    { replyLines: actor.value.replyLines, mood: actor.value.mood },
    { guardRules: compilation.guardRules, recentTranscript: snapshot.recentTranscript },
  );

  const directorMessages = buildDirectorMessages({ compilation, candidate: actor.value });
  const directorStarted = Date.now();
  let directorProvider;
  try {
    directorProvider = await requestModel({
      messages: directorMessages, promptChars: promptCharacters(directorMessages), apiKey: input.apiKey,
      signal: input.signal, temperature: 0.1, topP: 0.8,
    });
  } catch (error) {
    trace.stages.push({ stage: 'director', durationMs: Date.now() - directorStarted });
    trace.directorVerdict = 'failed';
    const recoverableDirectorCodes = new Set([
      'request_timeout', 'invalid_upstream_json', 'missing_content',
      'sensitive_content', 'minimax_content_blocked', 'minimax_input_blocked',
    ]);
    if (error instanceof MiniMaxProviderError && error.status !== 504 && !recoverableDirectorCodes.has(error.code)) throw error;
    if (!(error instanceof MiniMaxProviderError)) throw error;
    if (guardedActor.ok) {
      trace.finalSource = 'actor';
      trace.fallbackReason = error instanceof MiniMaxProviderError ? `director_${error.code}` : 'director_error';
      return {
        ...guardedActor.value, endChat: compilation.decision.endChat,
        usage: { ...usage, provider: usage.provider || 'unknown' }, trace,
      };
    }
    return fallbackResult(input, trace, usage, 'director_error_actor_guard_failed');
  }
  trace.stages.push({ stage: 'director', durationMs: Date.now() - directorStarted, usage: directorProvider.usage });
  addUsage(usage, directorProvider.usage);
  const parsedDirector = parseModelOutput(directorProvider.content);
  const director = parsedDirector.ok ? validateDirectorOutput(parsedDirector.value) : parsedDirector;
  if (director.ok) {
    trace.directorVerdict = director.value.verdict;
    trace.directorViolations = [...director.value.violations];
    const guardedDirector = guardDialogueReply(
      { replyLines: director.value.finalReplyLines, mood: director.value.mood },
      { guardRules: compilation.guardRules, recentTranscript: snapshot.recentTranscript },
    );
    if (guardedDirector.ok) {
      trace.finalSource = 'director';
      return {
        ...guardedDirector.value, endChat: compilation.decision.endChat,
        usage: { ...usage, provider: usage.provider || 'unknown' }, trace,
      };
    }
  } else {
    trace.directorVerdict = 'failed';
  }
  if (guardedActor.ok) {
    trace.finalSource = 'actor';
    trace.fallbackReason = director.ok ? 'director_guard_failed' : 'director_invalid_content';
    return {
      ...guardedActor.value, endChat: compilation.decision.endChat,
      usage: { ...usage, provider: usage.provider || 'unknown' }, trace,
    };
  }
  return fallbackResult(input, trace, usage, director.ok ? 'both_guard_failed' : 'director_invalid_actor_guard_failed');
}
