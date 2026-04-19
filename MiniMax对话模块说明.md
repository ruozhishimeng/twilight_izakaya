# MiniMax 对话模块说明

更新时间：2026-04-19  
文档定位：面向项目开发者的实现与调试说明  
适用范围：当前仅覆盖 NPC 尾声 AI 对话 MVP

## 1. 这个模块做什么

这个模块负责《黄昏居酒屋》中“尾声 AI 对话”的真实模型调用。

当前职责范围是：

- 玩家在尾声阶段点击 `聊一聊`
- 进入 `dayLoop.guest.llmChatSession`
- 玩家输入一句短文本
- 前端把当前营业事实整理成 `NpcDialogueRequest`
- 本地后端调用 MiniMax `M2-her`
- 后端返回结构化 `NpcDialogueResponse`
- 前端按“我 -> NPC 多句逐条播放”的方式演出

它**不**负责：

- 推进主线剧情
- 发奖励
- 解锁章节
- 修改调酒结果
- 决定 NPC 是否离店

## 2. 触发位置

当前接入点是：

- 由剧情节点显式配置 `llm_chat.entry_mode: before_next_node`
- 在进入离店/收束节点前，进入尾声 AI 对话

当前 MVP 的真实样例是：

- `fox_uncle_reward_01 -> 尾声 AI 对话 -> fox_uncle_reward_01_end`

## 3. 本地开发怎么启动

先开后端：

```powershell
Set-Location 'F:\twilight_izakaya'
npm run dev:backend
```

再开前端：

```powershell
Set-Location 'F:\twilight_izakaya'
npm run dev
```

推荐同时验证：

```powershell
Set-Location 'F:\twilight_izakaya'
npm run content:check
npm run lint
```

## 4. 需要哪些环境变量

在项目根目录 `.env` 中配置：

```env
MINIMAX_API_KEY="YOUR_MINIMAX_API_KEY"
MINIMAX_MODEL="M2-her"
MINIMAX_BASE_URL="https://api.minimaxi.com"
MINIMAX_TIMEOUT_MS="8000"
```

说明：

- `MINIMAX_API_KEY`：必填
- `MINIMAX_MODEL`：当前第一版固定 `M2-her`
- `MINIMAX_BASE_URL`：默认官方地址
- `MINIMAX_TIMEOUT_MS`：后端请求超时

## 5. 为什么密钥不做前端输入

这个功能**不做前端设置页输入密钥**，也不做“前端加密保存 key”。

原因很简单：

- 只要密钥进了浏览器，它就已经暴露给前端环境了
- 前端所谓“加密保存”并不能改变这个事实
- 正确边界是：**前端完全不接触真实 key**

当前安全方案是：

- key 只存在本地后端环境变量
- 浏览器请求只打本地 `/api/npc-dialogue`
- 后端代发 MiniMax 请求

## 6. 前端发什么

前端发送 `NpcDialogueRequest`，核心包含：

- 当前是谁：
  - `guestId`
  - `guestName`
  - `guestProfile`
- 当前营业事实：
  - `week`
  - `day`
  - `guestInDay`
  - `currentNodeId`
- 当前上下文：
  - `observedFeatures`
  - `recentTranscript`
  - `lastDrink`
  - `turnIndex`
- 当前这一句玩家输入：
  - `playerText`

关键原则：

- 前端不把 API key 发过去
- 前端不让模型决定状态
- 前端只负责把当前事实打包给后端

## 7. 后端喂模型什么

后端不会把整段 YAML 剧情原样扔给模型。

当前喂给 MiniMax 的是四段 `messages`：

1. `system`
   - NPC 身份
   - 人设
   - 世界边界
   - 输出 JSON 规则
2. `user_system`
   - 玩家身份：当前店内调酒师 / 酒保
3. `user`
   - 结构化事实区
   - 包括时间、节点、调酒结果、观察线索、轮次、近期对话
4. `user`
   - 玩家这次输入的短文本

一句话理解：

- **后端喂的是“当前事实 + 当前这句输入”**
- **不是把剧情控制权交给模型**

## 8. 模型吐什么

模型必须返回 JSON 字符串，目标结构是：

```json
{
  "replyLines": ["...", "..."],
  "mood": "steady",
  "endChat": false
}
```

其中：

- `replyLines`
  - 1 到 2 句
  - 总长度不超过 90 字
- `mood`
  - 目前只允许：
    - `steady`
    - `warm`
    - `guarded`
    - `awkward`
- `endChat`
  - 布尔值

## 9. `/api/npc-dialogue` 返回格式

本地接口成功时返回：

```json
{
  "replyLines": ["..."],
  "mood": "steady",
  "endChat": false,
  "usage": {
    "provider": "minimax:M2-her",
    "promptTokens": 123,
    "completionTokens": 34,
    "totalTokens": 157,
    "promptChars": 456,
    "completionChars": 38
  }
}
```

失败时返回：

```json
{
  "error": "错误说明"
}
```

## 10. 常见错误与排查

### 10.1 后端没启动

表现：

- 浏览器请求 `/api/npc-dialogue` 失败
- 前端显示“本地对话服务暂时不可用”

排查：

- 是否运行了 `npm run dev:backend`

### 10.2 未配置密钥

表现：

- `/api/npc-dialogue` 返回：
  - `未配置 MINIMAX_API_KEY，无法调用对话服务。`

排查：

- 根目录 `.env` 是否存在
- 是否写入了 `MINIMAX_API_KEY`

### 10.3 密钥无效

表现：

- `/api/npc-dialogue` 返回：
  - `MiniMax 密钥无效或未授权。`

排查：

- key 是否复制完整
- 账号是否有权限调用 `M2-her`

### 10.4 模型返回格式错误

表现：

- `/api/npc-dialogue` 返回：
  - `模型返回格式无效`
  - 或 `模型返回的 replyLines 数量无效`

排查：

- 查看后端日志
- 核对 prompt 是否仍要求“只返回 JSON”

### 10.5 内容被安全策略拦截

表现：

- `/api/npc-dialogue` 返回 `422`
- 错误信息提示输入或输出命中安全限制

排查：

- 缩短输入
- 避免明显违规内容

## 11. 当前限制

当前第一版有这些明确限制：

- 只在尾声 AI 对话使用
- 不支持流式输出
- 不支持长期记忆
- 不支持多角色群聊
- 不支持前端切换模型
- 不支持设置页输入 key

## 12. 后续优化方向

后续可以继续优化，但不属于当前 MVP：

- 为不同角色加入 `sample_message_user/sample_message_ai` few-shot
- 对不同角色做更细的人设摘要
- 给高频上下文加短时缓存
- 做更稳的输出重试策略
- 引入更细的错误 telemetry / usage 统计

当前最重要的不是“更自由”，而是：

- 人设稳定
- 状态一致
- 接口可调试
- 密钥边界清晰
