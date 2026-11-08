<!-- markdownlint-disable -->

[简体中文](README.md) | [繁體中文](README_zh-HK.md) | **English**

<div align="center">

<img src="./src-tauri/icons/icon.png" width="120" alt="DeskMate icon">

# DeskMate

A local-first desktop app for timetables, schedules and todos<br>
No account · No cloud · All data stays on your computer<br>
Built with Tauri 2 + React + Rust

[Report an issue](https://github.com/Ahazjh/DeskMate/issues) · [Releases](https://github.com/Ahazjh/DeskMate/releases)<br>
[Download](#download) · [Features](#features) · [Build from source](#build-from-source)

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

## Why DeskMate

Most note, calendar and todo apps require an account, a long onboarding and a slow startup. DeskMate puts quick notes, timetables, schedules and todos into one local window: summon it instantly, close it, and never depend on a service.

## Features

- **Markdown notes** — GFM, LaTeX, live preview, categories, `.md` import/export
- **Quick notes & tiles** — global hotkey (`Ctrl+Space` by default), pin notes as desktop tiles
- **Timetable** — semester weeks, odd/even weeks, rescheduled/cancelled classes, timeline & table views, print/PDF, free-text import
- **Shared timetable** — import a partner's classes, overlapping slots, five relationship icons, automatic common free slots
- **Schedule & todos** — time-block events, due-date todos, overdue grouping, smart planning, DDL pressure strip, daily habits & streaks
- **Desktop widget** — one "Today" window shows schedule and todos stacked, four font sizes, always-on-top, remembered position, auto-restore on startup
- **Light / dark theme** — circular reveal expanding from the button you clicked; respects reduced-motion
- **Local reminders** — class/event/todo notifications without network access

![Main window](Docs/images/主窗口截图.png)

![Desktop widget](Docs/images/小窗多开示例.gif)

## Download

**Windows x64 only for now** (Windows 10/11 with WebView2 Runtime; usually preinstalled on Win11).

Get it from [GitHub Releases](https://github.com/Ahazjh/DeskMate/releases/latest):

| File | Description |
| --- | --- |
| [DeskMate_1.2.0_x64-setup.exe](https://github.com/Ahazjh/DeskMate/releases/download/v1.2.0/DeskMate_1.2.0_x64-setup.exe) | Installer (recommended): Start menu and desktop shortcut |
| [DeskMate_1.2.0_x64_portable.exe](https://github.com/Ahazjh/DeskMate/releases/download/v1.2.0/DeskMate_1.2.0_x64_portable.exe) | Portable: single exe, run from any folder |
| [SHA256SUMS.txt](https://github.com/Ahazjh/DeskMate/releases/download/v1.2.0/SHA256SUMS.txt) | Checksums |

> Upgrading from 1.2.0 or earlier migrates notes, schedule and timetable into the new data folders; the old folders are kept as a backup.

### Data & privacy

- Config: `%APPDATA%\deskmate`
- Notes, schedule, todos and timetable: `Documents\DeskMate`
- Everything is local; no upload, no analytics, no account. See [PRIVACY](PRIVACY)

### Getting started

1. Install or run the exe; the tray icon starts automatically and the "Today" widget opens on startup
2. Switch between Notes / Schedule / Todos in the main window; the timetable lives under Schedule
3. Use `Aa` in the widget title bar for font size and `Axis / Table` for view mode; drag position is remembered
4. Toggle light/dark in settings to see the circular theme reveal

### Experience checklist

To see everything DeskMate can do, or to prepare feedback, [Docs/EXPERIENCE-CHECKLIST.md](Docs/EXPERIENCE-CHECKLIST.md) is a task-by-task walkthrough organised by real usage path: Markdown notes, quick pads and tiles, schedule and todos, timetable import, dual timetables, reminders and the desktop widget, quick entry and daily review — 8 groups, about 60 items, each with "how to try it" and "what you should see". It takes about 15–20 minutes end to end.

## Build from source

Requires Node.js, the Rust toolchain and Visual Studio Build Tools. A PowerShell helper is included:

```powershell
cd C:\Users\<you>\Desktop\DeskMate
npm ci
.\start-deskmate.ps1              # dev mode (hot reload)
.\start-deskmate.ps1 -Release     # build the Windows installer
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full build and release guide.

## Star History

[![Star History Chart](https://star-history.dera.page/svg?repos=Ahazjh/DeskMate&type=Date&legend=top-left)](https://star-history.dera.page/#Ahazjh/DeskMate&Date)

## 🌟 Contributors

[![contrib.rocks](https://contrib.rocks/image?repo=Ahazjh/DeskMate&max=1000)](https://contrib.rocks/image?repo=Ahazjh/DeskMate&max=1000)

## Sponsors

| <img src="https://signpath.org/assets/favicon.png" alt="SignPath Logo" width=50> | Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org/) |
| --- | --- |

## License

[MIT](LICENSE)
