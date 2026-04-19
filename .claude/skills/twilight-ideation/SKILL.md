---
name: twilight-ideation
description: Use when generating task drafts for 《黄昏居酒屋》 characters. Creates character concepts, conflicts, fun elements, tearjerker moments, and player branch designs.
---

# Twilight Izakaya · Ideation Skill

## Overview

任务草案生成 skill，用于《黄昏居酒屋》角色创作的 STAGE 1 阶段。基于角色灵感和关系网，生成完整的人物任务草案。

**Core principle**: Every character needs a clear emotional hook, tangible details, and meaningful player choices.

---

## When to Use

**Use when:**
- STAGE 1 of the story pipeline
- Creating a new character's task draft
- Iterating an existing character's draft

**Do NOT use when:**
- Creating character relationship webs (use twilight-character-web)
- Writing dialogue/nodes (use twilight-narrative or twilight-yaml-converter)

---

## Input

```yaml
character_web:  # 可选，如果有关系网
  characters: [...]
  relationships: [...]

character_inspiration: "角色的一句话描述"
```

---

## Output Structure

```yaml
character_draft:
  # 核心人设
  core_identity:
    name: "角色名"
    type: "迷失者/滞留者/鬼神/普通人"
    role_category: "情感型/教学型/奖励型/挑战型"
    one_line_hook: "一句话核心钩子"

  # 角色分工（鬼神必须填写）
  role_description:
    teaching_intro: "引导此角色的鬼神"
    teaching_mission: "此角色的功课"
    reward_type: "recipe/ingredient/story_unlock"
    challenge_core: "挑战核心"

  # 故事冲突
  central_conflict:
    surface: "表面冲突"
    deeper: "深层冲突"
    root: "根本原因"

  # 趣味点
  fun_elements:
    - "具体细节1"
    - "具体细节2"

  # 催泪点
  tearjerker_moments:
    - "情感高潮1"
    - "情感高潮2"

  # 玩家分支
  player_branches:
    flavor_branches:
      - id: "分支ID"
        trigger: "触发条件"
        npc_reaction: "NPC反应"
        unlock_info: "解锁信息"
    plot_branches:
      - id: "分支ID"
        trigger: "触发条件"
        condition: "前置条件"
        branch_a: {condition: "...", outcome: "..."}
        branch_b: {condition: "...", outcome: "..."}

  # 饮品建议
  drink_hints:
    phase_1: "味觉建议"
    phase_2: "味觉建议"
    phase_3: "味觉建议"
    phase_4: "味觉建议"

  # 角色弧线
  arc_notes:
    start_phase: "开始阶段"
    end_phase: "结束阶段"
    key_unlock_moment: "关键解锁时刻"
    unlock_keys:
      - key: "解锁钥匙"
        unlocks: "解锁内容"
```

---

## Character Type Differentiation

| 角色类型 | phase 弧线 | 关键设计点 | 特殊要求 |
|---------|-----------|-----------|---------|
| **迷失者** | MEMORY→CONFRONT→HEAL→REBORN（全4阶段） | 必须有 tangible 未完成事物；开场对话防御性强 | 不能直接说"我死了" |
| **滞留者** | CONFRONT 为主，可能横跨多阶段 | 逃避的核心真相；对话绕圈、转移话题 | 知道出事但不承认 |
| **普通人** | HEAL→REBORN（1-2阶段为主） | 日常生活困境；单次或短访 | 非超自然，问题是现实的 |
| **鬼神** | 教学弧线（多阶段） | teaching_mission 功课设计；cryptic 对话风格 | 知道但不全说 |

---

## Role Category Guide

### For 迷失者/滞留者
```
role_category: "情感型"
# 默认类别，不需要额外填写 role_description
```

### For 鬼神
```
role_category: "教学型/奖励型/挑战型"

role_description:
  teaching_intro: "谁第一次带这个角色来居酒屋"
  teaching_mission: "这个角色要学的功课"
  reward_type: "recipe/ingredient/story_unlock"  # 给予什么奖励
  challenge_core: "这个角色设置的挑战核心"
```

---

## Information Inference

当用户只提供片句话时，自动推断：

| 输入 | 推断 |
|-----|------|
| "在雨夜死去的邮差" | type=迷失者, 全4阶段弧线, 核心执念=送信 |
| "等待女儿的母亲" | type=滞留者, 逃避的真相=女儿已死 |
| "教人调酒的狐面大叔" | type=鬼神, role_category=教学型 |

**如果推断困难：**
```yaml
[需要用户确认: 角色的核心执念是什么？]
```

---

## Fun Elements Guide

有画面感的细节，不是抽象描述：

| ❌ 抽象 | ✅ 具体 |
|--------|--------|
| "他很努力" | "凌晨四点的闹钟，便利店最便宜的饭团" |
| "他很疲惫" | "碎了屏幕还在滑动的手机" |
| "他很担心妹妹" | "左袖口缝进去的红绳，12岁时妹妹系的" |

---

## Tearjerker Moments Guide

情感共鸣的瞬间，不是说教：

| ❌ 说教 | ✅ 细节 |
|--------|--------|
| "他要死了好可怜" | "护住胸口的动作——'还好，没有碎'" |
| "他很爱妹妹" | "出发前妹妹还在睡，没能告别" |
| "他放不下" | "一百六十七单，凌晨四点的闹钟" |

---

## Player Branches Design

### Flavor Branches (个性化选择)
- 不影响剧情走向
- 只增加角色了解
- 至少 2 个

```yaml
flavor_branches:
  - id: "分支ID"
    trigger: "当玩家问'...'"
    npc_reaction: "阿相的回应"
    unlock_info: "解锁的背景信息"
```

### Plot Branches (剧情走向选择)
- 直接影响故事分支
- 至少 1 个
- 必须有明确的 condition 和 outcome

```yaml
plot_branches:
  - id: "分支ID"
    trigger: "当玩家选择'...'"
    condition: "需要玩家已了解..."
    branch_a:
      condition: "玩家传达积极信息"
      outcome: "阿相进入HEAL阶段"
    branch_b:
      condition: "玩家选择隐瞒"
      outcome: "阿相继续在CONFRONT阶段"
```

---

## Drink Hints by Phase

参考 `emotions.json` 的味觉标签：

| Phase | 情感 | 推荐味觉 |
|-------|------|---------|
| MEMORY | 离别, 重逢, 留恋, 怀旧 | 苦涩, 烟熏, 米香, 温热 |
| CONFRONT | 执念, 孤独, 迷茫, 宽恕 | 辛辣, 清冷, 多变, 柔和 |
| HEAL | 慰藉, 希望, 共鸣, 平静 | 果香, 花香, 浓郁, 平淡 |
| REBORN | 释然, 忘却, 遗忘, 新生 | 清凉, 纯净, 花香, 温热 |

---

## Self-Check Checklist

```
【STAGE 1 自检清单】
- [ ] role_category 填写正确（鬼神：教学/奖励/挑战；迷失者：情感型）
- [ ] flavor_branches >= 2个
- [ ] plot_branches >= 1个，每个分支有明确的 condition 和 outcome
- [ ] 趣味点有画面感
- [ ] 催泪点有情感共鸣
- [ ] unlock_keys 与 plot_branches 对应
- [ ] 若为迷失者：必须有 tangible 未完成事物
- [ ] 若为滞留者：必须有逃避的核心真相
- [ ] 若为鬼神：必须有 teaching_mission 设计
- [ ] 若信息推断困难：标注 [需要用户确认: xxx]
```

---

## Cross-Reference

- **Requires**: [twilight-character-web](../twilight-character-web/SKILL.md) (STAGE 0 output) or character inspiration directly
- **Next Skill**: [twilight-literary](../twilight-literary/SKILL.md) - STAGE 2: Generate literary story

---

## Example

**Input:**
```
character_inspiration: "一个赶着在生日之前把礼物送到妹妹手中的哥哥，死于雨夜车祸"
```

**Output:**
```yaml
character_draft:
  core_identity:
    name: "阿相"
    type: "迷失者"
    role_category: "情感型"
    one_line_hook: "赶着把音乐盒送到妹妹手中的哥哥，却再也没能回家"

  central_conflict:
    surface: "要把音乐盒送到妹妹手里"
    deeper: "妹妹以后一个人了怎么办"
    root: "来不及说再见"

  fun_elements:
    - "一百六十七单的攒钱过程"
    - "凌晨四点的闹钟和便利店饭团"
    - "袖口里藏着的红绳"
    - "碎了屏幕还在滑动的手机"
    - "粉色丝带是在百元店挑了二十分钟选的"

  tearjerker_moments:
    - "护住胸口的动作——'还好，没有碎'"
    - "出发前妹妹还在睡，没能告别"
    - "雪12岁系的红绳，缝进了袖口"
    - "一百六十七单换来的礼物"

  player_branches:
    flavor_branches:
      - id: "aqiang_ask_umbrella"
        trigger: "当玩家问'雨很大吧'"
        npc_reaction: "阿相不记得下雨，只是'好像湿了'"
        unlock_info: "解锁背景: 他对天气已经麻木"
      - id: "aqiang_ask_phone"
        trigger: "当玩家注意到他碎了的手机"
        npc_reaction: "'还能用，导航还要用'"
        unlock_info: "解锁背景: 他有多拼命"
      - id: "aqiang_ask_red_string"
        trigger: "当玩家注意到他袖口"
        npc_reaction: "沉默片刻，说'我妹给的'"
        unlock_info: "解锁背景: 妹妹12岁时的'平安绳'"

    plot_branches:
      - id: "aqiang_tell_truth"
        trigger: "当玩家选择告诉他'雪很好'"
        condition: "需要玩家已了解雪的现状"
        branch_a:
          condition: "玩家传达了积极信息"
          outcome: "阿相的执念开始松动，进入HEAL阶段"
        branch_b:
          condition: "玩家选择隐瞒"
          outcome: "阿相继续在CONFRONT阶段，下次来访时玩家会愧疚"

  drink_hints:
    phase_1: "苦涩/烟熏 → 古典，未竟的生诞"
    phase_2: "清冷/迷茫 → 马丁尼，孤独的清醒"
    phase_3: "温热/甘甜 → 梅酒嗨棒，家的味道"
    phase_4: "纯净/新生 → 最后的告别"

  arc_notes:
    start_phase: "CONFRONT"
    end_phase: "REBORN"
    key_unlock_moment: "当玩家告诉他'雪很好'的时候"
    unlock_keys:
      - key: "玩家见过雪或了解雪的情况"
        unlocks: "plot_branches.aqiang_tell_truth 的 branch_a"
```
