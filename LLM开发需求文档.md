# 《黄昏居酒屋》LLM开发需求文档

更新时间：2026-04-19  
文档定位：指导 NPC 对话 LLM MVP 的设计、开发与验收  
适用范围：当前仅覆盖“每位客人当日流程结束后的尾声短对话”

## 1. 文档目标

这份文档用于直接指导开发，不是供应商接口教程。  
它要回答的是：

- 游戏进程里，玩家到底在什么时候进入 AI 对话阶段
- `聊一聊` 按钮应该如何工作
- 什么情况下可以聊、不能聊、聊到上限
- 文案应该怎么可配置
- 需要补哪些状态字段，才能让模型既符合人设，也符合当前营业事实
- 第一版做成什么样就算 MVP 可用

## 2. 先给结论：MVP 应该怎么做

这版 LLM 对话 MVP 不应该插在主线中途。  
更合适的落点是：

- **每位客人当天节点流结束后的尾声阶段**

推荐流程：

1. `story / observation / mixing / result / reward` 正常跑完
2. 进入当前客人的“尾声交互阶段”
3. 玩家看到：
   - `聊一聊`
   - `送客 / 继续营业`
4. 若允许聊天，玩家可在这位客人身上最多聊 `N` 次
5. 聊完后，玩家再结束这位客人的流程

一句话总结：

- 主线节点负责剧情推进
- 尾声阶段负责 LLM 短对话
- LLM 只负责表达，不负责改游戏状态

## 3. 核心设计原则

## 3.1 LLM 对话是“尾声能力”，不是主线节点

这套功能的本质不是：

- 再加一种剧情节点

而是：

- 在当前客人这次营业结束后，给玩家一个有限、可选、短回合的 AI 闲聊机会

所以它不应继续复用当前 `nodes_chat` 的语义。

更合理的分层是：

- `nodes_chat`：手写剧情闲聊节点
- `LLM chat`：系统级尾声短对话

## 3.2 状态系统提供事实，模型只负责措辞

LLM 不拥有业务状态。  
它不能决定：

- 是否推进主线
- 是否发奖励
- 是否解锁剧情
- 调酒是否成功
- 当前客人是否该离场

这些都由状态系统决定。

## 3.3 一致性优先于“无限自然”

对这个项目来说，最重要的不是让 NPC 无限自由聊天，而是：

- 像这个人
- 记得刚刚发生了什么
- 不和当前剧情状态打架

## 4. 建议的阶段放置

当前用户需求已经很明确：

- AI 对话阶段应放在 **NPC 当天节点流的最后**

这点我认同，而且这是最稳的方案。

推荐状态顺序：

```text
dayLoop.guest.story
  -> dayLoop.guest.observation
  -> dayLoop.guest.mixing
  -> dayLoop.guest.result
  -> dayLoop.guest.reward
  -> dayLoop.guest.llmChatLobby
  -> dayLoop.guest.llmChatSession
  -> dayLoop.guest.reflection / dayLoop.daySummary / next guest
```

说明：

- `llmChatLobby`：尾声阶段入口，展示 `聊一聊 / 送客`
- `llmChatSession`：真正输入和接收 LLM 回复的阶段

如果暂时不想新增两个根状态，也可以第一版先只做一个局部子界面。  
但从长期可维护性上，**新增明确状态更好**。

## 5. 玩家体验要求

## 5.1 每位客人每天最多聊 N 次

默认值建议：

- `3` 次

但必须是可配置字段，不要写死。

## 5.2 入口按钮

尾声阶段显示一个按钮：

- `聊一聊`

点击后不是一定发起 LLM 请求，而是先经过可用性判断。

## 5.3 接话状态文案

点击 `聊一聊` 时，界面应先显示一条 NPC 当前状态文案。  
这条文案不一定来自模型，应该优先来自配置。

示例：

- 外向型 NPC：`不说话可太无聊了……`
- 沉默型 NPC：`他闷头喝着酒。`

这类文案不应写死在代码里，应该是可调字段。

## 5.4 被禁止聊天时的反馈

若当前剧情设定下不能聊，点击 `聊一聊` 后应显示配置文案，例如：

- `XXX没有什么可以聊的了。`
- `现在还是不太适合聊天……`

重点：

- 这是**显式禁止聊天**
- 不发起 LLM 请求
- 不假装模型“没回”

## 5.5 次数用尽时的反馈

若当日该客人的聊天次数已用尽，点击 `聊一聊` 后应显示：

- `聊得够多了……`

同样：

- 不发起 LLM 请求
- 这是系统边界提示，不是模型回复

## 6. `NpcDialogueRequest / NpcDialogueResponse` 的真实触发时机

这是开发时最容易做错的地方。

## 6.1 `NpcDialogueRequest` 什么时候生成

`NpcDialogueRequest` 不应该在进入尾声阶段时自动生成。  
也不应该在玩家点击 `聊一聊` 按钮的第一下就生成。

正确时机是：

1. 玩家位于 `llmChatLobby`
2. 点击 `聊一聊`
3. 系统判断：
   - 是否允许聊天
   - 是否达到次数上限
4. 若允许，则进入 `llmChatSession`
5. 显示接话状态文案 + 输入框
6. 玩家真正输入文本并点击发送
7. **这时才生成 `NpcDialogueRequest`**

结论：

- 进入尾声阶段不等于调用模型
- 点击 `聊一聊` 不等于调用模型
- 玩家发送文本，才是模型请求触发点

## 6.2 `NpcDialogueResponse` 什么时候渲染

`NpcDialogueResponse` 应在：

1. 后端成功返回
2. 返回结果通过结构校验
3. 字数和句数通过限制

之后，才允许渲染。

渲染位置：

- `llmChatSession` 面板内
- 作为这次 AI 短对话的结果展示

渲染后建议：

- 追加到当前尾声聊天记录
- 同时可追加到总 transcript 中
- `turnsUsed + 1`

但注意：

- `NpcDialogueResponse` 不是新的根状态
- 它不应该直接推进流程
- 也不应该直接决定“是否送客”

## 7. 需要的可配置字段

你提的“建议直接弄成可调字段”，这个判断是对的。  
这类信息不该写死在代码里。

## 7.1 角色默认配置

建议先放在角色级配置里，例如 `character_meta.yaml` 或后续独立配置字段：

```yaml
llm_chat:
  enabled: true
  max_turns_per_visit: 3
  entry_status_text: "不说话可太无聊了……"
  blocked_message: "现在还是不太适合聊天……"
  exhausted_message: "聊得够多了……"
```

含义：

- `enabled`：这个角色默认是否支持尾声 AI 对话
- `max_turns_per_visit`：当天每次来访最多可聊几次
- `entry_status_text`：进入聊天输入前显示的接话状态
- `blocked_message`：当前不可聊时显示
- `exhausted_message`：次数用尽后显示

## 7.2 当天节点覆盖配置

为了支持“基于剧情设定不能聊”，还需要节点级覆盖。

建议允许在“当天最终节点”或“当前客人收束节点”中覆盖：

```yaml
llm_chat:
  enabled: false
  blocked_message: "XXX没有什么可以聊的了。"
```

或：

```yaml
llm_chat:
  enabled: true
  max_turns_per_visit: 1
  entry_status_text: "他闷头喝着酒。"
```

节点级覆盖优先于角色默认配置。

## 8. 现有状态记录够不够

短答案：

- **够做一个很小的 MVP**
- 但如果按你这版设计来做，建议先补一轮很小的状态增强

## 8.1 现有已经足够的字段

当前状态里已经有很多关键事实，定义在 [src/state/gameState.ts](F:\twilight_izakaya\src\state\gameState.ts)：

- `week`
- `day`
- `guestInDay`
- `currentGuest.nodeId`
- `currentGuest.discoveredFeatures`
- `currentGuest.isSuccess`
- `currentGuest.mixedDrinkName`
- `currentGuest.drinkLabel`
- `currentGuest.challenges`
- `currentGuest.transcript`
- `characterProgress`

这些已经足够让模型知道：

- 当前是哪位客人
- 现在是哪个营业时点
- 玩家今天刚做过什么
- 最近几句说了什么

## 8.2 当前还不够“开发友好”的地方

### A. 缺少明确的尾声聊天运行态

当前状态里还没有一个专门描述“尾声聊天能力”的运行态。

建议新增：

```ts
tailChat: {
  enabled: boolean;
  turnsUsed: number;
  maxTurns: number;
  entryStatusText: string;
  blockedMessage: string;
  exhaustedMessage: string;
}
```

这会明显提升：

- 入口判断清晰度
- UI 渲染清晰度
- 调试可读性

### B. 最近一次调酒结果还不够结构化

当前和调酒相关的状态分散在：

- `isSuccess`
- `mixedDrinkName`
- `drinkLabel`

建议补成明确对象：

```ts
lastDrinkResult: {
  label?: string;
  mixedDrinkName?: string;
  isSuccess: boolean;
  sourceNodeId?: string | null;
} | null;
```

这样后端生成事实区时更稳。

### C. `npcDialogue` 运行态目前太薄

当前 `npcDialogue` 只有：

- `status`
- `errorMessage`

建议最小补成：

```ts
interface NpcDialogueRuntime {
  status: 'idle' | 'requesting' | 'error';
  errorMessage: string | null;
  turnCount: number;
  lastReplyLines: string[];
}
```

作用：

- 和 UI 对话框更好衔接
- 限制聊天轮数
- 请求失败时仍保留最近一次成功回复

### D. 最好区分“剧情 transcript”和“LLM 对话历史”

当前 `currentGuest.transcript` 已经很好，但它是总记录。

MVP 可以继续复用。  
但如果你想让 prompt 更稳，建议后续补一个轻量字段：

```ts
llmChatHistory: Array<{
  speaker: string;
  text: string;
}>;
```

这不是第一优先级，但会让后端拼 prompt 更干净。

## 8.3 建议的最小状态补强

为了尽量不大改系统，我建议第一版只补下面三组：

1. `currentGuest.tailChat`
2. `currentGuest.lastDrinkResult`
3. `npcDialogue.turnCount / npcDialogue.lastReplyLines`

这已经足够明显提升稳定性。

## 9. `NpcDialogueRequest` 与 `NpcDialogueResponse` 的建议定义

## 9.1 `NpcDialogueRequest`

它是“这次发送给后端的结构化上下文”，不是 prompt 原文。

推荐：

```ts
export interface NpcDialogueRequest {
  guestId: string;
  playerText: string;
  state: 'dayLoop.guest.llmChatSession';
  week: number;
  day: number;
  guestInDay: number;
  currentNodeId: string | null;
  observedFeatures: string[];
  recentTranscript: Array<{
    speaker: string;
    text: string;
  }>;
  lastDrink?: {
    label: string;
    isSuccess: boolean;
    mixedDrinkName?: string;
  };
  turnIndex: number;
}
```

这里多加的 `turnIndex` 很有价值：

- 后端知道这是第几轮
- prompt 可以更稳地限制语气和收束

## 9.2 `NpcDialogueResponse`

推荐：

```ts
export interface NpcDialogueResponse {
  replyLines: string[];
  mood: 'calm' | 'guarded' | 'warm' | 'awkward';
  endChat: boolean;
  usage?: {
    totalTokens?: number;
  };
}
```

说明：

- `endChat` 是建议值，不是强制跳转命令
- 真正是否结束这位客人流程，仍由前端状态和玩家按钮决定

## 10. Prompt 工程需求

你提到“为了稳定性，必要的 prompt 工程是需要的”，这个判断是正确的。  
但这里仍然坚持最小方案。

## 10.1 Prompt 的三层结构

### A. System Prompt

固定：

- 角色身份
- 角色语气
- 不能改游戏状态
- 输出必须为 JSON

### B. Fact Block

由状态系统生成，至少包括：

- 当前营业时间
- 当前尾声阶段
- 当前节点
- 最近一次调酒结果
- 已观察线索
- 最近 transcript
- 当前是本次尾声聊天的第几轮

### C. Task Prompt

明确要求：

- 只回复玩家这次输入
- 1~2 句
- 不超过长度上限
- 若玩家输入与事实冲突，要轻微纠正

## 10.2 Prompt 不负责什么

Prompt 不负责：

- 状态管理
- 主线推进
- 奖励逻辑
- 剧情解锁

## 11. 长度与稳定性限制

## 11.1 玩家输入限制

- 最少 1 个字符
- 最多 60 个汉字

校验位置：

- 前端一次
- 后端再校验一次

## 11.2 NPC 输出限制

- 最多 2 句
- 总长度不超过 80 个汉字
- `max_completion_tokens` 建议先设为 `120`

## 11.3 每位客人每天默认最多 3 次

这是默认值，不是硬编码。

实际应取：

1. 节点覆盖值
2. 若无覆盖，则取角色默认值
3. 若都没写，再回退到系统默认 `3`

## 12. 参数建议

MiniMax 接口支持：

- `temperature`
- `top_p`
- `max_completion_tokens`
- `stream`

MVP 推荐：

- `stream: false`
- `temperature: 0.4 ~ 0.6`
- `top_p: 0.85 ~ 0.95`
- `max_completion_tokens: 120`

原因：

- 第一版优先保证稳定性
- 不是优先追求流式体验

## 13. 前端实现需求

前端至少要负责：

1. 在尾声阶段显示 `聊一聊`
2. 点击后先判断：
   - 是否允许聊天
   - 是否已达次数上限
3. 若不允许，显示 `blockedMessage`
4. 若次数用尽，显示 `exhaustedMessage`
5. 若允许，进入输入框状态，并显示 `entryStatusText`
6. 玩家发送后，生成 `NpcDialogueRequest`
7. 请求期间锁定按钮并显示 loading
8. 收到 `NpcDialogueResponse` 后渲染 `replyLines`
9. 更新 `turnsUsed`

前端不应做：

- 不自行拼长 prompt
- 不直接调用供应商 API
- 不根据模型文本直接改业务状态

## 14. 后端实现需求

后端至少要负责：

1. 接收 `NpcDialogueRequest`
2. 校验当前 state 是否为 `dayLoop.guest.llmChatSession`
3. 校验输入长度
4. 用结构化状态生成事实区
5. 调用 MiniMax `chatcompletion_v2`
6. 解析 `choices[0].message.content`
7. 校验返回 JSON
8. 返回 `NpcDialogueResponse`

后端禁止做的事：

- 不替模型推进剧情
- 不偷偷发奖励
- 不把未校验的裸文本直接返回前端

## 15. 推荐的开发顺序

1. 先补状态字段：
   - `currentGuest.tailChat`
   - `currentGuest.lastDrinkResult`
   - `npcDialogue.turnCount`
   - `npcDialogue.lastReplyLines`
2. 再加内容配置字段：
   - 角色默认 `llm_chat`
   - 节点级 `llm_chat` 覆盖
3. 再新增尾声阶段 UI
4. 再定义 `NpcDialogueRequest / NpcDialogueResponse`
5. 再新增后端 `/api/npc-dialogue`
6. 先用 mock 跑通，再接 MiniMax 真调用

## 16. 验收标准

MVP 完成后至少满足：

### 功能层

- 每位客人每天默认最多可聊 3 次
- 次数可配置
- 不可聊时显示配置文案
- 次数用尽时显示配置文案

### 一致性层

- 如果玩家刚调了一杯酒，NPC 会围绕这杯酒回应
- 如果玩家输入与当前事实冲突，NPC 不会顺着瞎说
- NPC 不会忘掉当前客人和当前营业语境

### 边界层

- 尾声 AI 对话不接管主线
- 模型不会直接推进状态
- 失败时不会伪装成正常剧情推进

## 17. 一句话结论

对《黄昏居酒屋》来说，这版正确的 LLM MVP 不是“随时找 NPC 自由聊天”，而是：

- 把 AI 对话放在每位客人当日流程的最后
- 让玩家主动点击 `聊一聊`
- 每人每天最多聊 `N` 次
- 文案和次数都可配置
- 状态系统先给出硬事实
- 模型只在这个边界内生成短回复

这才是当前项目最稳、最清晰、最容易落地的第一版方案。

## 18. 当前实现状态（Step 5）

截至目前，尾声 AI 对话已经从本地 mock 升级为真实 MiniMax 接入：

- 前端仍只发送结构化 `NpcDialogueRequest`
- 本地后端 `POST /api/npc-dialogue` 已负责：
  - 请求校验
  - 组装 MiniMax `messages`
  - 调用 `M2-her`
  - 解析 `choices[0].message.content`
  - 校验 JSON 输出结构
- 前端不持有 API key，也没有设置页输入框
- MiniMax key 只存在本地后端环境变量：
  - `MINIMAX_API_KEY`
  - `MINIMAX_MODEL`
  - `MINIMAX_BASE_URL`
  - `MINIMAX_TIMEOUT_MS`

当前这一步的真实边界是：

- 只支持尾声对话，不接管主线节点
- 只支持短回复，不做流式输出
- 失败时返回显式错误，不伪造固定剧情台词
- 角色一致性依赖：
  - `guestProfile`
  - `recentTranscript`
  - `lastDrink`
  - `observedFeatures`
  - `turnIndex`

实现与调试说明请结合：

- `MiniMax对话模块说明.md`
