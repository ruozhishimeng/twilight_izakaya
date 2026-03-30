# 黄昏居酒屋

《黄昏居酒屋》是一个基于 React + Vite 的叙事调酒游戏项目。

## 运行环境

- Windows
- Node.js 18 及以上
- 已安装项目依赖

## 首次使用

在项目根目录打开终端后运行：

```bash
npm install
```

## 一键启动

根目录已经提供一键启动脚本：

- [黄昏居酒屋.bat](F:\twilight_izakaya\黄昏居酒屋.bat)

使用方法：

1. 直接双击 `黄昏居酒屋.bat`
2. 或者在 `cmd` / PowerShell 中进入项目根目录后运行：

```bat
黄昏居酒屋.bat
```

脚本会自动完成以下工作：

1. 自动切换到项目根目录
2. 自动检测可用端口，避开端口冲突
3. 同时启动前端和本地后端
4. 等待服务就绪后自动打开默认浏览器

默认情况下：

- 前端优先使用 `3000`
- 后端优先使用 `3001`

如果端口被占用，脚本会自动寻找下一个空闲端口。

## 手动启动

如果你不想使用一键脚本，也可以手动启动。

### 1. 启动前端

```bash
npm run dev
```

### 2. 启动本地后端

```bash
node local-backend.mjs
```

### 3. 浏览器访问

前端启动后，访问终端输出的本地地址即可。

## 项目内的启动文件

- [黄昏居酒屋.bat](F:\twilight_izakaya\黄昏居酒屋.bat)：Windows 一键启动入口
- [twilight_izakaya_launcher.ps1](F:\twilight_izakaya\twilight_izakaya_launcher.ps1)：启动逻辑脚本
- [local-backend.mjs](F:\twilight_izakaya\local-backend.mjs)：本地轻量后端

## 常见问题

### 双击脚本没有反应

请确认：

- 已安装 Node.js
- 已执行过 `npm install`
- 当前系统允许通过批处理启动 PowerShell

### 端口被占用

无需手动处理。一键启动脚本会自动寻找空闲端口。

### 浏览器没有自动打开

这通常是系统环境限制导致的。此时可以直接复制终端输出的前端地址，在浏览器中手动打开。
