# 《黄昏居酒屋》角色文件夹说明

## 概述

本文件夹存放所有角色的剧本数据。角色分为三类：普通人、迷失者、鬼神。
所有角色文件统一使用 YAML 格式，基于节点系统驱动剧情。

---

## 角色类型

### 1. 普通人（Regular Customer）
- 偶然来访的普通人，不是迷失者/滞留者
- 每次来访都可能是最后一次（无多阶段推进）
- 对话简洁，1-2轮
- 目录结构：`{character_id}/character_meta.yaml`, `nodes_main.yaml`, `media/`

### 2. 迷失者（Lost Soul）
- 有阶段推进的灵魂角色（Phase 1 → 2 → 3 → Released）
- 通过调对不同喜爱度的酒推进剧情
- 目录结构：完整节点系统结构（见下方）

### 3. 鬼神（Ghost）
- 固定来访的鬼神角色
- 通过来访类型（教学/赠礼/挑战）推进
- 目录结构：完整节点系统结构（见下方）

---

## 统一目录结构

### 迷失者 / 鬼神（完整结构）
```
{character_id}/
├── character_meta.yaml                              # 角色基础设定
├── observations.yaml                                # 打量特质库
├── gallery.yaml                                   # 人物图鉴（节点解锁式）
├── media/                                         # 媒体资产
│   ├── avatar.png                                 # 头像
│   ├── portrait.png                               # 立绘
│   └── cg_xxx.png                                # 特殊 CG
├── nodes_main.yaml                                # 主线剧情节点
├── nodes_chat.yaml                                # 闲聊/碎片节点
├── nodes_hidden.yaml                              # 隐藏/传说节点
├── nodes_teaching.yaml                           # 教学/奖励/挑战/结局节点
└── loot_table.yaml                               # 奖励与解锁逻辑
```

### 普通人（简化结构）
```
{character_id}/
├── character_meta.yaml     # 角色基础设定
├── nodes_main.yaml        # 单次来访对话
└── media/                # 媒体资产（如有）
```

---

## 文件格式规范

### character_meta.yaml（角色元数据）

```yaml
character_id: aqiang
base_info:
  name: "阿相"
  real_name: "晴山 冰相"
  age: 25
  occupation: "速运员"
  identity: |
    角色身份背景描述...
  type: "迷失者"
  personality: "顽固、极度焦虑、自我牺牲"
  short_story: |
    角色简短故事...
arrival_pattern: "random"
arrival_condition:
  type: "progress"
  description: "玩家完成5杯调酒后灵魂可能被吸引到来"
  required_count: 5
  count_type: "drinks_made"
drinks:
  most_loved:
    phase_1:
      id: "R001"
      name: "未竟的生诞"
      formula: ["bc01", "m04", "f03"]
      reason: "原因描述..."
is_unlocked: false
visits_count: 0
```

| 字段 | 说明 |
|------|------|
| `character_id` | 角色唯一标识（小写+下划线） |
| `type` | 角色类型：迷失者/鬼神/普通人 |

### nodes_main.yaml（主线剧情节点）

```yaml
character_id: aqiang
nodes:
  - id: phase1_arrival
    event_id: "aqiang_001_dialogue_main"
    trigger_condition:
      need_event: []
      need_time: "any"
      need_item: []
    atmosphere_lines:
      - "氛围描写1"
      - "氛围描写2"
    speaker: null
    content:
      - "「NPC台词1」"
      - "「NPC台词2」"
    player_options:
      - text: "「玩家选项」"
        next_node: "aqiang_phase1_round2"
        impact_log: "写入店长手记的内容"
    next_node: "aqiang_phase1_round2"
    drink_request:
      keywords: ["焦急", "赶时间", "未完成"]
      hint: "他下意识地摸了摸胸口的位置..."

  - id: phase1_most_loved_success
    event_id: "aqiang_phase1_most_loved_success"
    trigger_condition:
      need_event: ["aqiang_003_drink_request"]
      need_time: "any"
      need_item: []
    atmosphere_lines:
      - "他接过酒杯，抿了一口..."
    speaker: null
    content:
      - "「......这酒。」"
    player_options: []
    next_node: null
    on_success:
      next_phase: 2
```

#### 节点类型

| 节点类型 | 说明 |
|----------|------|
| `_dialogue_main` | 主线对话节点 |
| `_dialogue_chat` | 闲聊对话节点 |
| `_dialogue_lore` | 故事倾诉节点 |
| `_dialogue_hidden` | 隐藏剧情节点 |
| `_drink_request` | 调酒请求节点 |
| `_teaching` | 教学节点 |
| `_reward` | 奖励节点 |
| `_challenge` | 挑战节点 |
| `_idle` | 等待闲聊节点 |
| `_ending` | 结局节点 |

#### 触发条件 trigger_condition

```yaml
trigger_condition:
  need_event: ["event_id_1", "event_id_2"]  # 需要触发过的事件
  need_time: "any"                           # any / night / day
  need_item: ["item_id_1"]                   # 需要持有的道具
```

#### 回合结构 player_options

```yaml
player_options:
  - text: "「玩家选项」"
    next_node: "next_node_id"
    impact_log: "写入店长手记的内容"
```

### observations.yaml（打量特质库）

```yaml
character_id: aqiang
observations:
  - id: obs_temple_bruise
    area: "头部"
    objective: "右太阳穴的青紫撞伤"
    subjective: "车祸致命伤的残留，淤血的紫混着靛青色..."
    hint: "他似乎察觉不到这道伤的存在，从不触碰，也从不遮挡。"
    revealed_at: phase_1
```

| 字段 | 说明 |
|------|------|
| `objective` | 客观描述（所有玩家都能看到） |
| `subjective` | 调酒师的主观推测（带情感色彩） |
| `revealed_at` | 首次揭示的阶段 |

### gallery.yaml（人物图鉴）

```yaml
character_id: aqiang
base_info:
  name: "阿相"
  age: 25
  occupation: "速运员"
  description: "角色描述..."
  type: "迷失者"
  short_story: "简短故事..."

profile_sections:
  - id: "surface"
    title: "焦急的速运员"
    content: |
      打量描述内容...
    unlock_condition: "obs_temple_bruise"
    depth_level: 1

  - id: "true_story"
    title: "冰相的故事"
    content: |
      完整故事内容...
    unlock_condition: "aqiang_phase3_redemption_end"
    depth_level: 3
```

| depth_level | 解锁时机 |
|-------------|----------|
| 1 | Phase 1 首次来访 |
| 2 | Phase 2 来访后 |
| 3 | Phase 3 / 救赎后 |
| 4 | 完整故事解锁后 |

### loot_table.yaml（奖励与解锁）

```yaml
character_id: aqiang

phase_completion:
  - phase: 1
    unlock_condition:
      event_id: "aqiang_phase1_most_loved_success"
      description: "调对最爱的酒后进入第二阶段"
    unlocks:
      - "aqiang_phase_2_dialogue"
      - "gallery_family_bond"

observation_unlocks:
  - observation_id: "obs_temple_bruise"
    name: "右太阳穴的青紫撞伤"
    unlock_condition:
      event_id: "aqiang_001_dialogue_main"
      description: "首次来访时自动可见"
    unlocks:
      - "gallery_surface"

hidden_unlocks:
  - hidden_id: "hidden_blue_dye"
    name: "蓝染的记忆"
    unlock_condition:
      event_id: "aqiang_005_dialogue_main"
      description: "第五对话节点时可能触发"
    requires_phase: 2
    unlocks:
      - "gallery_family_bond"

redemption:
  true_story: |
    角色完整故事...
  lesson: |
    救赎 lesson...
```

---

## 游戏规则

### 酒喜爱度系统

| 分类 | 说明 | 效果 |
|------|------|------|
| 最爱的酒 | 角色最深层的情感共鸣 | 调对 → 直接进入下一阶段 |
| 一般喜爱的酒 | 角色性格/职业相关 | 调对 → idle闲聊，下次调普通酒后进入下一阶段 |
| 普通的酒 | 基于hint匹配当前阶段情绪 | 调对 → 正常对话，不推进阶段 |

### 阶段流转

```
[Phase 1]
    ├── 调对「最爱的酒」 → [Phase 2]
    ├── 调对「一般喜爱的酒」 → idle → 下次调普通酒 → [Phase 2]
    └── 调对「普通的酒」 → 对话结束，不推进

[Phase 2] → [Phase 3]（同上）

[Phase 3]
    └── 调对「最爱的酒」 → [Released] 救赎
```

### 鬼神来访类型

| visit_type | 说明 |
|-------------|------|
| 2 | 赠道具/配方 |
| 3 | 教学来访 |
| 4 | 带配料+教学 |
| 5 | 挑战 |

### 节点对话结构：汇合-分支-汇合

第一轮玩家选项有不同 NPC 回应（分支），之后所有路径汇合到相同的教学内容。

---

## 索引参考

### recipes.json
位置：`f:\twilight\src\assets\recipes\recipes.json`

| 字段 | 说明 |
|------|------|
| `id` | 配方ID（如 R001, R021） |
| `name` | 配方名称 |
| `formula` | 配方（基底酒+配料） |
| `tag1/tag2` | 风格/口味标签 |
| `emotion_tags` | 情绪标签数组 |

### emotions.json
位置：`f:\twilight\src\assets\emotions.json`

16个情绪标签：
- **MEMORY_PHASE**: 离别、重逢、留恋、怀旧
- **CONFRONT_PHASE**: 执念、孤独、迷茫、宽恕
- **HEAL_PHASE**: 慰藉、希望、共鸣、平静
- **REBORN_PHASE**: 释然、忘却、遗忘、新生

---

## Skill 文件位置

| Skill | 路径 |
|-------|------|
| twilight-izakaya | `C:\Users\ruozh\.claude\skills\twilight-izakaya\SKILL.md` |
| twilight-izakaya-ghost | `C:\Users\ruozh\.claude\skills\twilight-izakaya-ghost\SKILL.md` |
| twilight-izakaya-npc | `C:\Users\ruozh\.claude\skills\twilight-izakaya-npc\SKILL.md` |

---

## 现有角色列表

| 角色ID | 名称 | 类型 |
|---------|------|------|
| tired_salaryman | 疲惫的上班族 | 普通人 |
| young_couple | 年轻情侣 | 普通人 |
| insomniac_writer | 失眠的作家 | 普通人 |
| homesick_grandma | 怀念故乡的老奶奶 | 普通人 |
| retired_grandpa | 庆祝退休的老爷爷 | 普通人 |
| aqiang | 阿相（晴山冰相） | 迷失者 |
| fox_uncle | 狐面大叔（稻荷） | 鬼神 |
| yuki | 小雪（晴山雪） | 迷失者 |
