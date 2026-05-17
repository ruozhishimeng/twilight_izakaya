# 黄昏居酒屋

《黄昏居酒屋》是一个基于 React + Vite + Electron 的叙事调酒游戏。玩家在夜晚的吧台后接待来客、调制饮品，并在尾声阶段与 NPC 进行 AI 对话。

当前说明对应版本：`V2.0.7`

## 运行形态

- 本地开发版：前端 Vite + 本地 Node 后端，适合开发和调试。
- 桌面封包版：Electron portable 包，适合 Windows 本地分发。
- Vercel 线上版：静态前端 + `/api` Serverless Functions，适合部署到公网测试。

## 快速开始

### 玩家使用桌面包

从 `release/` 目录取得 `黄昏居酒屋-2.0.7-win-x64.exe` 后直接双击运行。桌面版会在本机启动内置后端，存档和玩家自填 KEY 都保存在本机。

如果封包时内置了作者 KEY，玩家可以在游戏内 `设置 -> API 设置` 点击 `使用作者的KEY`。如果作者 KEY 不可用，也可以填写自己的 MiniMax KEY。

### 开发者本地运行

环境要求：

- Windows
- Node.js 18 或更高版本
- 已安装 npm 依赖

首次安装：

```bash
npm install
```

复制 `.env.example` 为 `.env`，至少配置：

```env
MINIMAX_API_KEY="你的 MiniMax API Key"
MINIMAX_MODEL="MiniMax-M2.5"
```

一键启动：

```bat
黄昏居酒屋.bat
```

手动启动：

```bash
npm run dev
node local-backend.mjs
```

一键脚本会自动寻找可用端口，默认优先使用前端 `3000`、后端 `3001`。

## API KEY 配置

当前 AI 对话仅支持 MiniMax。相关 KEY 只应存在于后端、桌面主进程或 Vercel 环境变量中，不要使用 `VITE_` 前缀。

### 本地开发

`.env` 支持以下变量：

```env
MINIMAX_API_KEY="玩家或作者的 MiniMax API Key"
TWILIGHT_AUTHOR_MINIMAX_API_KEY="可选：作者 KEY"
AUTHOR_MINIMAX_API_KEY="可选：作者 KEY 兼容变量"
MINIMAX_MODEL="MiniMax-M2.5"
MINIMAX_BASE_URL="https://api.minimaxi.com"
MINIMAX_TIMEOUT_MS="20000"
```

作者 KEY 优先级：

1. `TWILIGHT_AUTHOR_MINIMAX_API_KEY`
2. `AUTHOR_MINIMAX_API_KEY`
3. `MINIMAX_API_KEY`

本地后端会把 `MINIMAX_API_KEY` 作为兜底作者 KEY，因此开发时只配置 `MINIMAX_API_KEY` 也可以测试 `使用作者的KEY`。

### 桌面封包

普通封包：

```bash
npm run desktop:pack
```

带作者 KEY 的封包：

```bash
npm run desktop:pack:author
```

`desktop:pack:author` 会从本地 `.env` 读取作者 KEY，临时生成 `electron/author-key.local.json`，运行 Electron 打包后立刻删除该临时文件。该文件已加入 `.gitignore`，不要手动提交。

注意：桌面包内置作者 KEY 有被提取的风险。只有在接受该风险的分发场景中才使用 `desktop:pack:author`。

### Vercel 线上版

Vercel 项目需要配置环境变量：

```env
MINIMAX_API_KEY="你的 MiniMax API Key"
TWILIGHT_AUTHOR_MINIMAX_API_KEY="推荐：同一个作者 KEY 或单独作者 KEY"
MINIMAX_MODEL="MiniMax-M2.5"
MINIMAX_BASE_URL="https://api.minimaxi.com"
MINIMAX_TIMEOUT_MS="20000"
```

最小可用配置是 `MINIMAX_API_KEY`。推荐同时配置 `TWILIGHT_AUTHOR_MINIMAX_API_KEY`，这样 `/api/settings/api-key` 会明确报告作者 KEY 可用。

环境变量修改后需要重新部署。部署后可先访问：

```text
https://你的域名/api/settings/api-key
```

预期返回 JSON 中包含：

```json
{
  "configured": true,
  "source": "author",
  "supportsAuthorKey": true
}
```

响应不应包含 KEY 明文。

## 常用命令

```bash
npm run content:check
npm run lint
npm run build
npm run desktop:dev
npm run desktop:pack
npm run desktop:pack:author
```

关键测试命令：

```bash
node --import tsx --test server/backendApp.test.mjs server/apiSettings/state.test.mjs server/apiSettings/route.test.mjs server/apiSettings/handler.test.mjs server/npcDialogue/provider.test.mjs server/npcDialogue/responseParser.test.mjs server/npcDialogue/safety.test.mjs server/npcDialogue/handler.test.mjs server/vercelFunctions.test.mjs src/services/apiSettings.test.ts src/components/ApiSettingsPanel.test.ts scripts/desktopAuthorKey.test.mjs
```

## 项目入口

- `src/`：React 游戏前端。
- `server/`：本地后端、API 设置、NPC 对话处理与 MiniMax 调用。
- `api/`：Vercel Functions 入口。
- `electron/`：Electron 桌面主进程。
- `scripts/`：内容校验、Node 环境准备和桌面封包辅助脚本。
- `twilight_izakaya_launcher.ps1` / `黄昏居酒屋.bat`：Windows 本地一键启动入口。

## 常见问题

### 开始新游戏时提示未配置 KEY

进入 `设置 -> API 设置`，选择 `使用作者的KEY` 或填写自己的 MiniMax KEY。线上版需要确认 Vercel 环境变量已配置并重新部署。

### 点击“使用作者的KEY”失败

说明当前后端没有可用作者 KEY，或作者 KEY 已失效。可以改填自己的 MiniMax KEY，也可以检查 `.env`、桌面封包流程或 Vercel 环境变量。

### 桌面包没有作者 KEY

确认使用的是：

```bash
npm run desktop:pack:author
```

而不是普通的 `npm run desktop:pack`。封包前 `.env` 中必须有有效的作者 KEY。

### 端口被占用

一键启动脚本会自动寻找空闲端口。桌面版固定使用 `127.0.0.1:37621`，如果提示端口占用，请先确认是否已经打开了一个桌面版实例。

### 浏览器没有自动打开

本地一键启动时如果浏览器没有打开，可以复制终端输出的前端地址手动访问。
