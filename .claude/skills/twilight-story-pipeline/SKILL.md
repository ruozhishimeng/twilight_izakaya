---
name: twilight-story-pipeline
description: Use when orchestrating the complete story generation workflow for 《黄昏居酒屋》. Coordinates STAGE 0-4 from character web to YAML files.
---

# Twilight Izakaya · Story Pipeline Skill

## Overview

剧情生成工作流编排 skill，用于协调完整的 6 阶段剧情生成流程。

**Core principle**: Each stage outputs self-check report for user review before proceeding to next stage. STAGE 5 enforces runtime validation.

---

## When to Use

**Use when:**
- User says "创建新角色", "生成剧情", "帮我写一个角色", "改写角色"
- Starting a complete character story generation from scratch
- Iterating/modifying an existing character's story

---

## Pipeline Architecture

```
[角色灵感]
    │
    ▼
┌──────────────────────────────────────────────┐
│ STAGE 0: 人物关系网建立/改写                   │
│ twilight-character-web                       │
│ 产出: character_web.yaml（设计参考文件）       │
└──────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────┐
│ STAGE 1: 任务草案生成                         │
│ twilight-ideation                           │
└──────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────┐
│ STAGE 2: 纯文学人物故事                       │
│ twilight-literary                           │
└──────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────┐
│ STAGE 3: 文学脚本                             │
│ twilight-narrative                          │
└──────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────┐
│ STAGE 4: YAML剧情文件                         │
│ twilight-yaml-converter                     │
└──────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────┐
│ STAGE 5: 校验与修复                           │
│ npm run content:check + auto-fix loop        │
└──────────────────────────────────────────────┘
    │
    ▼
[完整游戏剧情文件 · 通过校验]
```

---

## Execution Modes

### Mode 1: First Creation (No Relationship Web Exists)
```
1. 用户提供角色灵感列表（至少2个）
2. 执行 STAGE 0 建立关系网（作为设计参考，不进入运行时）
3. 后续流程同下
```

### Mode 2: Based on Existing Web
```
1. 读取已存在的 character_web.yaml（如存在）
2. 读取用户需求：
   - 创建新角色：用户提供角色灵感
   - 改写现有角色：用户提供需要改写的内容
3. 执行 STAGE 0 更新关系网
4. 后续流程同下
```

---

## Per-Character Execution Flow

对每个角色执行 STAGE 1-5，每阶段后需要自检 + 用户审核：

```
┌─────────────────────────────────────────┐
│ a. 执行阶段                              │
│    Spawn subagent with {stage}_skill     │
│    获取输出                              │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ b. 自检                                  │
│    Agent 对照自检清单验证输出             │
│    输出自检报告                           │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ c. 输出审核                              │
│    将输出 + 自检报告展示给用户            │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ d. 等待确认                              │
│    用户确认/修改/迭代后，进入下一阶段      │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ e. 迭代（可选）                          │
│    用户可要求对当前阶段输出进行改写        │
│    重复步骤 a-d                           │
└─────────────────────────────────────────┘
```

---

## STAGE 5: 校验与修复

STAGE 4 产出 YAML 文件后，**必须**执行此阶段才能视为完成。

### 执行步骤

1. **运行校验**
   ```
   npm run content:check
   ```

2. **如果通过** → 输出校验通过报告，展示文件列表，等待用户最终确认

3. **如果失败** → 进入修复循环：
   - 阅读错误信息，定位具体节点和字段
   - 修复对应的 YAML 文件（使用 Edit 工具）
   - 重新运行 `npm run content:check`
   - 重复直到通过

4. **常见错误类型与修复方向**
   | 错误 | 典型修复 |
   |------|---------|
   | `missing script_flow` | main/teaching 节点补 script_flow |
   | `missing atmosphere_lines` | chat/hidden 节点改用 atmosphere_lines + content |
   | `points to missing next_node` | 确认目标 event_id 存在，或修正拼写 |
   | `unknown ingredient id` | 对照 recipes.json 修正 formula 中的原料 ID |
   | `unknown recipe id` | 对照 recipes.json 修正 preferred_drink.id |
   | `unknown gallery chapter` | 确认 gallery.yaml 中有对应 profile_sections[].id |
   | `must define on_mixing_complete or on_mixing_fail` | 为 drink_request 节点补出口 |
   | `teaching node must point to a next_node` | 为 teaching 节点补 next_node |

5. **通过后输出**
   ```
   【STAGE 5 校验报告】
   npm run content:check ✓ 通过
   校验了 N 个角色，M 个排班日

   产出文件：
   - src/assets/character/{char_id}/character_meta.yaml
   - src/assets/character/{char_id}/nodes_main.yaml
   - src/assets/character/{char_id}/nodes_chat.yaml
   - src/assets/character/{char_id}/observations.yaml
   - src/assets/character/{char_id}/gallery.yaml
   （列出实际产出的所有文件）

   【用户确认】
   - [ ] 确认完成 / [ ] 需要修改
   ```

---

## Self-Check Report Format

After each stage, output a self-check report:

```
【{阶段名} 自检清单】
- [ ] 检查项1
- [ ] 检查项2
...

【问题与建议】
- 若有问题，列出具体改进建议

【用户确认】
- [ ] 确认进入下一阶段 / [ ] 需要修改
```

---

## Character Type Handling

所有角色类型共用同一套 STAGE 1-5 流程，但各阶段产出有所差异：

| 角色类型 | phase 弧线 | 关键设计点 |
|---------|-----------|-----------|
| **迷失者** | MEMORY→CONFRONT→HEAL→REBORN（全4阶段） | 必须有 tangible 未完成事物 |
| **滞留者** | CONFRONT 为主，可能横跨多阶段 | 逃避的核心真相 |
| **普通人** | HEAL→REBORN（1-2阶段为主） | 日常生活困境，不过多刻画 |
| **鬼神** | 教学弧线（多阶段） | teaching_mission 功课设计 |

---

## Cross-Stage Information Preservation

每个阶段产出结构化信息后，下游阶段**必须**保留并转化这些信息。以下为各阶段的关键可追溯元素：

### STAGE 1 → STAGE 4 追溯

| STAGE 1 产出 | 必须在 STAGE 4 体现为 |
|-------------|---------------------|
| `flavor_branches[].id` | `player_options` 中对应的 `branch_type: flavor` 选项 |
| `plot_branches[].id` | `player_options` 中对应的 `branch_type: plot` 选项，且有不同 `next_node` |
| `plot_branches[].condition` | `player_options[].condition` 字段 |
| `drink_hints.phase_N` | `drink_request.preferred_drink` 或 `most_loved.phase_N` |
| `tearjerker_moments[]` | 至少有一个对应的 `script_flow` 场景体现该情感高潮 |
| `arc_notes.unlock_keys[]` | `story_unlocks` 或 `trigger_condition` |

### STAGE 2 → STAGE 4 追溯

| STAGE 2 产出 | 必须在 STAGE 4 体现为 |
|-------------|---------------------|
| `[联动: xxx]` 标注 | `trigger_condition.need_event` 或跨角色 `story_unlocks` |
| 分支伏笔场景 | `player_options` 中对应的 flavor/plot 选项 |
| 分歧点 `[分支A/B]` | `player_options` 中不同的 `next_node` |

### STAGE 4 自检中的跨阶段核对项

STAGE 4 的自检清单已包含以下跨阶段核对项：
- STAGE 1 的所有 flavor_branches id 在 nodes 中有对应的 player_option
- STAGE 1 的所有 plot_branches id 在 nodes 中有对应的 branch_type: plot
- STAGE 1 的 drink_hints 对应 phase 有 drink_request.preferred_drink
- STAGE 2/3 的 [联动: xxx] 已转化为 trigger_condition.need_event 或 story_unlocks

---

## Iteration Impact Rules

当用户在某个阶段要求迭代时，按以下规则判断下游阶段是否需要重做：

### 改动内容 → 影响范围

| 改动范围 | 影响的下游阶段 | 说明 |
|---------|--------------|------|
| STAGE 0 新增角色 | STAGE 1-5 全重做（新角色） | 已有角色的内容不受影响 |
| STAGE 0 修改关系 | STAGE 2/3 的联动标注 + STAGE 4 的 trigger_condition | 仅更新跨角色引用 |
| STAGE 1 core_identity 变 | STAGE 2/3/4 全重做 | 核心人设变了，下游全部受影响 |
| STAGE 1 central_conflict 变 | STAGE 2/3/4 全重做 | 冲突变了，故事必须重写 |
| STAGE 1 只改 flavor_branches | STAGE 4 对应 player_option 更新 | STAGE 2/3 几乎不变 |
| STAGE 1 改了 plot_branches | STAGE 2/3 分歧点重写 + STAGE 4 全重做 | 分支结构变了 |
| STAGE 1 改了 drink_hints | STAGE 4 drink_request 更新 | STAGE 2/3 不受影响 |
| STAGE 2 改某个场景描写 | STAGE 3 对应幕更新 + STAGE 4 对应节点 script_flow | 仅影响对应段落 |
| STAGE 2 改分歧点 | STAGE 3 分支标注 + STAGE 4 player_options | 分支下游受影响 |
| STAGE 3 改某幕对白 | STAGE 4 对应节点 script_flow | 仅影响对应节点 |
| STAGE 3 改分支标注 | STAGE 4 player_options.next_node | 仅影响跳转逻辑 |
| STAGE 4 文件生成后校验失败 | 仅修 YAML 文件，不回滚上游 | 上游内容是正确的情况下只修格式 |

### 迭代执行流程

```
1. 用户提出迭代要求（如"STAGE 1 的 flavor_branches 不够有趣"）
2. 判断影响范围（参照上表）
3. 告知用户"此改动将影响 STAGE X 的 Y 部分，是否继续？"
4. 执行当前阶段迭代
5. 对受影响的下游阶段执行对应的更新（不一定是完全重做）
6. STAGE 5 重新校验
```

---

## Multi-Character Integration

When generating stories for multiple characters:

1. Generate each character's story through STAGE 1-5 separately
2. After all characters complete, integrate relationship webs
3. Update cross-character references (`trigger_condition.need_event`, `story_unlocks`)
4. Output consolidated files
5. Run STAGE 5 validation on all characters together

---

## Output Files

After STAGE 5, output:

```
src/assets/character/{char_id}/
  character_meta.yaml    # 角色静态资料 + 酒单
  nodes_main.yaml        # 主线剧情节点
  nodes_teaching.yaml    # 教学节点（鬼神角色）
  nodes_chat.yaml        # 闲聊节点
  nodes_hidden.yaml      # 隐藏补充节点
  observations.yaml      # 观察点
  gallery.yaml           # 图鉴章节

character_web.yaml       # 关系网（设计参考文件，不进入运行时）
```

---

## Skill Dependencies

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| [twilight-character-web](../twilight-character-web/SKILL.md) | 关系网建立/改写 | STAGE 0 |
| [twilight-ideation](../twilight-ideation/SKILL.md) | 任务草案生成 | STAGE 1 |
| [twilight-literary](../twilight-literary/SKILL.md) | 纯文学故事 | STAGE 2 |
| [twilight-narrative](../twilight-narrative/SKILL.md) | 文学脚本 | STAGE 3 |
| [twilight-yaml-converter](../twilight-yaml-converter/SKILL.md) | YAML文件生成 | STAGE 4 |
| [twilight-worldbuilding](../twilight-worldbuilding/SKILL.md) | 世界观基础 | 始终参考 |
| — | `npm run content:check` | STAGE 5 |

---

## Key Reference Files

- [状态系统驱动内容规范.md](../../../状态系统驱动内容规范.md) - 运行时字段契约（最高优先级）
- [状态系统驱动节点模板.md](../../../状态系统驱动节点模板.md) - 最小脚手架
- [剧情文件规范文档.md](../../../剧情文件规范文档.md) - 文学风格参考 + 历史样例
- [emotions.json](../../../src/assets/emotions.json) - 情感标签
- [recipes.json](../../../src/assets/recipes/recipes.json) - 配方参考
- [aqiang/character_meta.yaml](../../../src/assets/character/aqiang/character_meta.yaml) - 完整角色示例
- [validation.ts](../../../src/data/content/validation.ts) - 校验规则来源

---

## Example User Prompts

**Create new character:**
```
帮我创建一个新角色：一个在车站等待女儿五十年的母亲
```

**Create multiple characters with relationship:**
```
帮我创建两个角色：
1. 一个在雨夜死去的快递员，执念是送音乐盒给妹妹
2. 一个等待女儿的母亲，已经等了五十年
```

**Modify existing character:**
```
改写阿相的角色：让他有一个更深层的死亡真相揭露
```

**Start from existing web:**
```
基于现有的 character_web.yaml，再添加一个新角色：雨夜花店女孩
```

---

## Iteration Flow

用户可以在任何阶段要求迭代：

```
用户: "STAGE 1 的 flavor_branches 不够有趣，改写一下"

→ 判断影响范围：仅 STAGE 4 player_option 需要更新
→ 告知用户影响范围
→ 返回 STAGE 1，使用 twilight-ideation 重新生成
→ 仅更新 STAGE 4 中对应的 player_option（无需重做 STAGE 2/3）
→ STAGE 5 重新校验
→ 用户审核
```

---

## Planning Memory Integration

Before starting, check for relevant planning memories:
- 查看 `C:\Users\ruozh\.claude\plans\dreamy-booping-puzzle.md` 了解工作流细节
- 查看 `MEMORY.md` 了解项目上下文

---

## Tips

1. **始终基于关系网** - 不要从零开始，基于已有关系网
2. **每阶段都要自检** - 使用对应阶段的 self-check checklist
3. **用户审核是门** - 每阶段必须等用户确认才能进入下一阶段
4. **迭代是正常的** - 用户要求迭代时，先判断影响范围再动手
5. **角色类型一致性** - 确保同一角色在各阶段类型一致
6. **普通人不需过多刻画** - 普通客人保持简洁，不展开深层剧情
7. **STAGE 5 不可跳过** - 校验通过才算管线完成
