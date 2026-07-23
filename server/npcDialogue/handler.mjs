import { compileDialogueTurnContext } from './contextCompiler.mjs';
import { buildCharacterFallback } from './fallback.mjs';
import { dialogueManifest } from './manifest.mjs';
import { runDialoguePipeline } from './pipeline.mjs';
import { requestMiniMaxNpcDialogue, MiniMaxProviderError } from './provider.mjs';
import { moderateNpcDialogueInput } from './safety.mjs';
import { validateNpcDialogueRequest } from './schema.mjs';

function safeStage(stage) {
  return {
    stage: stage.stage,
    durationMs: Number.isFinite(stage.durationMs) ? Math.max(0, stage.durationMs) : 0,
    ...(stage.usage ? { usage: {
      provider: String(stage.usage.provider || ''),
      ...(typeof stage.usage.promptTokens === 'number' ? { promptTokens: stage.usage.promptTokens } : {}),
      ...(typeof stage.usage.completionTokens === 'number' ? { completionTokens: stage.usage.completionTokens } : {}),
      ...(typeof stage.usage.totalTokens === 'number' ? { totalTokens: stage.usage.totalTokens } : {}),
      promptChars: Number(stage.usage.promptChars || 0),
      completionChars: Number(stage.usage.completionChars || 0),
    } } : {}),
  };
}

export function whitelistDialogueDiagnostics(trace) {
  if (!trace || typeof trace !== 'object') return undefined;
  return {
    sessionId: String(trace.sessionId || ''), requestId: Number(trace.requestId || 0),
    characterId: String(trace.characterId || ''), relationshipPosture: String(trace.relationshipPosture || ''),
    topicIds: [...(trace.topicIds || [])].map(String), cognition: trace.cognition,
    disclosureLevel: trace.disclosureLevel, responseMode: trace.responseMode,
    repetitionLevel: trace.repetitionLevel,
    allowedFactIds: [...(trace.allowedFactIds || [])].map(String),
    hintableFactIds: [...(trace.hintableFactIds || [])].map(String),
    protectedTopicIds: [...(trace.protectedTopicIds || [])].map(String),
    actorDraftLinesRedacted: [...(trace.actorDraftLinesRedacted || [])].map(String),
    directorVerdict: trace.directorVerdict,
    directorViolations: [...(trace.directorViolations || [])].map(String),
    finalSource: trace.finalSource, fallbackReason: trace.fallbackReason == null ? null : String(trace.fallbackReason),
    stages: [...(trace.stages || [])].map(safeStage),
  };
}

function localSafetyTrace(compilation, snapshot, reason) {
  return {
    sessionId: `W${snapshot.week}:D${snapshot.day}:G${snapshot.guestInDay}:${snapshot.guestId}`,
    requestId: snapshot.turnIndex, characterId: snapshot.guestId,
    relationshipPosture: compilation.actorContext.relationshipPosture,
    topicIds: [...compilation.decision.topicIds], cognition: compilation.decision.cognition,
    disclosureLevel: compilation.decision.disclosureLevel, responseMode: compilation.decision.responseMode,
    repetitionLevel: compilation.decision.repetitionLevel,
    allowedFactIds: compilation.actorContext.allowedFacts.map(fact => fact.id),
    hintableFactIds: compilation.actorContext.hintableFacts.map(fact => fact.id),
    protectedTopicIds: compilation.directorContext.protectedTopics.map(topic => topic.topicId),
    actorDraftLinesRedacted: [], directorVerdict: 'skipped', directorViolations: [],
    finalSource: 'local-safety', fallbackReason: `safety_${reason}`, stages: [],
  };
}

export async function handleNpcDialogueRequest(body, options = {}) {
  const manifest = options.manifest || dialogueManifest;
  const validation = validateNpcDialogueRequest(body, { manifest });
  if (!validation.ok) return { status: 400, body: { error: validation.error } };

  const { state: _state, debug: _debug, ...snapshot } = validation.value;
  const character = manifest.characters[snapshot.guestId];
  const moderation = moderateNpcDialogueInput(snapshot.playerText);
  const inputKind = moderation.reason === 'off_topic' ? 'off_topic' : 'in_world';
  const compilation = compileDialogueTurnContext(character, snapshot, { inputKind });

  if (!moderation.allowed && moderation.reason !== 'off_topic') {
    const fallback = buildCharacterFallback(character, {
      fallbackKey: `safety_${moderation.reason}`,
      endChat: compilation.decision.endChat,
      promptChars: snapshot.playerText.length,
    });
    const trace = localSafetyTrace(compilation, snapshot, moderation.reason);
    return {
      status: 200,
      body: {
        replyLines: fallback.replyLines, mood: fallback.mood, endChat: fallback.endChat, usage: fallback.usage,
        ...(options.includeDebug === true ? { diagnostics: whitelistDialogueDiagnostics(trace) } : {}),
      },
    };
  }

  if (!options.apiKey) {
    return { status: 401, body: { error: '请先填写自己的 MiniMax API Key。' } };
  }
  try {
    const result = await runDialoguePipeline({
      compilation, snapshot, apiKey: options.apiKey, signal: options.signal,
      requestModel: options.requestModel || requestMiniMaxNpcDialogue,
    });
    return {
      status: 200,
      body: {
        replyLines: result.replyLines, mood: result.mood, endChat: result.endChat, usage: result.usage,
        ...(options.includeDebug === true ? { diagnostics: whitelistDialogueDiagnostics(result.trace) } : {}),
      },
    };
  } catch (error) {
    if (error instanceof MiniMaxProviderError) return { status: error.status, body: { error: error.message } };
    return { status: 502, body: { error: '对话服务返回了无效内容。' } };
  }
}
