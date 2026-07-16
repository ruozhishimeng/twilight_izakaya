# 黄昏居酒屋

《黄昏居酒屋》是一个基于 React、Vite 和 Electron 的叙事调酒游戏。玩家在夜晚的吧台后接待来客、调制饮品，并在尾声阶段与 NPC 进行 AI 对话。

当前说明对应版本：`V2.0.10`

## 运行形态

- 本地开发版：前端 Vite + 本地 Node 后端。
- 桌面封包版：Electron portable 包，面向 Windows 本地运行。
- Vercel 线上版：静态前端 + `/api` Serverless Function。

三种形态使用同一套 MiniMax BYOK 规则：项目不提供、不内置作者 Key；玩家在每次运行中填写自己的 MiniMax Key。

## 玩家 Key 的安全边界

- 当前只支持 MiniMax，模型固定为 `MiniMax-M2.5`，上游固定为 MiniMax 官方 API。
- Key 只保存在当前页面的 JavaScript 运行内存中；刷新、关闭或重启后需要重新填写。
- 应用代码不会把 Key 写入源码、桌面包、`config.json`、localStorage、sessionStorage、游戏存档、业务日志或服务端全局状态。
- 每次 NPC 对话请求通过同源后端转发给 MiniMax，Key 只存在于该次请求的 `Authorization` 头和上游调用中。
- 线上部署方仍需确保托管平台、CDN 和反向代理对 Authorization 请求头进行脱敏且不记录。
- 建议玩家使用独立、可撤销、已设置额度限制的 MiniMax Key。
- 线上部署必须使用 HTTPS。

旧桌面版本可能曾将玩家 Key 写入用户目录的 `config.json`；新版本启动时会删除其中的旧 `MINIMAX_API_KEY` 字段，并要求玩家重新填写。

## 快速开始

### 玩家使用桌面包

从 `release/` 目录取得 portable 程序后直接运行，在 `设置 -> API 设置` 中填写自己的 MiniMax Key。Key 只在本次程序运行期间有效。

### 开发者本地运行

环境要求：Windows、Node.js 18 或更高版本、npm。

```bash
npm install
```

不需要在 `.env` 中配置 API Key。可选配置只有本地服务参数和上游请求超时：

```env
HOST="127.0.0.1"
PORT="3001"
MINIMAX_TIMEOUT_MS="20000"
```

一键启动：

```bat
黄昏居酒屋.bat
```

或打开两个终端分别启动：

```bash
npm run dev
```

另一个终端：

```bash
node local-backend.mjs
```

进入游戏后由玩家在 API 设置中填写 Key。一键脚本默认优先使用前端 `3000`、后端 `3001`。

## 桌面封包

```bash
npm run desktop:pack
```

桌面包不会包含作者 Key，也不存在带作者 Key 的封包命令。Electron 内置后端只负责把当前玩家请求转发给 MiniMax。

## Vercel 部署

Vercel 不需要配置 `MINIMAX_API_KEY`、作者 Key、模型或 API Base URL。玩家 Key 随当前 NPC 请求到达函数，并直接传给 MiniMax，不依赖跨函数内存或环境变量。

可以保留可选的请求超时：

```env
MINIMAX_TIMEOUT_MS="20000"
```

部署后，未携带玩家 Key 的 `POST /api/npc-dialogue` 应返回 `401`。项目不再提供 `/api/settings/api-key` 状态接口。

## 常用命令

```bash
npm run content:check
npm run lint
npm test
npm run build
npm run desktop:dev
npm run desktop:pack
```

## 项目入口

- `src/`：React 游戏前端和当前运行内存中的 BYOK 状态。
- `server/`：本地后端、NPC 对话处理与 MiniMax 调用。
- `api/`：Vercel Functions 入口。
- `electron/`：Electron 桌面主进程和旧明文配置迁移。
- `scripts/`：内容校验和 Node 环境准备。
- `docs/`：项目规范、系统说明、审查清单及历史文档索引。
- `twilight_izakaya_launcher.ps1` / `黄昏居酒屋.bat`：Windows 本地一键启动入口。
- [`docs/代码审查问题清单.md`](docs/代码审查问题清单.md)：代码审查问题、优先级、状态与验收条件的唯一清单。

## 常见问题

### 开始游戏时提示未配置 Key

进入 `设置 -> API 设置`，填写自己的 MiniMax Key，并点击“本次运行使用”。刷新或重启后需要重新填写，这是当前“不在磁盘保存明文 Key”策略的预期行为。

### MiniMax 提示 Key 无效或未授权

清除当前 Key 后重新填写，确认 Key 尚未撤销、拥有可用额度，并且来自 MiniMax。服务端不会回显或保留该 Key。

### 旧版本曾经分发过带作者 Key 的桌面包

仅删除新版本代码不能保护旧包中的凭据。应立即在 MiniMax 后台撤销或轮换旧 Key，并删除部署平台中遗留的 `TWILIGHT_AUTHOR_MINIMAX_API_KEY`、`AUTHOR_MINIMAX_API_KEY` 和 `MINIMAX_API_KEY`。

### 端口被占用

一键启动脚本会自动寻找空闲端口。桌面版目前固定使用 `127.0.0.1:37621`；如果提示端口占用，请确认是否已经运行了另一个桌面版实例。
