# PDF Presentation Tool

[English](README.md) | 简体中文

这是一个基于 [DamianoP/PDF_Presentation_Tool](https://github.com/DamianoP/PDF_Presentation_Tool) 二次开发的 Windows 11 x64 便携版 PDF (Beamer) 放映工具。

本项目面向“笔记本主屏 + 外接显示器或投影仪”的演讲场景，程序可以直接从 U 盘运行，不要求安装 Node.js、浏览器或网络连接。当前界面支持简体中文和 English，默认使用简体中文。

> ！本项目重度依赖AI进行开发，虽然本人使用暂未发现问题，但请自行评估风险。
> * [pympress](https://github.com/Cimbali/pympress) 是一个功能强大全面的开源 PDF 放映工具, 但我在实际使用过程中会出现频繁卡顿的效果
> * [dspdfviewer](https://github.com/projekter/dspdfviewer) 能够流畅放映，但不支持激光笔等功能
> * [PDF-Presentation-Tool](https://github.com/DamianoP/PDF_Presentation_Tool) 既能够流畅放映，又支持激光笔等功能, 但需要安装 Node.js, 且首次首次使用必须联网, 使用不方便
> 
> 基于以上原因，我决定二次开发一个便携版，以方便在演讲时使用, 主要功能如下


## 主要功能

- 双窗口放映：演讲者窗口和观众窗口分离
- 外接显示器和投影仪选择
- Beamer 双宽 PDF 自动识别, 请在Beamer中使用命令`\setbeameroption{show notes on second screen=right}`
- 演讲者备注预览：显示当前页、下一页和备注(Notes)
- 激光笔、聚光灯、白板批注和橡皮擦
- 黑屏、计时器、休息倒计时

**以下是二次开发后的新增功能:**
- 当前页和放映窗口均支持 PDF 内部链接跳转
- 当前页、下一页、缩略图和备注面板可调整布局
- 完全离线运行，PDF.js 和 Worker 使用本地文件
- 便携, 可以直接放到U盘上, 在陌生的汇报地点或者使用别人的电脑时, 可以插上U盘直接使用
- 语言切换：简体中文 / English

## 操作说明

### 直接运行便携版

1. 将 `PDF-Presentation-Tool-Portable-1.0.0-x64.exe` 复制到 U 盘。
2. 双击运行，不需要安装 Node.js、浏览器或其他运行环境。
3. 在初始界面点击 `📄 Choose File`，选择 PDF 文件；也可以将 PDF 拖入选择区域。
4. PDF 加载后进入演讲者界面。
5. 点击右下角的 Start/Stop Presentation，选择观众显示器或投影仪。
6. 将观众窗口移动到目标屏幕后，在观众窗口按 `F` 进入或退出原生全屏。
7. 在观众窗口按 `Esc` 结束放映并关闭观众窗口。


## 常用快捷键

| 按键                                    | 功能             |
| --------------------------------------- | ---------------- |
| `Right` / `Down` / `Space` / `PageDown` | 下一页           |
| `Left` / `Up` / `PageUp`                | 上一页           |
| `Home`                                  | 第一页           |
| `End`                                   | 最后一页         |
| `B` 或 `.`                              | 黑屏             |
| `F`                                     | 放映窗口全屏切换 |
| `L`                                     | 激光笔           |
| `S`                                     | 聚光灯           |
| `Z`                                     | 放大镜           |
| `P`                                     | 观众进度条       |
| `D`                                     | 白板批注         |
| `E`                                     | 橡皮擦           |
| `C`                                     | 清除批注         |
| `1`–`5`                                 | 切换批注颜色     |
| `+` / `-`                               | 调整批注线宽     |


## 运行架构

```text
演讲者窗口 index.html  ── BroadcastChannel / postMessage ── 观众窗口 presentation.html
         │
         └── 本地 Node.js + Express + WebSocket 服务
```

PDF 渲染在本机通过 PDF.js 完成。Electron 主进程负责本地服务器、独立窗口、显示器选择和原生全屏。

## 项目结构

```text
├── data/                         # 前端页面、样式、本地资源和 JavaScript
│   ├── index.html                # 演讲者窗口
│   ├── presentation.html         # 观众放映窗口
│   ├── css/main.css              # 主样式
│   ├── js/                       # 应用、PDF 渲染和窗口通信逻辑
│   └── public/vendor/pdfjs/      # 本地 PDF.js 和 Worker
├── electron/                     # Electron 主进程和 preload
├── scripts/                      # 离线检查和 Electron 冒烟测试
├── Doc/                          # 项目架构文档
├── server.js                     # 本地 Express/WebSocket 服务
├── package.json                  # 依赖和构建脚本
├── package-lock.json             # 固定依赖版本
└── vite.config.js                # Vite 配置
```

## 离线和隐私

- PDF 文件在本机处理，不上传到服务器。
- PDF.js、Worker、应用页面和 Service Worker 均使用本地资源。
- 运行时不依赖 CDN、Google Fonts 或首次联网下载。
- 本项目不会修改用户选择的 PDF 文件。

## 开发和构建

开发环境要求 Node.js 20–24 和 Windows 11 x64。

```powershell
npm install
npm run build
npm run check:offline
```

生成 Windows 便携版：

```powershell
$workspace = (Get-Location).Path
$env:ELECTRON_CACHE = Join-Path $workspace '.electron-cache'
$env:ELECTRON_BUILDER_CACHE = Join-Path $workspace '.electron-builder-cache'
$env:TEMP = Join-Path $workspace '.tmp'
$env:TMP = Join-Path $workspace '.tmp'
npm run dist:portable
```

## 开源和许可证

本项目是在 [DamianoP/PDF_Presentation_Tool](https://github.com/DamianoP/PDF_Presentation_Tool) 基础上的二次开发。发布和修改时请保留原项目版权、许可证和第三方依赖声明。

项目根目录中的 `LICENSE` 为 AGPL-3.0 许可证。内置 PDF.js 文件随附其许可证文件，位于 `data/public/vendor/pdfjs/3.2.146/LICENSE.txt`。
