# 好感度驱动剧情推进（affection-driven progression）设计规格

- 日期：2026-08-11
- 关联：MIX-001（调酒分级反馈，本分支已完成）；CONTENT-005（44 条不可达主节点 warning）
- 分支说明：本规格基于 `worktree-mixing-tier-scoring`（MIX-001 之上）。若 MIX-001 先合入 master，本分支 rebase 后继续，逻辑不变。

## 1. 背景与目标

当前剧情推进是**固定次数**：`schedule.yaml` 单周排期 + `start_node` 硬编码，一周过完软锁（FLOW-002）。角色好感度（`narrativeEffects.ts` 的 affection 轴，-100..100）已被剧情选择/`on_complete` 效果写入（仅 aqiang 6 处），但**没有任何系统消费好感度来推进剧情**。同时 44 条 UNREACHABLE_MAIN_NODE 里，aqiang 第 2–4 章（14 节点）、yuki 第 2–3 章（15 节点）是**作者已写好的完整章节内容**，只因 schedule 永远只排第一章而不可达。

目标：好感度达标 → 推进到下一章；不达标 → 不硬卡（回退/正常剧情）；好感来源 = 剧情选择/事件结果 + 调酒三档。

## 2. 首期必做

1. **周循环**：`schedule.yaml` 的 W1 在周结束后循环播放（访客按好感度重复到访），消除 FLOW-002 软锁。这是好感度积累的前提。
2. **好感阈值分章**：每角色按好感度解锁章节；达标 → 下次到访走后续章节；不达标 → 走第 1 章内容 + 「关系还不够」备选对话（软门槛，永不硬卡）。
3. **只进不退**：调酒三档影响好感（perfect 增 / good 微增 / off 减），但已解锁章节**永不再回锁**（sticky 解锁，存为 fact）。
4. **调酒三档产生好感**：每次 `serveDrink` 按 tier 发出标准好感度增量（visit 作用域幂等事务）。
5. **剧情选择/事件结果影响好感**：复用现有 `relationship.change` 机制；内容侧补接线（本期以 aqiang 既有 6 处为准，yuki/fox_uncle/常客按需补）。
6. **接线 aqiang 2–4 章 + yuki 2–3 章**：作者已写好的章节内容接入好感度门；推进 CONTENT-005（warning 计数更新并如实记录）。

## 3. 首期非目标

1. 不修改 `interpreter.ts`/`simulator.ts`（纯解释器/模拟器保持不动；`need_affection` 对它们不可见——它们不读 trigger_condition 的 main 节点门）。
2. 不重建 `schedule.yaml` 结构（仍是「天→访客→start_node」；循环与章节解析叠加在其上）。
3. 不做多好感轴（本期只有 affection；`trust` 等后续）。
4. 不做好感度数值 UI（NarrativeDebugPanel 已展示 relationshipValues，够调试用）。
5. 不改写既有内容的好感度效果（aqiang 的 +4/−1 保留，与调酒档位增量并存，见 §5.3）。
6. 不接 fox_uncle 章节（其 2–3 章内容不存在，仅有教学弧；好感度照常记录，章节表本期不含他）。
7. `feedback` 文案展示：本期可选（不做不影响推进；机制上保留）。

## 4. 核心原则

- **软门槛，不硬卡，停顿不后退**：好感度不足**不**把玩家丢回已看过的章节，而是剧情指针**停在当前章节的门前**——演出一场「话没说出口」的停顿场景，到访照常可点酒（涨好感），达标后剧情自然续上。这是「暂停」而非「回退」。
- **只进不退**：解锁状态是「已记录事实」，不是当前数值的派生；数值可降，解锁不回锁。
- **纯半心制**：好感度最小存储/显示单位是半心（满级 5 心 = 10 点）。所有增量必须是半心整数（半心不变式）；GUI 直接显示心形（像素心形，满级 ♥♥♥♥♥）。现有内容数值**迁移**为半心整数（见 §5.4）。
- **复用现有机制**：好感存储/事务/幂等/fact 全部用 `narrativeEffects.ts` 既有能力，不新造存储。
- **章节表为唯一权威**：章节 → 起始节点 → 阈值 → 停顿节点 的映射以 `character_meta.yaml` 的 `chapters` 表为准，运行时与校验都读它。
- **无上帝函数**：章节解析、调酒好感、图可达性各自成小函数，单测覆盖。

## 5. 数据模型改动

### 5.1 `trigger_condition` 新增 `need_affection`

`NodeTriggerCondition`（`src/data/content/types.ts:66-70`）增加：

```ts
need_affection?: { axis?: string; min: number };  // 缺省 axis='affection'
```

- 语义：进入该节点需要 `getRelationshipValue(state, guestId, axis) >= min`。
- 校验（`validation.ts`）：`min` 有限数；`axis` 必须已注册（本期只有 `affection`）。
- 运行时消费：章节起始节点解析（§6）+ 任意节点门（通用机制，本期仅章节用）。
- 对 interpreter/simulator 不可见（它们不读此字段 → §3.1 成立）。

### 5.2 `character_meta.yaml` 新增 `chapters` 表

每角色（本期 aqiang、yuki）新增：

```yaml
chapters:
  - id: phase_2
    start_node: aqiang_004_dialogue_main   # 章节入口（必须是 main 组节点，存在）
    min_affection: 4                         # 达标阈值（半心点；4 点 = 2 心）
    paused_node: aqiang_004_gate_paused      # 未达标时的「话没说出口」停顿场景（存在校验）
  - id: phase_3
    start_node: aqiang_007_dialogue_main
    min_affection: 6                         # 3 心
    paused_node: aqiang_007_gate_paused
  - id: phase_4
    start_node: aqiang_010_dialogue_main
    min_affection: 8                         # 4 心
    paused_node: aqiang_010_gate_paused
```

- 顺序即章节顺序；`start_node` 必须存在且为 main 组；`paused_node` 若给出必须存在；`min_affection` 为半心整数（0–10），建议递增（不强校验递增）。
- 章节起始节点本身建议（不强求）声明一致的 `trigger_condition.need_affection`——校验做「若表与节点都声明则必须一致」的交叉检查，防止漂移。
- `current_phase`/`pending_phase`/`unlock_next_phase` 仍是死元数据，本期不动（不复活、不清理，避免范围蔓延）。

### 5.3 心制（半心制）与既有数值迁移

- 好感值内部存储范围：0–10 点（半心整数），满级 = 5 心（♥♥♥♥♥）。1 点 = 1 半心；**半心不变式**：任何时刻好感度与任何增量都是 0–10 的整数（或半心倍数），由 `min`/`max` clamp（0..10）与增量校验保证。
- **现有数值迁移**（`narrativeEffects.ts` 默认轴 min/max 从 −100..100 改为 0..10，及 aqiang YAML 既有效果数值）：
  - `amount` 必须是半心整数（整数 0–10 内）；校验增强：`amount` 必须整数（否则报错）。
  - aqiang 既有效果迁移为半心：+4 → +1、+3 → +1、+2 → +1、+1 → +0（或 +1 取整上限，见下）、−1 → −0（或 −1 取整下限）。
  - 迁移规则（统一）：`amount <= 2 → 1 半心`，`amount > 2 → 1 半心`（**取整到最近半心，非对称不扩展**）——实际：+1/+2 → +1，+3/+4 → +1，−1 → −0（不降），保留非负推进语义。具体取值在迁移时逐处定并记录（避免四舍五入歧义）。
  - 迁移属于本期任务（含测试断言更新）。
- 显示：GUI 显示心形（满级 ♥♥♥♥♥）；当前值向下取整到半心显示（存储即半心，无精度损失）。

### 5.4 持久化：零版本变更

- 无新持久化字段。sticky 解锁复用既有 fact 存储：首次选中某章节 start 时记录 `completedEvents` fact `{guestId}_chapter_{phaseId}_unlocked`。
- 好感值、已应用事务、事实全部在 v5 快照已有字段内 → `PERSISTED_GAME_SNAPSHOT_VERSION` 保持 5。
- 心制迁移（0..10）对旧存档：旧 v5 存档若有 −100..100 好感值，超出 0..10 的新 clamp 会截断到 0..10（旧 30 → 新 10，旧 90 → 10，旧 −5 → 0）。可接受：旧存档本就只有 aqiang 的少量 ± 值，且章节门看事实不看绝对值；如实记录为已知迁移行为。

## 6. 好感度来源与数值

### 6.1 调酒三档（新增）

`serveDrink` 在得到 `tier` 后，发出一个 **visit 作用域** 的 `relationship.change` 事务（target `self`，axis `affection`），事务 id = `visit/{visitId}/{guestId}/{mixingNodeId}`（每次到访每调酒节点至多一次）：

| tier | 增量（半心） | 语义 |
|---|---|---|
| perfect | +1 | 客人很满意（半心） |
| good | 0 | 客人还算认可（不掉） |
| off | −1 | 客人有些失望（半心） |

- 对**所有访客**生效（常客也有好感记录，本期无章节影响，为未来预留）。
- 与既有 `on_complete` 效果**并存**：`on_complete` 是剧情性效果（aqiang phase1_success +4「这杯酒让他觉得你理解了他」），tier 增量是通用满意度。二者相加；迁移后半心制下 off 最坏 −1（tier）−1（若既有 on_complete 负值）= −2，可接受，不改写既有内容。
- 实现要点：走既有 `applyNarrativeTransaction` 路径（新编译函数或复用 `compileNodeCompletionNarrativeTransaction` 的变体），不绕过 reducer。

### 6.2 剧情选择/事件结果（既有机制，内容接线）

- 机制已工作（option `effects` / `on_complete.effects`，game/visit 作用域，幂等）。
- 本期内容侧：aqiang 既有 6 处保持；yuki/fox_uncle/常客不强制补（章节门槛主要靠调酒+选择积累，yuki 若阈值难达成可在接线时给其选择补 1–2 处效果，规划阶段定）。
- 首期数值表（建议值，可调）：ch2 4 点（2 心）/ ch3 6 点（3 心）/ ch4 8 点（4 心）；单次到访的典型收益：一次调酒（perfect +1）+ 1–2 个选择（+0/+1）+ 结果节点 on_complete（+1）。粗算 4–8 次到访可到 4 点，8–12 次到 6 点，与周循环匹配。

## 7. 章节解锁与推进（运行时）

### 7.1 到访起始节点解析（核心新函数）

`resolveStartNodeForVisit(guest, context): string`（`flowHelpers.ts` 或新模块）：

1. 取该角色 `chapters` 表（按顺序）。
2. 从高到低找第一个「可解锁」的章节：`min_affection` 已达成 **或** 已有 `{guestId}_chapter_{id}_unlocked` fact，**且** `start_node` 的 `need_event` 前置（若有）已满足。
3. 找到 → 记录 sticky 解锁 fact（若尚未记录）→ 返回该 `start_node`。
4. 找不到 → 返回 schedule 默认 `start_node`（即第 1 章入口，现状不变）。

插入点：`beginGuestArrival`/`nextGuest` 链路中现 `startNodeId = currentGuestData?.start_node`（`gameSelectors.ts:46`）处。

### 7.2 软门槛（未达标 → 停顿，不回退）

- 若最高已解锁章节 < 目标章节（未达阈值），解析**不**落到第 1 章重播，而是停在当前章节门前：本次到访播放该章节 `paused_node` 的**停顿场景**（「话没说出口」那一刻的演出，每章手写专属），随后进入一个**可点酒的日常流程**（小演出 → 点酒 → 收尾，形态类似常客日常到访）。达标后剧情自然续上。
- 停顿场景是普通 dialogue 节点，`next_node` 指向日常点酒流程；`paused_node` 存在性校验（§9）。
- 明确：**永不出现「不能开始访问」**，也**永不让玩家重看已看过的章节**（指针只进不退）。

### 7.3 周循环（前置必做）

- `schedule.yaml` 保持 W1_D1..D7；`findScheduledVisit`/`getScheduleDay` 对 `week` 取模回绕（W2 → 复用 W1 数据），使访客在周后继续到访。
- 内容可重播（日常流程/停顿场景按需重播完全正常）；章节内容由 §7.1 每次到访动态解析，无需新增排期行。
- 顺带消除 FLOW-002 软锁（周后不再无访客）。
- 细节：`findScheduledVisit` 现扫描至 365 天；改为无限回绕（或 modulo）；`visitId` 格式 `W{week}:D{day}:...` 的 week 会持续增长——事务 id 已含 week，天然区分各周同一访客的 visit 作用域（visit 作用域按 visitId 幂等，正确）。

## 8. 图可达性与 warning（CONTENT-005 推进）

- `graph.ts` 的 `analyzeNarrativeGraph` 需理解 `chapters` 表：章节 `start_node` 视为**条件可达**（conditional-reachable）的伪起点——不产生 UNREACHABLE，但打上 conditional 标记（或直接计入可达，规格倾向：计为可达并记录条件类型）。
- `narrative:check` 输出：新增一条「conditional-reachable via chapters」统计；44 条 warning 中 aqiang 14 + yuki 15 = 29 条转为条件可达 → **44 → 15**（剩余：fox_uncle 备用开场/未排期 6 + 未排期常客 9）。实际以接线后的真实 run 为准，文档如实记录新计数。
- 若某章节 `start_node` 仍不可达（如表指向不存在/孤立节点）→ 报错（错误级，不是 warning）。

## 9. 校验与测试

- **validation**：`need_affection` 字段；`chapters` 表（结构/存在性/交叉一致性）；`paused_node` 存在性；表内 `start_node` 为 main 组。
- **单元测试**：
  - `resolveStartNodeForVisit`：未达阈值→第 1 章；达标→章节 start；sticky（解锁后数值下降仍解锁）；need_event 前置不满足→回落。
  - 调酒三档事务：每次到访每个调酒节点恰好应用一次（visit 作用域幂等）；perfect/good/off 增量正确。
  - validation：need_affection 非法、chapters 表非法、交叉不一致 → 报错。
  - graph：章节表接入后 warning 计数 44 → 15（或实际值），conditional 标记正确。
- **门禁**：`content:check && narrative:check && narrative:simulate && npm test && npm run lint && npm run build` 全绿；`narrative:simulate` 基线（74 paths/27 retry/0 failed）预期因周循环与章节解析变化——如实记录新基线，不与旧值硬比。

## 10. 边界与迁移

- 旧存档（v5）：好感值、facts 均在既有字段内 → 无需迁移，零版本变更（§5.3）。
- 既有节点行为：未配置 `chapters` 的角色（fox_uncle、常客）完全不受影响（解析回落默认 start_node）。
- 既有剧情选择效果：不改写 aqiang 6 处；新 tier 增量与既有并存（§6.1）。
- 分支策略：本系统作为 MIX-001 的延续在同一分支推进（用户已选「扩展 MIX-001 计划」结构）；若需独立合并再拆分（详见计划阶段）。

## 11. 风险与开放问题

1. **数值平衡**：阈值（2 心=40→按半心制 = 4 点 / 6 点 / 8 点）与增量（perfect +1 / off −1）是首期建议值，需实际游玩校准。规格定机制，数值允许在接线阶段调整并记录。
2. **yuki 阈值可达性**：yuki 仅有 W1_D5 排期且选择零效果，达标主要靠调酒 +1；若过慢，接线时给 yuki 选择补 1–2 处半心效果（规划阶段定）。
3. **停顿场景内容量**：每角色每章节一个专属停顿节点（2–3 行演出 + 日常点酒流程 + 收尾），本期 aqiang 3 个 + yuki 2 个 = 5 个新场景，量小可控。
4. **visit 作用域与周循环交互**：visitId 含 week，周循环后同一访客每周独立 visit 作用域 → 调酒好感每周重新计算，正确（幂等键含 visitId）。
5. **sticky fact 的清理**：无（解锁永久，符合只进不退）。
6. **既有内容好感度数值迁移**（半心制）：aqiang 6 处 +1~+4/−1 迁移为半心整数，含测试断言更新；旧存档值截断到 0..10（§5.4 已记录）。
