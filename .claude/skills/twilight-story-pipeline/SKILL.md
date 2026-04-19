---
name: twilight-story-pipeline
description: Use when orchestrating the complete story generation workflow for 《黄昏居酒屋》. Coordinates STAGE 0-4 from character web to YAML files.
---

# Twilight Izakaya · Story Pipeline Skill

## Overview

剧情生成工作流编排 skill，用于协调完整的 5 阶段剧情生成流程。

**Core principle**: Each stage outputs self-check report for user review before proceeding to next stage.

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
[完整游戏剧情文件]
```

---

## Execution Modes

### Mode 1: First Creation (No Relationship Web Exists)
```
1. 用户提供角色灵感列表（至少2个）
2. 执行 STAGE 0 建立关系网
3. 后续流程同下
```

### Mode 2: Based on Existing Web
```
1. 读取已存在的 character_web.yaml
2. 读取用户需求：
   - 创建新角色：用户提供角色灵感
   - 改写现有角色：用户提供需要改写的内容
3. 执行 STAGE 0 更新关系网
4. 后续流程同下
```

---

## Per-Character Execution Flow

对每个角色执行 STAGE 1-4，每阶段后需要自检 + 用户审核：

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

所有角色类型共用同一套 STAGE 1-4 流程，但各阶段产出有所差异：

| 角色类型 | phase 弧线 | 关键设计点 |
|---------|-----------|-----------|
| **迷失者** | MEMORY→CONFRONT→HEAL→REBORN（全4阶段） | 必须有 tangible 未完成事物 |
| **滞留者** | CONFRONT 为主，可能横跨多阶段 | 逃避的核心真相 |
| **普通人** | HEAL→REBORN（1-2阶段为主） | 日常生活困境 |
| **鬼神** | 教学弧线（多阶段） | teaching_mission 功课设计 |

---

## Multi-Character Integration

When generating stories for multiple characters:

1. Generate each character's story through STAGE 1-4 separately
2. After all characters complete, integrate relationship webs
3. Update cross-character references
4. Output consolidated files

---

## Output Files

After STAGE 4, output:

```
src/assets/character/{char_id}/
  character_meta.yaml    # 角色静态资料
  nodes_main.yaml        # 主线剧情节点
  observations.yaml      # 观察点（可选）
  gallery.yaml           # 图鉴（可选）

character_web.yaml       # 更新的关系网总览
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

---

## Key Reference Files

- [剧情文件规范文档.md](剧情文件规范文档.md) - 完整格式参考
- [emotions.json](src/assets/emotions.json) - 情感标签
- [recipes.json](src/assets/recipes/recipes.json) - 配方参考
- [aqiang/character_meta.yaml](src/assets/character/aqiang/character_meta.yaml) - 完整角色示例

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

→ 返回 STAGE 1
→ 使用 twilight-ideation 重新生成
→ 输出新的自检报告
→ 用户审核
→ 继续
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
4. **迭代是正常的** - 用户要求迭代时，保持流程灵活性
5. **角色类型一致性** - 确保同一角色在各阶段类型一致
