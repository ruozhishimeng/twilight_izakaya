---
name: twilight-literary
description: Use when writing literary character stories for 《黄昏居酒屋》. Creates novel-level 3000-5000 word stories with subtext, pixel-level details, and embedded branch foreshadowing.
---

# Twilight Izakaya · Literary Story Skill

## Overview

纯文学人物故事 skill，用于 STAGE 2。基于任务草案，生成小说级别的人物文学故事。

**Core principle**: Emotional truth through specific details, not exposition. Subtext over statement.

---

## When to Use

**Use when:**
- STAGE 2 of the story pipeline
- Writing a complete character backstory
- Creating story material for script conversion

**Do NOT use when:**
- Creating task drafts (use twilight-ideation)
- Converting to game format (use twilight-yaml-converter)

---

## Input

```yaml
character_draft:
  core_identity: {...}
  central_conflict: {...}
  fun_elements: [...]
  tearjerker_moments: [...]
  player_branches: {...}
  arc_notes: {...}
  drink_hints: {...}
```

---

## Output

A literary story in markdown format, 3000-5000 words.

---

## Structure

```markdown
# 《角色名》—— 副标题文学故事

## 第一章：[场景标题]
[17岁，染坊继承]

## 第二章：[场景标题]
[攒钱过程]

## 第三章：[场景标题]
[核心场景，如死亡]

## 第四章：[场景标题]
[居酒屋场景]

## 终章：[场景标题]
[REBORN/告别]
```

---

## World Pillar Compliance

**All stories MUST follow the 4 pillars:**

1. **Liminal Space**: 居酒屋存在于生死交界处，既不是死后世界也不是人间
2. **Subtext Over Exposition**: 角色通过暗示而非直接表达情感/真相
3. **Drinks as Bridges**: 酒是情感催化剂，不是魔法解决方案
4. **Gradual Redemption**: 救赎是4阶段过程，不是瞬间转变

---

## Character Type Differentiation

| 角色类型 | STAGE 2 产出重点 |
|---------|----------------|
| **迷失者** | 必须包含"不知道自己已死"的模糊感；死亡场景要像素级细节 |
| **滞留者** | 重点在逃避真相的内心戏；对话要绕圈、有自我矛盾 |
| **普通人** | 可跳过死亡背景，聚焦日常困境；情感要真实可共鸣 |
| **鬼神** | 重点在 teaching_mission 功课设计；对白要 cryptic、有双关 |

---

## Writing Guidelines

### Environment Descriptions
每个场景必须有像素感的 env 描写：

```markdown
# ❌ 抽象
雨夜，他很悲伤。

# ✅ 像素感
雨打在玻璃上，像碎掉的星星。他低头看着自己湿透的鞋，发现左边那只渗进了水——那种冰凉的、慢慢渗透的感觉，他太熟悉了。
```

### Dialogue Rules
对话要短促、有停顿、有潜台词：

```markdown
# ❌ 直接说出情感
"我很担心妹妹，她一个人在家我不放心。"

# ✅ 潜台词
他看了一眼手机。屏幕上还亮着妹妹钢琴比赛的通知。
"......她应该睡了。"
```

### Emotional Layering
情感层次分明，不是爆发式：

```markdown
# ❌ 爆发式
他突然想起妹妹一个人在家，放声大哭起来。

# ✅ 层次分明
他收起手机。
动作很慢。
像是在把什么东西一起收进去。
然后他转身，肩膀绷得像拉满的弓弦。
"......走吧。"
```

### Silence Markers
用「......」表示沉默和内心活动：

```markdown
他看着门外。
「......」
「......雨好像停了。」
```

---

## Branch Foreshadowing

**必须埋入分支伏笔：**

### Flavor Branch 伏笔
每个 flavor_branch 都必须有对应的伏笔场景：

```yaml
flavor_branches:
  - id: "aqiang_ask_umbrella"
    trigger: "当玩家问'雨很大吧'"
```

对应的伏笔场景：
```markdown
他站在门口，湿透的制服贴在身上。
调酒师注意到他的鞋——左脚那只渗水了。
但他好像没察觉。
「......好像湿了。」他说的不是雨。
```

### Plot Branch 分歧点
每个 plot_branch 都必须有明确的分歧时刻：

```yaml
plot_branches:
  - id: "aqiang_tell_truth"
    branch_a: 玩家传达积极信息
    branch_b: 玩家隐瞒
```

对应的分歧点：
```markdown
调酒师擦着杯子，等待他开口。

他看着杯中的酒。

「......她，」
他停顿了很久。
「......她还在弹琴吗。」

# [分歧点：玩家选择告诉他"雪很好"或选择沉默]
```

---

## Cross-Character Relationships

若有与其他角色的关联，必须标注：

```markdown
[联动: xxx角色|方式|触发条件]
```

例：
```markdown
他想起母亲。
不是记忆里的母亲，是很久以后才会出现在居酒屋里的母亲。

[联动: 等待女儿的母亲|共同主题|来不及的告别]
```

---

## Self-Check Checklist

```
【STAGE 2 自检清单】
- [ ] 字数 >= 3000字
- [ ] 有像素感 env 描写
- [ ] 对话短促、有停顿
- [ ] 情感层次分明，不是爆发式
- [ ] flavor_branch 伏笔埋入
- [ ] plot_branch 分歧点设计
- [ ] 若为迷失者：死亡场景有像素级细节，"不知道自己已死"的模糊感
- [ ] 若为滞留者：内心戏体现逃避，有自我矛盾外化
- [ ] 若有跨角色关联：[联动: xxx] 标注清晰
```

---

## Cross-Reference

- **Requires**: [twilight-ideation](../twilight-ideation/SKILL.md) (STAGE 1 output)
- **Next Skill**: [twilight-narrative](../twilight-narrative/SKILL.md) - STAGE 3: Convert to script

---

## Example Output

```markdown
# 《蓝染坊的儿子》—— 阿相文学故事

## 第一章：那个撕掉通知书的夏天

通知书的红印章还没干。

十七岁的冰相站在玄关，手里攥着那张纸。国立大学的标志在灯光下发亮，像是某种承诺，又像是某种审判。

父亲刚走三个月。肺病。染料粉尘。染坊的烟囱已经不冒烟了。

他看着在厨房发呆的母亲，妹妹小雪还蹲在门槛上玩那根红线绳——12岁生日时她系在他手腕上的那个，说是"护身符"。

「哥？」

他把通知书叠起来，塞进口袋。

「......我去厂里看看。」

---

## 终章：黄昏的居酒屋

门被推开的时候，他还没意识到自己已经死了。

浑身湿透。制服贴在身上。手机屏幕碎得像蛛网。

但他还攥着胸口那个位置。

「......有酒吗。」

调酒师没问。只是一杯一杯地擦着杯子。

他坐下。手指在桌面上轻轻敲着。

「......有让人想起家的酒吗。」

调酒师开始调制。

他抿了一口，手指停止了敲动。

「......这个味道。像我妈......」

他的声音很轻，像怕惊动什么。左手攥得更紧了。

「......我还要去送东西。马上就走的。」

他说。却没有站起来。

---

[联动: 等待女儿的母亲|共同主题|来不及的告别]
```

---

## Tips

1. **不要写流水账** - 每个场景都要有情感推进
2. **不要直接说教** - 让读者自己感受
3. **细节要具体** - "一百六十七单"比"很多努力"更有力
4. **保持 twilight 感** - 角色不知道自己死了，subtext 是关键
5. **伏笔要自然** - 让玩家觉得选择是自然产生的
