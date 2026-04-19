---
name: twilight-yaml-converter
description: Use when converting narrative scripts to YAML format for 《黄昏居酒屋》. Generates game-ready YAML files including character_meta.yaml, nodes_main.yaml, and observations.yaml.
---

# Twilight Izakaya · YAML Converter Skill

## Overview

YAML剧情文件生成 skill，用于 STAGE 4。将影视脚本转换为游戏可用的 YAML 剧情文件。

**Core principle**: Scripts become structured YAML with complete references, proper branching, and game-ready formatting.

---

## When to Use

**Use when:**
- STAGE 4 of the story pipeline
- Converting a narrative script to game format
- Generating complete character files

**Do NOT use when:**
- Writing scripts (use twilight-narrative)
- Creating character drafts (use twilight-ideation)

---

## Input

A narrative script from STAGE 3 (twilight-narrative), in markdown format.

---

## Output Files

1. `character_meta.yaml` - 角色静态资料
2. `nodes_main.yaml` - 主线剧情节点
3. `observations.yaml` - 观察点（可选）

---

## Output Structure

### character_meta.yaml

```yaml
character_id: unique_id
base_info:
  name: "显示名称"
  type: "迷失者/滞留者/鬼神/普通人"
  description: "描述"

story:
  summary: "故事概要"
  chapters:
    - id: "chapter_1"
      title: "章节标题"
      summary: "章节概要"
      unlocked: true/false

drinks:
  most_loved:
    phase_1:
      id: "R001"
      name: "饮品名"
      formula: ["bc01", "m04", "f03"]
      reason: "推荐理由"
  generally_liked:
    phase_1:
      - id: "R003"
        name: "血腥玛丽"
        formula: [...]
        reason: "理由"

is_unlocked: false
visits_count: 0
```

### nodes_main.yaml

```yaml
nodes:
  - event_id: character_id_001_dialogue
    type: dialogue
    next_node: character_id_002
    script_flow:
      - type: env
        content:
          - "环境描写"
      - type: npc
        content:
          - "NPC台词"
      - type: inner
        content:
          - "主角内心"
    player_options:
      - option: "选项A"
        next_node: character_id_002_branch_a
        branch_type: flavor
      - option: "选项B"
        next_node: character_id_002_branch_b
        branch_type: plot

  - event_id: character_id_001_dialogue_branch_a
    type: dialogue
    next_node: character_id_002
    # ...
```

### observations.yaml

```yaml
character_id: unique_id
observations:
  - id: obs_feature_1
    area: "部位"
    objective: "客观观察"
    subjective: "主观感受"
    hint: "暗示"
    revealed_at: phase_1
```

---

## Branch Conversion

### Flavor Branch → branch_type: flavor

Flavor branches don't affect story direction:

```yaml
player_options:
  - option: "问他关于雨的事"
    next_node: aqiang_002_flav_umbrella  # 即使选择这个，最终还是到 aqiang_002
    branch_type: flavor
    condition:
    impact_log: "解锁背景：对天气麻木"
```

### Plot Branch → branch_type: plot

Plot branches affect story direction:

```yaml
player_options:
  - option: "告诉雪很好"
    next_node: aqiang_003_truth
    branch_type: plot
    condition:
      need_event: "learned_about_snow"  # 前置条件
    impact_log: "触发真相分支"
  - option: "沉默"
    next_node: aqiang_003_silent
    branch_type: plot
    impact_log: "触发沉默分支"
```

---

## Character Type Differentiation

| 角色类型 | observations.yaml 重点 | nodes 节点设计重点 |
|---------|----------------------|------------------|
| **迷失者** | 必须有1-2个揭示"死亡真相"的观察点（但要隐蔽） | 随 phase 递进解锁更多对话节点 |
| **滞留者** | 观察点揭示"逃避的真相"与"表面言行"的矛盾 | 对话节点要有循环结构（绕圈后回到原点） |
| **普通人** | 可无观察点或简单观察；聚焦情感共鸣 | 单次来访节点为主，可选短弧线 |
| **鬼神** | 观察点揭示"知道但不说"的智慧感 | teaching_mission 对应 milestones 奖励节点 |

---

## Cross-Character Relationship Mapping

### [联动: xxx] → YAML

```
[联动: 阿相|信息传递|玩家询问雪的情况]
```

转化为：

```yaml
# 在触发条件中
trigger_condition:
  need_event:
    - learned_about_snow  # 玩家之前见过雪或了解雪的情况

# 或者在 story_unlocks 中
story_unlocks:
  - event: "learned_about_snow"
    description: "玩家了解了雪的现状"
```

### 物品流转 → related_items

```yaml
# 在 character_meta.yaml 中
related_items:
  - id: "music_box"
    name: "音乐盒"
    connected_to: "sister_snow"
    story: "一百六十七单换来的德彪西《月光》"
```

---

## Event ID Naming Convention

```
{character_id}_{sequence}_{type}

Examples:
- aqiang_001_dialogue      # 对话节点
- aqiang_001_mixing        # 调酒节点
- aqiang_001_reward        # 奖励节点
- aqiang_001_observe       # 观察节点
- aqiang_001_end           # 结束节点
- aqiang_001_branch_a      # 分支A
- aqiang_001_branch_b      # 分支B
```

---

## Reference Validation

确保所有引用完整：

```yaml
# ✅ 正确
next_node: aqiang_002  # 这个 event_id 必须存在

# ❌ 错误
next_node: nonexistent_node  # 这个 event_id 不存在！
```

---

## YAML Format Rules

### script_flow Types
- `env` - 环境描写
- `npc` - NPC台词
- `inner` - 主角内心独白
- `system` - 系统提示

### Type Values
- `dialogue` - 普通对话
- `mixing` - 调酒
- `observation` - 观察
- `reward` - 奖励
- `transition` - 过渡
- `system` - 系统
- `ending` - 结束

### trigger_condition Fields
```yaml
trigger_condition:
  need_event: []      # 需要的事件
  need_item: []       # 需要的关键物品
  need_flag: []       # 需要的状态标记
  need_time: "W1_D3"  # 需要的时间
```

---

## Self-Check Checklist

```
【STAGE 4 自检清单】
- [ ] event_id 唯一且规范
- [ ] trigger_condition / next_node 引用完整
- [ ] flavor_branch → branch_type: flavor
- [ ] plot_branch → branch_type: plot，不同分支指向不同 next_node
- [ ] story_unlocks 正确
- [ ] 所有 plot_branch 分支都有对应 event_id
- [ ] 若为迷失者：observations 有1-2个隐蔽揭示死亡真相的点
- [ ] 若为滞留者：observations 揭示"逃避真相"与"表面言行"的矛盾
- [ ] 跨角色引用正确映射到 trigger_condition.need_event 或 story_unlocks
- [ ] 物品流转通过 related_items 正确关联
```

---

## Cross-Reference

- **Requires**: [twilight-narrative](../twilight-narrative/SKILL.md) (STAGE 3 output)
- **Format Reference**: [剧情文件规范文档.md](剧情文件规范文档.md)
- **World Reference**: [twilight-worldbuilding](../twilight-worldbuilding/SKILL.md)
- **Example**: [aqiang/character_meta.yaml](src/assets/character/aqiang/character_meta.yaml)

---

## Example Conversion

### Script Input:
```markdown
## 第一幕 · 雨夜

**【居酒屋 · 黄昏】**

（门被推开，雨声涌入。一个浑身湿透的年轻人站在门口。）

阿相：「......有酒吗。」

（伏笔：flavor_branch.aqiang_ask_umbrella）

---

# 【玩家选择将影响走向】
# A: 告诉真相「雪很好」 → 阿相进入 HEAL 阶段
# B: 沉默/隐瞒 → 阿相继续在 CONFRONT 阶段
```

### YAML Output (nodes_main.yaml):
```yaml
nodes:
  - event_id: aqiang_001_dialogue
    type: dialogue
    next_node: aqiang_001_choice
    script_flow:
      - type: env
        content:
          - "门被推开，雨声涌入。一个浑身湿透的年轻人站在门口。"
      - type: npc
        content:
          - "「......有酒吗。」"
      - type: inner
        content:
          - "他沉默地站着，目光低垂。左手始终攥着，像握着什么重要的东西。"
    presentation:
      speaker: npc
      portrait:
        action: show
        character_id: aqiang
        expression: dialogue
        position: center

  - event_id: aqiang_001_choice
    type: dialogue
    next_node:
    script_flow:
      - type: inner
        content:
          - "他要问关于雪的事了。玩家选择将影响走向。"
    player_options:
      - option: "告诉她雪很好"
        next_node: aqiang_002_truth
        branch_type: plot
        condition:
          need_event:
            - learned_about_snow
        impact_log: "告诉阿相雪的现状"
      - option: "沉默"
        next_node: aqiang_002_silent
        branch_type: plot
        impact_log: "选择沉默"

  - event_id: aqiang_002_truth
    type: dialogue
    next_node: aqiang_002_dialogue
    # ...
```

---

## Tips

1. **验证所有引用** - 确保 next_node 和 trigger_condition 引用的 event_id 都存在
2. **flavor vs plot** - 不要混淆，flavor 不影响走向，plot 会分支
3. **隐蔽的观察点** - 迷失者的死亡真相要通过观察点暗示，不要直接揭露
4. **物品关联** - 使用 related_items 字段建立物品与角色的连接
5. **完整的故事解锁** - 使用 story_unlocks 字段记录玩家的关键选择
