# 好感度驱动剧情推进 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current fixed-visit progression (single-week `schedule.yaml` + hardcoded `start_node`, soft-lock after W1 per FLOW-002) with affection-driven chapter progression: each guest's affection (半心制, 0–10 points = 5 hearts, half-heart resolution) gates which chapter their visit plays. Affection grows via story choices/event outcomes (existing `relationship.change` mechanism) and via mixing tiers (new). A guest whose affection is below the next chapter's threshold does NOT get bounced back to an old chapter — the story pointer pauses at the chapter door with a hand-written `paused_node` scene ("话没说出口"), followed by a drinkable daily-flow visit, so affection can still grow and the story resumes when the threshold is met. Unlocked chapters never re-lock (只进不退, sticky facts). Existing fully-authored but currently-unreachable chapter content (aqiang phases 2–4, yuki phases 2–3, the bulk of the 44 CONTENT-005 UNREACHABLE_MAIN_NODE warnings) gets wired to these gates.

**Architecture:** The single source of truth for chapter→start_node→threshold→paused_node mapping is a new `chapters` table in `character_meta.yaml` (validated at content:check time). A new runtime function `resolveStartNodeForVisit(guest, context)` (in `flowHelpers.ts` or a new small module) picks the highest eligible chapter (threshold met OR sticky fact present, AND `need_event` prerequisites satisfied), recording the sticky unlock fact on first entry, else returns the schedule default (chapter 1) — never blocking a visit. `trigger_condition` gains a `need_affection?: { axis?, min }` field (validated; invisible to interpreter/simulator per the existing do-not-touch boundary). `serveDrink` emits a visit-scoped `relationship.change` transaction per mixing node (perfect +1 / good 0 / off −1 half-hearts). The weekly schedule loops (W2 reuses W1 data) so guests return and affection can accumulate. `graph.ts` treats chapter `start_node`s as conditionally-reachable pseudo-entries (no UNREACHABLE warning, tracked as conditional), dropping the 44 warnings to ~15. Affection axis range changes −100..100 → 0..10 (half-hearts), with existing authored aqiang effect amounts migrated to half-heart integers (validation enforces integer amounts).

**Tech Stack:** React + TypeScript + Vite, `node --import tsx --test` + `node:assert/strict` for unit tests, YAML-authored content through `src/data/content/*`, Tailwind for styling. The game is a narrative bartending sim (黄昏居酒屋) on React+Vite+Electron.

## Global Constraints

- **半心制（pure half-heart scale）**：好感值范围 0–10 点 = 满级 5 心；最小存储/显示单位是半心（1 点 = 1 半心）；任何时刻值与增量都是 0–10 整数（半心不变式）；GUI 显示像素心形（满级 ♥♥♥♥♥）。
- **停顿不后退（pause, never regress）**：好感不足时剧情指针停在当前章节门前，播放该章 `paused_node` 停顿场景 + 可点酒日常流程；**永不把玩家丢回已看过的章节**，永不阻止开始访问。
- **只进不退（sticky unlocks）**：已解锁章节是已记录 fact，数值下降不回锁。
- **复用现有机制**：好感存储/事务/幂等/fact 全部用 `narrativeEffects.ts` 既有能力；不新造存储；`PERSISTED_GAME_SNAPSHOT_VERSION` 保持 5。
- **章节表为唯一权威**：章节→start_node→min_affection→paused_node 映射以 `character_meta.yaml` 的 `chapters` 表为准，运行时与校验都读它。
- **调酒三档影响好感**：perfect +1 / good 0 / off −1（半心），visit 作用域幂等，所有访客生效；与既有 `on_complete` 剧情效果并存（不改写既有内容）。
- **剧情选择/事件结果影响好感**：复用现有 `relationship.change`；aqiang 既有 6 处迁移为半心整数；yuki 按需补 1–2 处（规划阶段定）。
- **接线 aqiang 第 2–4 章 + yuki 第 2–3 章**：作者已写好的不可达章节接入好感门，CONTENT-005 的 44 条 warning 降至约 15（以实际 run 为准，文档如实记录新计数）。
- **do-not-touch 边界**：不修改 `interpreter.ts`/`simulator.ts`；`need_affection`/`chapters` 对它们不可见。
- **无上帝函数**：章节解析、调酒好感、图可达性各自成小函数，单测覆盖。
- 每步提交前运行 `npm run content:check`、`npm run narrative:check`、`npm test`；最终提交前完整 `npm run lint`、`npm run build`。
- 新增测试文件必须手动追加到 `package.json` 的 `test` 脚本硬编码字符串中。

---

## Task 1: 心制轴迁移 + 调酒三档好感事务（半心制地基）

**Files:**
- Modify: `src/state/narrativeEffects.ts`（`DEFAULT_RELATIONSHIP_AXES` 的 affection 轴 min/max 从 −100..100 改为 0..10）
- Modify: `src/state/narrativeEffects.test.ts`（既有断言随轴范围更新）
- Modify: `src/data/content/validation.ts`（`validateNarrativeEffectDeclarations`：`amount` 必须是整数，即半心不变式）
- Modify: `src/data/content/effects.ts`（新增调酒三档事务编译函数，或复用 `compileNodeCompletionNarrativeTransaction` 变体）
- Modify: `src/hooks/useGameFlowController.ts`（`serveDrink` 在得 tier 后发出 visit 作用域 `relationship.change` 事务，target `self`，axis `affection`，事务 id = `visit/{visitId}/{guestId}/{mixingNodeId}`，perfect +1 / good 0 / off −1）
- Modify: `src/assets/character/aqiang/nodes_main.yaml`（6 处 `relationship.change` amount 迁移为半心整数：+4→+1、+3→+1、+2→+1、+1→+0、−1→−0）
- Test: `src/state/narrativeEffects.test.ts`、`src/hooks/useGameFlowController.test.ts`（或对应测试文件）追加调酒事务用例

**Interfaces:**
- Produces: 好感轴 0..10；调酒三档好感事务；amount 整数校验。

**验收：** 每次到访每调酒节点恰好应用一次调酒好感事务（visit 作用域幂等）；perfect +1 / good 0 / off −1；aqiang 既有效果迁移后断言更新；全门禁通过。

## Task 2: `trigger_condition.need_affection` + `chapters` 表 + 校验

**Files:**
- Modify: `src/data/content/types.ts`（`NodeTriggerCondition` 加 `need_affection?: { axis?: string; min: number }`；`character_meta` 相关类型加 `chapters?: ChapterTable`）
- Modify: `src/data/content/validation.ts`（`need_affection` 校验：min 有限数、axis 已注册、半心整数；`chapters` 表校验：结构/存在性/paused_node 存在性/start_node 为 main 组/与节点 need_affection 交叉一致）
- Modify: `src/assets/character/aqiang/character_meta.yaml` + `yuki/character_meta.yaml`（新增 `chapters` 表：aqiang ch2(4)/ch3(6)/ch4(8)，yuki ch2/ch3）
- Modify: `src/assets/character/*/nodes_main.yaml`（章节 start_node 声明一致的 `trigger_condition.need_affection`）
- Test: `src/data/content/validation.test.ts` 追加

**Interfaces:**
- Produces: `need_affection` 门 + `chapters` 表 + 校验。

**验收：** 非法 need_affection/chapters/交叉不一致 → content:check 报错；aqiang/yuki 表合法。

## Task 3: `resolveStartNodeForVisit` + 周循环 + 图可达性（章节接线运行时）

**Files:**
- Modify: `src/data/content/flowHelpers.ts` 或新模块（`resolveStartNodeForVisit(guest, context)`：从高到低找首个可解锁章节 → 记录 sticky fact → 返回 start_node；否则返回 schedule 默认）
- Modify: `src/state/gameSelectors.ts`（`startNodeId` 解析处接入该函数）
- Modify: `src/data/content/selectors.ts` / `flowHelpers.ts`（`findScheduledVisit`/`getScheduleDay` 对 week 取模回绕，W2 复用 W1 数据）
- Modify: `src/data/content/graph.ts`（`analyzeNarrativeGraph` 将章节 `start_node` 视为条件可达伪起点，不产生 UNREACHABLE，计入 conditional）
- Modify: `scripts/check-narrative.ts` 或输出侧（新增「conditional-reachable via chapters」统计）
- Test: `resolveStartNodeForVisit` 单测 + graph 可达性测试

**Interfaces:**
- Produces: 到访起始节点按好感动态解析；周循环；章节条件可达。

**验收：** 未达阈值→默认 start（第 1 章）；达标→章节 start；sticky（解锁后数值降仍解锁）；need_event 前置不满足→回落；周循环后 W2 照常来客；44 warning → 约 15（如实记录）；全门禁通过。

## Task 4: 停顿场景 + 日常点酒流程 + 内容接线（aqiang 2–4 章 / yuki 2–3 章）

**Files:**
- Modify: `src/assets/character/aqiang/nodes_main.yaml`（新增 3 个 paused_node：`aqiang_004_gate_paused`/`007`/`010`，各含停顿演出 + 日常点酒流程 + 收尾，next_node 指向日常流程）
- Modify: `src/assets/character/yuki/nodes_main.yaml`（新增 2 个 paused_node：`yuki_004_gate_paused`/`007`；按需给 yuki 选择补 1–2 处半心效果）
- Modify: `src/assets/character/aqiang/character_meta.yaml` + `yuki/character_meta.yaml`（chapters 表配好 paused_node）
- Modify: `docs/代码审查问题清单.md`（CONTENT-005 状态/计数更新；MIX-001 关联记录）
- Test: content:check 覆盖新节点

**Interfaces:**
- Produces: 5 个停顿场景 + yuki 选择效果。

**验收：** 未达标到访播放停顿场景 → 可点酒日常流程 → 收尾；达标后剧情续上；content:check 通过。

## Task 5: 好感度 UI（像素心形）+ 文档收尾

**Files:**
- Modify: `src/components/*`（新增好感度心形显示，满级 ♥♥♥♥♥，半心向下取整显示；挂到 NPC 头部/档案/对话界面）
- Modify: `docs/superpowers/specs/2026-08-12-affection-driven-progression-design.md`（若实现有偏差，如实记录）
- Modify: `docs/代码审查问题清单.md`（FLOW-002 软锁标记解决；CONTENT-005 计数如实更新）
- Test: 组件测试（若存在）或手动冒烟记录

**Interfaces:**
- Produces: 好感度心形 UI + 文档收尾。

**验收：** GUI 显示半心粒度心形；文档如实；全门禁通过。

---

## Final Verification

- [ ] **Step 1: Run the complete gate sequence**: `npm run content:check && npm run narrative:check && npm run narrative:simulate && npm test && npm run lint && npm run build`。全部通过；`narrative:simulate` 新基线（因周循环/章节解析变化）如实记录，不与旧值硬比。
- [ ] **Step 2: Full manual playthrough smoke test**: `npm run dev`。验证：周循环来客；好感度积累（调酒/选择）；未达标停顿场景 → 点酒 → 收尾；达标后章节剧情续上；aqiang 2–4 章 / yuki 2–3 章可玩通；心形 UI 半心显示；无卡关、无软锁。

## Commit Hygiene

- 每 Task 一个提交（或按需拆分），提交信息含任务编号与内容。
- 文档更新与代码同提交或紧随其后，保证可追溯。
- 无残留死代码：删除 `shouldRetryMixingFailure` 之外的死代码路径；本计划的死代码清理如涉及 interpreter/simulator 之外的移除，需在提交说明中标注。
