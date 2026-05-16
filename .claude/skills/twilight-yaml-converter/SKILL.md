---
name: twilight-yaml-converter
description: Use when converting narrative scripts to YAML format for 《黄昏居酒屋》. Generates game-ready YAML files including character_meta.yaml, nodes_main.yaml, and observations.yaml.
---

# Twilight Izakaya · YAML Converter Skill

## Overview

YAML剧情文件生成 skill，用于 STAGE 4。将影视脚本转换为游戏可用的 YAML 剧情文件。

**Core principle**: Scripts become structured YAML that passes `npm run content:check` without errors. Every field must match the runtime validation contract.

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

1. `character_meta.yaml` - 角色静态资料 + 酒单
2. `nodes_main.yaml` - 主线剧情节点（script_flow 格式）
3. `nodes_teaching.yaml` - 教学节点（鬼神角色）
4. `nodes_chat.yaml` - 闲聊节点（atmosphere_lines + content 格式）
5. `nodes_hidden.yaml` - 隐藏补充节点（atmosphere_lines + content 格式）
6. `observations.yaml` - 观察点
7. `gallery.yaml` - 图鉴章节（profile_sections 格式）

---

## CRITICAL: Runtime Validation Contract

以下规则来自 `src/data/content/validation.ts`，产出必须逐条满足。违反任何一条都会导致 `npm run content:check` 失败。

### 所有节点通用

- `event_id` 或 `id` 至少存在一个，且全局唯一
- `next_node` 如果非空，必须指向真实存在的 event_id
- `trigger_condition.need_event` 必须为数组（可为空数组 `[]`）
- `trigger_condition.need_item` 必须为数组
- `trigger_condition.need_time` 如果存在，必须为非空字符串
- `player_options` 如果存在，必须为数组；每个 option 必须有 `text` 或 `option`

### main / teaching 节点

- **必须**使用 `script_flow`（非空数组）
- `script_flow[].type` 只能是 `env` / `npc` / `inner`
- 每个 step 的 `content` 必须为非空字符串或非空字符串数组

### chat / hidden 节点

- **必须**使用 `atmosphere_lines`（非空字符串数组）
- **必须**使用 `content`（非空字符串数组）
- **禁止**使用 `script_flow`

### drink_request（调酒触发）

- `request_text` 必填（非空字符串）
- `preferred_drink` 必填，包含 `id` / `name` / `formula`
- `formula` 中的每个 ID 必须是 `recipes.json` 中真实存在的原料 ID
- 必须有 `on_mixing_complete` 或 `on_mixing_fail`（指向真实节点）

### teaching（教学触发）

- `teaching.recipe` 必填，包含 `id` / `name` / `formula` / `steps`
- `recipe.id` 必须是 `recipes.json` 中真实存在的配方 ID
- `steps` 必须为非空字符串数组
- 教学节点必须有 `next_node`

### reward（奖励）

- 格式：`reward.details`（单个对象或数组）
- 每个 detail 必须包含 `type` / `id` / `name` / `description`
- `type=recipe` 时 `id` 必须存在于 recipes.json
- `type=ingredient` 或 `type=item` 时 `id` 必须存在于原料目录

### trigger_observation（观察触发）

- `prompt` 必填（非空字符串）
- `continue_node` 必填（非空字符串），且必须指向真实节点

### story_unlocks（故事解锁）

- `story_unlocks.chapters` 必须为非空数组
- 每个 entry 必须包含 `id`（对应 gallery.yaml 中的 chapter id）和 `reason`（非空说明）
- **挂载位置**：只挂在当日收尾节点（`next_node: null` + `diary_note` 的节点）

### gallery（图鉴）

- `profile_sections` 必须为非空数组
- 每个 section 必须包含 `id` / `title`（或 `name`）/ `content` / `depth_level`

---

## character_meta.yaml 模板

```yaml
character_id: example_guest
base_info:
  name: "显示名称"
  type: "迷失者"    # 迷失者 / 滞留者 / 鬼神 / 普通人
  description: |
    一句话角色外观描述，含关键视觉特征。

story:
  summary: >
    一到两句角色故事总览。
  chapters:
    - id: "example_story_01"
      title: "章节标题"
      summary: "图鉴列表展示的短摘要。"
      unlocked: true
      unlock_text: ""
      content: |
        完整长文内容。可自然分段。
    - id: "example_story_02"
      title: "第二章"
      summary: "短摘要"
      unlocked: false
      unlock_text: "继续推进主线后解锁"
      content: |
        完整长文内容。

drinks:
  most_loved:
    phase_1:
      id: "R001"
      name: "饮品名"
      formula: ["bc01", "m04", "f03"]
      reason: "为什么这杯酒匹配这一阶段的情感"
  generally_liked:
    phase_1:
      - id: "R003"
        name: "替代饮品"
        formula: ["bc03", "m05"]
        reason: "理由"
  regular:
    phase_1:
      - id: "R021"
        name: "普通接受"
        formula: ["bj01", "m01"]
        reason: "理由"

llm_chat:
  enabled: true
  max_turns_per_visit: 3
  entry_status_text: "闲聊入口提示文案"
  blocked_message: "当前不适合聊天的提示"
  exhausted_message: "聊天次数用尽的提示"

is_unlocked: false
visits_count: 0
```

---

## nodes_main.yaml 模板

### 标准对话节点

```yaml
character_id: example_guest
nodes:
  - event_id: example_001_dialogue_main
    trigger_condition:
      need_event: []
      need_time: any
      need_item: []
    script_flow:
      - type: env
        content:
          - 环境描写第一句。
          - 环境描写第二句。
      - type: npc
        content:
          - "「NPC台词。」"
      - type: inner
        content:
          - 主角内心独白。
    player_options:
      - text: "「选项文案A」"
        branch_type: flavor
        script_flow:
          - type: npc
            content:
              - "「NPC回应。」"
        impact_log: 记录文本
      - text: "「选项文案B」"
        branch_type: flavor
        script_flow:
          - type: npc
            content:
              - "「NPC回应。」"
        impact_log: 记录文本
    next_node: example_002_dialogue_main
```

### 带观察触发的节点

```yaml
  - event_id: example_002_dialogue_main
    trigger_condition:
      need_event:
        - example_001_dialogue_main
      need_time: any
      need_item: []
    script_flow:
      - type: env
        content:
          - 环境描写。
      - type: npc
        content:
          - "「台词。」"
    trigger_observation:
      prompt: "仔细观察什么？"
      continue_node: example_002_after_obs
      feature_groups:
        - phase_1
    next_node: null
```

### 观察后继续节点

```yaml
  - event_id: example_002_after_obs
    trigger_condition:
      need_event:
        - example_002_dialogue_main
      need_time: any
      need_item: []
    script_flow:
      - type: inner
        content:
          - 观察后的内心总结。
    player_options:
      - text: "「继续对话」"
        branch_type: flavor
        script_flow:
          - type: npc
            content:
              - "「回应。」"
        impact_log: 继续推进
    next_node: example_003_drink_request
```

### 点单/调酒节点

```yaml
  - event_id: example_003_drink_request
    trigger_condition:
      need_event:
        - example_002_after_obs
      need_time: any
      need_item: []
    script_flow:
      - type: env
        content:
          - 他看着空酒杯。
      - type: npc
        content:
          - "「给我一杯......能让人冷静下来的酒。」"
    player_options: []
    next_node: null
    drink_request:
      request_text: "给我一杯能让人冷静下来的酒"
      hint: "可选提示文案"
      retry_on_fail: false
      preferred_drink:
        id: "R021"
        name: "纯米嗨棒"
        formula: ["bj01", "m01"]
    on_mixing_fail: example_phase1_regular_success
```

### 结果节点（成功/一般成功）

不同调酒结果应有不同 event_id，但可以使用雷同的 script_flow 结构。关键差异在 `next_node` 和 `story_unlocks`。

```yaml
  - event_id: example_phase1_most_loved_success
    trigger_condition:
      need_event:
        - example_003_drink_request
      need_time: any
      need_item: []
    script_flow:
      - type: env
        content:
          - 他抿了一口，手指停止了敲动。
      - type: npc
        content:
          - "「......这个味道。对的。」"
      - type: inner
        content:
          - 他似乎放松了一些。
    player_options: []
    next_node: null
    diary_note: "今晚的酒似乎让他松开了什么。"
    story_unlocks:
      chapters:
        - id: "example_story_02"
          reason: "这一天的完整对话、调酒结果与情绪收束已经在日记里形成闭环，此时解锁第二篇故事能与玩家认知推进保持同步。"

  - event_id: example_phase1_regular_success
    trigger_condition:
      need_event:
        - example_003_drink_request
      need_time: any
      need_item: []
    script_flow:
      - type: env
        content:
          - 他喝了一口，没说什么。
      - type: npc
        content:
          - "「......还行。」"
    player_options: []
    next_node: null
    diary_note: "酒不算完美，但他还是喝完了。"
    story_unlocks:
      chapters:
        - id: "example_story_02"
          reason: "即使调酒未达最佳，当日核心情绪已经完整传达并在日记里被重新整理，故事解锁不应绑定单一成功结果。"
```

---

## nodes_teaching.yaml 模板

### 教学说明节点

```yaml
character_id: example_teacher
nodes:
  - event_id: example_teaching_01
    trigger_condition:
      need_event: []
      need_time: W1_D1_Dusk
      need_item: []
    script_flow:
      - type: env
        content:
          - 他把材料一样样摆在吧台上。
      - type: npc
        content:
          - "「今天先学最基础的一杯。」"
    next_node: example_teaching_01_mixing
    teaching:
      recipe:
        id: "R021"
        name: "纯米嗨棒"
        ingredients:
          - 纯米清酒 (bj01)
          - 苏打水 (m01)
        formula:
          - bj01
          - m01
        steps:
          - "「第一步的教学引导文案。」"
          - "「第二步的教学引导文案。」"
      mixing_steps_display:
        - 步骤1的简短显示文本
        - 步骤2的简短显示文本
      game_action:
        trigger: on_teaching_start
        action: ENTER_MIXING_MODE
        params:
          recipe_id: "R021"
          show_steps: true
      tip: "「教学提示文案。」"
```

### 教学调酒节点

```yaml
  - event_id: example_teaching_01_mixing
    trigger_condition:
      need_event:
        - example_teaching_01
      need_time: W1_D1_Dusk
      need_item: []
    script_flow:
      - type: env
        content:
          - 你按他说的顺序开始调酒。
    player_options: []
    next_node: null
    drink_request:
      mode: teaching
      request_text: "按教学内容调一杯纯米嗨棒"
      retry_on_fail: true
      preferred_drink:
        id: "R021"
        name: "纯米嗨棒"
        formula:
          - bj01
          - m01
    on_mixing_complete: example_teaching_01_reaction
```

### 教学反应节点

```yaml
  - event_id: example_teaching_01_reaction
    trigger_condition:
      need_event:
        - example_teaching_01_mixing
      need_time: any
      need_item: []
    script_flow:
      - type: env
        content:
          - 他尝了一口，轻轻点头。
      - type: npc
        content:
          - "「这次对了。」"
    player_options:
      - text: "「谢谢夸奖」"
        branch_type: flavor
        script_flow:
          - type: npc
            content:
              - "「继续保持。」"
        impact_log: 谦虚接受赞美
    next_node: example_teaching_01_reward
```

### 教学奖励节点

```yaml
  - event_id: example_teaching_01_reward
    trigger_condition:
      need_event:
        - example_teaching_01_reaction
      need_time: any
      need_item: []
    script_flow:
      - type: env
        content:
          - 他把一个小纸包推到你面前。
      - type: npc
        content:
          - "「拿着，以后用得上。」"
    player_options: []
    next_node: null
    diary_note: "今天他第一次夸我手稳了些。"
    reward:
      details:
        type: ingredient
        id: "m08"
        name: "可尔必思"
        description: "日本特有的乳酸饮料，是日式调酒的重要配角。"
```

---

## nodes_chat.yaml 模板

闲聊节点**必须**使用 `atmosphere_lines` + `content` 双层结构。**禁止**使用 `script_flow`。

```yaml
character_id: example_guest
nodes:
  - id: chat_01
    event_id: example_chat_001
    trigger_condition:
      need_event: []
      need_time: "between_visits"
      need_item: []
    atmosphere_lines:
      - "环境白描第一句——他在做什么、空间氛围。"
      - "环境白描第二句——细节动作或光影。"
    speaker: null
    content:
      - "「闲聊台词第一句。」"
      - "「闲聊台词第二句。」"
    player_options:
      - text: "「回应选项」"
        immediate_response: "「NPC即时回应。」"
        next_node: null
        fallback_node: null
        impact_log: "记录文本"
        branch_type: "flavor"
    next_node: null
```

字段规则：
- `atmosphere_lines`：环境白描，数组，每一项是一个独立画面。运行时渲染为 `type: env`。
- `content`：NPC台词正文，数组，运行时按 NPC 正文渲染。
- `speaker: null`：闲聊默认不切换说话者名牌。
- `player_options[].immediate_response`：玩家选择后的即时 NPC 回应（可选）。
-  闲聊结束后回到原主线节点，由状态机自动处理。

---

## nodes_hidden.yaml 模板

格式与 `nodes_chat.yaml` 完全相同。语义上承担隐藏线索、补充叙事或特殊观察结果。

```yaml
character_id: example_guest
nodes:
  - id: hidden_memory_001
    event_id: example_hidden_memory_001
    trigger_condition:
      need_event:
        - example_phase3_end
      need_time: any
      need_item: []
    atmosphere_lines:
      - "他望着窗外，像是在看一段已经结束的旧事。"
    speaker: null
    content:
      - "「那天我本来赶得上的。」"
      - "「只是我一直不肯承认，自己其实早就迟了。」"
    player_options: []
    next_node: null
    unlock_gallery: "example_story_03"
```

---

## observations.yaml 模板

```yaml
character_id: example_guest
observations:
  - id: obs_sleeve_stain
    area: "袖口"
    group: phase_1
    objective: "袖口边缘有深色水痕"
    subjective: "那水痕不像雨，更像久洗不掉的旧污渍"
    hint: "他一直避免让你看见那里"
    revealed_at: phase_1
    x: 30
    y: 20
```

---

## gallery.yaml 模板

```yaml
character_id: example_guest
base_info:
  name: "角色名"
  description: "一句话描述"

profile_sections:
  - id: "surface"
    title: "初见"
    content: |
      完整长文内容。可自然分段。
    unlock_condition: "none"
    depth_level: 1

  - id: "example_story_02"
    title: "第二章标题"
    content: |
      完整长文内容。
    unlock_condition: "example_phase1_most_loved_success"
    depth_level: 2

  - id: "example_story_03"
    title: "第三章标题"
    content: |
      完整长文内容。
    unlock_condition: "example_phase3_end"
    depth_level: 3
```

字段规则：
- `id`：必须与 `story_unlocks.chapters[].id` 对应
- `title`：图鉴列表展示标题
- `content`：点击后展开的完整长文
- `unlock_condition`：此处可填 `"none"`（初始解锁）或对应节点 event_id 作为标识
- `depth_level`：1=表层 / 2=中层 / 3=深层

---

## Event ID 命名规范

```
{character_id}_{sequence}_{purpose}

示例：
- aqiang_001_dialogue_main      # 主线对话
- aqiang_002_after_obs          # 观察后继续
- aqiang_003_drink_request      # 点单触发
- aqiang_phase1_most_loved_success   # 最佳结果
- aqiang_phase1_regular_success      # 一般结果
- fox_uncle_teaching_01         # 教学说明
- fox_uncle_teaching_01_mixing  # 教学调酒
- fox_uncle_teaching_01_reaction # 教学反应
- fox_uncle_teaching_01_reward  # 教学奖励
- example_chat_001              # 闲聊
- example_hidden_memory_001     # 隐藏节点
```

---

## 分支转换规则

### Flavor Branch → branch_type: flavor

风味选项不影响剧情走向，`next_node` 统一走节点级别的 `next_node`：

```yaml
player_options:
  - text: "「外面雨很大，要不要先擦一擦？」"
    branch_type: flavor
    script_flow:
      - type: npc
        content:
          - "「不用。我很快就走。」"
    impact_log: 关心他的状态
```

### Plot Branch → branch_type: plot

关键选项不同分支指向不同 event_id：

```yaml
player_options:
  - text: "「告诉她雪很好」"
    branch_type: plot
    next_node: example_003_truth
    condition:
      need_item: "learned_about_snow"
    impact_log: "触发真相分支"
  - text: "「沉默」"
    branch_type: plot
    next_node: example_003_silent
    impact_log: "选择沉默"
```

### 跨角色联动 → trigger_condition

STAGE 2/3 中的 `[联动: xxx角色|方式|触发条件]` 标注，在 STAGE 4 转化为前置条件：

```yaml
trigger_condition:
  need_event:
    - learned_about_snow   # 玩家已了解雪的情况
```

---

## Stage 4 自检清单

```
【STAGE 4 自检清单】

### 节点完整性
- [ ] 所有 event_id 唯一
- [ ] 所有 next_node / continue_node / on_mixing_complete / on_mixing_fail 指向真实存在的 event_id
- [ ] 起始节点（无前置 need_event 或 need_event 为空数组）存在且可被 schedule 引用

### 格式契约
- [ ] main / teaching 节点使用 script_flow（非空，type 仅 env/npc/inner）
- [ ] chat / hidden 节点使用 atmosphere_lines + content（非空字符串数组）
- [ ] 没有在 chat/hidden 中误用 script_flow

### 调酒字段
- [ ] drink_request 有 request_text + preferred_drink（id/name/formula）
- [ ] formula 中的原料 ID 在 recipes.json 中真实存在
- [ ] 有 on_mixing_complete 或 on_mixing_fail
- [ ] teaching 节点有 teaching.recipe（id/name/formula/steps）且 recipe.id 真实存在
- [ ] teaching 节点有 next_node

### 奖励字段
- [ ] reward 使用 reward.details 格式（type/id/name/description）
- [ ] ingredient/item 类型 id 在原料目录中存在
- [ ] recipe 类型 id 在配方目录中存在

### 故事解锁
- [ ] 每个 story_unlocks.chapters[].id 在 gallery.yaml 的 profile_sections 中有对应章节
- [ ] story_unlocks 挂在收尾节点（通常 next_node: null + diary_note）
- [ ] 每个 reason 解释了为什么这个节点是正确的解锁时机

### 图鉴
- [ ] gallery.yaml 的 profile_sections 非空
- [ ] 每个 section 有 id / title / content / depth_level

### 跨阶段信息保留
- [ ] STAGE 1 的所有 flavor_branches id 在 nodes 中有对应的 player_option
- [ ] STAGE 1 的所有 plot_branches id 在 nodes 中有对应的 branch_type: plot
- [ ] STAGE 1 的 drink_hints 对应 phase 有 drink_request.preferred_drink
- [ ] STAGE 2/3 的 [联动: xxx] 已转化为 trigger_condition.need_event 或 story_unlocks

### 校验
- [ ] 已执行 npm run content:check 且通过
- [ ] 如有校验错误，已全部修复并重新校验通过
```

---

## STAGE 4 → STAGE 5 交接

YAML 文件生成完毕后，**必须**执行校验：

```powershell
Set-Location 'F:\twilight_izakaya'
npm run content:check
```

如果校验失败：
1. 阅读错误信息，定位具体节点和字段
2. 修复 YAML 文件
3. 重新执行 `npm run content:check`
4. 重复直到通过

校验通过后，将最终输出文件列表和自检报告展示给用户确认。

---

## Cross-Reference

- **Requires**: [twilight-narrative](../twilight-narrative/SKILL.md) (STAGE 3 output)
- **Format Reference**: [状态系统驱动内容规范.md](../../../状态系统驱动内容规范.md) - 运行时字段契约
- **Template Reference**: [状态系统驱动节点模板.md](../../../状态系统驱动节点模板.md) - 最小脚手架
- **Validation Code**: [validation.ts](../../../src/data/content/validation.ts) - 校验规则来源
- **Next**: STAGE 5 (content:check + fix loop)

---

## Tips

1. **先跑校验再交付** - 文件生成后立即 `npm run content:check`，不要等用户发现错误
2. **atmosphere_lines ≠ script_flow** - chat/hidden 节点严格使用双层结构
3. **formula 原料 ID 必须真实** - 参考 `recipes.json` 确认每个 ID
4. **story_unlocks 挂收尾** - 不要挂在对话中途节点
5. **reason 要具体** - 不要写"推进剧情后解锁"，要写出玩家此时已知什么、为什么可读了
6. **event_id 唯一性** - 跨所有节点文件全局检查，不允许重名
