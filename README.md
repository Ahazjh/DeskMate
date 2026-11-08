<!-- markdownlint-disable -->

**简体中文** | [繁體中文](README_zh-HK.md) | [English](README_en-US.md)

<div align="center">

<img src="./src-tauri/icons/icon.png" width="120" alt="DeskMate 图标">

# DeskMate

轻量、优雅、现代化的本地便签工具<br>
基于 Tauri 2 + React 构建

[反馈问题](https://github.com/Ahazjh/DeskMate/issues) · [更新日志](https://github.com/Ahazjh/DeskMate/releases) <br>
[快速开始](#快速开始) · [FAQ](https://github.com/Ahazjh/DeskMate/wiki) · [构建指南](#从源码构建)

[![Version](https://img.shields.io/github/v/release/Ahazjh/DeskMate)](https://github.com/Ahazjh/DeskMate/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Stars](https://img.shields.io/github/stars/Ahazjh/DeskMate?color=ffcb47&labelColor=black)</br>
![React 19](https://img.shields.io/badge/React-19-blue?logo=react)
![Tauri v2](https://img.shields.io/badge/Tauri-v2-%2324C8D8?logo=tauri)
![Rust Edition 2021](https://img.shields.io/badge/Rust-2021-%23000000?logo=rust)<br>
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Ahazjh/DeskMate)

</div>

<!-- markdownlint-restore -->

---

## 为什么选择DeskMate

市面上现有的笔记或便签软件，要么功能繁重、上手门槛高，要么界面陈旧、久未更新。DeskMate因此而生，其特点是轻便、随呼随用，同时提供现代化的界面与舒适的编辑体验。

## 功能特点

- **Markdown 编辑与预览** — 支持 GitHub Flavored Markdown 语法，实时切换编辑和预览模式

  ![主窗口截图](Docs/images/主窗口截图.png)

- **快捷便签** — 通过托盘或全局快捷键（默认 `Ctrl+Space`）随时唤出便签窗口

  ![小窗多开示例](Docs/images/小窗多开示例.gif)

- **磁贴模式** — 将笔记固定在桌面某处，以便快速查阅和复制

  ![磁贴示例](Docs/images/AI绘画截图.png)

- **导入导出** — 支持 `.md` 文件的导入和导出

## 应用场景

- 当作随时可见的剪贴板，快速暂存和复制文本
- 游戏、看视频时随手记点东西
- 临时记录思路或灵感
- 桌面待办清单

## 快速开始

### 下载安装

#### 通过 GitHub 下载

请前往 [Release 页](https://github.com/Ahazjh/DeskMate/releases/latest) 下载 DeskMate

> 从 1.2.0 及更早版本升级时，原有笔记、日程与课表会自动迁移到新的数据目录，旧目录保留作为备份。

##### 下载参考

| 系统    | 架构                    | 类型             | 文件名                                      |
| ------- | ----------------------- | ---------------- | ------------------------------------------- |
| Windows | x64                     | 安装程序（推荐） | deskmate\_版本号\_x64-setup.exe     |
| Windows | x64                     | 便携版           | deskmate\_版本号.exe                |
| Windows | x64                     | 安装包           | deskmate\_版本号\_x64.msix          |
| Windows | AArch64                 | 安装程序（推荐） | deskmate\_版本号\_aarch64-setup.exe |
| Windows | AArch64                 | 安装包           | deskmate\_版本号\_aarch64.msix      |
| macOS   | AArch64 (Apple Silicon) | DMG              | deskmate\_版本号\_aarch64.dmg       |
| macOS   | x64 (Intel)             | DMG              | deskmate\_版本号\_x64.dmg           |

#### 通过 Microsoft Store 下载

前往 [Microsoft Store](https://apps.microsoft.com/detail/9NRCC0ZSG81R) 下载 DeskMate

> 注意：MSIX 安装（无论来自 Microsoft Store 还是侧载的 .msix 文件）暂不支持应用内更新，请通过 Microsoft Store 或 GitHub Releases 获取最新版本。

<!-- markdownlint-disable -->

<a href="https://apps.microsoft.com/detail/9NRCC0ZSG81R?referrer=appbadge&mode=full" target="_blank"  rel="noopener noreferrer">
	<img src="https://get.microsoft.com/images/en-us%20dark.svg" width="200"/>
</a>

<!-- markdownlint-restore -->

#### macOS 版安装指引

如遇安装问题，请参考：

- Wiki 中的 [macOS 安装指引](https://github.com/Ahazjh/DeskMate/wiki/macOS-%E5%AE%89%E8%A3%85%E6%8C%87%E5%BC%95-%7C-macOS-Installation-Guidance)
- 或视频（Bilibili）：[Mac云课堂 - 在 Mac 上装软件，要学会和苹果斗智斗勇](https://www.bilibili.com/video/BV1tg411t7hN)

### 从源码构建

请参考 [CONTRIBUTING.md](CONTRIBUTING.md)

## Star History

[![Star History Chart](https://star-history.dera.page/svg?repos=Ahazjh/DeskMate&type=Date&legend=top-left)](https://star-history.dera.page/#Ahazjh/DeskMate&Date)

## 🌟 贡献者

[![contrib.rocks](https://contrib.rocks/image?repo=Ahazjh/DeskMate&max=1000)](https://contrib.rocks/image?repo=Ahazjh/DeskMate&max=1000)

## Sponsors

<!-- markdownlint-disable -->

| <img src="https://signpath.org/assets/favicon.png" alt="SignPath Logo" width=50> | Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org/) |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |

<!-- markdownlint-restore -->

## 许可证

[MIT](LICENSE)
