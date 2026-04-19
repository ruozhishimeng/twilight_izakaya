---
name: twilight-worldbuilding
description: Use when creating new characters, expanding the game world, or designing story arcs for 《黄昏居酒屋》. Anchors all creative work in the world's core pillars and character archetype system.
---

# Twilight Izakaya · World-Building Guide

## Overview

《黄昏居酒屋》是一个以"生死边界"为核心的叙事游戏。居酒屋是一个存在于黄昏维度的独立空间，角色通过 subtext（潜台词）和调酒来推动救赎，而不是直接说教或揭露真相。

**Core principle**: World-building serves emotional truth, not lore exposition.

---

## When to Use

**Use when:**
- Creating a new character (any type: 迷失者/滞留者/鬼神/普通人)
- Designing a new story arc or chapter
- Expanding the game world (new locations, rituals, rules)
- Establishing character世界观 foundation before writing dialogue
- Evaluating if existing content respects world boundaries

**Do NOT use when writing dialogue/nodes:**
- The dialogue skill (twilight-izakaya) handles node structure, YAML format, script_flow, and player_options
- This skill focuses on the conceptual foundation: character type, emotional arc, world consistency

**Workflow order:**
1. **Worldbuilding** (this skill) → establish character concept
2. **twilight-izakaya** (dialogue skill) → generate nodes and YAML
3. **story-node-validation** → validate YAML correctness

---

## World Pillars

The world is built on **4 pillars** that must never be violated:

| Pillar | Description | Why It Matters |
|--------|-------------|---------------|
| **Liminal Space** | 居酒屋存在于生死交界处，既不是死后世界也不是人间 | Creates the "twilight" feeling - souls don't know they're dead |
| **Subtext Over Exposition** | 角色通过暗示而非直接表达情感/真相 | Maintains mystery, respects player intelligence |
| **Drinks as Bridges** | 酒是情感催化剂，不是魔法解决方案 | Bartender is witness, not savior |
| **Gradual Redemption** | 救赎是4阶段过程，不是瞬间转变 | Emotional truth requires pacing |

### Pillar Rules (Critical)

1. **Never tell a soul directly** that they are dead
2. **Never use drinks as magic** - they open doors, not fix problems
3. **Never rush redemption** - the 4-phase structure exists for emotional truth
4. **Never break the twilight boundary** - the izakaya is neutral ground

---

## Character Archetype System

Every character must belong to one of 4 types:

### 迷失者 (Lost Souls)
```
Status: Dead but don't know it
Core need: Complete unfinished business
Arc: MEMORY → CONFRONT → HEAL → REBORN (full 4-phase arc)
Dialogue style: Defensive, short, eventually breaks open
Example: 阿相 - died in rain, obsessed with delivering music box to sister
```

**Key rules:**
- Opening dialogue must be defensive/guarded (3 sentences or less)
- Cannot directly say "I'm dead" or equivalent
- Unfinished business must be tangible (an object, a message, a person)
- Redemption comes from seeing the unfinished business resolved in a different way
- **Misleading indicator**: They often say "I need to go back" or "I have to get something"

### 滞留者 (Lingerers)
```
Status: Living but trapped at the boundary
Core need: Face a truth they're avoiding
Arc: Can span multiple phases but often stays in CONFRONT
Dialogue style: Evasive, circular, changes subject frequently
Example: Someone waiting at a train station for someone who died long ago
```

**Key rules:**
- **Know** something is wrong ("I don't feel right") but **deny** the truth
- Often ask indirect questions about life/death without directly confronting it
- May make excuses for why they can't leave
- Their denial is active, not passive
- **Misleading indicator**: They may admit "something happened" but refuse to elaborate

### 迷失者 vs 滞留者 快速区分

| 特征 | 迷失者 | 滞留者 |
|------|--------|--------|
| 知道自己死了？ | 不知道 | 知道（但不接受） |
| 执念类型 | 完成某事 | 逃避某真相 |
| 典型台词 | "我要赶去..." | "我在这里等..." |
| 否认方式 | 不认为自己死了 | 否认已发生的事 |

### 鬼神 (Gods/Spirits)
```
Status: Non-human, supernatural guardians/teachers
Core need: Guide souls, sometimes their own forgotten purpose
Arc: May have multi-phase teaching arcs
Dialogue style: Cryptic, wise, knowing but withholding
Example: 狐面大叔 - teaches the player, has own mysterious past
```

**Key rules:**
- Know things but don't reveal everything
- Teach through experience, not lectures
- Have their own untold stories (foreshadow but don't reveal)

### 普通人 (Regulars)
```
Status: Living humans with everyday troubles
Core need: Emotional support, a moment of peace
Arc: Single-visit or short arc, focused on HEAL/REBORN
Dialogue style: Natural, conversational, vulnerable
```

**Key rules:**
- Not supernatural at all
- Come for comfort, not redemption
- Problems are grounded (work, relationships, self-doubt)

---

## Emotional Phase System

Every character's redemption arc follows this 4-phase structure:

```
MEMORY_PHASE     → What they left behind / past
CONFRONT_PHASE   → The core wound / truth
HEAL_PHASE       → Processing / beginning to accept
REBORN_PHASE     → Letting go / moving on
```

### Emotion Lexicon

| Phase | Emotions | Drink Tags |
|-------|----------|-----------|
| **MEMORY** | 离别, 重逢, 留恋, 怀旧 | 苦涩, 烟熏, 米香, 温热 |
| **CONFRONT** | 执念, 孤独, 迷茫, 宽恕 | 辛辣, 清冷, 多变, 柔和 |
| **HEAL** | 慰藉, 希望, 共鸣, 平静 | 果香, 花香, 浓郁, 平淡 |
| **REBORN** | 释然, 忘却, 遗忘, 新生 | 清凉, 纯净, 花香, 温热 |

**Rule**: A character's **most_loved** drink in each phase must match that phase's emotion. The *reason* field explains why this drink fits the emotional moment.

---

## World Extension Points

When expanding the world, respect these boundaries:

### Can Expand
- New character archetypes within the 4 types
- New emotional nuances within the 16 emotions
- New ritual details for drink preparation
- New aspects of the izakaya's history
- New locations within the twilight dimension

### Cannot Expand
- The 4 core pillars
- The 4 character types
- The 16-emotion lexicon
- The 4-phase redemption structure
- The boundary that souls don't know they're dead (until the moment of truth)

### Questions to Ask Before Adding Content

1. Does this respect the liminal space concept?
2. Is this driven by subtext, not exposition?
3. Would this make sense in a world where drinks are bridges, not solutions?
4. Does this honor the gradual redemption principle?
5. Is this character type already covered by one of the 4 archetypes?

---

## Quick Reference

### Character Creation Checklist

- [ ] Character type: 迷失者 / 滞留者 / 鬼神 / 普通人
- [ ] Tangible unfinished business (for 迷失者)
- [ ] Emotional phase arc: Which phase does the character START in?
- [ ] Opening dialogue is defensive/guarded (if 迷失者)
- [ ] Drink preferences mapped to emotional phases
- [ ] World rules respected (no direct revelation)

### World Rule Violations (Common Mistakes)

| Mistake | Why It's Wrong | Correct Approach |
|---------|----------------|-----------------|
| Direct revelation: "You're dead" | Breaks subtext pillar, robs player of discovery | Hint through behavior, environment, other characters |
| Magic drinks | Undermines the bridge metaphor | Drinks open emotional doors, not fix problems |
| Instant redemption | Breaks 4-phase structure | Let each phase breathe |
| Breaking twilight boundary | Destroys the liminal space | Never fully explain where the izakaya is |

---

## World Canon (Established Facts)

These facts are fixed and cannot be contradicted:

1. The izakaya exists at the boundary between life and death
2. Souls do not know they are dead until their moment of truth
3. The bartender is a witness and companion, not a savior
4. Drinks are emotional bridges - what you do with the opened door matters
5. Every soul has unfinished business that keeps them at the boundary
6. Redemption is a 4-phase process (MEMORY → CONFRONT → HEAL → REBORN)
7. The izakaya has operated for a very long time - its origin is not explained
8. Not all souls find peace - some choose to linger

---

## Relationship to Other Skills

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **twilight-worldbuilding** (this) | World concept, character archetypes, emotional arc | Before writing anything |
| **twilight-izakaya** (existing) | Dialogue writing, node structure, YAML format | When generating nodes and script_flow |
| **story-node-validation** | YAML validation, event_id checks, reference validation | After generating YAML content |

**Critical workflow:** Worldbuilding → Dialogue Generation → YAML Validation
