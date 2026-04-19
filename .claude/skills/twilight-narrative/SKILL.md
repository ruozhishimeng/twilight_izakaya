---
name: twilight-narrative
description: Use when converting literary stories to script format for 《黄昏居酒屋》. Creates readable dialogue scripts with branch labels and cross-character annotations.
---

# Twilight Izakaya · Narrative Script Skill

## Overview

文学脚本 skill，用于 STAGE 3。将文学故事转换为影视脚本风格的对话流程。

**Core principle**: Pure literary content, no structured fields. Readable dialogue with clear act breakdowns and branch labels.

---

## When to Use

**Use when:**
- STAGE 3 of the story pipeline
- Converting a literary story to a playable dialogue flow
- Creating a script that preserves literary quality

**Do NOT use when:**
- Writing the initial literary story (use twilight-literary)
- Converting to game YAML (use twilight-yaml-converter)

---

## Input

A literary story from STAGE 2 (twilight-literary), in markdown format, 3000-5000 words.

---

## Output

A script in markdown format, similar to a film/TV screenplay.

---

## Output Format

```markdown
# 《黄昏居酒屋》—— 角色篇

## 第一幕 · 场景标题

**【居酒屋 · 黄昏】**

（舞台指示/动作描写）

角色名：「台词。」
角色名：「......沉默。」

---

## 第二幕 · 场景标题
...
```

---

## Format Rules

### Scene Headers
```
## 第X幕 · 场景标题

**【地点 · 时间】**
```

### Dialogue Format
```
角色名：「台词。」
```

### Silence/Musing
```
「......」
「......沉默的内容」
```

### Action/Stage Directions
```
（他站起来，走向门口。）

（停顿。）

（门铃响起。）
```

### Separator Between Scenes
```
---
```

---

## Character Type Differentiation

| 角色类型 | STAGE 3 产出重点 |
|---------|----------------|
| **迷失者** | 开场防御性对白（3句以内）；随信任增加逐渐打开；死亡真相要埋入 subtext |
| **滞留者** | 对话中频繁转移话题；自我矛盾要外化（动作/表情泄露真实情绪） |
| **普通人** | 自然对话感强；问题要具体真实；重点在治愈感而非救赎 |
| **鬼神** | 对白要有智慧感但留白；引导而非告知；每个 teaching_prompt 要有双关含义 |

---

## Dialogue Guidelines

### Lost Souls (迷失者)
开场要防御性强，慢慢打开：

```markdown
# ❌ 太快打开
阿相：「我是一个迷失者，我死了但不知道，我妹妹在等我...」

# ✅ 防御性开场
阿相：「......有酒吗。」

（他站着，目光低垂。左手攥着，像握着什么重要的东西。）

阿相：「......我还要走的。马上就走的。」
```

### Lingerers (滞留者)
对话要绕圈，频繁转移话题：

```markdown
阿相：「......」

（他看了一眼窗外。）

阿相：「今天天气......不太好。」

（他收回视线，看向酒杯。）

阿相：「......算了，不说这个。有烟吗。」
```

### Ghosts (鬼神)
对白要 cryptic，有双关：

```markdown
狐面大叔：「酒啊......」

（他慢慢擦着杯子。）

狐面大叔：「酒能让人记起一些事。也能让人忘掉一些事。」

（他的目光落在阿相攥紧左袖口的手上。）

狐面大叔：「......关键是，你想要记住，还是想要忘掉。」
```

---

## Branch Labels

**必须标注分支：**

### Flavor Branches
伏笔场景后标注 `（伏笔）`：

```markdown
调酒师注意到他左袖口露出的红绳。

阿相：「......」

（他的手指无意识地摩挲着袖口。）

阿相：「我妹给的。」

（伏笔：flavor_branch.aqiang_ask_red_string）
```

### Plot Branches
在分歧点明确标注 `[分支A]` / `[分支B]`：

```markdown
阿相看着调酒师。

「......她还好吗。」

（调酒师沉默。）

# [分支A: 玩家选择告诉他"雪很好"]
# [分支B: 玩家选择沉默/隐瞒]

阿相：「......」

（他的目光暗了一下。）
```

### Format for Branch Points
```markdown
# [分支A: 玩家选择'...]
# [分支B: 玩家选择'...]

或者：

# 【玩家选择将影响走向】
# A: 告诉真相 → 结局A
# B: 隐瞒 → 结局B
```

---

## Cross-Character Annotations

若有与其他角色的联动点：

```markdown
[联动: 等待女儿的母亲|共同主题|来不及的告别]
```

格式：
```
[联动: 角色名|方式|触发条件]
```

---

## Example

**Input (excerpt from literary story):**
```markdown
门被推开的时候，他还没意识到自己已经死了。

浑身湿透。制服贴在身上。手机屏幕碎得像蛛网。

但他还攥着胸口那个位置。

「......有酒吗。」

调酒师没问。只是一杯一杯地擦着杯子。

他坐下。手指在桌面上轻轻敲着。

「......有让人想起家的酒吗。」
```

**Output (script):**
```markdown
# 《黄昏居酒屋》—— 阿相篇

## 第一幕 · 雨夜

**【居酒屋 · 黄昏】**

（门被推开，雨声涌入。一个浑身湿透的年轻人站在门口。）

阿相：「......有酒吗。」

（他沉默地站在门口，目光低垂。左手始终攥着，像握着什么重要的东西。）

调酒师没问。只是继续擦着杯子。

---

## 第二幕 · 调酒

（他坐下，手指在桌面上轻轻敲着。）

阿相：「......有让人想起家的酒吗。」

（调酒师沉默地开始调制。）

（阿相抿了一口，手指停止了敲动。）

阿相：「......这个味道。像我妈......」

（他的声音很轻，像怕惊动什么。左手攥得更紧了。）

阿相：「......我还要去送东西。马上就走的。」

（他没有站起来。）

---

## 第三幕 · 真相

（调酒师递上一杯水，没有说话。）

阿相：「......你知道吗。我妹妹，很喜欢弹钢琴。」

（他的眼神有一瞬间的柔软。）

阿相：「她今年......应该十八了吧。」

（他低头看着自己的手。）

阿相：「那天出门的时候，她还在睡。我想回来再告诉她......」

（沉默。）

阿相：「......结果没来得及。」

# 【玩家选择将影响走向】
# A: 告诉真相「雪很好」 → 阿相进入 HEAL 阶段
# B: 沉默/隐瞒 → 阿相继续在 CONFRONT 阶段

---

## 终幕 · 告别

（门铃轻响。他站起身，往门口走去。）

阿相：「......谢谢你的酒。」

（他在门口停下，没有回头。）

阿相：「跟她说我很好就行了。」

（门关上。雨声渐远。）
```

---

## Self-Check Checklist

```
【STAGE 3 自检清单】
- [ ] 保留文学性（无流水账）
- [ ] 分幕清晰
- [ ] flavor_branch 伏笔可见
- [ ] plot_branch 分歧点标注 [分支A] / [分支B]
- [ ] 沉默用「......」
- [ ] 若为迷失者：开场防御性对白（3句以内）
- [ ] 若为滞留者：对话频繁转移话题，有自我矛盾外化
- [ ] 若为鬼神：对白有 cryptic 感，有双关含义
- [ ] 跨角色联动标注 [联动: xxx角色|方式|触发条件]
```

---

## Cross-Reference

- **Requires**: [twilight-literary](../twilight-literary/SKILL.md) (STAGE 2 output)
- **Next Skill**: [twilight-yaml-converter](../twilight-yaml-converter/SKILL.md) - STAGE 4: Convert to YAML

---

## Tips

1. **保持文学性** - 不要变成流水账式的事件记录
2. **让选择自然** - 玩家应该觉得选择是情感上必然的
3. **标注清晰** - 每个分支都要有明确的 [分支A] / [分支B] 标签
4. **用「......」** - 表示沉默和内心活动
5. **动作外化内心** - 特别是滞留者的自我矛盾
