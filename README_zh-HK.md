<!-- markdownlint-disable -->

[简体中文](README.md) | **繁體中文** | [English](README_en-US.md)

<div align="center">

<img src="./src-tauri/icons/icon.png" width="120" alt="DeskMate 圖示">

# DeskMate

本地優先的課表、日程與待辦桌面應用<br>
零帳號 · 零雲端 · 資料全部留在自己的電腦<br>
基於 Tauri 2 + React + Rust 建構

[回報問題](https://github.com/Ahazjh/DeskMate/issues) · [更新日誌](https://github.com/Ahazjh/DeskMate/releases)<br>
[下載安裝](#下載安裝) · [功能特點](#功能特點) · [從源碼建構](#從源碼建構)

[![Version](https://img.shields.io/github/v/release/Ahazjh/DeskMate)](https://github.com/Ahazjh/DeskMate/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Stars](https://img.shields.io/github/stars/Ahazjh/DeskMate?color=ffcb47&labelColor=black)</br>
![React 19](https://img.shields.io/badge/React-19-blue?logo=react)
![Tauri v2](https://img.shields.io/badge/Tauri-v2-%2324C8D8?logo=tauri)
![Rust Edition 2021](https://img.shields.io/badge/Rust-2021-%23000000?logo=rust)

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Ahazjh/DeskMate)

</div>

<!-- markdownlint-restore -->

---

## 為什麼選擇 DeskMate

市面上的筆記、日曆與待辦工具往往要註冊帳號、引導流程長、啟動也慢。DeskMate 把「隨手記」與「課表 / 日程 / 待辦」放進同一個本地視窗：呼出即用，關閉即走，不依賴任何服務。

## 功能特點

- **Markdown 筆記** — GFM、LaTeX 公式、即時預覽、分類管理、`.md` 匯入匯出
- **快捷便籤與磁貼** — 全域快捷鍵（預設 `Ctrl+Space`）呼出便籤，可把筆記固定成桌面磁貼
- **課表** — 週次與單雙週、調課 / 停課、時間軸與表格檢視、列印 / 匯出 PDF、文字快速匯入
- **雙人課表** — 匯入對方的課表，雙方課程佔滿同一時段重疊顯示，五種關係專屬圖示，自動標出共同空檔
- **日程與待辦** — 時間塊日程、截止待辦、逾期分組、智慧排期、DDL 壓力條、每日必做與連續打卡
- **桌面小窗** — 一個「今日一覽」視窗上下同時顯示日程與待辦，四檔字體大小、置頂、位置記憶，啟動自動恢復
- **深淺色主題** — 以點擊的按鈕為圓心圓形擴散切換，尊重系統「減少動態效果」設定
- **本地提醒** — 課程 / 日程 / 待辦到點提醒，無需連網

![主視窗截圖](Docs/images/主窗口截图.png)

![桌面小窗](Docs/images/小窗多开示例.gif)

## 下載安裝

**目前僅提供 Windows x64 版本**（Windows 10 / 11，需系統已安裝 WebView2 Runtime；Win11 通常內建）。

請前往 [GitHub Releases](https://github.com/Ahazjh/DeskMate/releases/latest) 下載：

| 檔案 | 說明 |
| --- | --- |
| [DeskMate_1.2.0_x64-setup.exe](https://github.com/Ahazjh/DeskMate/releases/download/v1.2.0/DeskMate_1.2.0_x64-setup.exe) | 安裝版（推薦）：建立開始功能表與桌面捷徑 |
| [DeskMate_1.2.0_x64_portable.exe](https://github.com/Ahazjh/DeskMate/releases/download/v1.2.0/DeskMate_1.2.0_x64_portable.exe) | 攜帶版：單一 exe，放到任意目錄直接執行 |
| [SHA256SUMS.txt](https://github.com/Ahazjh/DeskMate/releases/download/v1.2.0/SHA256SUMS.txt) | 校驗和 |

> 從 1.2.0 及更早版本升級時，原有筆記、日程與課表會自動遷移到新的資料目錄，舊目錄保留作為備份。

### 資料與隱私

- 設定：`%APPDATA%\deskmate`
- 筆記、日程、待辦與課表：`文件\DeskMate`
- 全部為本地檔案，不上傳、不分析、不需要帳號；隱私說明見 [PRIVACY](PRIVACY)

### 快速上手

1. 安裝或直接執行 exe，啟動後托盤常駐，並自動開啟「今日一覽」小窗
2. 在主視窗切換「筆記 / 日程 / 待辦」，課表位於日程頁的「課表」標籤
3. 點小窗標題列 `Aa` 調整字體大小，`軸 / 表` 切換檢視；拖到順手的位置會自動記住
4. 在設定裡切換淺色 / 深色，即可看到圓形擴散的主題切換效果

## 從源碼建構

需要 Node.js、Rust 工具鏈與 Visual Studio Build Tools。仓库根目錄附帶 PowerShell 啟動指令稿：

```powershell
cd C:\Users\<你>\Desktop\DeskMate
npm ci
.\start-deskmate.ps1              # 開發模式（熱更新）
.\start-deskmate.ps1 -Release     # 打包 Windows 安裝版
```

完整建構與發佈說明見 [CONTRIBUTING.md](CONTRIBUTING.md)。

## Star History

[![Star History Chart](https://star-history.dera.page/svg?repos=Ahazjh/DeskMate&type=Date&legend=top-left)](https://star-history.dera.page/#Ahazjh/DeskMate&Date)

## 🌟 貢獻者

[![contrib.rocks](https://contrib.rocks/image?repo=Ahazjh/DeskMate&max=1000)](https://contrib.rocks/image?repo=Ahazjh/DeskMate&max=1000)

## Sponsors

| <img src="https://signpath.org/assets/favicon.png" alt="SignPath Logo" width=50> | Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org/) |
| --- | --- |

## 授權

[MIT](LICENSE)
