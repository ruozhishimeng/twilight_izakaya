---
name: twilight-izakaya
description: 为《黄昏居酒屋》生成角色剧本。作为首席叙事架构指南，包含所有节点类型的详尽示例，以及与调酒、日志、图鉴系统的深度交互规范。
---

# 黄昏居酒屋 · 首席叙事架构与剧本生成指南 (Director's Script)

> **版本**：v1.1（与《剧情文件规范文档 v1.0》对齐）
>
> **变更日志**：
> - 新增 `presentation` 演出系统、`audio` 音频系统
> - 统一 `reward` 结构为 `items[]` 数组格式
> - 统一 `branch_type` 为 `flavor | plot | hidden`
> - 新增 `diary_note` 正式规范
> - 明确 `observations.yaml` 和 `gallery.yaml` 结构
> - 新增 `transition`、`system` 节点类型

---

## 核心使命

作为《黄昏居酒屋》的主策划与叙事架构师，你的任务是生成符合世界观的角色剧本。本剧本不仅是纯文本，更是直接驱动游戏引擎（UI、立绘、存档、逻辑路由、调酒系统、图鉴系统）的**"底层控制代码"**。所有角色类型统一使用极致严谨的节点系统。

---

## 节点类型 (Node Types)

固定以下节点类型：

| type | 说明 |
|------|------|
| `dialogue` | 普通对话节点 |
| `observation` | 进入打量/观察 |
| `mixing` | 进入调酒 |
| `reward` | 奖励展示 |
| `transition` | 黑屏过渡、铃声、日结、独白等 |
| `system` | 纯系统提示 |
| `ending` | 当前客人流程结束 |

---

## 三大核心叙事机制 (Core Narrative Mechanisms)

### 机制 1：选项类型区分 (Flavor vs Plot vs Hidden)

在 `player_options` 中，有三种选项类型：

- **风味选项 (Flavor Options)**：`branch_type: "flavor"`
  - 点击后**直接跳转**到 `next_node`
  - 用于简单的态度回应，不追踪完成状态
  - **不应定义选项级别的 `next_node`**，使用节点级别的 `next_node`

- **隐藏选项 (Hidden Options)**：`branch_type: "hidden"`
  - 点击后标记为"已完成"，玩家可继续选择其他选项
  - 所有选项都完成后才跳转到节点的 `next_node`
  - 用于需要玩家探索所有对话的场景

- **关键选项 (Plot Options)**：`branch_type: "plot"`
  - 不同的选项导向**完全不同**的 `next_node`
  - 用于实质性的剧情分歧

### 机制 2：收束节点 (Convergence Node) 的丝滑法则

**写作强制规则**：当剧本设计中出现多个前置节点（或多个选项）导向同一个后置节点（收束节点）时，该后置节点的内容不能与前置节点的内容冲突。严禁在收束节点中提及仅在某一条前置分支中才出现过的专属信息。

### 机制 3：条件门控与后备退路 (Condition & Fallback)

```yaml
player_options:
  - option: "「这是你的吗？」"
    branch_type: "plot"
    condition:
      need_item: "item_broken_musicbox"
    fallback_node: "bx_05_failed_search"  # 条件不满足时的退路
    next_node: "bx_04_success_reveal"      # 条件满足时的跳转
```

支持的条件字段：
- `need_item`：需要持有某道具
- `need_event`：需要已发生某事件
- `need_flag`：需要某 flag

---

## 全节点数据结构 Schema (The Master Schema)

### 必填字段

所有节点至少应包含：

```yaml
event_id: "xxx"           # 唯一标识符
type: "dialogue"          # 节点类型
```

同时至少满足以下一种内容存在：

- `script_flow`
- `player_options`
- `mixing`
- `reward`
- `observation`

### 通用可选字段

```yaml
trigger_condition:
  need_event: []         # 必须已发生的 event_id 列表
  need_item: []          # 必须持有的道具 ID 列表
  need_time: "W1_D1"     # 触发时间
  need_flag: []          # 必须满足的 flag 列表

script_flow:              # 剧本流
  - type: "env"          # 环境/氛围描述
    content:
      - "文字描述..."
  - type: "npc"          # NPC 台词
    content:
      - "「台词...」"
  - type: "inner"        # 主角内心独白
    content:
      - "内心想法..."
  - type: "system"       # 系统提示
    content:
      - "系统消息..."

next_node: "xxx"         # 下一节点（null 时由引擎接管）

story_unlocks:            # 人物故事解锁声明，通常挂在当日收尾节点
  chapters:
    - id: "fox_uncle_story_02"
      reason: "说明为什么这个节点已经完成了该篇人物故事所需的剧情推进，并且会在日记/日结后形成叙事闭环。"

player_options:           # 玩家选项
  - option: "「选项」"
    branch_type: "flavor" | "plot" | "hidden"
    condition:           # 可选，条件门控
      need_item: []
      need_event: []
      need_flag: []
    fallback_node: "xxx" # 条件不满足时的退路
    script_flow:         # 选项的 NPC 回应
      - type: "npc"
        content:
          - "「回应...」"
    impact_log: "xxx"    # 记录文本
    trigger_event: "xxx" # 触发事件
    next_node: "xxx"     # 仅 plot 类型需要

diary_note:               # 日记记录
  text:
    - "独白内容..."

audio:                    # 音频控制
  bgm:
    action: "switch" | "stop" | "keep" | "resume"
    tag: "bgm_tag"
    fade_in: 1.2
    fade_out: 0.8
    loop: true
  sfx:
    - tag: "sfx_tag"
      timing: "on_enter" | "after_text" | "on_option_select"
      volume: 0.9

presentation:             # 演出控制
  speaker: "npc" | "player" | "system"
  portrait:
    action: "show" | "hide" | "keep" | "change"
    character_id: "fox_uncle"
    expression: "dialogue" | "main" | "smile" | "serious" | "shadow"
    position: "left" | "center" | "right"
  background:
    action: "switch" | "keep" | "hide"
    tag: "background_tag"
    transition: "fade" | "cut" | "blackout"
```

---

## 教学调酒系统 (Teaching Mixing)

教学流程链：
```
dialogue → mixing → reaction → reward → ending
```

### 教学对话节点

```yaml
- event_id: "fox_uncle_003_teaching"
  type: "dialogue"
  next_node: "fox_uncle_003_mixing"
  script_flow:
    - type: "env"
      content:
        - "老者从腰间解下朱红色的葫芦，轻轻放在吧台上。"
    - type: "npc"
      content:
        - "「今天教你一杯——古典。」
  mixing:
    mode: "teaching"
    speaker: "teacher"
    teaching_prompt:
      - "「先稳住基底。」"
      - "「最后让味道收回来。」"
    preferred_drink:
      id: "R008"
      name: "古典"
      formula: ["bc01", "f01", "f09"]
    retry_on_fail: true
    on_success: "fox_uncle_003_reward"
    on_fail: "fox_uncle_003_fail"
```

### 调酒进行节点

```yaml
- event_id: "fox_uncle_003_mixing"
  type: "mixing"
  next_node: null  # 调酒完成后由 on_mixing_complete 接管
  mixing:
    mode: "teaching"
    speaker: "teacher"
    preferred_drink:
      id: "R008"
      name: "古典"
      formula: ["bc01", "f01", "f09"]
    retry_on_fail: true
    on_success: "fox_uncle_003_reaction"
    on_fail: "fox_uncle_003_fail"
  audio:
    bgm:
      action: "switch"
      tag: "mixing_teaching"
      fade_in: 0.8
      loop: true
```

### 反应节点

```yaml
- event_id: "fox_uncle_003_reaction"
  type: "dialogue"
  trigger_condition:
    need_event: ["fox_uncle_003_mixing"]  # 必须指向对应的 mixing 节点
  script_flow:
    - type: "env"
      content:
        - "他轻轻抿了一口。"
    - type: "npc"
      content:
        - "「不错...这杯古典，调得恰到好处。」
  player_options:
    - option: "「谢谢夸奖」"
      branch_type: "flavor"
      script_flow:
        - type: "npc"
          content:
            - "「继续保持。」
      impact_log: "谦虚接受赞美"
  next_node: "fox_uncle_003_reward"
```

### 奖励节点

```yaml
- event_id: "fox_uncle_003_reward"
  type: "reward"
  script_flow:
    - type: "env"
      content:
        - "他从袖中取出一个小布包，轻轻推到你面前。"
    - type: "npc"
      content:
        - "「手艺不错。这个给你。」
  next_node: "fox_uncle_003_ending"
  reward:
    items:
      - type: "ingredient"
        id: "f09"
        name: "黑胡椒"
        is_new: true
```

> **注意**：旧的 `reward.details[]` 格式已废弃，请使用 `reward.items[]`：
> - `type`: `ingredient` | `recipe` | `memory` | `key_item`
> - `id`: 资源 ID
> - `name`: 显示名称
> - `is_new`: 是否新解锁（替代旧的 `quantity` 字段）

---

## 点单调酒系统 (Drink Request - 非教学)

用于迷失者/滞留者的普通点单。

```yaml
- event_id: "aqiang_003_drink_request"
  type: "dialogue"
  script_flow:
    - type: "npc"
      content:
        - "「......随便给我弄杯什么吧。越烈越好。」
  next_node: null  # 引擎接管，进入调酒阶段
  mixing:
    mode: "normal"
    speaker: "player"
    player_prompt:
      - "他似乎需要一杯能让他冷静下来的酒..."
    preferred_drink:
      id: "R008"
      name: "古典"
      formula: ["bc01", "f01", "f09"]
    retry_on_fail: true
    on_success: "aqiang_003_success"
    on_fail: "aqiang_003_fail"
```

### 角色酒单喜好（定义在 nodes_main.yaml 顶部）

```yaml
drinks:
  most_loved:
    phase_1:
      id: "R008"
      name: "古典"
      formula: ["bc01", "f01", "f09"]
      reason: "苦涩和执念的交织"
  generally_liked:
    phase_1:
      - id: "R003"
        name: "血腥玛丽"
        formula: ["bc03", "m05", "f14", "f06", "f09", "f15"]
        reason: "血色与苦涩"
  regular:
    phase_1:
      - id: "R021"
        name: "纯米嗨棒"
        formula: ["bj01", "m01"]
        reason: "简单的日式气泡酒"
```

---

## 打量与图鉴系统 (Observation & Gallery)

### observations.yaml

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

### gallery.yaml

```yaml
character_id: fox_uncle
profile_sections:
  - id: "identity_hint"
    title: "袖口的秘密"
    npc_talking: "仔细观察发现他袖口有金色的稻穗刺绣..."
    unlock_condition: "obs_inari_embroidery"
    depth_level: 2
  - id: "true_story"
    title: "稻荷的故事"
    npc_talking: "他在黄昏的居酒屋终于放下了那份执念..."
    unlock_condition: "fox_uncle_phase3_ending"
    depth_level: 3
```

---

## 过渡与系统节点 (Transition & System)

### transition 节点示例

```yaml
- event_id: "day_1_ending"
  type: "transition"
  script_flow:
    - type: "system"
      content:
        - "第一夜结束。"
    - type: "inner"
      content:
        - "门铃轻响，他消失在夜色中。"
  next_node: "day_2_start"
  audio:
    bgm:
      action: "fade_out"
      fade_out: 1.5
```

### system 节点示例

```yaml
- event_id: "game_tip_01"
  type: "system"
  script_flow:
    - type: "system"
      content:
        - "提示：观察客人可以获得线索。"
  next_node: null  # 自动进入下一节点
```

---

## 叙事风格与文学指南 (Literary Guidelines)

1. **潜台词原则 (Show, Don't Tell)**：角色绝对不可以直白地说出"我很伤心"或"我死了"。尽量通过动作（如"无意识地抠着桌角"、"死死盯着屏幕"）和顾左右而言他来表现焦虑。
2. **像素感白描 (Director's Lens)**：`script_flow` 中的 `type: "env"` 必须带有极强的画面感，仿佛能看到 16-bit 像素小人的动作。例如："水滴砸在吧台上"、"指尖微微发抖"、"霓虹灯光扫过他苍白的脸"。
3. **主角的克制**：主角（调酒师）的台词必须温和、克制、像一个倾听者。不要急于追问真相。
4. **防御性开场**：除了教学的狐面大叔，所有来访的迷失者前期必须具有强烈的【戒备心】和【防御性】，对话要短促、敷衍。
5. **节奏结构**：「一句两句、再一句两句」。2句对话 → 沉默/动作 → 2句对话。沉默统一使用「......」。
6. **内容独立性原则 (No Redundancy)**：**前后相邻节点间的 `script_flow` 内容必须独立，不能重复**。

---

## 质量检查清单 (Quality Checklist)

### 核心机制检查
- [ ] `event_id` 唯一
- [ ] `type` 为合法节点类型
- [ ] `branch_type` 为 `flavor` | `plot` | `hidden`
- [ ] `trigger_condition.need_event` 不为空数组（除起始节点外）
- [ ] `mixing.preferred_drink` 包含 `id` 和 `formula`

### 系统对接检查
- [ ] `reward.items[]` 使用正确格式（非旧的 `details[]`）
- [ ] `audio.bgm.action` 为 `switch` | `stop` | `keep` | `resume`
- [ ] `presentation.portrait.action` 为 `show` | `hide` | `keep` | `change`
- [ ] `observations.yaml` 的 `id` 与 `gallery.yaml` 的 `unlock_condition` 匹配

### 基础格式检查
- [ ] 结构扁平化（无嵌套的 rounds/dialogues 数组）
- [ ] 节点ID格式为 `{character_id}_{number}_{event_type}`
- [ ] 沉默统一使用「......」

---

## 生成执行步骤

1. **确定 character_type**：根据输入确定角色类型（鬼神/迷失者/滞留者）
2. **规划节点流**：设计对话 → 打量/观察 → 调酒 → 反应 → 奖励流程
3. **生成文件（按功能维度）**：
   - 基础：`character_meta.yaml`, `nodes_main.yaml`, `observations.yaml`, `gallery.yaml`
   - 教学：`nodes_teaching.yaml`（鬼神角色）
   - 支线：`nodes_side.yaml`
4. **执行质量检查**：严格对照 Checklist 验证生成的 YAML
---

## 人物故事长文规范（当前项目强制）

从现在开始，`character_meta.yaml` 里的人物故事统一使用正式字段 `story.chapters`，并且每个故事条目都写成一篇完整长文。

### 标准结构

```yaml
story:
  summary: >
    角色故事总览，一到两句即可。
  chapters:
    - id: "fox_uncle_story_01"
      title: "初见"
      summary: "用于图鉴列表展示的短摘要。"
      unlocked: true
      unlock_text: ""
      content: |
        这里直接写完整长文。
        可以自然分段，但仍然属于同一个故事条目。
```

### 字段要求

- `story.summary`
  - 人物故事总览，只写 1 到 2 句

- `story.chapters[].title`
  - 图鉴列表标题，必须是正式故事名

- `story.chapters[].summary`
  - 图鉴列表短摘要，控制在 1 到 2 句

- `story.chapters[].content`
  - 点击条目后展开阅读的完整长文
  - 允许用空行自然分段
  - 当前项目不再拆成 `sections`

- `story.chapters[].unlocked`
  - `true` 为默认可读
  - `false` 为初始锁定

- `story.chapters[].unlock_text`
  - 锁定时给玩家看的提示文案

### 当前项目禁止写法

- 不再为人物故事生成 `sections`
- 不再混用 `character_stories`、`stories`、`story_entries`
- 不再只写 `short_story` 而缺失 `story.chapters`

### 与前端对接规则

- 图鉴故事列表读取 `story.chapters[].title / summary / unlocked / unlock_text`
- 点击条目后读取 `story.chapters[].content`
- `short_story` 仅保留兼容用途，不再作为主展示字段

### 写作要求

- 每个故事条目必须是完整可阅读的人物片段，而不是提纲
- 长文优先服务于人物补完和回看体验，避免与主线台词逐句重复
- 同一角色可以有多个故事条目，但每个条目内部都用一篇完整长文承载

---

## short_story 详细角色设定写作规范（当前项目强制）

`short_story` 是角色最核心、最详细的设定文档，不在游戏内公开，仅供策划、开发和 AI 生成时参考。它是 `story.chapters` 的内容来源，也是角色一切行为、台词、决策的底层依据。

### 通用写作原则

1. **全方位覆盖**：必须涵盖角色的起源、性格、记忆、执念、遗憾、与世界的关系
2. **埋设悬念**：重要的谜团只给引子，不揭露答案，留待后续补充
3. **服务于创作**：直接支撑剧情生成、台词设计、角色行为逻辑
4. **保持神秘感**：细节要具体，但核心秘密要给暗示不能明说
5. **类型适配**：不同角色类型的侧重点不同（见下文）

### 角色类型适配

#### 迷失者（已故但不知自己已死）

```yaml
short_story: |
  【生前概况】
  # 姓名、年龄、身份、社会关系
  # 生前是做什么的，性格如何
  # 与谁有羁绊

  【死亡真相】
  # 怎么死的，死因是什么
  # 死亡地点和环境
  # 死亡那一刻在想什么

  【执念核心】
  # 不知道自己死了
  # 还在做死前没完成的事
  # 是什么让他留在这里

  【与玩家的关系】
  # 玩家扮演的调酒师能做什么
  # 他最终需要什么才能离开
  # 玩家和他的关系走向

  【遗憾与未解】
  # 生前来不及说的话
  # 死前最后悔的事
  # 还有什么放心不下的
```

#### 滞留者（徘徊在生死边界的生者）

```yaml
short_story: |
  【生前行踪】
  # 姓名、年龄、身份
  # 生前是什么样的人，性格如何
  # 与谁有羁绊

  【滞留原因】
  # 为什么会停留在生死边界
  # 有什么放不下的人或事
  # 不知道死后的世界是什么样子

  【执念核心】
  # 生者还在坚持的事
  # 不愿承认/面对的真相
  # 等一个永远不会来的人

  【与玩家的关系】
  # 玩家能不能/应不应该让她知道真相
  # 如何帮助她面对现实
  # 她的最终走向是释怀还是继续等待

  【未解之谜】
  # 她不知道的死亡真相（如果她真的死了）
  # 她在逃避什么
  # 那个她一直在等的人/答案是什么
```

#### 鬼神/特殊存在

```yaml
short_story: |
  【起源】
  # 他是什么，怎么成为现在的存在
  # 能力和代价是什么
  # 与这个世界最初的关系

  【存在本质】
  # 他的职责或存在意义是什么
  # 他见证过什么
  # 他不能改变什么

  【执念/未解之谜】
  # 他还在等什么
  # 他不愿意说/不能说的秘密
  # 面具背后或身份背后的真相

  【与玩家的关系】
  # 为什么要接近/教导/考验玩家
  # 想从玩家身上得到什么
  # 最终想把什么交给玩家

  【遗憾】
  # 神什么都记得，却留不住任何东西
  # 他最害怕什么
  # 有什么是他即使过了很久也释怀不了的
```

### 悬念埋设规则（通用）

以下内容不得在 short_story 中直接揭露，必须只给引子或暗示：

| 禁止直接写 | 要求 |
|-----------|------|
| 场所的最终起源 | 只写"这个存在来的时候这里就已经是这样了"，不解释是谁建的 |
| 其他角色的死亡真相细节 | 只写"她/他死前发生了什么"，让相关角色的故事自己揭露 |
| 核心秘密的完整答案 | 只写"他在回避什么"，不写"为什么回避" |
| 故事的最终走向 | 只写"他会等到/失去什么"，不写"然后呢" |

### 禁止写法（通用）

- ❌ 只写身份标签（"他是迷失者，死在雨夜"）
- ❌ 一次性揭露所有秘密
- ❌ 与主线台词逐句重复
- ❌ 没有情感重量，只有信息堆砌
- ❌ 写成了提纲式大纲

### short_story 与 story.chapters 的关系

- `short_story`：内部详细设定文档，是所有内容的根源
- `story.chapters`：从 short_story 中提取的、适合在游戏内分阶段解锁的片段
- 生成 story.chapters 时，应从 short_story 中提炼关键场景和主题，而非另起炉灶

---

## 人物故事节点解锁规范（当前项目强制）

人物图鉴里的故事条目解锁继续采用**节点驱动**，不允许把解锁逻辑写死在前端。

### 核心原则

- 故事内容放在 `character_meta.yaml -> story.chapters`
- 解锁时机写在具体剧情节点上
- 节点只声明“本节点完成后，本日记阶段应解锁哪些故事”
- 前端在**整天结束后的日记/反思/总结阶段**统一提交解锁结果
- 图鉴只读取最终已解锁结果，不自行推理剧情进度

### 节点字段

```yaml
story_unlocks:
  chapters:
    - id: "fox_uncle_story_02"
      reason: "玩家在第三天已经完整经历了关于止痛药的教学与尾声反思，足以在图鉴中展开“面具之后”这段补完故事。"
```

### 字段要求

- `story_unlocks.chapters`
  - 数组
  - 每个元素代表一条待解锁的人物故事

- `story_unlocks.chapters[].id`
  - 必填
  - 必须对应 `character_meta.yaml -> story.chapters[].id`

- `story_unlocks.chapters[].reason`
  - 必填
  - 用于说明“为什么这个节点结束后可以解锁这条故事”
  - 这是内容闭环字段，主要服务于剧情生成、校对和后续维护

### reason 的写法要求

- 必须明确指出：
  - 玩家在这个节点之前已经知道了什么
  - 这个节点补充或确认了什么
  - 为什么此时打开人物图鉴阅读这段长文是合理的

- 不要写成空泛注释，例如：
  - `推进剧情后解锁`
  - `角色故事解锁`

- 推荐写法：
  - `玩家已经完成第一天教学并在日记里记录下对狐面大叔身份的疑惑，此时解锁“黄昏里的第一任酒保”，用于补完他作为引路者的底色。`
  - `小雪在第二阶段明确提到了《月光》与哥哥留下的音乐盒，此时解锁“没有回来的人”，让图鉴内容与主线情绪保持闭环。`

### 挂载位置规则

- 优先挂在**当日完整剧情真正收尾的节点**
- 通常这个节点同时具备：
  - `next_node: null`
  - `diary_note`
  - 或明显是当天该角色的最后结果节点

- 不要挂在：
  - 中途普通对白节点
  - 尚未完成该日情绪收束的分支节点
  - 纯奖励节点中段

### 与前端的对接规则

- 节点结束时，运行时收集 `story_unlocks`
- 不立即写入图鉴
- 当天结束并进入日记/反思/日结阶段时统一提交
- 图鉴只根据已提交的解锁结果决定故事是否可读

### 当前项目禁止写法

- 不允许前端按 `characterProgress` 直接硬编码某条故事自动解锁
- 不允许只改 `character_meta.story.chapters[].unlocked` 作为剧情推进解锁方案
- 不允许新增故事却不在对应剧情尾节点补 `story_unlocks`
