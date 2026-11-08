[简体中文](README.md) | **繁體中文** | [English](README_en-US.md)

<!-- markdownlint-disable -->

<div align="center">

<img src="./src-tauri/icons/icon.png" width="120" alt="DeskMate圖示">

# DeskMate

輕巧、優雅、現代化的本機便箋工具<br>
基於 Tauri 2 + React 構建

[回報問題](https://github.com/Ahazjh/DeskMate/issues) · [更新日誌](https://github.com/Ahazjh/DeskMate/releases) <br>
[快速開始](#快速開始) · [FAQ](https://github.com/Ahazjh/DeskMate/wiki) · [構建指南](#從原始碼構建)

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

## 為什麼選擇DeskMate

市面上現有的筆記或便箋軟件，要麼功能繁重、上手門檻高，要麼介面陳舊、久未更新。DeskMate因此而生，其特點是輕巧、隨呼隨用，同時提供現代化的介面與舒適的編輯體驗。

## 功能特點

- **Markdown 編輯與預覽** — 支援 GitHub Flavored Markdown 語法，可即時切換編輯及預覽模式

  ![主視窗截圖](Docs/images/主窗口截图.png)

- **快速便箋** — 透過系統匣或全域快速鍵（預設 `Ctrl+Space`）隨時喚出便箋視窗

  ![小視窗多開示例](Docs/images/小窗多开示例.gif)

- **磁貼模式** — 將筆記固定於桌面某處，以便快速查閱及複製

  ![磁貼示例](Docs/images/AI绘画截图.png)

- **匯入匯出** — 支援 `.md` 檔案的匯入及匯出

## 應用場景

- 用作隨時可見的剪貼簿，快速暫存及複製文字
- 遊戲、觀看影片時隨手記錄
- 臨時記錄思路或靈感
- 桌面待辦清單

## 快速開始

### 下載安裝

#### 透過 GitHub 下載

請前往 [Release 頁](https://github.com/Ahazjh/DeskMate/releases/latest) 下載DeskMate

##### 下載參考

| 系統    | 架構                    | 類型             | 檔案名稱                                    |
| ------- | ----------------------- | ---------------- | ------------------------------------------- |
| Windows | x64                     | 安裝程式（推薦） | deskmate\_版本號\_x64-setup.exe     |
| Windows | x64                     | 可攜版           | deskmate\_版本號.exe                |
| Windows | x64                     | 安裝包           | deskmate\_版本號\_x64.msix          |
| Windows | AArch64                 | 安裝程式（推薦） | deskmate\_版本號\_aarch64-setup.exe |
| Windows | AArch64                 | 安裝包           | deskmate\_版本號\_aarch64.msix      |
| macOS   | AArch64 (Apple Silicon) | DMG              | deskmate\_版本號\_aarch64.dmg       |
| macOS   | x64 (Intel)             | DMG              | deskmate\_版本號\_x64.dmg           |

#### 透過 Microsoft Store 下載

前往 [Microsoft Store](https://apps.microsoft.com/detail/9NRCC0ZSG81R) 下載DeskMate

> 注意：MSIX 安裝（無論來自 Microsoft Store 或側載的 .msix 檔案）暫不支援應用程式內更新，請透過 Microsoft Store 或 GitHub Releases 取得最新版本。

<!-- markdownlint-disable -->

<a href="https://apps.microsoft.com/detail/9NRCC0ZSG81R?referrer=appbadge&mode=full" target="_blank"  rel="noopener noreferrer">
	<img src="https://get.microsoft.com/images/en-us%20dark.svg" width="200"/>
</a>

<!-- markdownlint-restore -->

#### macOS 版安裝指引

如遇安裝問題，請參考：

- Wiki 中的 [macOS 安裝指引](https://github.com/Ahazjh/DeskMate/wiki/macOS-%E5%AE%89%E8%A3%85%E6%8C%87%E5%BC%95-%7C-macOS-Installation-Guidance)
- 或影片（Bilibili）：[Mac雲課堂 - 在 Mac 上裝軟件，要學會和蘋果鬥智鬥勇](https://www.bilibili.com/video/BV1tg411t7hN)

### 從原始碼構建

請參考 [CONTRIBUTING.md](CONTRIBUTING.md)

## Star History

[![Star History Chart](https://star-history.dera.page/svg?repos=Ahazjh/DeskMate&type=Date&legend=top-left)](https://star-history.dera.page/#Ahazjh/DeskMate&Date)

## 🌟 貢獻者

[![contrib.rocks](https://contrib.rocks/image?repo=Ahazjh/DeskMate&max=1000)](https://contrib.rocks/image?repo=Ahazjh/DeskMate&max=1000)

## Sponsors

<!-- markdownlint-disable -->

| <img src="https://signpath.org/assets/favicon.png" alt="SignPath Logo" width=50> | Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org/) |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |

<!-- markdownlint-restore -->

## 授權條款

[MIT](LICENSE)
