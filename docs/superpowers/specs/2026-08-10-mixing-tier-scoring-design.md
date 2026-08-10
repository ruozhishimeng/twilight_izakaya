# 《黄昏居酒屋》调酒判定去卡关化 + 分级反馈设计

- 日期：2026-08-10
- 状态：已确认，待制定实施计划
- 关联问题清单条目：`CONTENT-005`（旧剧情规划遗留问题）之外新增 `MIX-001`，见 `docs/代码审查问题清单.md`
- 关联既有说明：`docs/项目系统与迭代说明.md` 2.2-C「调酒结果仍偏硬匹配」

## 1. 背景

当前调酒判定（`useGameFlowController.ts` 的 `serveDrink`）是精确配方 ID 数组比对：玩家选择的原料集合必须与 `preferred_drink.formula` 完全一致（排序后逐项相等）才算成功，否则触发 `retry_on_fail`，把玩家留在调酒界面重新选择。

这带来两个核心问题：

1. **硬墙式失败**：调酒本质是"考试对答案"，不是"实验-反馈"。玩家没有信息来源能可靠猜出配方，只能试错，试错代价是卡在原地重来。
2. **数据未被使用**：`src/assets/recipes/recipes.json` 中每个原料（49 种）和每个配方（42 个）都已经标注了 `tag1`（日式/西式/通用）、`tag2`（米香/苦涩/烟熏等 16 种风味）、`emotion_tag`/`emotion_tags`（怀旧/孤独/释然等 26 种情绪），但判定逻辑完全没有使用这些标签，只做 ID 精确匹配。

调酒是本作以"调酒师读懂客人"为核心情感主题的游戏机制，现状与主题脱节。

## 2. 目标

首期必须实现：

1. 调酒永远产出一杯酒，不存在因判定失败被打回重做的硬性卡关。
2. 判定标准对玩家可见：客人台词中划出的关键词就是评价依据，不是隐藏算法。
3. 判定结果分为多档（`perfect` / `good` / `off`），影响客人当次反应文案与图鉴解锁，而非单一二元成功/失败。
4. 现有三位主角（阿相、狐面大叔、雪）的既有精确配方内容零改动，自动获得新行为。
5. 判分逻辑抽成独立纯函数，具备完整单元测试，填补当前 `MixingPhase`/`useGameFlowController` 零测试覆盖的缺口。
6. `serveDrink` 不再是揉合"解析节点 + 配方比对 + 图鉴查找 + 重试判断 + 状态写入 + 状态迁移"六件事的单一函数，拆分为可独立理解的小函数。

## 3. 首期非目标

以下内容明确不进入本次改动：

1. 不修改 `narrativeEffects.ts` 中 `RelationshipChangeEffect` 的消费逻辑或数值权重——好感度是否/如何驱动剧情推进，是独立的后续项目（当前游戏靠固定日程 `schedule.yaml` + 角色 `current_phase` 手动步进，不靠好感度）。
2. 不修改 `schedule.yaml` 的调度方式，不改变 NPC 回访逻辑。
3. 不修改 `character_meta.yaml` 的章节推进（`current_phase`/`pending_phase`）方式。
4. `trait` 类型请求的"结构性修饰符"（如"烈的"）本次只实现 1-2 个示例，不构建完整词表；后续内容迭代按需扩充。
5. 不引入新的持久化好感度效果；`good`/`off` 档位只影响当次拜访内的文案表现和图鉴解锁判断，这两者都是复用现有机制（`isNewRecipe` 式解锁），不是新系统。

## 4. 核心原则

### 4.1 请求文本即判定标准，标准对玩家可见

不存在"玩家看不到、只能靠猜"的判定依据。客人台词（`request_text`）中该被高亮的子串通过新增的 `highlight` 字段显式声明，前端在 `PixelDialogueBox` 中渲染为醒目样式，判定标准和玩家读到的文本是同一份数据。

### 4.2 判定分三种请求类型

- **`named`（点名型）**："我要一杯xxx" —— 直接对应 `preferred_drink.formula`，是现有内容的默认行为（`kind` 缺省即为 `named`，保证零迁移成本）。
- **`trait`（修饰型）**："要烈的xxx" —— 不指定精确配方，而是给出 `required_tags`（引用配方/原料已有的 `tag1`/`tag2`/`emotion_tag`），判定看标签命中程度，不看 ID 是否一致。
- **`open`（自由型）**："什么都可以" —— 无硬性要求，恒定 `perfect` 档，`highlight` 直接标出这几个字。

### 4.3 永不卡关

`serveDrink` 处理任意原料组合都会推进到 `dayLoop.guest.result`，不存在"没通过，请重新选择"的分支。`shouldRetryMixingFailure` 函数与其所有调用点整体删除，不保留死代码路径。

### 4.4 失败也是内容，不是死胡同

`off` 档位不是"什么都不给"，而是仍然生成一杯酒（`drinkLabel` 照常计算），且可以命中配方库中特意设计的"意外配方"（黑暗料理类），通过现有 `isNewRecipe` 图鉴解锁路径收录。这是复用现有机制，不是新增系统。

## 5. 数据模型改动

`src/data/content/types.ts` 中 `DrinkRequestSource` 新增字段：

```ts
export interface DrinkRequestSource {
  mode?: string;
  request_text?: string;
  hint?: string;
  retry_on_fail?: boolean;       // 保留字段但判定逻辑不再读取，见 §6.3
  preferred_drink?: PreferredDrinkSource;
  eval_branches?: DrinkRequestEvalBranches;

  // 新增：
  kind?: 'named' | 'trait' | 'open';   // 缺省 'named'
  highlight?: string;                   // request_text 中要高亮的原文子串
  required_tags?: string[];             // kind: 'trait' 时使用，引用 tag1/tag2/emotion_tag 值
}
```

`NarrativeMixingOutcomes` 从 `{success, fail}` 扩展为：

```ts
export interface NarrativeMixingOutcomes {
  success: string | null;   // perfect 档使用
  good?: string | null;     // 缺省回退到 success
  fail: string | null;      // off 档使用
}
```

不新增独立的 `perfect`/`off` 键名，复用 `success`/`fail` 语义（perfect→success, off→fail），避免所有既有内容和测试同时改名；只新增中间档 `good`。

## 6. 判分引擎

新建 `src/data/content/mixingScore.ts`，不依赖 React、不依赖游戏状态，输入输出均为纯数据：

```ts
export type MixingTier = 'perfect' | 'good' | 'off';

export interface MixingScoreResult {
  tier: MixingTier;
  matchedRecipeId: string | null;
  drinkLabel: string;
}

export function scoreMixing(
  request: DrinkRequestSource | null,
  selectedIngredientIds: string[],
  recipeCatalog: RecipeCatalog,
): MixingScoreResult
```

### 6.1 判分规则

- `request` 为空或 `kind` 缺省/为 `'named'`：
  - 与 `preferred_drink.formula` 排序后完全一致 → `perfect`
  - 标签重合度（选中原料的 tag1/tag2/emotion_tag 并集，与目标配方标签集合的交集比例）达到阈值（首期定为 ≥ 0.5）→ `good`
  - 否则 → `off`
- `kind: 'trait'`：
  - `required_tags` 全部命中（选中原料标签并集是 `required_tags` 的超集）→ `perfect`
  - 部分命中（交集非空）→ `good`
  - 完全不命中 → `off`
- `kind: 'open'`：恒定 `perfect`

### 6.2 配方匹配与命名

无论 tier 为何，`scoreMixing` 都会用选中原料的精确 ID 组合去查 `recipeCatalog`（现有 `contentRegistry.recipes.recipes` 逻辑原样迁移到此文件）：命中已知配方则 `matchedRecipeId` 有值、`drinkLabel` 用配方名；未命中则 `matchedRecipeId` 为 `null`、`drinkLabel` 回退到 `formatMixedDrinkLabel`（原料名拼接，已有函数，不改动）。

### 6.3 `retry_on_fail` 字段处理

类型上保留 `retry_on_fail?: boolean` 字段（避免要求内容作者同步删除所有旧节点里的这个键，属于兼容性保留），但 `serveDrink` 和 `scoreMixing` 都不再读取它。`shouldRetryMixingFailure` 函数删除。

## 7. `serveDrink` 拆分（对应无上帝函数原则）

现状 `serveDrink`（`useGameFlowController.ts:470-550`，约 80 行）内联完成：①解析当前调酒节点（`asMixingNode`/`getNextExitTarget` 的 `||` 链）②配方精确比对 ③扫描 recipe catalog 找匹配 ④图鉴解锁判断 ⑤重试判断 ⑥patch state ⑦transition。

拆分后：

- `resolveActiveMixingNode(teachingNode, mixingNode): CharacterNode | null` —— 迁入 `src/app/narrativeRouting.ts`，把①的三元 `||` 链收敛为具名函数，独立可测。
- `scoreMixing(...)`（§6）接管 ②③，`serveDrink` 内不再有 formula 比对或 recipe catalog 扫描的内联代码。
- `serveDrink` 收敛为线性流程：`resolveActiveMixingNode` → `getMixingRequest` → `scoreMixing` → `resolveMixingOutcomeNode`（改造为按 tier 取值，见下）→ `patchContext`/`patchCurrentGuest` → `transition`。每一步是对已抽出函数的调用。

`resolveMixingOutcomeNode` 签名从 `(mixingNode, success: boolean)` 改为 `(mixingNode, tier: MixingTier)`，内部按 `perfect→success`、`good→(good ?? success)`、`off→fail` 取值。

## 8. UI 改动

- `MixingPhase.tsx`：`buildPlayerPrompt` 渲染时，若 `mixingRequest.highlight` 存在且是 `request_text`/`hint` 的子串，用醒目样式（复用现有 `PixelDialogueBox` 的强调文本能力，若无则新增一个 inline `<mark>` 级别的样式类）包裹该子串。
- `ResultPhase`（未在本次审查中细读具体实现，实施阶段需要先读该组件）按 `tier` 呈现不同客人反应文案/表情：`perfect` 惊喜、`good` 将就着喝完还吐槽两句、`off` 也喝了但明显不对味。首期这些反应文本是**静态多档文案**，不接入好感度数值变化，不产生 §3 之外的持久效果。

## 9. 测试

- `mixingScore.test.ts`：覆盖三种 `kind`、边界标签重合度、未命中配方回退 `drinkLabel`、`open` 恒定 `perfect`。
- `narrativeRouting.test.ts`（已存在同名文件，追加用例）：`resolveActiveMixingNode` 的教学节点/普通节点/无节点分支。
- `useGameFlowController.ts` 中 `serveDrink` 相关逻辑因已拆分为纯函数，主要测试压力转移到上述两个纯函数测试上，不要求对 `serveDrink` 本身做 React hook 集成测试（现状也没有）。

## 10. 提交与文档边界

按可独立验证的里程碑提交，参照本项目既有约定（见 `docs/superpowers/specs/2026-07-18-...` §21 的先例）：

1. `feat(mixing): extend drink request schema with kind/highlight/required_tags`（仅类型定义，不改行为）
2. `feat(mixing): add scoreMixing pure function`（新文件 + 单测，不接入调用方）
3. `refactor(mixing): extract resolveActiveMixingNode`（从 `serveDrink` 抽出，行为不变）
4. `feat(mixing): wire scoreMixing into serveDrink, remove retry-on-fail lockstep`（接入 + 删除 `shouldRetryMixingFailure`）
5. `feat(mixing): highlight request keywords in MixingPhase`
6. `feat(mixing): tiered guest reaction copy in ResultPhase`
7. `docs(mixing): cross-reference design spec in issue list and iteration notes`

每步提交前运行：

- `npm run content:check`
- `npm run narrative:check`
- `npm test`（至少覆盖新增/改动文件对应的定向测试）

最终提交前完整运行 `npm run lint`、`npm run build`。

## 11. 已确认的设计决策

1. 调酒不再有硬性失败，只有分档反馈。
2. 判定依据（`highlight`）对玩家可见，不是隐藏算法。
3. `named`/`trait`/`open` 三种请求类型，`named` 为兼容默认值，现有内容零改动。
4. 本次不涉及好感度驱动剧情推进的系统重构，好感度消费端保持现状。
5. `serveDrink` 必须拆分为可独立理解的小函数，不在原地叠加新逻辑。
6. 设计文档与问题清单、迭代说明文档交叉引用，保持可追溯。

## 12. 补充说明：与纯解释器（`interpreter.ts`）的边界

写实施计划阶段发现 `src/data/content/narrative.ts` 的 `getMixingOutcomeTarget(exit, success: boolean)` 同时被两处调用：

- `src/app/narrativeRouting.ts`（本次改动的对象，供真实游戏流程 `serveDrink` 使用）
- `src/data/content/interpreter.ts`（纯路径解释器，供 `narrative:check`/`narrative:simulate` CLI 与内容校验使用，独立于真实游戏流程）

`retry_on_fail` 字段在 `interpreter.ts` 的 `enumerateNarrativePaths` 中驱动着一段独立的重试型路径枚举逻辑（用于 fox_uncle 六个只有 `retry_on_fail: true`、没有 `outcomes.fail` 的教学节点），这段逻辑校验的是"内容结构是否会死循环/死锁"，与运行时判定档位无关。

明确边界：本次改动**不修改** `narrative.ts` 的 `getMixingOutcomeTarget` 签名或实现，也不修改 `interpreter.ts`/`simulator.ts`。§7 中 `resolveMixingOutcomeNode` 签名从 `(mixingNode, success: boolean)` 改为 `(mixingNode, tier: MixingTier)` 后，其内部直接读取 `mixingNode` 解析出的 `exit.outcomes.{success,good,fail}`，不再调用 `getMixingOutcomeTarget`——因此该共享函数对 `interpreter.ts` 的既有布尔语义完全不受影响，`interpreter.test.ts`、`scripts/simulate-narrative.test.mjs` 无需改动即应继续通过。
