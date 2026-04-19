---
name: twilight-character-web
description: Use when establishing or modifying character relationship webs for 《黄昏居酒屋》. Creates connection maps, key item flows, and shared memory themes between characters.
---

# Twilight Izakaya · Character Web Skill

## Overview

人物关系网建立 skill，用于在《黄昏居酒屋》中创建和管理角色之间的关系网络。这是 STAGE 0 工作流，发生在任何角色剧情生成之前。

**Core principle**: Character connections should reveal deeper emotional truths, not just surface similarities.

---

## When to Use

**Use when:**
- Creating a new character relationship web from scratch (first time)
- Adding new characters to an existing relationship web
- Modifying/iterating an existing relationship web
- Expanding the Twilight Izakaya world with interconnected characters

**Do NOT use when:**
- Single character creation without web context (use twilight-ideation directly)
- Generating dialogue/nodes (use twilight-narrative or twilight-yaml-converter)

---

## Input

### Mode 1: Create from Scratch
```
角色1: "角色描述"
角色2: "角色描述"
角色3: "角色描述"
...
```

### Mode 2: Iterate/Rewrite Existing
```
现有关系网: character_web.yaml
改写需求: 具体描述需要如何修改
```

---

## Output Structure

```yaml
character_web:
  # 人物节点
  characters:
    - id: "unique_id"
      name: "显示名称"
      role: "迷失者/滞留者/鬼神/普通人"
      core_item: "核心物品"
      brief: "一句话描述"

  # 人物关系
  relationships:
    - from: "character_id"
      to: "character_id"
      type: "关系类型"
      connection_point: "深层连接点"

  # 关键物品
  key_items:
    - id: "item_id"
      name: "物品名"
      owner: "character_id"
      story: "物品故事"
      connected_to: "关联的角色或物品"

  # 共同记忆
  shared_memories:
    - theme: "共同主题"
      characters: ["id1", "id2"]
      description: "描述"

  # 设计笔记
  design_notes:
    - "笔记内容"

  # 冲突标注
  conflicts:
    - "[冲突: 描述]"  # 如有与现有角色的冲突
```

---

## Key Design Principles

### 1. Deep Connection Points
不是表面相似，而是深层情感共鸣：
- ❌ "两个角色都死了" (表面)
- ✅ "两个人都在生前没能好好告别" (深层)

### 2. Key Items as Bridges
物品应该：
- 有明确的故事背景
- 连接角色与他们的执念
- 可以在角色间流转（通过调酒师）

### 3. Ghost Role Classification
鬼神必须有明确的功能定位：

| 类型 | 描述 | 示例 |
|-----|------|-----|
| **教学型** | 引导玩家理解游戏机制 | 狐面大叔 |
| **奖励型** | 提供奖励和解锁内容 | 特定鬼神 |
| **挑战型** | 设置情感挑战和考验 | 特定鬼神 |

### 4. Shared Memories
共同记忆主题让角色产生隐性联系：
- "来不及的告别"
- "未完成的承诺"
- "被留下的人"

---

## Character Type Basics for Web

| 类型 | 核心特征 | 在关系网中的位置 |
|-----|---------|----------------|
| **迷失者** | 不知道自己死了，执着于未完成事物 | 通常是关系网核心节点 |
| **滞留者** | 知道出了事但拒绝接受 | 横向连接，可能形成群组 |
| **鬼神** | 超自然存在，有教学/奖励/挑战功能 | 枢纽角色 |
| **普通人** | 活着的客人，情感困扰 | 外部连接点 |

---

## Agent Execution Guidelines

### When Creating New Web

1. **分析角色灵感** → 提取每个角色的：
   - 核心执念/物品
   - 情感主题
   - 与其他角色的潜在共鸣

2. **建立连接** → 设计关系类型：
   - 师徒（教学鬼神 ↔ 迷失者）
   - 陌生但相似（两个迷失者）
   - 信息桥梁（通过调酒师传递）
   - 共同主题（shared_memories）

3. **物品流转** → 设计关键物品：
   - 物品主人
   - 物品故事
   - 物品如何连接角色

4. **检查** → 自检清单验证

### When Iterating Existing Web

1. **读取现有关系网**
2. **分析改写需求**
3. **检查冲突** → 是否有与现有角色的冲突？
4. **更新关系网**
5. **自检**

---

## Self-Check Checklist

```
【STAGE 0 自检清单】
- [ ] 关系网中每个角色都有明确的 core_item
- [ ] 人物关系有深层连接点，不是表面相似
- [ ] 关键物品有明确的 owner 和 connected_to
- [ ] shared_memories 有共同主题
- [ ] 鬼神角色有明确的功能定位（教学/奖励/挑战）
- [ ] 没有强行关联
- [ ] 与已有关系网中的角色没有冲突（如有冲突，标注 [冲突: xxx] 等待用户确认）
```

---

## Conflict Detection

如果新角色与现有关系网存在冲突（如两个角色有相同的核心物品），必须标注：

```yaml
conflicts:
  - "[冲突: 阿相和XX角色都有关于'妹妹'的执念，需要用户确认如何区分]"
```

---

## Relationship Type Examples

| Type | Description | Example |
|------|-------------|---------|
| `师徒` | 教学鬼神引导学生 | 狐面大叔 → 阿相 |
| `陌生但相似` | 处境相似但不相识 | 阿相 ↔ 等待女儿的母亲 |
| `信息桥梁` | 通过调酒师传递信息 | 阿相的雪 → 其他角色 |
| `共同主题` | 共享情感记忆 | 阿相 + 等待女儿的母亲：来不及的告别 |
| `物品关联` | 通过物品间接连接 | 音乐盒 ↔ 红绳 |

---

## Cross-Reference

- **Next Skill**: [twilight-ideation](../twilight-ideation/SKILL.md) - STAGE 1: Generate task draft
- **Requires**: None (can start from character inspirations)
- **Outputs to**: twilight-ideation for each character's task draft generation

---

## Example

**Input:**
```
角色1: "一个在雨夜死去的快递员，执念是送音乐盒给妹妹"
角色2: "一个等待女儿的母亲，已经等了五十年"
角色3: "教人调酒的狐面大叔"
```

**Output (character_web.yaml):**
```yaml
character_web:
  characters:
    - id: "aqiang"
      name: "阿相"
      role: "迷失者"
      core_item: "音乐盒"
      brief: "赶着在生日之前把礼物送到妹妹手中的哥哥"
    - id: "mother_ghost"
      name: "等待女儿的母亲"
      role: "滞留者"
      core_item: "旧照片"
      brief: "在车站等待女儿五十年的母亲"
    - id: "fox_uncle"
      name: "狐面大叔"
      role: "鬼神"
      core_item: "酒谱"
      brief: "教人调酒的神秘鬼神"

  relationships:
    - from: "aqiang"
      to: "mother_ghost"
      type: "陌生但相似"
      connection_point: "都来不及好好告别，都在等待一个回不来的重逢"
    - from: "aqiang"
      to: "fox_uncle"
      type: "师徒"
      connection_point: "狐面大叔教他调酒作为面对真相的勇气"

  key_items:
    - id: "music_box"
      name: "音乐盒"
      owner: "aqiang"
      story: "一百六十七单攒钱买的德彪西《月光》音乐盒"
      connected_to: "sister_snow"
    - id: "red_string"
      name: "红绳"
      owner: "aqiang"
      story: "妹妹12岁系在手腕上，后来缝进袖口"
      connected_to: "sister_snow"
    - id: "old_photo"
      name: "旧照片"
      owner: "mother_ghost"
      story: "女儿三岁时的照片，母亲五十年来一直拿着"
      connected_to: "daughter"

  shared_memories:
    - theme: "来不及的告别"
      characters: ["aqiang", "mother_ghost"]
      description: "两人都在生前没能好好说再见，都在自己的时空里继续等待"

  design_notes:
    - "阿相和母亲的幽灵不知道对方存在，但调酒师可以成为他们之间的桥梁"
    - "当玩家同时了解两个角色后，可以通过调酒师传递信息"
    - "关键物品（音乐盒、红绳）可以考虑作为触发其他角色故事的钥匙"
```
