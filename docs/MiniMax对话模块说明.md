# MiniMax 对话模块说明

更新时间：2026-07-15
文档定位：面向项目开发者的实现与调试说明  
适用范围：当前仅覆盖 NPC 尾声 AI 对话 MVP

## 1. 这个模块做什么

这个模块负责《黄昏居酒屋》中“尾声 AI 对话”的真实模型调用。

当前职责范围是：

- 玩家在尾声阶段点击 `聊一聊`
- 进入 `dayLoop.guest.llmChatSession`
- 玩家输入一句短文本
- 前端把当前营业事实整理成 `NpcDialogueRequest`
- 本地后端调用 `MiniMax-M3`
- 后端先做本地安全前置拦截；明显违法、色情、完全无关或提示注入内容不调用 MiniMax
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
Set-Location '<仓库目录>'
npm run dev:backend
```

再开前端：

```powershell
Set-Location '<仓库目录>'
npm run dev
```

推荐同时验证：

```powershell
Set-Location '<仓库目录>'
npm run content:check
npm run lint
```

## 4. 环境变量

线上版从服务端环境变量读取作者 Key，让未填写玩家 Key 的访客也能调用 NPC 对话。当前模型固定为 `MiniMax-M3`，上游固定为 MiniMax 官方 API：

```env
MINIMAX_API_KEY="your-server-only-minimax-key"
HOST="127.0.0.1"
PORT="3001"
MINIMAX_TIMEOUT_MS="20000"
```

`MINIMAX_API_KEY` 只允许配置在 `.env.local` 或 Vercel Environment Variables，不能提交到仓库，也不能使用 `NEXT_PUBLIC_` 前缀。`MINIMAX_TIMEOUT_MS` 控制上游请求超时；当前后端调用温度为 `0.35`，优先保证 NPC 回复结构稳定和 JSON 可解析。

## 5. API 设置入口与密钥边界

游戏内设置已经提供 API 设置入口：

- 当前只支持 MiniMax 密钥
- 线上访客可以不填写 Key，服务端使用作者 Key
- 玩家可以填写自己的 MiniMax Key 作为本次运行的优先覆盖项
- 玩家 Key 只保存在当前页面的 JavaScript 运行内存，刷新、关闭或重启后需要重新填写

安全边界：

- 作者 Key 不进入源码、桌面包、浏览器、响应或日志，只保存在服务端 `MINIMAX_API_KEY`
- 玩家 Key 不写入 `config.json`、IndexedDB、localStorage、sessionStorage、存档或对话记录
- 前端仅在玩家填写 Key 时通过 `Authorization: Bearer` 携带；请求体和响应体都不含 Key
- Express 与 Vercel 入口按“玩家 Key 优先、服务端 Key 回退”解析，再把最终 Key 作为 request-scoped 参数传给 handler/provider
- 项目不提供 `/api/settings/api-key`
- 应用代码不主动记录 Authorization；线上部署方仍须在托管平台、CDN 和反向代理层配置请求头脱敏

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
  - 1 到 3 句台词
  - 可包含动作描写，总条目最多 5 条
  - 总长度不超过 120 字
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
    "provider": "minimax:MiniMax-M3",
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

命中本地安全前置拦截时，不返回错误，而是直接返回固定 NPC 回复：

```json
{
  "replyLines": [
    "这个话题不适合在店里聊。我们还是回到这杯酒、这位客人，或者刚才的故事吧。"
  ],
  "mood": "guarded",
  "endChat": false,
  "usage": {
    "provider": "local-safety-filter",
    "promptChars": 18,
    "completionChars": 39
  }
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
  - `请先填写自己的 MiniMax API Key。`

排查：

- 线上 Vercel 当前环境是否配置 `MINIMAX_API_KEY`
- 配置环境变量后是否重新部署
- 或者是否已在游戏设置页填写自己的 MiniMax Key

### 10.3 密钥无效

表现：

- `/api/npc-dialogue` 返回：
  - `MiniMax 密钥无效或未授权。`

排查：

- key 是否复制完整
- 账号是否有权限调用 `MiniMax-M3`

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

- 本地安全前置拦截命中时，`/api/npc-dialogue` 返回 `200` 与固定 NPC 文案，`usage.provider` 为 `local-safety-filter`
- MiniMax 上游命中安全策略时，`/api/npc-dialogue` 返回 `422`
- 后端会识别官方响应字段 `input_sensitive`、`output_sensitive`，并映射 `1026 input new_sensitive` 与 `1027 output new_sensitive`

排查：

- 缩短输入
- 避免明显违规内容
- 避免与游戏完全无关的请求，如代码生成、网页制作、现实世界查询等

## 11. 对话质量回归测试

批量质量测试命令：

```powershell
Set-Location '<仓库目录>'
node devtools\npc-dialogue-quality-suite.mjs
```

测试用例文件：

```text
devtools/npc-dialogue-quality-cases.json
```

结果会写入：

```text
devtools/debug-output/npc-dialogue-quality-<timestamp>.json
```

当前覆盖：

- 狐面大叔：调酒引导、面具边界、世界观边界
- 阿相：关心、执念追问、记忆模糊、调酒失败
- 小雪：寻找主题、真相逼近
- 普通客人：上班疲惫、老人思乡
- 边界输入：极短输入、违法、色情、无关请求、提示注入

## 12. 当前限制

当前第一版有这些明确限制：

- 只在尾声 AI 对话使用
- 不支持流式输出
- 不支持长期记忆
- 不支持多角色群聊
- 不支持前端切换模型
- 不支持切换 MiniMax 以外的供应商

## 13. 后续优化方向

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
