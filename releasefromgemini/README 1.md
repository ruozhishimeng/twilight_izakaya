# 居酒屋游戏引擎重构说明 (Izakaya Game Engine Refactoring)

## 架构更新概述 (Architecture Update Overview)

本次重构将游戏引擎从**硬编码的阶段式（Hardcoded Phases）**彻底转变为**基于节点的驱动模式（Node-Driven Architecture）**。

过去，游戏流程被强制划分为“客人进门 -> 观察 -> 对话 -> 调酒 -> 结算（这杯酒不错） -> 黑屏反思”等固定阶段。这导致了“死逻辑”问题，无法根据 YAML 剧情文本灵活跳转。

现在，游戏完全由 YAML 定义的剧情节点（Nodes）驱动，实现了类似视觉小说（Visual Novel）的无缝流转。

## 核心变更点 (Key Changes)

1. **废弃旧的阶段组件**：
   - 删除了 `GuestEnterPhase`、`DialoguePhase`、`GuestReactionPhase` 和 `ReflectionPhase`。
   - 所有的对话、反应、反思现在全部合并到统一的节点播放器中。

2. **引入核心播放器 `StoryPhase`**：
   - 新增 `src/components/StoryPhase.tsx`。
   - 负责解析当前节点的 `script_flow`（环境描述、NPC台词、内心独白等）。
   - 负责渲染 `player_options` 并处理分支跳转（`next_node`）。
   - 负责检测 `game_action: ENTER_MIXING_MODE` 并触发调酒。
   - 负责发放节点中配置的 `reward`（物品/线索）。

3. **动态调酒结算逻辑**：
   - 调酒完成后，不再强制进入通用的“结算/反思”界面。
   - 系统会根据调酒成功与否，读取调酒节点（Mixing Node）中的 `on_mixing_complete` 或 `on_mixing_fail` 属性，直接无缝跳转到对应的后续剧情节点（例如客人的特定反应节点）。

4. **数据层支持 (`gameData.ts`)**：
   - 为每个客人（Guest）对象预处理并挂载了 `nodeMap`（节点字典），实现 $O(1)$ 的节点查找。
   - 提取了每个阶段的 `startNodeIds`，确保游戏能准确从当天的第一个剧情节点开始播放。

## 重点修改文件清单 (Modified Files List)

如果您需要将项目迁移到另一个 AI Coding 助手，请让它重点关注以下文件的当前状态：

### 1. `src/App.tsx` (核心状态机)
- **修改内容**：重写了整个游戏的主循环和状态机。
- **关键状态**：引入了 `currentNodeId`（当前剧情节点）、`teachingNode`（教学节点缓存）、`mixingNode`（调酒节点缓存）。
- **关键函数**：`handleServe` 被重写，现在它通过判断调酒结果，将 `currentNodeId` 设置为 `on_mixing_complete` 或 `on_mixing_fail` 指向的节点，然后将控制权交还给 `StoryPhase`。

### 2. `src/components/StoryPhase.tsx` (全新核心组件)
- **修改内容**：全新创建的文件。
- **功能**：这是整个 Node-driven 架构的心脏。它接收 `currentNodeId`，从 `guest.nodeMap` 中取出节点数据，解析文本，渲染对话框，处理玩家选项点击，并向外抛出 `onNodeChange`、`onEnterMixing` 和 `onReward` 事件。

### 3. `src/data/gameData.ts` (数据预处理)
- **修改内容**：增强了数据解析逻辑。
- **功能**：在解析 YAML 文件构建 `GUESTS` 数组时，增加了对 `startNodeIds` 的提取（过滤出没有 `need_event` 的根节点），并将所有节点转化为 `Map<string, any>` 格式挂载到 `Guest` 对象上，方便 `StoryPhase` 快速检索。

### 4. 被删除的文件 (Deleted Files)
请确保新的 AI 助手不要再尝试寻找或修改以下文件，它们已被彻底废弃：
- `src/components/GuestEnterPhase.tsx`
- `src/components/DialoguePhase.tsx`
- `src/components/GuestReactionPhase.tsx`
- `src/components/ReflectionPhase.tsx`

## 给下一个 AI 助手的提示 (Prompt for the Next AI Assistant)

> "The game engine has been refactored to a Node-Driven architecture. The flow is no longer hardcoded into phases like 'Reaction' or 'Reflection'. Instead, `src/App.tsx` manages a `currentNodeId`, and `src/components/StoryPhase.tsx` renders the content of that node based on the YAML data parsed in `src/data/gameData.ts`. When modifying the story flow or adding new features, always look at how `StoryPhase` processes `script_flow`, `player_options`, and `next_node`. Do not try to re-introduce hardcoded phase components."
