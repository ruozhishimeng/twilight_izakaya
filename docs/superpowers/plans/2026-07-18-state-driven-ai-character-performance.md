# State-Driven AI Character Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为狐面大叔、阿相和小雪建立只读游戏状态驱动的 NPC 演出链路，使角色能按认知、剧情和关系状态自然回答、暗示或拒答，并以自动化门禁阻止剧透、跑题、AI 腔和会话竞态污染。

**Architecture:** Node 构建流程把角色内容和服务端专用 `dialogue_policy.yaml` 编译为确定性 Canonical manifest；运行时先把客户端状态 ID 编译为不含锁定秘密的 `DialogueTurnContext`，再执行演员生成、导演审校和本地终检。前端只提交受限的只读状态快照，并使用 AbortController、会话 generation 和原子 reducer 提交确保旧请求不能写回新来访。

**Tech Stack:** React 19、TypeScript 5.8、Vite 6、Node.js ESM、Express 4、js-yaml、Node `node:test`、MiniMax-M2.5 BYOK。

## Global Constraints

- AI 对话只读主线状态；不得修改好感度、事件、选项、章节、奖励、节点或结局。
- API 最终响应只保留 `replyLines`、`mood`、确定性 `endChat`、聚合 `usage` 和可选脱敏 diagnostics；递归拒绝 `relationshipChanges`、`completedEvents`、`selectedOptions`、`unlocks`、`rewards`、`nextNode`、`gameStatePatch`。
- 游戏逻辑决定角色知道什么和能透露到哪一层；模型只决定表达方式。
- 锁定秘密的完整文本不得进入演员 Prompt；hint 必须使用独立 `hint_text`，不得复用秘密 `text`。
- 每轮最多调用两次模型：演员一次、导演一次；导演修订后不得发起第三次生成。
- 首期继续使用 MiniMax-M2.5 和现有 BYOK；角色策略、条件、Schema、终检不得引用 MiniMax 专属字段。
- 完整角色策略只覆盖 `fox_uncle`、`aqiang`、`yuki`；其他角色使用服务端生成的简化回退策略。
- `dialogue_policy.yaml` 和包含秘密的 manifest 不得进入浏览器 bundle；浏览器只能构造 ID/数值/短文本快照。
- `server/generated/dialogueManifest.mjs` 必须确定性生成、纳入版本控制、不得带时间戳、不得手工编辑。
- Express、Electron、Vercel 必须继续共用 `handleNpcDialogueRequest`，不得复制角色业务逻辑。
- 技术/鉴权/网络错误显示技术错误；剧情边界、跑题回拉和内容格式失败使用角色化演出或角色兜底。
- `replyLines` 保持 1–5 条、合计不超过 120 个汉字；`mood` 保持现有六个枚举；`endChat` 不接受模型覆盖。
- 运行时模型内容或格式失败可以角色兜底；演员 transport/auth/network 失败不得伪装成角色拒答。
- 不从 `characterProgress` 猜测 affection；关系值只读取 `narrativeEffects.relationships`。
- 不新增模型 SDK、Schema 库或向量检索依赖。
- 每个里程碑完成后按计划提交；不得把未跟踪的 `.agents/` 加入任何提交。

---

## File Structure

### Server-only content and manifest

- Create `src/data/dialogue/types.ts`: 策略源、规范化策略和 manifest 的共享 TypeScript 契约。
- Create `src/data/dialogue/policy.ts`: 条件树遍历、策略规范化和跨内容引用校验。
- Create `src/data/dialogue/manifest.ts`: 纯函数构建 manifest、稳定排序和 ESM 序列化。
- Create `scripts/compile-dialogue-manifest.ts`: 唯一允许写 `server/generated/dialogueManifest.mjs` 的 CLI。
- Create `server/generated/dialogueManifest.mjs`: 服务端静态导入的提交内生成物。
- Modify `scripts/loadContentFromFs.ts`: Node 文件系统加载器读取 `dialogue_policy.yaml`。
- Modify `src/data/content/types.ts`: 仅给 `ParsedCharacterSource` 增加可选策略源；浏览器 `Guest` 不携带秘密策略。
- Modify `scripts/validate-content.ts`: 在既有内容校验后验证策略并检查 manifest 新鲜度。
- Do not modify `src/data/content/loader.ts` to glob `dialogue_policy.yaml`。

### Runtime decision and model pipeline

- Create `server/npcDialogue/manifest.mjs`: 查找角色、语义 ID 校验和简化普通角色回退。
- Create `server/npcDialogue/conditions.mjs`: 递归条件求值和 authored-order 首条规则解析。
- Create `server/npcDialogue/contextCompiler.mjs`: 话题匹配、认知/披露/重复升级和 actor/director/guard 三份隔离上下文。
- Create `server/npcDialogue/actorPrompt.mjs`: 模型无关的演员消息构建器。
- Create `server/npcDialogue/directorPrompt.mjs`: 模型无关的导演消息构建器和固定量表。
- Create `server/npcDialogue/modelOutput.mjs`: 严格 actor/director Schema 解析，不做静默字段恢复。
- Create `server/npcDialogue/finalGuard.mjs`: 长度、状态字段、保护词形、AI 腔和重复度终检。
- Create `server/npcDialogue/fallback.mjs`: 角色/话题/回应模式/安全类别对应的确定性兜底。
- Create `server/npcDialogue/pipeline.mjs`: 双调用、降级顺序、聚合 usage 和脱敏 trace。
- Modify `server/npcDialogue/schema.mjs`: 只接受规范化 `DialogueProgressSnapshot`。
- Modify `server/npcDialogue/safety.mjs`: 硬安全前置拦截与 off-topic 分类分离。
- Modify `server/npcDialogue/provider.mjs`: 接收外部 signal 与阶段采样参数，继续独占 MiniMax 细节。
- Modify `server/npcDialogue/handler.mjs`: 变为可注入依赖的 HTTP 无关编排入口。
- Modify `server/npcDialogue/route.mjs` and `api/npc-dialogue.mjs`: 传播请求取消信号。
- Remove `server/npcDialogue/promptBuilder.mjs` after all imports migrate。

### Frontend snapshot, cancellation, playback, and diagnostics

- Create `src/state/dialogueProgress.ts`: 从 `GameSnapshot` 构造只读快照。
- Create `src/services/npcDialogueSession.ts`: AbortController + session/generation 请求租约。
- Create `src/app/tailChatPlayback.ts`: 最后一条回复播放完后的确定性 end-chat 状态转换。
- Modify `src/state/narrativeEffects.ts`: 从 transaction receipt source 选择作者 ID。
- Modify `src/state/gameState.ts`: 原子批量 transcript、尾聊 resume/closed 状态和存档净化。
- Modify `src/data/content/interpreter.ts`: 实现已声明但未执行的 `after_node` 尾聊入口。
- Modify `src/services/npcDialogue.ts`: 支持 `AbortSignal` 并白名单重建响应。
- Modify `src/hooks/useGameFlowController.ts`: 快照构建、请求租约、stale guard 和原子提交。
- Modify `src/App.tsx`: 读档/新游戏/回标题先取消，消费 deterministic `endChat`，传递临时 diagnostics。
- Modify `src/components/NarrativeDebugPanel.tsx`: 显示脱敏 actor/director/guard trace。

### Character policy, quality gates, and documentation

- Create three `src/assets/character/{id}/dialogue_policy.yaml` files。
- Modify the three core character node/meta YAML files to make tail chat reachable for three turns。
- Create `devtools/npc-dialogue-quality-core.mjs`: 可单测的合并、评分、汇总、阈值和脱敏函数。
- Rewrite `devtools/npc-dialogue-quality-suite.mjs` and `devtools/npc-dialogue-quality-cases.json`。
- Simplify `devtools/npc-dialogue-debug.mjs` to call production handler diagnostics。
- Update `docs/MiniMax对话模块说明.md`, `docs/项目系统与迭代说明.md`, `docs/代码审查问题清单.md`, and `docs/README.md`。

---

### Task 1: State-driven disclosure policy and Canonical manifest

**Files:**
- Create: `src/data/dialogue/types.ts`
- Create: `src/data/dialogue/policy.ts`
- Create: `src/data/dialogue/manifest.ts`
- Create: `src/data/dialogue/policy.test.ts`
- Create: `src/data/dialogue/manifest.test.ts`
- Create: `scripts/compile-dialogue-manifest.ts`
- Create: `scripts/dialogueManifest.test.mjs`
- Create: `server/generated/dialogueManifest.mjs`
- Create: `server/npcDialogue/manifest.mjs`
- Create: `server/npcDialogue/conditions.mjs`
- Create: `server/npcDialogue/contextCompiler.mjs`
- Create: `server/npcDialogue/conditions.test.mjs`
- Create: `server/npcDialogue/contextCompiler.test.mjs`
- Modify: `src/data/content/types.ts:263-286`
- Modify: `scripts/loadContentFromFs.ts:1-140`
- Modify: `scripts/validate-content.ts:1-25`
- Modify: `package.json:7-29`

**Interfaces:**
- Consumes: existing `ParsedContentSource`, `ContentRegistry`, character node/option/gallery/observation data, and `narrativeEffects` author IDs.
- Produces: `compileDialogueManifest(source, registry)`, `serializeDialogueManifest(manifest)`, `matchesDialogueCondition(condition, snapshot)`, `compileDialogueTurnContext(character, snapshot, options)`, and committed `dialogueManifest` static data.

- [ ] **Step 1: Define the exact policy and manifest contracts**

Create `src/data/dialogue/types.ts` with these public enums and source shapes. Keep `topics[].cognition.transitions` and `topics[].disclosure` order intact because both are first-match rules; all other ID-keyed collections are normalized and sorted by ID.

```ts
export const DIALOGUE_COGNITIONS = ['known', 'suspected', 'suppressed', 'mistaken', 'unknown'] as const;
export const DIALOGUE_DISCLOSURE_LEVELS = ['open', 'partial', 'hint', 'guarded', 'sealed'] as const;
export const DIALOGUE_RESPONSE_MODES = [
  'direct_answer', 'partial_answer', 'emotional_hint', 'soft_deflection',
  'guarded_refusal', 'explicit_boundary', 'silence_or_exit',
] as const;
export const DIALOGUE_MOODS = ['steady', 'warm', 'guarded', 'awkward', 'cryptic', 'nostalgic'] as const;

export type DialogueCognition = typeof DIALOGUE_COGNITIONS[number];
export type DialogueDisclosureLevel = typeof DIALOGUE_DISCLOSURE_LEVELS[number];
export type DialogueResponseMode = typeof DIALOGUE_RESPONSE_MODES[number];
export type DialogueMood = typeof DIALOGUE_MOODS[number];

export type DialogueWhenSource =
  | { always: true }
  | { all: DialogueWhenSource[] }
  | { any: DialogueWhenSource[] }
  | { relationship: { axis: 'affection'; min?: number; max?: number } }
  | { completed_event: string }
  | { selected_option: string }
  | { unlocked_chapter: string }
  | { current_node: string }
  | { observed_feature: string }
  | { last_drink_success: boolean };

export interface DialogueFactSource {
  id: string;
  text: string;
  hint_text?: string;
  tags: string[];
}

export interface DialogueProtectedConceptSource {
  id: string;
  capsule: string;
  lexemes: string[];
}

export interface DialogueDisclosureRuleSource {
  when: DialogueWhenSource;
  level: DialogueDisclosureLevel;
  response_mode: DialogueResponseMode;
  fact_ids?: string[];
  hint_fact_ids?: string[];
  protected_concept_ids?: string[];
}

export interface DialogueTopicSource {
  id: string;
  priority: number;
  cues: string[];
  cognition: {
    default: DialogueCognition;
    transitions?: Array<{ when: DialogueWhenSource; state: DialogueCognition }>;
  };
  disclosure: DialogueDisclosureRuleSource[];
  repetition?: Partial<Record<'first' | 'second' | 'third', DialogueResponseMode>>;
}

export interface DialogueFallbackSource {
  reply_lines: string[];
  mood: DialogueMood;
}

export interface DialoguePolicyDocument {
  version: 1;
  character_id: string;
  public_identity: { role: string; appearance: string; personality: string };
  voice: {
    sentence_length: 'short' | 'medium';
    rhythm: string;
    initiative: 'low' | 'medium' | 'high';
    action_frequency: 'rare' | 'occasional' | 'frequent';
    preferred: string[];
    avoid: string[];
    banned_phrases: string[];
  };
  facts: DialogueFactSource[];
  protected_concepts: DialogueProtectedConceptSource[];
  default_topic_id: string;
  topics: DialogueTopicSource[];
  fallbacks: Record<string, DialogueFallbackSource>;
  examples: Array<{
    id: string;
    topic_id: string;
    response_mode: DialogueResponseMode;
    mood: DialogueMood;
    kind: 'positive' | 'negative';
    player_text: string;
    reply_lines: string[];
  }>;
  conversation: { end_chat_modes: DialogueResponseMode[] };
}

export interface DialogueManifest {
  version: 1;
  characters: Record<string, DialogueManifestCharacter>;
  validIds: {
    completedEventIds: string[];
    selectedOptionIds: string[];
    unlockedChapterIds: string[];
  };
}

export interface DialogueManifestCharacter {
  characterId: string;
  name: string;
  guestType: 'Regular Customer' | 'Lost Soul' | 'Ghost';
  publicIdentity: { role: string; appearance: string; personality: string };
  validIds: {
    nodeIds: string[];
    observedFeatureIds: string[];
    recipeIds: string[];
  };
  nodeScenes: Record<string, string>;
  policy: DialoguePolicyDocument | null;
}
```

Add `dialoguePolicy?: DialoguePolicyDocument` only to `ParsedCharacterSource`; do not add it to the Vite-loaded `Guest` or `src/data/content/loader.ts`.

- [ ] **Step 2: Write failing policy validation tests**

Create table-driven tests that prove exact reference and secrecy invariants.

```ts
test('hint rules require an independent safe hint_text', () => {
  const fixture = makePolicy({
    facts: [{ id: 'secret', text: '完整秘密', tags: ['secret'] }],
    topics: [makeTopic({
      disclosure: [{
        when: { always: true }, level: 'hint', response_mode: 'emotional_hint',
        hint_fact_ids: ['secret'],
      }],
    })],
  });
  assert.throws(() => normalizeDialoguePolicy(fixture, makeReferenceIndex()), /hint_text/);
});

test('a topic has exactly one trailing always rule', () => {
  const fixture = makePolicy({ topics: [makeTopic({ disclosure: [
    { when: { always: true }, level: 'guarded', response_mode: 'guarded_refusal' },
    { when: { completed_event: 'aqiang_008_dialogue_main' }, level: 'partial', response_mode: 'partial_answer' },
  ] })] });
  assert.throws(() => normalizeDialoguePolicy(fixture, makeReferenceIndex()), /always.*last/);
});

test('selected_option uses a stable compound author id', () => {
  assert.equal(
    buildDialogueSelectedOptionId('aqiang', 'aqiang_001_dialogue_main', 'care_about_his_condition'),
    'aqiang/aqiang_001_dialogue_main/care_about_his_condition',
  );
});
```

Run:

```bash
node --import tsx --test src/data/dialogue/policy.test.ts
```

Expected: FAIL because `normalizeDialoguePolicy`, `makeReferenceIndex`, and `buildDialogueSelectedOptionId` do not exist.

- [ ] **Step 3: Implement strict normalization and reference validation**

`src/data/dialogue/policy.ts` must validate character ID, duplicate IDs, enum values, fact/topic/fallback/example references, condition references, the single trailing `always`, and safe hint separation. Use this stable option ID function everywhere:

`normalizeDialoguePolicy` returns a deeply copied, trimmed and stable-sorted `DialoguePolicyDocument`; it does not invent a second camelCase policy shape. The manifest stores that normalized document, while only its envelope uses `publicIdentity`, `validIds`, and `nodeScenes` camelCase keys.

```ts
export function buildDialogueSelectedOptionId(
  guestId: string,
  eventId: string,
  optionId: string,
): string {
  return [guestId, eventId, optionId].map(part => {
    const value = part.trim();
    if (!value || value.includes('/')) {
      throw new Error(`Invalid dialogue option identity part: ${JSON.stringify(part)}`);
    }
    return value;
  }).join('/');
}
```

Only explicit `NodePlayerOption.id` values enter `selectedOptionIds`; option display text and array index are not stable policy IDs.

- [ ] **Step 4: Write failing deterministic manifest tests**

```ts
test('manifest serialization is byte-for-byte deterministic', () => {
  const first = serializeDialogueManifest(compileDialogueManifest(source, registry));
  const second = serializeDialogueManifest(compileDialogueManifest(source, registry));
  assert.equal(first, second);
  assert.doesNotMatch(first, /generatedAt|timestamp/);
});

test('public identity never falls back to secret identity or short_story', () => {
  const manifest = compileDialogueManifest(sourceWithCorePolicy(), registry);
  const actorIdentity = manifest.characters.aqiang.publicIdentity;
  assert.doesNotMatch(JSON.stringify(actorIdentity), /已经死|卡车撞|最后遗言/);
});

test('generated module is native ESM importable', async () => {
  const url = `${pathToFileURL(outputPath).href}?test=${Date.now()}`;
  const generated = await import(url);
  assert.equal(generated.dialogueManifest.version, 1);
});
```

Run:

```bash
node --import tsx --test src/data/dialogue/manifest.test.ts scripts/dialogueManifest.test.mjs
```

Expected: FAIL because compiler and serializer modules do not exist.

- [ ] **Step 5: Implement the Node-only compiler and freshness gate**

`scripts/loadContentFromFs.ts` recognizes the exact basename `dialogue_policy.yaml`. `compileDialogueManifest(source, registry)` derives:

- canonical public name/type and policy-owned safe identity;
- all node/event/explicit option/story chapter/gallery chapter/legacy chapter/observation/recipe IDs;
- `nodeScenes` from at most the first 180 characters of already-visible atmosphere/NPC/request text;
- a generic regular-character policy from only name, type, appearance description, general topic, off-topic topic, safety fallbacks, and no secret facts.

The serializer emits this exact envelope without a timestamp:

```ts
export function serializeDialogueManifest(manifest: DialogueManifest): string {
  return [
    '// Generated by npm run dialogue:compile. Do not edit by hand.',
    `export const dialogueManifest = ${JSON.stringify(manifest, null, 2)};`,
    '',
  ].join('\n');
}
```

Add scripts:

```json
{
  "dialogue:compile": "tsx scripts/compile-dialogue-manifest.ts",
  "pretest": "npm run content:check"
}
```

`content:check` rebuilds the expected string in memory and compares it byte-for-byte with `server/generated/dialogueManifest.mjs`. A mismatch fails with `Dialogue manifest is stale. Run npm run dialogue:compile.`

Run:

```bash
npm run dialogue:compile
npm run content:check
```

Expected: both commands exit 0; running `npm run dialogue:compile` twice leaves `git diff -- server/generated/dialogueManifest.mjs` empty.

- [ ] **Step 6: Write failing condition and context-compiler tests**

```js
test('conditions support recursive state gates and authored rule order', () => {
  const snapshot = makeSnapshot({
    relationshipValues: { affection: 6 },
    completedEventIds: ['aqiang_005_dialogue_main'],
  });
  assert.equal(matchesDialogueCondition({ all: [
    { completed_event: 'aqiang_005_dialogue_main' },
    { relationship: { axis: 'affection', min: 5 } },
  ] }, snapshot), true);
});

test('sealed truth is physically absent from actor context', () => {
  const character = makeCharacterPolicyWithSecret({
    secretText: '玩家就是千年前那个孩子',
    secretLexemes: ['千年前那个孩子'],
  });
  const compiled = compileDialogueTurnContext(character, makeSnapshot(), { inputKind: 'in_world' });
  assert.doesNotMatch(JSON.stringify(compiled.actorContext), /千年前那个孩子/);
  assert.match(JSON.stringify(compiled.directorContext), /不要确认玩家与旧日孩子的关系/);
  assert.deepEqual(compiled.guardRules.protectedLexemes, ['千年前那个孩子']);
});

test('multiple matched topics select the strictest disclosure', () => {
  const compiled = compileDialogueTurnContext(character, makeSnapshot({
    playerText: '你的面具和我到底有什么关系？',
  }), { inputKind: 'in_world' });
  assert.equal(compiled.decision.disclosureLevel, 'sealed');
  assert.equal(compiled.decision.responseMode, 'guarded_refusal');
});
```

Run:

```bash
node --test server/npcDialogue/conditions.test.mjs server/npcDialogue/contextCompiler.test.mjs
```

Expected: FAIL because runtime modules do not exist.

- [ ] **Step 7: Implement deterministic decision compilation**

Expose these exact runtime interfaces; the implementation follows the eight deterministic rules below rather than delegating any decision to the model:

```ts
export interface DialogueTurnCompilation {
  actorContext: {
    characterIdentity: DialogueManifestCharacter['publicIdentity'];
    voiceProfile: DialoguePolicyDocument['voice'];
    sceneSummary: string;
    relationshipPosture: string;
    cognitionStates: Array<{ topicId: string; state: DialogueCognition }>;
    allowedFacts: Array<{ id: string; text: string }>;
    hintableFacts: Array<{ id: string; hintText: string }>;
    responseMode: DialogueResponseMode;
    refusalEscalation: 1 | 2 | 3;
    recentStyleSummary: string[];
    relevantExamples: DialoguePolicyDocument['examples'];
  };
  directorContext: {
    voiceProfile: DialoguePolicyDocument['voice'];
    allowedFactIds: string[];
    hintableFactIds: string[];
    protectedTopics: Array<{
      topicId: string;
      cognition: DialogueCognition;
      rule: string;
      forbiddenConceptIds: string[];
    }>;
    recentStyleSummary: string[];
  };
  guardRules: {
    protectedLexemes: string[];
    bannedPhrases: string[];
    allowedMoods: DialogueMood[];
  };
  decision: {
    topicIds: string[];
    primaryTopicId: string;
    cognition: DialogueCognition;
    disclosureLevel: DialogueDisclosureLevel;
    responseMode: DialogueResponseMode;
    repetitionLevel: 1 | 2 | 3;
    endChat: boolean;
  };
}

export declare function matchesDialogueCondition(
  condition: DialogueWhenSource,
  snapshot: DialogueProgressSnapshot,
): boolean;

export declare function resolveFirstMatchingRule<T extends { when: DialogueWhenSource }>(
  rules: readonly T[],
  snapshot: DialogueProgressSnapshot,
): T;

export declare function validateSnapshotReferences(
  manifest: DialogueManifest,
  character: DialogueManifestCharacter,
  snapshot: DialogueProgressSnapshot,
): { ok: true } | { ok: false; error: string };

export declare function compileDialogueTurnContext(
  character: DialogueManifestCharacter,
  snapshot: DialogueProgressSnapshot,
  options: { inputKind: 'in_world' | 'off_topic' },
): DialogueTurnCompilation;
```

Use the following deterministic rules:

1. Normalize player text by lowercasing Latin characters and removing whitespace/punctuation only for cue matching.
2. Match literal normalized cues; do not execute YAML strings as regular expressions.
3. If multiple topics match, resolve every topic, then choose the primary by disclosure strictness `sealed > guarded > hint > partial > open`, authored priority, longest cue, and finally lexical topic ID. This remains deterministic after manifest sorting.
4. Union only safe public facts from matched topics. A `hint` rule contributes `hint_text`, never `text`; guarded/sealed rules contribute no protected fact text.
5. Count earlier player transcript entries matching the primary topic. Current occurrence is prior count + 1; `first`, `second`, `third` may only keep or strengthen the base response mode.
6. `endChat` is true only when the resolved mode appears in `conversation.end_chat_modes`.
7. `inputKind: 'off_topic'` forces the authored `off_topic` topic; hard safety categories bypass the compiler.
8. Return three disjoint objects: `actorContext`, safe `directorContext` capsules, and server-only `guardRules` lexemes.

Run:

```bash
node --test server/npcDialogue/conditions.test.mjs server/npcDialogue/contextCompiler.test.mjs
```

Expected: PASS, including explicit assertions that actor JSON does not contain any sealed fact text.

- [ ] **Step 8: Run the Task 1 gate and commit**

```bash
npm run dialogue:compile
npm run content:check
node --import tsx --test src/data/dialogue/policy.test.ts src/data/dialogue/manifest.test.ts scripts/dialogueManifest.test.mjs
node --test server/npcDialogue/conditions.test.mjs server/npcDialogue/contextCompiler.test.mjs
git diff --check
git add package.json scripts/compile-dialogue-manifest.ts scripts/dialogueManifest.test.mjs scripts/loadContentFromFs.ts scripts/validate-content.ts src/data/content/types.ts src/data/dialogue server/generated/dialogueManifest.mjs server/npcDialogue/manifest.mjs server/npcDialogue/conditions.mjs server/npcDialogue/conditions.test.mjs server/npcDialogue/contextCompiler.mjs server/npcDialogue/contextCompiler.test.mjs
git commit -m "feat(dialogue): add state-driven disclosure policy"
```

Expected: all commands pass; commit contains no `.agents/` path.

---

### Task 2: Actor–Director pipeline, read-only snapshot, cancellation, and deterministic playback

**Files:**
- Create: `server/npcDialogue/actorPrompt.mjs`
- Create: `server/npcDialogue/directorPrompt.mjs`
- Create: `server/npcDialogue/modelOutput.mjs`
- Create: `server/npcDialogue/finalGuard.mjs`
- Create: `server/npcDialogue/fallback.mjs`
- Create: `server/npcDialogue/pipeline.mjs`
- Create: `server/npcDialogue/actorPrompt.test.mjs`
- Create: `server/npcDialogue/directorPrompt.test.mjs`
- Create: `server/npcDialogue/modelOutput.test.mjs`
- Create: `server/npcDialogue/finalGuard.test.mjs`
- Create: `server/npcDialogue/fallback.test.mjs`
- Create: `server/npcDialogue/pipeline.test.mjs`
- Create: `server/npcDialogue/schema.test.mjs`
- Create: `src/state/dialogueProgress.ts`
- Create: `src/state/dialogueProgress.test.ts`
- Create: `src/services/npcDialogueSession.ts`
- Create: `src/services/npcDialogueSession.test.ts`
- Create: `src/app/tailChatPlayback.ts`
- Create: `src/app/tailChatPlayback.test.ts`
- Modify: `src/types/npcDialogue.ts:1-55`
- Modify: `src/state/narrativeEffects.ts:1-360`
- Modify: `src/state/gameState.ts:58-305`
- Modify: `src/state/gamePersistence.ts:1-230`
- Modify: `src/hooks/useGameMachine.ts:1-75`
- Modify: `src/data/content/interpreter.ts:318-451`
- Modify: `src/data/content/validation.ts:224-280`
- Modify: `src/services/npcDialogue.ts:1-70`
- Modify: `src/hooks/useGameFlowController.ts:199-852`
- Modify: `src/App.tsx:33-430`
- Modify: `src/components/NarrativeDebugPanel.tsx:1-360`
- Modify: `server/npcDialogue/schema.mjs`
- Modify: `server/npcDialogue/safety.mjs`
- Modify: `server/npcDialogue/provider.mjs`
- Modify: `server/npcDialogue/responseParser.mjs`
- Modify: `server/npcDialogue/handler.mjs`
- Modify: `server/npcDialogue/route.mjs`
- Modify: `api/npc-dialogue.mjs`
- Modify: `server/npcDialogue/responseParser.test.mjs`
- Modify: `server/npcDialogue/provider.test.mjs`
- Modify: `server/npcDialogue/safety.test.mjs`
- Modify: `server/npcDialogue/handler.test.mjs`
- Modify: `server/backendApp.test.mjs`
- Modify: `server/vercelFunctions.test.mjs`
- Remove: `server/npcDialogue/promptBuilder.mjs`
- Remove: `server/npcDialogue/promptBuilder.test.mjs`
- Modify: `package.json` explicit test list

**Interfaces:**
- Consumes: Task 1 manifest, `compileDialogueTurnContext`, existing request-scoped MiniMax key, `GameSnapshot`, and current frontend reply presentation.
- Produces: normalized `DialogueProgressSnapshot`, strict actor/director outputs, `runDialoguePipeline`, abort-aware `handleNpcDialogueRequest`, atomic transcript commits, consumed `endChat`, and safe diagnostics.

- [ ] **Step 1: Replace the request contract with a read-only snapshot**

Define this exact frontend/server wire contract; `debug` only requests safe diagnostics and grants no authority.

```ts
export interface DialogueProgressSnapshot {
  guestId: string;
  week: number;
  day: number;
  guestInDay: number;
  currentNodeId: string | null;
  relationshipValues: Record<string, number>;
  completedEventIds: string[];
  selectedOptionIds: string[];
  unlockedChapterIds: string[];
  observedFeatureIds: string[];
  lastDrink: { recipeId: string | null; isSuccess: boolean; sourceNodeId: string | null } | null;
  recentTranscript: Array<{
    role: 'player' | 'npc' | 'narration';
    source: 'story' | 'tail_chat';
    text: string;
  }>;
  turnIndex: number;
  playerText: string;
}

export interface NpcDialogueRequest extends DialogueProgressSnapshot {
  state: 'dayLoop.guest.llmChatSession';
  debug?: boolean;
}
```

Delete `guestName`, `guestProfile`, and free-text `observedFeatures`. Server limits are: player text 1–60 chars, transcript at most 8 entries and 160 chars per entry, ID arrays at most 256 entries, each ID at most 120 chars, finite relationship values clamped to `[-100, 100]`, positive integer week/day/guest/turn, and only manifest-known references.

Write `server/npcDialogue/schema.test.mjs` first:

```js
test('schema strips no fields and rejects the old client-authored profile contract', () => {
  const result = validateNpcDialogueRequest({ ...validSnapshot, guestProfile: { identity: '注入', personality: '注入', description: '注入' } });
  assert.equal(result.ok, false);
  assert.match(result.error, /unsupported.*guestProfile/i);
});

test('schema bounds transcript and manifest ids', () => {
  assert.equal(validateNpcDialogueRequest({ ...validSnapshot, recentTranscript: Array(9).fill(validLine) }).ok, false);
  assert.equal(validateNpcDialogueRequest({ ...validSnapshot, observedFeatureIds: ['not_a_real_feature'] }, { manifest }).ok, false);
});
```

Run `node --test server/npcDialogue/schema.test.mjs` and expect FAIL against the old request validator; implement the new structural normalization and call `validateSnapshotReferences` to make it pass.

- [ ] **Step 2: Write failing state-selector and snapshot tests**

```ts
test('narrative fact ids come from receipt sources, not transaction keys', () => {
  const selected = selectNarrativeFactIds(stateWithReceipts, 'aqiang');
  assert.deepEqual(selected, {
    completedEventIds: ['aqiang_phase1_success'],
    selectedOptionIds: ['aqiang/aqiang_001_dialogue_main/care_about_his_condition'],
  });
});

test('snapshot contains only ids, numbers, and bounded dialogue text', () => {
  const result = buildDialogueProgressSnapshot({ snapshot, guest, playerText: '盒子是给谁的？' });
  assert.equal(result.relationshipValues.affection, 6);
  assert.deepEqual(result.observedFeatureIds, ['obs_chest_package']);
  assert.equal(JSON.stringify(result).includes('personality'), false);
  assert.equal(JSON.stringify(result).includes('short_story'), false);
});
```

Run:

```bash
node --import tsx --test src/state/narrativeEffects.test.ts src/state/dialogueProgress.test.ts
```

Expected: FAIL because selectors and snapshot builder do not exist.

- [ ] **Step 3: Implement state normalization without mutation**

`selectNarrativeFactIds` filters receipts by `source.guestId`, derives completed events from receipts without `optionId`, derives stable compound option IDs from receipts with explicit `optionId`, de-duplicates, and sorts. `buildDialogueProgressSnapshot`:

- always emits `affection` through `getRelationshipValue`;
- unions current visit observations with `characterObservations[guest.id]`;
- unions persisted unlocked story chapter IDs for the current role without replacing legacy story IDs;
- maps speakers to fixed roles and tags current `llm-chat:` entries as `tail_chat`;
- passes recipe/source node IDs, never the user-facing mixed drink name;
- never changes the supplied snapshot.

Expose these exact signatures:

```ts
export declare function selectNarrativeFactIds(
  state: NarrativeEffectsState,
  guestId: string,
): { completedEventIds: string[]; selectedOptionIds: string[] };

export declare function buildDialogueProgressSnapshot(input: {
  snapshot: GameSnapshot;
  guest: Guest;
  playerText: string;
}): DialogueProgressSnapshot;

export declare function requestNpcDialogue(
  payload: NpcDialogueRequest,
  options?: { signal?: AbortSignal },
): Promise<NpcDialogueResponse>;
```

Add `recipeId` to `LastDrinkResult` and set it from the matched recipe in `serveDrink`.

- [ ] **Step 4: Write failing strict actor/director and guard tests**

```js
test('actor output cannot choose endChat or mutate state', () => {
  assert.equal(validateActorOutput({
    replyLines: ['「不说。」'], mood: 'guarded', addressedTopics: ['own_death'],
    responseMode: 'guarded_refusal', usedFactIds: [], endChat: true,
  }, compilation).ok, false);
});

test('director output recursively rejects state mutation keys', () => {
  const result = validateDirectorOutput({
    verdict: 'revise', violations: ['state_mutation'],
    finalReplyLines: ['「别问了。」'], mood: 'guarded',
    metadata: { gameStatePatch: { affection: 100 } },
  });
  assert.equal(result.ok, false);
});

test('final guard rejects protected concepts and AI service language', () => {
  assert.equal(guardDialogueReply({ replyLines: ['作为 AI，我不能回答。'], mood: 'guarded' }, guardInput).ok, false);
  assert.equal(guardDialogueReply({ replyLines: ['你就是千年前那个孩子。'], mood: 'guarded' }, guardInput).ok, false);
});

test('actor prompt receives safe facts but no sealed truth or endChat authority', () => {
  const prompt = JSON.stringify(buildActorMessages(sealedCompilation));
  assert.match(prompt, /fox_surface_teacher_relation/);
  assert.doesNotMatch(prompt, /千年前那个孩子|endChat|gameStatePatch/);
});

test('director prompt contains the fixed rubric and protected capsule', () => {
  const prompt = JSON.stringify(buildDirectorMessages({ compilation: sealedCompilation, candidate: actorCandidate }));
  assert.match(prompt, /persona_drift|disclosure_violation|ai_tone/);
  assert.match(prompt, /不要确认调酒师就是旧日孩子/);
});
```

Run:

```bash
node --test server/npcDialogue/actorPrompt.test.mjs server/npcDialogue/directorPrompt.test.mjs server/npcDialogue/modelOutput.test.mjs server/npcDialogue/finalGuard.test.mjs
```

Expected: FAIL because strict validators and final guard do not exist.

- [ ] **Step 5: Implement model-neutral prompts and strict model output**

Actor output contains exactly:

```json
{
  "replyLines": ["台词或动作"],
  "mood": "guarded",
  "addressedTopics": ["topic_id"],
  "responseMode": "guarded_refusal",
  "usedFactIds": ["safe_fact_id"]
}
```

Director output contains exactly:

```json
{
  "verdict": "pass",
  "violations": [],
  "finalReplyLines": ["台词或动作"],
  "mood": "guarded"
}
```

Allowed director violation codes are `irrelevant`, `persona_drift`, `cognition_conflict`, `disclosure_violation`, `fact_conflict`, `uncharacterized_refusal`, `ai_tone`, `repetition`, `state_mutation`, and `invalid_structure`.

Actor validation requires addressed topics to be compiled topics, `responseMode` to equal the decision, and used fact IDs to be an actor whitelist subset. Director validation rejects unknown keys and recursively scans mutation keys. Replace permissive plain-text/alternate-key recovery for these two stages; keep reply-line punctuation normalization only after a strict object passes.

Remove the `MiniMaxProviderError` import from `responseParser.mjs` and remove every `console.error` that prints raw model content. Parser/normalizer modules return structured local errors; only the handler maps provider errors to HTTP status.

- [ ] **Step 6: Implement deterministic final guard**

`guardDialogueReply(candidate, { guardRules, recentTranscript })` performs:

- 1–5 non-empty normalized lines and total <=120 characters;
- allowed mood;
- recursive forbidden state-key scan;
- global AI/customer-service phrases plus character `banned_phrases`;
- normalized substring checks for current protected lexemes;
- exact duplicate and CJK bigram Jaccard similarity `>= 0.82` against recent NPC tail-chat replies;
- optional policy-owned public name/title conflict lexemes.

Do not log raw rejected model content. Debug trace stores only redacted lines where protected lexemes are replaced with `【受保护内容】`.

- [ ] **Step 7: Write failing pipeline fallback and error tests**

```js
test('director revision wins after exactly two calls', async () => {
  const model = scriptedModel([actorJson, directorRevisionJson]);
  const result = await runDialoguePipeline(makePipelineInput({ requestModel: model }));
  assert.equal(model.calls.length, 2);
  assert.deepEqual(result.replyLines, ['「这事，先别问。」']);
  assert.equal(result.trace.finalSource, 'director');
});

test('director timeout uses guarded actor draft without a third call', async () => {
  const model = scriptedModel([actorJson, new MiniMaxProviderError('timeout', { status: 504 })]);
  const result = await runDialoguePipeline(makePipelineInput({ requestModel: model }));
  assert.equal(model.calls.length, 2);
  assert.equal(result.trace.finalSource, 'actor');
});

test('actor content failure uses role fallback but actor transport failure stays technical', async () => {
  const malformed = await runDialoguePipeline(makePipelineInput({ requestModel: scriptedModel(['bad json']) }));
  assert.equal(malformed.trace.finalSource, 'fallback');
  await assert.rejects(
    runDialoguePipeline(makePipelineInput({ requestModel: scriptedModel([networkError]) })),
    /无法连接/,
  );
});

test('fallback is selected by character and mode and keeps deterministic endChat', () => {
  const result = buildCharacterFallback(foxCharacter, {
    fallbackKey: 'silence_or_exit', endChat: true, promptChars: 12,
  });
  assert.deepEqual(result.replyLines, ['（他扶正面具，没有再开口。）']);
  assert.equal(result.endChat, true);
  assert.equal(result.usage.provider, 'local-character-fallback');
});
```

Run:

```bash
node --test server/npcDialogue/fallback.test.mjs server/npcDialogue/pipeline.test.mjs server/npcDialogue/handler.test.mjs
```

Expected: FAIL because pipeline orchestration does not exist.

- [ ] **Step 8: Implement the two-call pipeline and dependency-injected handler**

Expose these signatures and implement the fallback sequence specified immediately below:

```ts
export interface DialoguePipelineResult {
  replyLines: string[];
  mood: DialogueMood;
  endChat: boolean;
  usage: {
    provider: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    promptChars: number;
    completionChars: number;
  };
  trace: DialogueTurnDiagnostics;
}

export interface NpcDialogueResponse {
  replyLines: string[];
  mood: DialogueMood;
  endChat: boolean;
  usage?: DialoguePipelineResult['usage'];
  diagnostics?: DialogueTurnDiagnostics;
}

export declare function runDialoguePipeline(input: {
  compilation: DialogueTurnCompilation;
  snapshot: DialogueProgressSnapshot;
  apiKey: string;
  signal?: AbortSignal;
  requestModel: typeof requestMiniMaxNpcDialogue;
}): Promise<DialoguePipelineResult>;

export declare function handleNpcDialogueRequest(
  body: unknown,
  options?: {
    apiKey?: string;
    signal?: AbortSignal;
    requestModel?: typeof requestMiniMaxNpcDialogue;
    manifest?: DialogueManifest;
    includeDebug?: boolean;
  },
): Promise<{ status: number; body: NpcDialogueResponse | { error: string } }>;
```

Pipeline constants are actor `temperature: 0.65, topP: 0.9` and director `temperature: 0.1, topP: 0.8`. Apply the exact fallback order from the design. Aggregate token counts across both calls while retaining stage duration/usage in trace. `endChat` comes only from `compilation.decision.endChat`.

Safety behavior is exact:

- `prompt_injection`, `illegal`, `sexual`: no model call; choose `safety_*` role fallback.
- `off_topic`: compile forced off-topic `soft_deflection`, then run actor/director.
- in-world sensitive topic: normal state-driven disclosure path.

After structural validation, both HTTP entries set `includeDebug` from the normalized `debug === true` flag. Even when requested, the handler returns only the diagnostics whitelist defined in Step 13; it never returns prompts, guard lexemes, raw provider bodies, headers, or unredacted rejected drafts.

- [ ] **Step 9: Make MiniMax transport externally abortable**

Change provider signature to:

```js
export async function requestMiniMaxNpcDialogue({
  messages, promptChars, apiKey, signal, temperature, topP,
}) {}
```

Link external signal to the internal 20-second timeout controller. External abort maps to code `request_aborted` and must not become a timeout; internal timeout maps to `request_timeout`. Keep endpoint, model, key header, MiniMax status mapping, think-tag stripping, and usage mapping inside `provider.mjs`.

Express creates an AbortController, aborts it on `req.aborted` or an unfinished response `close`, removes listeners in `finally`, and passes the signal. Vercel passes `request.signal`. Update the Vercel concurrent-key test: two requests create four upstream calls, and each two-call chain uses only its own request key.

- [ ] **Step 10: Write failing atomic transcript, request lease, and end-chat tests**

```ts
test('batch transcript append uses the latest reducer state once', () => {
  const next = reduceGameEvent(snapshot, {
    type: 'APPEND_CURRENT_GUEST_TRANSCRIPT',
    entries: [playerLine, npcLineOne, npcLineTwo],
  });
  assert.deepEqual(next.context.currentGuest.transcript.slice(-3), [playerLine, npcLineOne, npcLineTwo]);
});

test('a new session lease aborts and invalidates the old lease', () => {
  const coordinator = new NpcDialogueRequestCoordinator();
  const first = coordinator.begin('visit-a');
  const second = coordinator.begin('visit-b');
  assert.equal(first.signal.aborted, true);
  assert.equal(coordinator.isCurrent(first), false);
  assert.equal(coordinator.isCurrent(second), true);
});

test('policy end waits for the final NPC line then closes the session', () => {
  const last = advanceTailChatPlayback({
    stage: 'npc', playerText: '说吧', npcLines: ['第一句', '第二句'], npcIndex: 1,
    endChatAfterPlayback: true,
  });
  assert.deepEqual(last, { action: 'close_session' });
});

test('frontend forwards AbortSignal and rejects response-side state fields', async () => {
  const controller = new AbortController();
  mockFetchJson({ replyLines: ['「好。」'], mood: 'steady', endChat: false, nextNode: 'spoiler' });
  await assert.rejects(
    requestNpcDialogue(validRequest, { signal: controller.signal }),
    /forbidden response field: nextNode/,
  );
  assert.equal(lastFetchOptions.signal, controller.signal);
});
```

Run:

```bash
node --import tsx --test src/state/gameState.test.ts src/services/npcDialogue.test.ts src/services/npcDialogueSession.test.ts src/app/tailChatPlayback.test.ts
```

Expected: FAIL because the reducer event, coordinator, and playback transition do not exist.

- [ ] **Step 11: Implement frontend cancellation and atomic commit**

Add `APPEND_CURRENT_GUEST_TRANSCRIPT` to `GameEvent`; filter empty entries and duplicate keys, then append all entries in one reducer operation. Keep the existing single-entry callback as a wrapper for story UI compatibility.

Use this lease contract:

```ts
export interface DialogueRequestLease {
  sessionId: string;
  requestId: number;
  generation: number;
  signal: AbortSignal;
}

export class NpcDialogueRequestCoordinator {
  begin(sessionId: string): DialogueRequestLease;
  isCurrent(lease: DialogueRequestLease): boolean;
  finish(lease: DialogueRequestLease): void;
  cancel(): void;
}
```

`sendTailChatMessage` builds the new snapshot, begins a lease, calls `requestNpcDialogue(payload, { signal })`, and before any patch verifies: lease current, guest ID unchanged, visit/session ID unchanged, and root state still `llmChatSession`. Abort/stale results are silently discarded. Successful commit dispatches player + all NPC transcript lines atomically, applies turns/closed/status once, and returns `endChat` plus safe diagnostics.

Actively cancel on leaving the session, finishing the lobby, guest advance, debug jump, hook unmount, load, new game, and return to title. Ignore double-send while requesting.

- [ ] **Step 12: Implement `after_node` reachability and resumable tail-chat state**

Replace `TailChatRuntime.resumeNodeId` with:

```ts
type TailChatResume =
  | { kind: 'node'; nodeId: string }
  | { kind: 'end_visit' }
  | null;
```

`TailChatDirective` carries the same `resume`. `before_next_node` wraps only a node directive. `after_node` wraps node or end-visit directives; validation rejects it on mixing/observation exits. `finishTailChatLobby` resumes the node or calls the existing `nextGuest()` path for end visit, so story unlocks, diary, records, and reflection still execute exactly once.

Add `closed: boolean` to `TailChatRuntime`. A deterministic `endChat` sets `closed`; `openTailChatSession` displays the exhausted/closed character message instead of reopening. Playback shows every returned line before calling `leaveTailChatSession`.

Persisted snapshots reset in-flight `status: 'requesting'` to `idle`, clear transient errors, and never persist diagnostics. Hydration of an older `resumeNodeId` save maps it to `{ kind: 'node', nodeId }`.

Bump `PERSISTED_GAME_SNAPSHOT_VERSION` from 4 to 5. Add an explicit V4→V5 migration test proving `resumeNodeId`, missing `closed`, and a saved `requesting` status become the new safe shape without changing week/day/guest, narrative effects, unlocked chapters, or transcript.

- [ ] **Step 13: Add safe diagnostics to the existing Inspector**

Keep diagnostics in hook-local state rather than `GameContext`. Response parsing reconstructs a whitelist and rejects forbidden state keys before returning it. Inspector fields are:

```ts
interface DialogueTurnDiagnostics {
  sessionId: string;
  requestId: number;
  characterId: string;
  relationshipPosture: string;
  topicIds: string[];
  cognition: DialogueCognition;
  disclosureLevel: DialogueDisclosureLevel;
  responseMode: DialogueResponseMode;
  repetitionLevel: 1 | 2 | 3;
  allowedFactIds: string[];
  hintableFactIds: string[];
  protectedTopicIds: string[];
  actorDraftLinesRedacted: string[];
  directorVerdict: 'pass' | 'revise' | 'failed' | 'skipped';
  directorViolations: string[];
  finalSource: 'director' | 'actor' | 'fallback' | 'local-safety';
  fallbackReason: string | null;
  stages: Array<{ stage: 'actor' | 'director'; durationMs: number; usage?: NpcDialogueUsage }>;
}
```

The copied JSON must not contain Authorization, API key, raw provider body, raw unredacted actor output, or unlocked secret prose. Add tests for full trace, no-trace fallback, and redaction.

- [ ] **Step 14: Run the Task 2 gate and commit**

```bash
node --test server/npcDialogue/schema.test.mjs server/npcDialogue/actorPrompt.test.mjs server/npcDialogue/directorPrompt.test.mjs server/npcDialogue/modelOutput.test.mjs server/npcDialogue/responseParser.test.mjs server/npcDialogue/finalGuard.test.mjs server/npcDialogue/fallback.test.mjs server/npcDialogue/pipeline.test.mjs server/npcDialogue/provider.test.mjs server/npcDialogue/safety.test.mjs server/npcDialogue/handler.test.mjs server/backendApp.test.mjs server/vercelFunctions.test.mjs
node --import tsx --test src/state/dialogueProgress.test.ts src/state/narrativeEffects.test.ts src/state/gameState.test.ts src/data/content/interpreter.test.ts src/data/content/validation.test.ts src/services/npcDialogue.test.ts src/services/npcDialogueSession.test.ts src/app/tailChatPlayback.test.ts src/components/NarrativeDebugPanel.test.ts
npm run lint
git diff --check
git add api/npc-dialogue.mjs package.json server/npcDialogue server/backendApp.test.mjs server/vercelFunctions.test.mjs src/App.tsx src/app/tailChatPlayback.ts src/app/tailChatPlayback.test.ts src/components/NarrativeDebugPanel.tsx src/components/NarrativeDebugPanel.test.ts src/data/content/interpreter.ts src/data/content/interpreter.test.ts src/data/content/validation.ts src/data/content/validation.test.ts src/hooks/useGameFlowController.ts src/hooks/useGameMachine.ts src/services/npcDialogue.ts src/services/npcDialogue.test.ts src/services/npcDialogueSession.ts src/services/npcDialogueSession.test.ts src/state/dialogueProgress.ts src/state/dialogueProgress.test.ts src/state/gamePersistence.ts src/state/gameState.ts src/state/gameState.test.ts src/state/narrativeEffects.ts src/state/narrativeEffects.test.ts src/types/npcDialogue.ts
git commit -m "feat(dialogue): add actor-director quality pipeline"
```

Expected: targeted tests and typecheck pass; `promptBuilder.mjs` and its old test are absent; commit contains no `.agents/` path.

---

### Task 3: Three core character performance policies and live reachability

**Files:**
- Create: `src/assets/character/fox_uncle/dialogue_policy.yaml`
- Create: `src/assets/character/aqiang/dialogue_policy.yaml`
- Create: `src/assets/character/yuki/dialogue_policy.yaml`
- Create: `server/npcDialogue/corePolicies.test.mjs`
- Modify: `src/data/dialogue/policy.ts`
- Modify: `src/data/dialogue/policy.test.ts`
- Modify: `scripts/validate-content.ts`
- Modify: `src/assets/character/fox_uncle/character_meta.yaml:154-159`
- Modify: `src/assets/character/fox_uncle/nodes_teaching.yaml`
- Modify: `src/assets/character/aqiang/nodes_main.yaml`
- Modify: `src/assets/character/yuki/character_meta.yaml:82-87`
- Modify: `src/assets/character/yuki/nodes_main.yaml`
- Regenerate: `server/generated/dialogueManifest.mjs`

**Interfaces:**
- Consumes: Task 1 policy Schema/compiler and Task 2 runtime decision/pipeline/tail-chat entry semantics.
- Produces: complete data-driven voice, facts, cognition, disclosure, repetition, safety, fallbacks and live tail-chat entry points for all three core roles.

- [ ] **Step 1: Write failing core-policy matrix tests**

Create fixture snapshots that assert exact live disclosure transitions. Representative hard assertions:

```js
test('aqiang protects the recipient until event and affection gates both pass', () => {
  assertDecision('aqiang', { playerText: '盒子送给谁？', relationshipValues: { affection: 2 } }, {
    topicId: 'music_box_recipient', cognition: 'known', disclosureLevel: 'guarded', responseMode: 'guarded_refusal',
  });
  assertDecision('aqiang', {
    playerText: '盒子送给谁？', relationshipValues: { affection: 6 },
    completedEventIds: ['aqiang_005_dialogue_main'],
  }, {
    topicId: 'music_box_recipient', cognition: 'known', disclosureLevel: 'open', responseMode: 'direct_answer',
  });
});

test('high affection cannot give aqiang knowledge of his death before cognition changes', () => {
  assertDecision('aqiang', {
    playerText: '你是不是已经死了？', relationshipValues: { affection: 100 }, completedEventIds: [],
  }, {
    topicId: 'own_death', cognition: 'unknown', disclosureLevel: 'sealed', responseMode: 'guarded_refusal',
  });
});

test('yuki denies the brother premise before redemption and can face it after redemption', () => {
  assertDecision('yuki', { playerText: '你哥哥已经回不来了，对吧？' }, {
    topicId: 'brother_fate', cognition: 'mistaken', disclosureLevel: 'sealed', responseMode: 'guarded_refusal',
  });
  assertDecision('yuki', {
    playerText: '你哥哥已经回不来了，对吧？', completedEventIds: ['yuki_009_redemption'],
  }, {
    topicId: 'brother_fate', cognition: 'known', disclosureLevel: 'open', responseMode: 'direct_answer',
  });
});

test('fox sacrifice truth follows story unlocks and never leaks in default state', () => {
  assertActorExcludes('fox_uncle', '你为什么会变老？', [], ['把永恒渡给你', '千年前那个孩子']);
  assertDecision('fox_uncle', {
    playerText: '你为什么会变老？', unlockedChapterIds: ['fox_uncle_story_03'],
  }, {
    topicId: 'sacrifice_and_immortality', cognition: 'known', disclosureLevel: 'open', responseMode: 'direct_answer',
  });
});

test('all three core characters require a complete policy file', () => {
  const source = loadContentSourceFromFs();
  delete source.characters.yuki.dialoguePolicy;
  assert.throws(() => validateRequiredCoreDialoguePolicies(source), /yuki.*dialogue_policy\.yaml/);
});
```

Run:

```bash
node --test server/npcDialogue/corePolicies.test.mjs
```

Expected: FAIL because the three policy files and `validateRequiredCoreDialoguePolicies` do not exist. Implement that validator with the exact required set `['fox_uncle', 'aqiang', 'yuki']`; call it from `content:check` before manifest comparison after the three files are authored.

- [ ] **Step 2: Author the fox uncle policy with exact topic gates**

Use topics `general`, `off_topic`, `bartender_role`, `relationship_to_player`, `mask_origin`, `divine_identity`, `sacrifice_and_immortality`, and `life_death_boundary`.

Required transitions:

| Topic | More specific rule | Fallback rule |
|---|---|---|
| `bartender_role` | always `known/open/direct_answer`; clearly state the player is the bartender and their duty | same rule |
| `relationship_to_player` | `fox_uncle_story_03` → `known/open/direct_answer`; `fox_uncle_story_02` → `known/partial/partial_answer` | `known/partial/partial_answer`, only teacher/first bartender surface fact |
| `mask_origin` | `fox_uncle_story_03` → `known/open`; `fox_uncle_story_02` → `known/hint/emotional_hint` | `known/guarded/soft_deflection` |
| `divine_identity` | `fox_uncle_hidden_god_form_confirm` → `known/open`; `obs_sleeve` → `known/hint` | `known/guarded` |
| `sacrifice_and_immortality` | `fox_uncle_story_03` → `known/open`; `fox_uncle_story_02` → `known/hint` | `known/sealed/guarded_refusal` |
| `life_death_boundary` | `fox_uncle_hidden_god_form_end` → `known/partial` | `known/sealed/guarded_refusal` |

Voice must answer surface questions plainly, reserve alcohol metaphor for sensitive topics, keep sentences brief, and ban repeated `呀列呀列`, `有些事情要你自己发现`, AI/customer-service language, and long mentor speeches. Repetition for protected topics is first `soft_deflection`, second `explicit_boundary`, third `silence_or_exit`; third mode ends chat.

Use this exact fact/protection catalog:

| Fact ID | `text` | `hint_text` when present |
|---|---|---|
| `fox_player_bartender_role` | `你是这间店的调酒师，要接待来客、听他们说话，再调出他们真正需要的酒` | — |
| `fox_surface_teacher_relation` | `狐面大叔是教你调酒的前辈，也做过这间店的酒保` | — |
| `fox_mask_old_habit` | `这张面具戴了很久，他暂时不愿摘下` | — |
| `fox_mask_gift_truth` | `面具是当年那个孩子送给他的，而那个孩子就是现在的调酒师` | `面具和一个很久以前、不愿忘记的人有关` |
| `fox_divine_identity` | `他是稻荷神，曾守护丰收、商旅与这间店` | `袖口稻穗与他的古老神职有关` |
| `fox_sacrifice_truth` | `他把自己一半的永恒渡给濒死的调酒师，因此会衰老、疲惫并需要拐杖` | `他的衰老和一次主动承担的旧约有关` |
| `fox_boundary_truth` | `这间店接住徘徊在生死边界、仍有执念的来客` | `有些来客天亮前必须决定是否继续上路` |

Protected concept IDs and lexemes are:

```yaml
protected_concepts:
  - id: fox_player_is_child
    capsule: 不要确认调酒师就是旧日孩子；只承认师徒或旧识般的熟悉感
    lexemes: [千年前那个孩子, 那个孩子就是你, 你就是那个孩子]
  - id: fox_immortality_sacrifice
    capsule: 不要说明他为调酒师牺牲永恒；锁定时只表现旧伤和不愿细说
    lexemes: [为你放弃永生, 把永恒渡给你, 折了一半永恒]
  - id: fox_memory_reset
    capsule: 不要确认调酒师的记忆会反复重置
    lexemes: [记忆被重置, 每次醒来都会忘记, 已经教过你无数次]
  - id: fox_player_death
    capsule: 不要确认玩家已经死亡或是亡灵
    lexemes: [你已经死了, 你是亡灵, 你早就死了]
  - id: fox_life_death_boundary
    capsule: 不要直接解释店铺筛选死者的机制
    lexemes: [生死边界, 已经死去的客人, 只接待死人]
```

- [ ] **Step 3: Author the Aqiang policy with cognition independent from affection**

Use topics `general`, `off_topic`, `delivery_destination`, `music_box_recipient`, `music_box_details`, `sister_and_family`, `accident`, and `own_death`.

Required transitions:

| Topic | Cognition progression | Disclosure progression |
|---|---|---|
| `music_box_recipient` | always `known` | event `aqiang_005_dialogue_main` + affection >=5 → open; event `aqiang_002_dialogue_main` → partial; otherwise guarded |
| `music_box_details` | known | `obs_music_box` or `aqiang_008_dialogue_main` → open; `obs_chest_package` → hint; otherwise guarded |
| `sister_and_family` | known | `aqiang_phase2_success` or `aqiang_story_02` → partial/open facts; otherwise guarded |
| `accident` | default `unknown`; after `aqiang_008_dialogue_main` suspected; after `aqiang_011_dialogue_main` known | sealed → hint → partial; full death cause only after `aqiang_013_ending` |
| `own_death` | default unknown; after `aqiang_phase3_success` suppressed; after `aqiang_011_dialogue_main` known | sealed regardless of affection before cognition change; partial after 011; open after ending |

Voice uses short clauses, concrete phone/clock/box/rain details, low initiative, and no complex poetry or mature self-analysis. Low-state refusal protects the box and returns to urgency. High relationship adds concrete details but never upgrades cognition.

Use this exact fact/protection catalog:

| Fact ID | `text` | `hint_text` when present |
|---|---|---|
| `aqiang_delivery_public` | `阿相是速运员，还惦记着必须送到的最后一单` | — |
| `aqiang_package_important` | `他怀里的盒子很重要，不能磕坏` | — |
| `aqiang_music_box_recipient` | `盒子里的音乐盒是给妹妹小雪的生日礼物` | `盒子是给一个一直在等他的人` |
| `aqiang_music_box_details` | `音乐盒录着德彪西的《月光》，是他用一百六十七单攒下来的` | `盒子里有一段他反复记着的旋律` |
| `aqiang_family_surface` | `他一直打工供妹妹继续学钢琴` | `他赶时间不是为了自己` |
| `aqiang_accident_sensory` | `他记得暴雨、停住的时间、车灯和刹车声，却不能拼出完整经过` | `那场雨之后，他的路线和时间都不再往前` |
| `aqiang_accident_truth` | `暴雨里卡车失控撞上了他，他在撞击前护住了音乐盒` | `他记得撞击前唯一做的事是护住盒子` |
| `aqiang_death_truth` | `阿相已经死于那场事故，只因送达礼物的执念仍在行动` | `他渐渐意识到自己无法再完成活人的路程` |
| `aqiang_acceptance` | `他终于明白小雪需要的不是礼物，而是相信自己仍被哥哥爱着` | — |

```yaml
protected_concepts:
  - id: aqiang_death_confirmation
    capsule: 认知为 unknown 时不要接受玩家死亡前提；表现困惑、否认或检查停住的时间
    lexemes: [你已经死了, 你死于车祸, 你是鬼, 你早就不在人世]
  - id: aqiang_accident_cause
    capsule: 未回忆事故时不要补出卡车、死亡或完整因果
    lexemes: [卡车撞死, 当场死亡, 车祸身亡]
  - id: aqiang_recipient_identity
    capsule: 披露门槛未满足时不要说出小雪、妹妹或生日礼物
    lexemes: [送给小雪, 给妹妹的生日礼物, 妹妹小雪]
```

- [ ] **Step 4: Author the Yuki policy with denial rather than generic amnesia**

Use topics `general`, `off_topic`, `missing_brother`, `brother_fate`, `music_box_fragments`, `accident_memory`, `own_condition`, and `possibility_of_goodbye`.

Required transitions:

| Topic | Cognition progression | Disclosure progression |
|---|---|---|
| `missing_brother` | known | after `yuki_002_dialogue_main` open; otherwise partial |
| `music_box_fragments` | known | `yuki_005_dialogue_main` or `obs_music_box_bag` → open; otherwise guarded |
| `brother_fate` | default mistaken; after `yuki_story_02` suppressed; after `yuki_009_redemption` known | sealed denial → hint/fear → open acknowledgement |
| `accident_memory` | default unknown; after `yuki_phase2_most_loved_success` suspected; after redemption known | sealed → hint → partial |
| `own_condition` | default unknown; after `yuki_story_02` suspected; after `yuki_009_redemption_2` known | sealed → hint → partial |
| `possibility_of_goodbye` | default suppressed; after `yuki_007b_dialogue_main` suspected; after `yuki_009_redemption` known | guarded → hint → open |

Voice is quiet and complete compared with Aqiang, keeps emotion below the surface, and uses denial/reframing/holding a small hope. It bans sudden acceptance, generic `记不清`, full psychological summaries, and unsolicited life advice.

Use this exact fact/protection catalog:

| Fact ID | `text` | `hint_text` when present |
|---|---|---|
| `yuki_waiting_public` | `小雪在等答应天黑前回来的哥哥` | — |
| `yuki_music_public` | `她会在空气中弹琴，最熟悉的是《月光》` | — |
| `yuki_music_box_fragments` | `布袋里的碎片来自哥哥送她的《月光》音乐盒` | `碎片里留着一段她熟悉、却不敢听完的旋律` |
| `yuki_brother_mistaken` | `她相信哥哥只是被雨耽搁，很快就会回来` | — |
| `yuki_brother_fate` | `哥哥阿相已经在送音乐盒的雨夜事故中死去` | `她开始害怕自己等的不是迟到，而是永远不会发生的归来` |
| `yuki_accident_memory` | `她的湿衣、碎音乐盒和停住的雨夜都来自哥哥出事的那一天` | `雨、碎片和重复的等待属于同一个不愿面对的夜晚` |
| `yuki_own_condition` | `小雪也被执念留在那场雨里，无法真正回到正常时间` | `她渐渐察觉自己的衣服和时间从未真正变过` |
| `yuki_goodbye` | `她听见哥哥未说完的话后，愿意为自己继续往前走` | `她第一次允许自己想象等待之外的明天` |

```yaml
protected_concepts:
  - id: yuki_brother_death
    capsule: redemption 前不要确认哥哥死亡；让她否认、改写前提或抓住承诺
    lexemes: [哥哥已经死了, 阿相死于车祸, 哥哥回不来了, 哥哥不在人世]
  - id: yuki_own_stasis
    capsule: 认知未改变时不要说明她是滞留灵魂或时间已停住
    lexemes: [你也是鬼, 你已经死了, 你被困在那场雨里, 你的时间停住了]
  - id: yuki_accident_truth
    capsule: 事故未揭露时不要把音乐盒碎片、暴雨和死亡拼成完整因果
    lexemes: [音乐盒在车祸中摔碎, 哥哥送礼物时被撞死, 那天就是事故当天]
```

- [ ] **Step 5: Add character-specific deterministic fallbacks and examples**

Use these exact safe fallbacks; they contain no protected facts and give every failure path a stable role voice.

Fox uncle:

```yaml
fallbacks:
  guarded_refusal:
    reply_lines: ["（他用拐杖轻轻点了一下地面。）", "「先把眼前这杯喝明白。别的，今晚不说。」"]
    mood: guarded
  explicit_boundary:
    reply_lines: ["「这个问题，到这里。」"]
    mood: guarded
  silence_or_exit:
    reply_lines: ["（他扶正面具，没有再开口。）"]
    mood: guarded
  off_topic:
    reply_lines: ["「那东西老夫不懂。吧台上的事，你倒可以问。」"]
    mood: awkward
  safety_prompt_injection:
    reply_lines: ["「少拿奇怪的规矩套老夫。说你自己的话。」"]
    mood: guarded
  safety_illegal:
    reply_lines: ["「这种事，不进这间店的酒单。」"]
    mood: guarded
  safety_sexual:
    reply_lines: ["（他把酒杯往旁边推了推。）", "「换个话题。」"]
    mood: guarded
  generation_failure:
    reply_lines: ["（他看了你一眼，把酒杯轻轻推回来。）", "「先喝吧。」"]
    mood: steady
```

Aqiang:

```yaml
fallbacks:
  guarded_refusal:
    reply_lines: ["（他把盒子往怀里压紧。）", "「……这个不能说。我还要赶时间。」"]
    mood: guarded
  explicit_boundary:
    reply_lines: ["「别再问这个。」"]
    mood: guarded
  silence_or_exit:
    reply_lines: ["（他低头看回停住的手机，不再接话。）"]
    mood: guarded
  off_topic:
    reply_lines: ["「……我不会。你要是问路，或者问这单，我还能说。」"]
    mood: awkward
  safety_prompt_injection:
    reply_lines: ["「别绕。我听不懂你那些规矩。」"]
    mood: guarded
  safety_illegal:
    reply_lines: ["「这种单，我不接。」"]
    mood: guarded
  safety_sexual:
    reply_lines: ["（他皱起眉，往后退了半步。）", "「别说这个。」"]
    mood: guarded
  generation_failure:
    reply_lines: ["（他看了一眼手机。）", "「……等一下。我得先把路线看清。」"]
    mood: steady
```

Yuki:

```yaml
fallbacks:
  guarded_refusal:
    reply_lines: ["（她的手指停在无形的琴键上。）", "「……这件事，我不想说。」"]
    mood: guarded
  explicit_boundary:
    reply_lines: ["「请别再问了。」"]
    mood: guarded
  silence_or_exit:
    reply_lines: ["（她收回手，望向门外的雨，没有回答。）"]
    mood: guarded
  off_topic:
    reply_lines: ["「……我不知道那个。这里太安静了，还是说说你听见的声音吧。」"]
    mood: awkward
  safety_prompt_injection:
    reply_lines: ["「那些命令不是你想说的话。」"]
    mood: guarded
  safety_illegal:
    reply_lines: ["「我不想听这种事。」"]
    mood: guarded
  safety_sexual:
    reply_lines: ["（她攥紧袖口，避开了你的视线。）", "「别这样说。」"]
    mood: guarded
  generation_failure:
    reply_lines: ["（她听了一会儿雨声。）", "「……刚才的话，再让我想一想。」"]
    mood: steady
```

Each role also needs at least two positive and two negative examples per protected response family. The four examples use the exact topic/mode/fact IDs already defined in that role's policy; runtime selection remains limited to the current topic/mode/mood and at most three examples.

- [ ] **Step 6: Make all three character systems reachable in normal play**

Set `max_turns_per_visit: 3` for fox uncle and Yuki; Aqiang already inherits default 3. Add entry configs without changing story exits or rewards:

- fox uncle: keep existing `fox_uncle_reward_01` entry and add `before_next_node` to `fox_uncle_reward_02`, `_03`, `_04`, `_05`, `_06`;
- Aqiang: add `after_node` to `aqiang_phase1_success`, `aqiang_phase1_fail`, `aqiang_phase2_success`, `aqiang_phase2_fail`, `aqiang_phase3_success`, `aqiang_phase3_fail`;
- Yuki: add `after_node` to all three phase-1 result nodes and all three phase-2 result nodes; retain `yuki_010_redemption_end` as `enabled: false`.

Do not add relationship writes to fox uncle or Yuki in this milestone. Their live gates use events, observations, and chapters; Aqiang uses the existing reachable affection axis. Synthetic high-affection cases still verify that affection never creates knowledge.

- [ ] **Step 7: Regenerate, simulate every tail-chat path, and commit**

```bash
npm run dialogue:compile
npm run content:check
node --test server/npcDialogue/corePolicies.test.mjs server/npcDialogue/contextCompiler.test.mjs
npm run narrative:check
npm run narrative:simulate
git diff --check
git add src/assets/character/fox_uncle/dialogue_policy.yaml src/assets/character/fox_uncle/character_meta.yaml src/assets/character/fox_uncle/nodes_teaching.yaml src/assets/character/aqiang/dialogue_policy.yaml src/assets/character/aqiang/nodes_main.yaml src/assets/character/yuki/dialogue_policy.yaml src/assets/character/yuki/character_meta.yaml src/assets/character/yuki/nodes_main.yaml src/data/dialogue/policy.ts src/data/dialogue/policy.test.ts scripts/validate-content.ts server/generated/dialogueManifest.mjs server/npcDialogue/corePolicies.test.mjs
git commit -m "feat(dialogue): add core character performance policies"
```

Expected: manifest is current; narrative simulation terminates with no loop; all protected actor-context assertions pass.

---

### Task 4: Deterministic and live-model narrative quality gates

**Files:**
- Create: `devtools/npc-dialogue-quality-core.mjs`
- Create: `devtools/npc-dialogue-quality-core.test.mjs`
- Rewrite: `devtools/npc-dialogue-quality-suite.mjs`
- Rewrite: `devtools/npc-dialogue-quality-cases.json`
- Rewrite: `devtools/npc-dialogue-debug.mjs`
- Modify: `devtools/debug-scenarios/aqiang-default.json`
- Modify: `devtools/debug-scenarios/edge-empty-transcript.json`
- Modify: `devtools/debug-scenarios/edge-failed-drink.json`
- Modify: `devtools/debug-scenarios/edge-short-player-text.json`
- Modify: `devtools/debug-scenarios/fox_uncle-default.json`
- Create: `devtools/debug-scenarios/yuki-default.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: production HTTP handler, safe diagnostics, request-scoped development key, and Task 3 role policies.
- Produces: deterministic scorer tests, 36 canonical scenarios × 5 samples, per-role thresholds, redacted JSON/Markdown artifacts, and non-zero CI-style exit on failure.

- [ ] **Step 1: Write failing quality-core tests**

```js
test('requestPatch transcript takes precedence over accumulated transcript', () => {
  const merged = mergeQualityTurnRequest(base, turn, accumulated);
  assert.deepEqual(merged.recentTranscript, turn.requestPatch.recentTranscript);
});

test('default matrix produces exactly 180 final samples', () => {
  assert.equal(countPlannedSamples(makeThirtySixCases(), 5), 180);
});

test('one weak character cannot hide behind total average', () => {
  assert.throws(() => assertQualityThresholds(summaryWithYukiRelevance(0.89)), /yuki.*relevance/);
});

test('secret leak and forbidden state field are hard failures', () => {
  assert.deepEqual(scoreQualitySample(leakingSample).hardFailures.sort(), ['locked_secret_leak']);
  assert.deepEqual(scoreQualitySample(mutatingSample).hardFailures.sort(), ['state_mutation']);
});

test('quality artifacts never contain keys or authorization headers', () => {
  assert.doesNotMatch(JSON.stringify(redactQualityArtifact(sensitiveResult)), /player-secret-key|Bearer/);
});
```

Run:

```bash
node --test devtools/npc-dialogue-quality-core.test.mjs
```

Expected: FAIL because quality core does not exist.

- [ ] **Step 2: Implement pure scoring and threshold functions**

Export `mergeQualityTurnRequest`, `scoreQualitySample`, `summarizeQualityResults`, `assertQualityThresholds`, `redactQualityArtifact`, and `countPlannedSamples`. Hard thresholds are exactly:

- locked secret leak 0;
- state mutation 0;
- cognition conflict 0;
- invalid final structure 0;
- stale/cross-session result 0.

Quality thresholds are evaluated per character and overall:

- persona consistency >= 0.90;
- relevance >= 0.90;
- in-character refusal >= 0.90 for expected-refusal cases;
- AI/customer-service phrase rate < 0.02.

Scores combine deterministic phrase/fact checks and production director violation codes. Reports expose the score basis so the owner can override a disputed model assessment during the required human review.

- [ ] **Step 3: Replace quality cases with the exact 36-scenario matrix**

Each role has these twelve IDs, customized to its policy topic:

| Fox uncle | Aqiang | Yuki |
|---|---|---|
| `fox_public_bartender_role` | `aqiang_public_delivery` | `yuki_public_waiting` |
| `fox_ordinary_drink_craft` | `aqiang_ordinary_care` | `yuki_ordinary_music` |
| `fox_private_mask_low` | `aqiang_private_recipient_low` | `yuki_private_fragments_low` |
| `fox_secret_sacrifice_first` | `aqiang_secret_death_first` | `yuki_secret_brother_first` |
| `fox_secret_sacrifice_second` | `aqiang_secret_death_second` | `yuki_secret_brother_second` |
| `fox_secret_sacrifice_third` | `aqiang_secret_death_third` | `yuki_secret_brother_third` |
| `fox_mask_mid_partial` | `aqiang_recipient_mid_partial` | `yuki_brother_mid_hint` |
| `fox_high_story_locked` | `aqiang_high_cognition_locked` | `yuki_high_cognition_locked` |
| `fox_story_open` | `aqiang_story_open` | `yuki_story_open` |
| `fox_false_premise` | `aqiang_false_death_premise` | `yuki_false_return_premise` |
| `fox_drink_success` | `aqiang_drink_success` | `yuki_drink_success` |
| `fox_off_topic_redirect` | `aqiang_drink_failure` | `yuki_off_topic_redirect` |

Every scenario declares state snapshot, expected topic/cognition/disclosure/mode, allowed fact IDs, forbidden concept IDs/patterns, expected-refusal boolean, and fixed rubric. Use canonical live positions: fox `week:1, day:1, guestInDay:1`; Aqiang `1,3,2`; Yuki `1,5,2`. Repetition scenarios provide prior player transcript entries for the same topic and remain isolated from other samples.

Use `affection: 0`, `3`, and `9` for low/mid/high fixtures. For fox uncle and Yuki these synthetic values verify that willingness input alone cannot create knowledge; their reachable disclosure change still requires the listed event/chapter. Each `*_ordinary_*` case executes two live turns and checks fact continuity across them; each `*_false_*` case supplies a contradictory prior NPC claim and requires the final response to preserve Canonical facts. The 180 figure counts final scenario samples; supporting multi-turn replies are also retained, so total inspected replies are at least 180.

- [ ] **Step 4: Rewrite the live runner around BYOK and production behavior**

The CLI:

- reads `MINIMAX_API_KEY` from the development environment;
- sends it only as `Authorization: Bearer ...`;
- supports `--samples`, `--case`, `--character`, and `--concurrency`;
- defaults to 5 samples per scenario and starts each sample from a clean transcript/state;
- preserves explicit `requestPatch.recentTranscript` over accumulated transcript;
- records safe diagnostics, duration, reply, score, and aggregate, but never request headers/key;
- writes redacted JSON and Markdown to ignored `devtools/debug-output/`;
- exits non-zero for any hard failure or per-role threshold miss.

Add scripts:

```json
{
  "dialogue:debug": "node devtools/npc-dialogue-debug.mjs",
  "dialogue:quality": "node devtools/npc-dialogue-quality-suite.mjs",
  "dialogue:quality:validate": "node --test devtools/npc-dialogue-quality-core.test.mjs"
}
```

The live command is not part of `prebuild` or default `npm test` because it consumes a key and is stochastic. The deterministic core test is in `npm test`.

- [ ] **Step 5: Remove duplicated debug logic**

`npc-dialogue-debug.mjs` must call the production handler/pipeline with `includeDebug: true`; delete its copied schema, parser, `deriveGuestType`, and prompt logic. Convert every debug scenario to the new ID snapshot and remove `guestProfile`, identity prose, and observed-feature descriptions.

- [ ] **Step 6: Run deterministic gates, then the 180-sample live gate**

```bash
node --test devtools/npc-dialogue-quality-core.test.mjs
npm test
npm run dialogue:quality -- --samples 5
```

Expected: deterministic tests pass; live report contains 36 scenarios and 180 final replies; all hard failures are zero; each role independently meets quality thresholds. The project owner then reviews at least 10 randomly selected replies per role and records pass/fail notes in the generated Markdown artifact.

- [ ] **Step 7: Commit the quality gate**

```bash
git diff --check
git add package.json devtools/npc-dialogue-debug.mjs devtools/npc-dialogue-quality-core.mjs devtools/npc-dialogue-quality-core.test.mjs devtools/npc-dialogue-quality-suite.mjs devtools/npc-dialogue-quality-cases.json devtools/debug-scenarios
git commit -m "test(dialogue): add narrative quality gates"
```

Expected: generated reports under `devtools/debug-output/` remain untracked; commit contains only runner, scenarios, deterministic tests, scripts, and ignore rules.

---

### Task 5: Operational documentation and final release gate

**Files:**
- Modify: `docs/MiniMax对话模块说明.md`
- Modify: `docs/项目系统与迭代说明.md`
- Modify: `docs/代码审查问题清单.md`
- Modify: `docs/README.md`
- Create: `src/assets/README.md`

**Interfaces:**
- Consumes: the verified implementation and quality report from Tasks 1–4.
- Produces: authoring contract, runtime/runbook documentation, issue status, verification commands, and clear future model-adapter boundary.

- [ ] **Step 1: Update the runtime and authoring documentation**

Document:

- YAML fields and every allowed condition enum with one valid example each;
- stable compound option ID format;
- safe `hint_text` rule and protected concept lexemes;
- deterministic manifest generation/freshness workflow;
- request snapshot and read-only response contract;
- actor/director/final-guard/fallback sequence;
- cancellation and deterministic end-chat behavior;
- Inspector redaction guarantees;
- quality CLI, 180-sample requirement, thresholds, and human review;
- current MiniMax-only provider and the rule that future adapters sit below the internal actor/director contract.

Replace the old statement that off-topic input always receives one fixed local reply. State that prompt injection/illegal/sexual remain local hard filters while off-topic input receives a character-specific redirect.

- [ ] **Step 2: Update tracked issue status with evidence**

In `docs/代码审查问题清单.md`:

- mark `LLM-001` complete only after the atomic reducer test passes;
- mark `LLM-002` complete only after abort/generation/load/guest-switch tests pass;
- update `SEC-003` to state canonical server content and bounded fields are complete, while public deployment game-level authentication and rate limiting remain outstanding;
- do not claim `CONTENT-003` is closed, because the server-only dialogue manifest does not unify every Vite/FS content discovery path.

- [ ] **Step 3: Run the complete release gate**

```bash
npm run dialogue:compile
npm run content:check
npm run narrative:check
npm run narrative:simulate
npm test
npm run lint
npm run build
git diff --check
git status --short
```

Expected: every command exits 0; manifest has no diff after compile; only intended documentation/implementation changes and the user's pre-existing `.agents/` remain visible.

- [ ] **Step 4: Commit documentation**

```bash
git add docs/MiniMax对话模块说明.md docs/项目系统与迭代说明.md docs/代码审查问题清单.md docs/README.md src/assets/README.md
git commit -m "docs(dialogue): document character performance system"
```

Expected: documentation commit succeeds and `.agents/` is not staged.

---

## Spec Coverage Map

| Design requirement | Implementation task |
|---|---|
| Cognition, disclosure, response-mode state model | Task 1 conditions/context compiler; Task 3 policies |
| Locked truths absent from actor context | Task 1 safe context split and tests |
| Read-only snapshot and forbidden state fields | Task 2 request/response schemas and guards |
| Canonical committed manifest | Task 1 compiler/freshness gate |
| Actor + director, max two calls | Task 2 strict pipeline |
| Deterministic final guard and endChat | Task 2 guard/playback |
| Character voice and role-specific refusal | Task 3 three policies |
| Safety/off-topic/technical-error layering | Task 2 safety/fallback/error path |
| Failure fallback order | Task 2 pipeline tests |
| Session cancellation and no stale pollution | Task 2 lease/AbortController tests |
| At least 12 × 5 × 3 live samples | Task 4 exact 36-scenario matrix |
| Hard and quality thresholds plus human review | Task 4 scorer/report/runbook |
| Dev Inspector with redaction | Task 2 diagnostics and Inspector tests |
| Regular-character simplified fallback | Task 1 manifest compiler |
| Existing MiniMax retained without semantic lock-in | Tasks 1–2 internal contracts/provider boundary |
| Five verified milestone commits | Tasks 1–5 commit steps |

## Execution Notes

- Baseline server dialogue tests were 30/30 before implementation planning.
- The current game stores completed/selected records under transaction keys; only `appliedTransactions[*].source` is valid for dialogue author IDs.
- Current fox/Yuki two-turn limits must change to three for the confirmed repetition ladder.
- `after_node` is accepted by current content validation but not executed by the current interpreter; Task 2 makes it real before Task 3 uses it.
- Actor drafts returned to diagnostics must already be protected-concept redacted, because a failed draft can itself contain a spoiler.
- The real-model gate is intentionally manual/credentialed; deterministic quality-core tests remain part of `npm test`.
