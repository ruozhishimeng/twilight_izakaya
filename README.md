# 黄昏居酒屋

《黄昏居酒屋》是一个基于 React、Vite 和 Electron 的叙事调酒游戏。玩家在夜晚的吧台后接待来客、调制饮品，并在尾声阶段与 NPC 进行 AI 对话。

当前说明对应版本：`V2.0.10`

## 运行形态

- 本地开发版：前端 Vite + 本地 Node 后端。
- 桌面封包版：Electron portable 包，面向 Windows 本地运行。
- Vercel 线上版：静态前端 + `/api` Serverless Function。

Vercel 线上版默认使用部署方在服务端配置的 MiniMax Key，让访客无需准备 Key 即可游玩。玩家仍可在本次运行中填写自己的 Key，并仅对自己的请求优先使用。桌面包不内置作者 Key。

## Key 的安全边界

- 当前只支持 MiniMax，模型固定为 `MiniMax-M3`，上游固定为 MiniMax 官方 API。
- 作者 Key 只允许保存在服务端 `MINIMAX_API_KEY` 环境变量中；不得使用 `NEXT_PUBLIC_` 前缀，不会进入浏览器 bundle。
- 玩家自带 Key 只保存在当前页面的 JavaScript 运行内存中；刷新、关闭或重启后需要重新填写。
- 应用代码不会把 Key 写入源码、桌面包、`config.json`、localStorage、sessionStorage、游戏存档或业务日志。
- 每次 NPC 对话请求都把最终选中的 Key 作为 request-scoped 参数传给 MiniMax：玩家 Key 优先；没有玩家 Key 时回退到服务端作者 Key。
- Key 不会出现在请求体、响应体或诊断数据中。
- 线上部署方仍需确保托管平台、CDN 和反向代理对 Authorization 请求头进行脱敏且不记录。
- 作者 Key 应使用独立、可撤销、已设置额度限制的凭据；公网部署还应配置费用告警和速率限制。
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

如需让本地浏览器在不填写玩家 Key 时也能调用模型，把作者 Key 写入不会提交的 `.env.local`；否则可以继续在游戏内填写玩家 Key：

```env
MINIMAX_API_KEY="your-server-only-minimax-key"
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

玩家 Key 是可选覆盖项。一键脚本默认优先使用前端 `3000`、后端 `3001`。

## 桌面封包

```bash
npm run desktop:pack
```

桌面包不会包含作者 Key，也不存在带作者 Key 的封包命令。Electron 内置后端可使用玩家本次运行填写的 Key；只有开发者在启动环境中显式设置 `MINIMAX_API_KEY` 时才会使用服务端回退。

## Vercel 部署

在 Vercel 项目的 `Settings -> Environment Variables` 中添加服务端敏感变量：

```env
MINIMAX_API_KEY="your-server-only-minimax-key"
```

至少勾选 `Production`；需要让预览部署也可试玩时再勾选 `Preview`。保存后必须重新部署，旧 deployment 不会自动获得新值。模型和 API Base URL 仍固定在服务端代码中。

可以保留可选的请求超时：

```env
MINIMAX_TIMEOUT_MS="20000"
```

部署后，未携带玩家 Key 的 `POST /api/npc-dialogue` 会使用 `MINIMAX_API_KEY`；携带合法玩家 Key 时使用玩家 Key。两种路径都不会回显凭据，项目也不提供 `/api/settings/api-key` 明文或状态接口。

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

### NPC 对话提示未配置 Key

线上部署请确认 Vercel 的 `MINIMAX_API_KEY` 已配置到当前环境并在配置后重新部署。也可以进入 `设置 -> API 设置`，填写自己的 MiniMax Key 作为本次运行的覆盖项。

### MiniMax 提示 Key 无效或未授权

清除当前 Key 后重新填写，确认 Key 尚未撤销、拥有可用额度，并且来自 MiniMax。服务端不会回显或保留该 Key。

### 旧版本曾经分发过带作者 Key 的桌面包

仅删除新版本代码不能保护旧包中的凭据。曾经进入桌面包或源码的旧 Key 必须在 MiniMax 后台撤销；Vercel 应改用新生成的独立 Key，并只保存在 `MINIMAX_API_KEY`。遗留的 `TWILIGHT_AUTHOR_MINIMAX_API_KEY`、`AUTHOR_MINIMAX_API_KEY` 应删除。

### 端口被占用

一键启动脚本会自动寻找空闲端口。桌面版目前固定使用 `127.0.0.1:37621`；如果提示端口占用，请确认是否已经运行了另一个桌面版实例。
