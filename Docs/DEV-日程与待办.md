# 开发文档 · 日程与待办

| 项目     | 内容                                              |
| -------- | ------------------------------------------------- |
| 对应 PRD | [PRD-日程与待办.md](./PRD-日程与待办.md)          |
| 目标版本 | v1.3.0（P0）/ v1.3.x（P1）                        |
| 文档版本 | v0.1                                              |
| 日期     | 2026-11-06                                        |
| 技术栈   | Tauri 2 · React 19 · TypeScript 5.8 · Rust 2021   |

---

## 实现状态（v0.1）

本轮已落地一个可运行的初版，范围对应 M0–M2 的主干：

- **已实现**：`agenda/events.json` + `todos.json` + `courses.json` + `daily.json` + `timetable.json` + `reminders.json` 原子读写、`.bak` 备份、损坏文件隔离恢复；待办增删改查、勾选完成、优先级、标签、日期/时间、智能清单、搜索；日程增删改查、全天/跨天、月视图、周视图、颜色；课程表（手动增删改、TSV/CSV 粘贴导入、自由文本粘贴导入、每节具体时刻、学期开始日期与当前周推算、按周过滤、单次调课/停课例外）；课程内作业/待办/提醒（截止时间、提交平台，复用待办清单）；每日必做（模板管理、按日勾选、近 7 天进度）；快速待办小窗与全局快捷键；主窗口「笔记 / 日程」工作区切换；三语文案。
- **v0.4 增补**：系统提醒引擎（`services/reminders.rs`，30s 后台 tick、系统通知 + 应用内提醒条、稍后提醒、今天不再提醒、免打扰时段、错过补偿、触发去重持久化）、提醒设置面板、`Todo.remindMinutes` 自定义提前量；快速添加本地语法解析（`quickAdd.ts` 纯函数 + 52 条单测，小窗实时 chips）；每日回顾自动成文（`agenda_review_generate`，复用 `NoteStore` 写入 Markdown 笔记，次日启动自动生成前一天，手动按钮可生成当天）。
- **v0.5 增补**：`services/widgets.rs` 持久化两个桌面小窗的位置/尺寸（`agenda/widgets.json`）；`desktop.rs` 新增 `agenda-widget-schedule` / `agenda-widget-todos` 窗口（420×500、无边框、默认置顶、隐藏复用）；`AgendaWidgetWindow.tsx` 提供时间轴/表格双视图、空状态、置顶切换、位置记忆与实时刷新；`windowRoutes.ts` 增加 `agendaWidget` 视图与 `kind` 参数；修复快速待办小窗无法输入。
- **小窗输入与保存失效的真正根因（v0.5 修正）**：
  1. `open_agenda_widget` / `open_quick_todo_window` 原先是**同步 `#[tauri::command] fn`**。从 WebView 调用时，命令线程与 `WebviewWindowBuilder::build()` 的窗口创建重入互锁，导致**整个应用的 IPC 全部挂起**——`agenda_snapshot`、`notes_list` 等所有 invoke 永不返回，表现为「待办、笔记都无法保存，界面一直加载中…」。项目里能正常工作的 `open_notepad_window` / `open_tile_window` 都是 `async fn`。修复：两个命令改为 `async fn`。
  2. 上一轮曾尝试在窗口创建命令里同步调用 `show() + set_focus()` 修输入焦点，但 WebView2 未就绪时同步窗口操作会加剧互锁，已移除。改为：窗口保持 `visible(false)` 创建，由 `QuickTodoWindow` / `AgendaWidgetWindow` 挂载后**异步** `show()`；`QuickTodoWindow` 独立调用 `show`/`setFocus` 并加 80/250/600ms 兜底 focus。
  3. `save()` 里 `await getCurrentWindow().hide()` 在 WebView 挂起后可能永不 resolve，导致 `saving` 卡死并禁用输入框；改为 fire-and-forget 并立即重置 `saving`。
- **实测**：用 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223` 连接真实 WebView 诊断。修复前打开小窗后所有 invoke 4s 超时；修复后 `agenda_snapshot` 3ms、`open_agenda_widget` 25–36ms、`open_quick_todo_window` 24ms，三个窗口 WebView 正常加载、真实键盘输入与 chips 正常。
- **v0.6 增补（图片 OCR 已于 v0.7 移除）**：`freeTextCourses.ts` 宽松文本解析（23 条单测）；`CourseImportDialog` 改为「表格粘贴 / 文字粘贴」两个 tab 共用校对预览。曾用 `device-ai 0.3` 调系统 OCR 并做网格映射，但因课表截图识别质量不稳定，v0.7 连同 `timetableImage` 字段、图片命令与相关文案一起删除；磁盘上已导入的图片文件保留不删。
- **v0.15 增补（v3：内容可见 + 深色小窗无白边）**：圆形色幕由 0.98 不透明改为 0.45 半透明（径向渐变、边缘透明），切换过程中底层文字与控件始终可见，不再出现整片空白；小窗（合并日程/待办窗、快速待办窗）挂载时给 `html` 加 `widget-window` class，CSS 为 `html/body/#root` 铺不透明 `var(--color-cloud)`，消除透明边距在深色模式下透出 WebView 白色背景的问题。
- **v0.17 增补（彻底改名与清理）**：移除旧版数据目录自动迁移逻辑（数据已迁移完成）、LEGACY 常量、`FLORAL_NOTEPAPER_*` 环境变量统一为 `DESKMATE_*`、keyring 旧服务名兼容分支；删除贡献者抓取脚本与生成数据（关于面板已精简）、Mirror酱 发布 workflow、前端 CDK API/测试/类型字段与不可达的 Mirror 错误分支及三语文案；`.gitignore` 增加 `.workbuddy/`。项目目录重命名为 `DeskMate`，本地 Git 仓库初始化并对齐远程 main。
- **v0.16 增补（小窗字号调节）**：`AgendaWidgetWindow` 标题栏新增 `Aa` 按钮，弹出四档字号面板（小 0.9 / 标准 1 / 大 1.15 / 特大 1.3）；档位存 `localStorage["deskmate-widget-font-scale"]`，通过内容区 `style={{ zoom: fontScale }}` 等比缩放两块列表、压力条与底栏，标题栏控件保持不变；三语文案新增 `agenda.widget.fontSize.*`。点面板外遮罩或选档后关闭菜单。
- **v0.16 增补（小窗字号调节）**：`AgendaWidgetWindow` 标题栏新增 `Aa` 按钮，弹出四档字号面板（小 0.9 / 标准 1 / 大 1.15 / 特大 1.3）；档位存 `localStorage["deskmate-widget-font-scale"]`，通过内容区 `style={{ zoom: fontScale }}` 等比缩放两块列表、压力条与底栏，标题栏控件保持不变；三语文案新增 `agenda.widget.fontSize.*`。点面板外遮罩或选档后关闭菜单。
- **v0.15 增补（主题切换：按键中心的圆形扩散，v2 修订）**：因 View Transitions 全屏快照卡顿，改为单个 GPU 合成圆。`SlidingButtonGroup` 的 `onChange` 附带被点击按钮中心坐标，`themeReveal.ts` 以该点为圆心计算覆盖半径，创建 `.theme-reveal-circle`（径向渐变色幕），分两段 WAAPI 动画：460ms `transform: scale(0→1)` 均匀扩散（`cubic-bezier(0.25,0.46,0.45,0.94)`），覆盖整屏后 `applyTheme(option, false)` 切主题（被色幕遮住，无跳变），再 140ms opacity 淡出并移除。只动画 transform / opacity，不做全屏快照；`prefers-reduced-motion` / 无 `Element.animate` 时直接切换；系统主题、初始化、config-changed 同步仍走原 `applyTheme`。CSS 已移除 `::view-transition-*` 规则。
- **v0.14 增补（下载源与关于面板）**：GitHub 仓库地址统一为 `https://github.com/Ahazjh/DeskMate`；删除应用内下载源的 Mirror酱 选项与 CDK 输入区，下载源固定 GitHub，Rust 端 `StoredUpdateSettings` 默认值与 `load()` / `from_dto()` 均归一化为 `GithubFirst`、`selected_download_source` 固定返回 GitHub；三语 README 删除 Mirror酱 下载段、tips 删除 Mirror 提示、三语 locale 删除 `mirrorChyan` 文案；关于面板只保留产品名、简介、版权/许可证文字与版本号，移除更新区、外部链接、贡献者与底部 tips 栏。
- **v0.13 增补（小窗合并）**：`AGENDA_WIDGET_LABEL = "agenda-widget"`，删除按 kind 分窗口的逻辑；`open_startup_widgets` 只打开一个窗口，位置优先 `all` → 兼容 `schedule`；`AgendaWidgetWindow` **上下同时显示**日程与待办两个 section（各自 `flex-1` 独立滚动，待办区底部常驻压力条），窗口规格 420×720；工作区顶部两个入口合并为「桌面小窗」一个按钮。另附 `start-deskmate.ps1`：自动补 cargo PATH、定位 npm、清理旧进程后启动。
- **v0.14 增补（下载源与关于面板）**：GitHub 仓库地址统一为 `https://github.com/Ahazjh/DeskMate`；删除应用内下载源的 Mirror酱 选项与 CDK 输入区，下载源固定 GitHub，Rust 端 `StoredUpdateSettings` 默认值与 `load()` / `from_dto()` 均归一化为 `GithubFirst`、`selected_download_source` 固定返回 GitHub；三语 README 删除 Mirror酱 下载段、tips 删除 Mirror 提示、三语 locale 删除 `mirrorChyan` 文案；关于面板只保留产品名、简介、版权/许可证文字与版本号，移除更新区、外部链接、贡献者与底部 tips 栏。
- **v0.13 增补（小窗合并）**：`AGENDA_WIDGET_LABEL = "agenda-widget"`，删除按 kind 分窗口的逻辑；`open_startup_widgets` 只打开一个窗口，位置优先 `all` → 兼容 `schedule`；`AgendaWidgetWindow` 内部用 `activeTab` 切换日程/待办，视图模式与置顶状态改为共享 localStorage 键，拖动位置保存到 `all`。工作区顶部两个入口合并为「桌面小窗」一个按钮。
- **v0.12 增补**：双人课程改为「同一时间段重叠、都占满跨度」——自己的块实色 + 实线边框 + 顶部文字，对方块淡化背景 + 虚线边框 + 底部文字，重叠时文字上下错开；`open_startup_widgets` 在 setup 后 1.2s 于后台线程打开两个 `agenda-widget-*` 窗口，复用 `agenda/widgets.json` 的位置，缺失时按主屏尺寸右侧并排；`--silent` 启动跳过。
- **v0.11 增补（双人展示重做）**：双人模式行高 40→66px，自己的课程上半格显示「名称 + 地点」，对方课程下半格显示「关系图标 + 名称 + 地点」并加深背景；网格顶部新增图例（我 / 对方 / 共同空档）；`PartnerIcon.tsx` 按 5 种关系渲染不同 SVG（爱心/双人/学士帽/交叠圆环/单人），用于网格、月视图、弹窗列表与关系按钮。去掉旧的 `PartnerHeart` 单一爱心。
- **v0.10 增补**：`clear_courses`（连带清空调课例外）与 `clear_partner_courses`（保留档案）及对应命令；课程表顶部新增垃圾桶（清空本人）与眼睛（显示/隐藏对方，localStorage 记忆）；`PartnerDialog` 增加显示开关与清空按钮；`PartnerHeart.tsx` 小爱心用于双人网格、月视图对方课程条与弹窗列表。
- **测试资产**：`testdata/课表-测试-本人.xlsx`（17 门，覆盖连堂/单节/单双周/`第N周`/地点变更/周末/晚上课）与 `testdata/课表-测试-对方.xlsx`（6 门，用于双人课表与共同空档）。`services/course_file.rs` 的 `parses_bundled_test_timetables` 会在两个文件存在时断言解析门数、单双周规范化、地点变更与 0 警告；文件缺失时自动跳过。
- **v0.9 增补**：`AgendaSnapshot` 增加 `partnerProfile` / `partnerCourses`，独立 `agenda/partner.json`；命令 `agenda_partner_profile_save` / `agenda_partner_courses_import` / `agenda_partner_course_delete`（复用 `normalize_course` 与去重，Rust 测试覆盖）。`sharedSlots.ts` 用当前周过滤双方课程计算 7×12 共同空档（4 条单测）；`CourseGrid` 支持上下分层与共同空档高亮，`MonthGrid` 增加课程/对方课程 chip；`PartnerDialog` 管理昵称、关系、颜色、文件导入与删除。桌面小窗底部显示「下周/明天有 N 节课」，解决「今天没课所以小窗空白」的误解。
- **v0.8 增补**：`services/course_file.rs` 用 `calamine 0.38` 直接解析 `.xls/.xlsx`：定位「星期一…星期日」表头 → 列映射星期 → 逐格按「课程名/(节次)周次/校区/地点/教师/…」拆分（换行拆多门课），`normalize_weeks` 把 `1-3周(单),4-8周`、`第3周` 规范化为 `1,3,4-8周`，同课程同节次合并周次并把地点变动写入 note；命令 `agenda_course_file_import` 走 `spawn_blocking`，限制 10 MB 与扩展名。`CourseImportDialog` 改为「课表文件 / 文字粘贴」两 tab，文件路径由系统对话框选择，不再要求复制到文本框。真实文件（2025自动化03课表.xls）解析 16 门课、0 条警告。快速待办小窗新增「自定义」日期（date input，窗口 252→278）；`coursesForWeek` 与 Rust `weeks_match` 无需改动，因为周次已规范化。
- **v0.7 增补**：`schedulePlanner.ts`（空档 × DDL × 预估时长，贪心排期，13 条单测）、`ddlPressure.ts`（14 天压力）、`semesterProgress.ts`（周次进度）、`weeklyReview.ts`（本周时间账本）；`Todo.estimateMinutes`、`CourseOverride`（`agenda/course_overrides.json` + 2 个命令 + 2 条 Rust 单测）；提醒引擎新增 `muteDuringCourses` 与 `in_course_time`（含周次匹配/停课例外，1 条 Rust 单测）；UI 新增 `PlanDialog`、`DdlPressureStrip`（待办列表 + 桌面小窗）、`SemesterProgressBar`、`CourseOverrideDialog`、`TimetablePrintView`（A4 横向 + `@media print`）；课程抽屉新增「记笔记 / 调课」入口，课程表渲染停课/调课标记。
- **实测**：`tsc` / `vitest` 226 项 / `oxlint` 0 / `vite build` / `cargo fmt --check` / `cargo check --locked` / `cargo test --lib --locked` 173 项全过；无头 Edge 验证压力条、排期弹窗（7 个计划块 + 写入按钮）、周次进度条、打印视图、课程抽屉笔记/调课按钮与调课弹窗。
- **未实现**：重复规则（解析器能识别但会提示暂未支持）、托盘计数、今日磁贴、便签待办页签、笔记选区转待办、ICS 导入导出、拖拽改期与拖拽排序；图片导入与 OCR 已移除，不再计划。
- **已知取舍**：删除为永久删除（带确认弹窗），未接回收站；周起始日暂固定为周一；每次写入整文件重写；`AgendaWorkspace` 切换时卸载笔记编辑区（状态仍在 `MainWindow`，滚动位置不保留）；回顾笔记中的课程按星期列出，暂不做周次过滤；便携版 Windows 无包身份时系统通知可能不可用，自动降级为应用内提醒条。

---

## 0. 摘要

本次改造在现有「笔记」之外增加两个工作区：**日程**（时间块）与**待办**（截止事项）。核心约束是延续DeskMate的既有工程哲学：

- 业务数据仍然落**本地明文文件**，不引入数据库、不联网。
- Rust 侧是唯一写入方，前端通过 `invoke` 调用，写成功后广播事件，各窗口只读刷新。
- 所有列表与编辑交互复用现有视觉 token 与组件习惯（`SlidingButtonGroup`、`Tile` 的配色派生、`Toast`、`ContextMenu`）。

### 0.1 关键决策

| 决策点     | 选择                                   | 理由                                                       | 被否方案                                                     |
| ---------- | -------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| 数据存储   | 两个 JSON 文件 + 原子写                | 与 `metadata.json` 一致；可读、可备份、可直接排障           | SQLite（新依赖 + 迁移成本）、塞进笔记 `.md`（结构化查询难）   |
| 时间表示   | UTC RFC3339；全天事件额外存 `dayKey`   | 与现有 `chrono::Utc` 一致；渲染时转本地                      | 本地时间字符串（时区变更后全部错位）                         |
| 重复规则   | 自定义 `RecurrenceRule`，查询时展开    | 零新依赖；只做产品需要的四种频率                             | `rrule` crate（能力强但依赖重、边界多）、预生成实例（改规则困难） |
| 提醒调度   | Rust 后台线程 30s tick + 系统通知      | 应用常驻托盘，不受窗口隐藏/休眠影响                          | 前端 `setInterval`（后台节流导致漂移）、OS 计划任务（三平台成本高） |
| 入口形态   | 主窗口内工作区切换                     | 复用窗口 chrome 与背景层，无额外 WebView 开销                | 新开「日程窗口」（重复标题栏、内存翻倍、切换割裂）            |
| 快速添加   | 本地规则解析                           | 隐私、离线、零延迟                                           | LLM 解析（联网、成本、不确定性）                              |

### 0.2 三条不要做的事

1. **不要把待办塞进 `metadata.json`**。它承担笔记索引与重建语义，混入异构数据会让 `rebuild_metadata` 的「扫描 .md 重建」逻辑失效。
2. **不要用 `localStorage` 存业务数据**。现有 `localStorage` 只存主题缓存，业务数据必须可被用户备份。
3. **不要让前端直接写文件**。多窗口会并发写；写入必须收敛到 Rust 单进程 + 互斥锁。

---

## 1. 现状盘点与复用

| 现有能力             | 当前位置                                             | 复用方式                                                       |
| -------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| 原子 JSON 写         | `src-tauri/src/json_io.rs::write_json_atomic`         | 直接复用（temp + `sync_all` + `rename` + 父目录 fsync）          |
| 结构化错误           | `services/notes.rs::AppError`                         | 复用 `{code,message,details}`，新增 `agenda*` 错误码             |
| 数据目录解析与迁移   | `services/notes.rs`（`default_store`、`DATA_DIR_ITEMS`） | 扩展 `DATA_DIR_ITEMS`，新增 `agenda/` 子目录                     |
| 配置读写             | `services/notes.rs::AppConfig`                        | 新增 6 个字段，全部 `#[serde(default)]`                          |
| 前端事件刷新         | `notes-changed` / `config-changed`                     | 新增 `agenda-changed`，模式完全一致                              |
| 侧栏 / 列表 / 抽屉样式 | `MainWindow.tsx`、`NotepadOpenPanel.tsx`              | 复用 `bg-paper/40`、`border-paper-deep/30`、`bg-bamboo-mist` 等  |
| 磁贴配色             | `components/Tile.tsx` + `chroma-js`                   | 事件色板同样按亮度混合出边框/文字色                              |
| 快捷键录制           | `features/settings/shortcutRecorder.ts`               | 快速添加快捷键直接复用                                           |
| 多语言               | `src/locales/{zh-CN,zh-HK,en-US}` + `src-tauri/src/locales.rs` | 前端加 `agenda` 命名空间；Rust 加托盘/通知文案                  |
| 弹窗定位             | `components/popupPosition.ts`                          | 快速添加浮窗、日期选择器复用                                     |
| 删除策略             | `services/notes.rs` 回收站实现                         | 待办删除沿用同一策略                                             |

---

## 2. 总体架构

```
┌──────────────────────────────────────────────────────────────┐
│ React 渲染进程                                                │
│                                                              │
│  App.tsx                                                     │
│   ├─ MainWindow（笔记工作区，现有）                           │
│   └─ AgendaWorkspace（新）                                    │
│        ├─ CalendarView（月 / 周）                             │
│        ├─ TodoListView（智能清单）                            │
│        ├─ DetailDrawer（事件 / 待办详情）                     │
│        └─ QuickAddBar（快速添加）                             │
│                                                              │
│  features/agenda/{api,types,dateUtils,recurrence,parser}.ts   │
└───────────────────────────┬──────────────────────────────────┘
                            │ invoke / listen
┌───────────────────────────▼──────────────────────────────────┐
│ Tauri IPC 层                                                  │
│  agenda_* 命令（读写 + 校验 + 展开）                           │
│  agenda-changed / agenda://reminder / agenda://navigate       │
└───────────────────────────┬──────────────────────────────────┘
┌───────────────────────────▼──────────────────────────────────┐
│ Rust 核心                                                     │
│  AgendaState(Mutex<AgendaStore>)                              │
│   ├─ AgendaStore：events.json / todos.json 原子读写            │
│   ├─ recurrence：区间展开、下一次触发计算                      │
│   └─ ReminderEngine：30s tick → 通知 / 事件                    │
└───────────────────────────┬──────────────────────────────────┘
                            │ std::fs
                    <dataDir>/agenda/*.json
```

数据流遵循现有单向模式：**UI 乐观更新 → invoke → Rust 加锁校验落盘 → emit → 所有窗口重拉快照**。前端不维护跨窗口状态，Rust 是唯一真相源。

---

## 3. 数据层

### 3.1 目录布局

```
<dataDir>/
├── metadata.json                 # 现有：笔记索引
├── notes/<分类>/*.md             # 现有
├── images/<noteId>/*             # 现有
├── backgrounds/                  # 现有
└── agenda/                       # 新增
    ├── events.json
    ├── events.json.bak
    ├── todos.json
    ├── todos.json.bak
    ├── courses.json              # 课程表
    ├── courses.json.bak
    ├── daily.json                # 每日必做模板 + 按日勾选
    ├── daily.json.bak
    ├── timetable.json            # 学期开始日期 + 每节时刻
    └── reminders.json            # 已触发去重键 + 今日静音
```

`agenda/` 与笔记数据同级，随数据目录迁移一起搬运（见 3.8）。`reminders.json` 是运行态数据，损坏可丢弃，不影响业务数据。

### 3.2 JSON Schema

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-11-06T08:30:00Z",
  "todos": [
    {
      "id": "b3d1c0a2-9c1e-4b7a-9a2c-2f6a1f0d8e11",
      "title": "把报价单发给张工",
      "notes": "附上 Q4 折扣表",
      "done": false,
      "completedAt": null,
      "dueDate": "2026-11-06",
      "dueAt": "2026-11-06T10:00:00Z",
      "priority": 2,
      "tags": ["工作", "Q4"],
      "recurrence": null,
      "remindMinutes": 10,
      "sourceNoteId": "7f0a...",
      "sortOrder": 1024,
      "createdAt": "2026-11-05T02:11:00Z",
      "updatedAt": "2026-11-05T02:11:00Z"
    }
  ]
}
```

`events.json` 结构相同，数组键为 `events`，元素字段见 3.3。

约定：

- 时间一律 UTC RFC3339（`2026-11-06T10:00:00Z`），由前端 `new Date(...).toISOString()` 或 Rust `DateTime<Utc>` 产出。
- 全天事件/仅日期待办额外存 `dueDate` / `startDate`（`YYYY-MM-DD`），**不存时区**，避免跨时区漂移。
- `priority`：0 无、1 低、2 中、3 高。
- `sortOrder`：整数，新项取当前最大值 + 1024，拖拽时取前后项均值；间隔小于 1 时触发一次全量重排。

### 3.3 Rust 类型

新增 `src-tauri/src/services/agenda.rs`（若超过 800 行，拆为 `agenda/{mod,store,model,recurrence,reminder}.rs`）。

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub done: bool,
    #[serde(default)]
    pub completed_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub due_date: Option<String>,
    #[serde(default)]
    pub due_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub priority: u8,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub recurrence: Option<RecurrenceRule>,
    #[serde(default)]
    pub remind_minutes: Option<i64>,
    #[serde(default)]
    pub source_note_id: Option<String>,
    #[serde(default)]
    pub sort_order: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgendaEvent {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub all_day: bool,
    pub start_at: DateTime<Utc>,
    pub end_at: DateTime<Utc>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub end_date: Option<String>,
    #[serde(default)]
    pub location: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub reminder_minutes: Vec<i64>,
    #[serde(default)]
    pub recurrence: Option<RecurrenceRule>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecurrenceRule {
    pub freq: Freq,
    #[serde(default = "default_interval")]
    pub interval: u32,
    #[serde(default)]
    pub by_weekday: Vec<u8>,
    #[serde(default)]
    pub count: Option<u32>,
    #[serde(default)]
    pub until: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Freq {
    Daily,
    Weekly,
    Monthly,
    Yearly,
}
```

派生类型（不落盘）：

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventOccurrence {
    pub event_id: String,
    pub start_at: DateTime<Utc>,
    pub end_at: DateTime<Utc>,
    pub occurrence_key: String,
    pub is_recurring: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgendaSnapshot {
    pub events: Vec<AgendaEvent>,
    pub occurrences: Vec<EventOccurrence>,
    pub todos: Vec<Todo>,
    pub warnings: Vec<String>,
}
```

### 3.4 TypeScript 类型

`src/features/agenda/types.ts` 与 Rust 一一对应，字段名 camelCase：

```ts
export type Priority = 0 | 1 | 2 | 3;
export type Freq = "daily" | "weekly" | "monthly" | "yearly";

export interface RecurrenceRule {
  freq: Freq;
  interval: number;
  byWeekday?: number[];
  count?: number | null;
  until?: string | null;
}

export interface Todo {
  id: string;
  title: string;
  notes: string;
  done: boolean;
  completedAt: string | null;
  dueDate: string | null;
  dueAt: string | null;
  priority: Priority;
  tags: string[];
  recurrence: RecurrenceRule | null;
  remindMinutes: number | null;
  sourceNoteId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgendaEvent {
  id: string;
  title: string;
  notes: string;
  allDay: boolean;
  startAt: string;
  endAt: string;
  startDate: string | null;
  endDate: string | null;
  location: string;
  color: string | null;
  reminderMinutes: number[];
  recurrence: RecurrenceRule | null;
  createdAt: string;
  updatedAt: string;
}
```

**不要**在前端把 `Todo` 拆成「UI 模型 + 存储模型」两套，字段量不足以抵消映射成本；只在视图层用 `TodoView = Todo & { overdue: boolean; dueLabel: string }` 派生。

### 3.5 Store 实现

```rust
pub struct AgendaStore {
    root: PathBuf,
}

impl AgendaStore {
    pub fn new(data_dir: &Path) -> Self {
        Self { root: data_dir.join("agenda") }
    }

    pub fn ensure_dirs(&self) -> Result<(), AppError> { /* create_dir_all */ }

    pub fn load_todos(&self) -> Result<LoadOutcome<TodoFile>, AppError>;
    pub fn load_events(&self) -> Result<LoadOutcome<EventFile>, AppError>;

    pub fn update_todos<T>(
        &self,
        f: impl FnOnce(&mut TodoFile) -> Result<T, AppError>,
    ) -> Result<T, AppError> {
        let mut file = self.load_todos()?.data;
        let output = f(&mut file)?;
        file.updated_at = Utc::now();
        self.save_todos(&file)?;   // 内部走 write_json_atomic
        Ok(output)
    }
}
```

- 所有修改走 `update_*` 闭包，避免「读—改—写」在调用侧散落。
- 校验在闭包内执行（标题 trim、标签长度、时间区间），失败返回 `AppError` 且**不落盘**。
- `save_*` 前把旧文件复制为 `.bak`（保留 1 份），再原子写。

### 3.6 并发与一致性

- `AgendaStore` 由 `AgendaState(Mutex<AgendaStore>)` 包裹，注册为 Tauri managed state。
- 命令签名统一 `state: State<'_, AgendaState>`；锁内完成「读 → 改 → 写」，锁外 `emit`，避免持锁回调。
- 前端不做跨窗口冲突合并：任何窗口写成功后广播 `agenda-changed`，其余窗口重拉快照。丢失的只是极端并发下的中间态，不是数据。
- 一次写入超过 2 MB 时（约 1 万条待办），改为整体重写仍可接受（< 50ms）；不做增量写，保持实现简单。

### 3.7 损坏恢复

```rust
pub struct LoadOutcome<T> {
    pub data: T,
    pub recovered_from: Option<PathBuf>, // 已重命名的损坏文件
}
```

解析失败时：

1. 把原文件重命名为 `<name>.corrupt-<unix>.json`；
2. 返回空数据集；
3. `AgendaSnapshot.warnings` 携带路径，前端 Toast 提示「日程数据损坏，已备份到 …」。

与 `metadata.json` 的恢复策略保持一致，但**不做自动扫描重建**——JSON 没有可推断的正文来源。

### 3.8 数据目录迁移（最容易踩的坑）

`services/notes.rs` 中：

```rust
const DATA_DIR_ITEMS: [&str; 4] = ["metadata.json", "notes", "images", "backgrounds"];
```

改为：

```rust
const DATA_DIR_ITEMS: [&str; 5] = ["metadata.json", "notes", "images", "backgrounds", "agenda"];
```

同时 `rescue_loose_legacy_notes` 的保留目录判断：

```rust
"notes" | "images" | "backgrounds" | "updates" => continue,
```

加入 `"agenda"`，否则旧目录救援逻辑会把 `agenda/` 当成「分类目录」扫描（虽然其中没有 `.md`，但语义上必须排除）。

`migrate_legacy_aux_data` **不要**加 `agenda`：它只处理 v1.0.4 之前的旧布局，那时不存在日程数据。

验收用例：设置自定义数据目录 → 重启 → 待办与事件完整；旧目录被清空；`agenda/*.bak` 一并迁移。

### 3.9 容量与性能预算

| 指标             | 目标                     | 手段                                              |
| ---------------- | ------------------------ | ------------------------------------------------- |
| 1 万条待办加载   | < 150ms                  | 单文件反序列化；列表虚拟滚动                      |
| 单次保存         | < 50ms                   | 原子写；仅在内容变化时写                          |
| 月视图切换       | < 100ms                  | 只展开当前区间；`limit` 上限 500 个 occurrence    |
| 内存             | 增量 < 40MB              | 不缓存全部 occurrence，只缓存当前视图区间         |

---

## 4. IPC 契约

### 4.1 命令

| 命令                     | 入参                                             | 返回                  | 说明                                     |
| ------------------------ | ------------------------------------------------ | --------------------- | ---------------------------------------- |
| `agenda_snapshot`        | `rangeStart`, `rangeEnd`                          | `AgendaSnapshot`      | 首屏/切区间，一次拿事件 + occurrence + 待办 |
| `agenda_events_range`    | `rangeStart`, `rangeEnd`                          | `EventOccurrence[]`   | 仅切月/切周时用，减少负载                |
| `agenda_event_create`    | `request: EventInput`                             | `AgendaEvent`         | 校验并广播                               |
| `agenda_event_update`    | `id`, `request: EventInput`, `scope`              | `AgendaEvent`         | `scope`: `single` / `all`（P0 仅 all）   |
| `agenda_event_delete`    | `id`, `scope`                                     | `()`                  | 同上                                     |
| `agenda_course_create`   | `request: CourseInput`                            | `Course`              | 课程表手动新增                           |
| `agenda_course_update`   | `id`, `request`                                   | `Course`              |                                          |
| `agenda_course_delete`   | `id`                                              | `()`                  |                                          |
| `agenda_courses_import`  | `courses: CourseInput[]`                          | `Course[]`            | 表格粘贴导入，按同名/同节次去重           |
| `agenda_daily_create`    | `request: DailyTaskInput`                         | `DailyTask`           | 每日必做模板                             |
| `agenda_daily_update`    | `id`, `request`                                   | `DailyTask`           |                                          |
| `agenda_daily_delete`    | `id`                                              | `()`                  | 同时清理历史勾选                         |
| `agenda_daily_toggle`    | `taskId`, `date`, `done`                          | `string[]`            | 返回该日期已勾选的 id 列表               |
| `agenda_timetable_image_import` | `sourcePath`                               | `string`              | 复制到 `agenda/timetable/`，替换旧图     |
| `agenda_timetable_image_remove` | —                                          | `()`                  | 删除参考底图                             |
| `agenda_todo_list`       | `filter: TodoFilter`                              | `Todo[]`              | 智能清单由 Rust 计算，避免前端重复实现   |
| `agenda_todo_create`     | `request: TodoInput`                              | `Todo`                |                                          |
| `agenda_todo_update`     | `id`, `patch: TodoPatch`                          | `Todo`                | 部分字段更新                             |
| `agenda_todo_toggle`     | `id`, `done`                                      | `Todo`                | 完成重复待办时生成下一实例               |
| `agenda_todo_delete`     | `id`                                              | `()`                  | 进回收站                                 |
| `agenda_todo_reorder`    | `ids: string[]`                                   | `()`                  | 批量写 `sortOrder`                       |
| `agenda_counts`          | `todayStart`, `todayEnd`                          | `AgendaCounts`        | 托盘与角标                               |
| `agenda_notification_permission` | —                                        | `"granted"｜"denied"｜"prompt"` | 首次使用前查询             |
| `agenda_import_ics`      | `path`                                            | `ImportReport`        | P2                                       |
| `agenda_export_ics`      | `path`, `rangeStart`, `rangeEnd`                  | `()`                  | P2                                       |

所有命令返回 `Result<T, AppError>`，失败时前端 `getErrorMessage` 已有统一解析链路，需在 `src/features/notes/api.ts` 的 `LOCALIZED_ERROR_CODES` 中补充新错误码。

### 4.2 事件

| 事件                  | 载荷                                        | 订阅方                          |
| --------------------- | ------------------------------------------- | ------------------------------- |
| `agenda-changed`      | `{ kind: "todo"｜"event", ids: string[] }`   | 主窗口、便签、磁贴、托盘刷新     |
| `agenda://reminder`   | `ReminderPayload`                            | 主窗口 Toast、通知点击处理       |
| `agenda://navigate`   | `{ date?: string, todoId?: string }`         | 主窗口接收后切工作区并定位       |

### 4.3 错误码

| code                     | 触发场景                     | 前端文案 key                    |
| ------------------------ | ---------------------------- | ------------------------------- |
| `agendaNotFound`         | id 不存在                    | `errors.agendaNotFound`         |
| `agendaTitleEmpty`       | 标题为空                     | `errors.agendaTitleEmpty`       |
| `agendaInvalidRange`     | 查询区间 > 400 天或起止倒置  | `errors.agendaInvalidRange`     |
| `agendaInvalidRecurrence`| 规则非法（interval=0 等）    | `errors.agendaInvalidRecurrence`|
| `agendaStoreCorrupt`     | 读取失败且无法恢复           | `errors.agendaStoreCorrupt`     |
| `agendaImportFailed`     | ICS 解析失败                 | `errors.agendaImportFailed`     |
| `agendaNotifyDenied`     | 通知权限被拒                 | `errors.agendaNotifyDenied`     |

---

## 5. 关键算法

### 5.1 日期键与周起始

统一用本地 `YYYY-MM-DD` 字符串作为「天」的主键，禁止用 `toISOString().slice(0, 10)`（会因 UTC 偏移错一天）。

```ts
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfWeek(date: Date, weekStartsOn: 0 | 1): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (copy.getDay() - weekStartsOn + 7) % 7;
  copy.setDate(copy.getDate() - diff);
  return copy;
}
```

### 5.2 月网格

固定 42 格，避免月份行数变化造成高度跳动：

```ts
export function monthGrid(year: number, month: number, weekStartsOn: 0 | 1): string[] {
  const first = new Date(year, month, 1);
  const gridStart = startOfWeek(first, weekStartsOn);
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    return dayKey(day);
  });
}
```

跨月格子用 `text-ink-ghost/50` 淡化，仍可点击新建（落在实际日期）。

### 5.3 重复展开

**只支持**：daily / weekly（可指定星期集合）/ monthly（按起始日）/ yearly（按起始月日）。不支持 BYSETPOS、倒数第 N 个、工作日规则。

```
expand(event, rangeStart, rangeEnd, limit = 500):
  duration = event.endAt - event.startAt
  if event.recurrence == null:
      return intersects(event, range) ? [occurrence(event.startAt)] : []

  cursor = event.startAt
  produced = 0
  guard = 0
  out = []

  while cursor < rangeEnd and out.size < limit and guard < 10000:
      guard += 1
      if cursor + duration > rangeStart and matches(rule, event.startAt, cursor):
          out.push(occurrence(cursor, cursor + duration))
          produced += 1
          if rule.count != null and produced >= rule.count: break
      cursor = advance(rule, event.startAt, cursor)

  return out
```

- `advance`：
  - daily：`+ interval 天`
  - weekly 且 `byWeekday` 非空：`+1 天`（由 `matches` 过滤星期）
  - weekly 且无 `byWeekday`：`+ interval × 7 天`
  - monthly：`+ interval 月`，日期取 `min(起始日, 该月最后一天)`
  - yearly：`+ interval 年`，2 月 29 日遇平年取 2 月 28 日
- `until` 按本地日期比较，`count` 只统计已产出实例。
- `guard` 防止「2 月 30 日 + 每月」这类规则造成死循环。

时区说明：P0 以 UTC 时间推进，跨 DST 地区的「每天 09:00」可能偏移 1 小时；中国大陆无夏令时，暂不处理，文档与设置页注明。

### 5.4 提醒调度

```
ReminderEngine:
  state: BTreeMap<fireAt, Vec<Candidate>>
  fired: BTreeMap<key, firedAt>        // reminders.json，保留 7 天
  mutedUntil: Option<DateTime<Local>>  // 今日不再提醒

  重建（启动、agenda-changed、每小时）:
      清空 state
      区间 = [now - 5min, now + 48h]
      对区间内每个 event occurrence × 每个 offset：
          fireAt = occurrenceStart - offset
          key = "{kind}:{id}:{occurrenceKey}:{offset}"
          if fired.contains(key) or muted: continue
          state[fireAt].push(candidate(candidate))

  每 30s tick:
      now = Utc::now()
      for fireAt in state.range(..=now + 5s):
          if now - fireAt > 90s: continue      // 错过太多，跳过
          for candidate in due:
              if fired.contains(key): continue
              notify(candidate)
              fired.insert(key, now)
      清理 7 天前的 fired
```

- 通知点击：Windows/macOS 通过 action 回调或前台窗口的 `agenda://navigate` 打开详情。
- 「今天不再提醒」写入 `mutedUntil = 今天 23:59:59`，跨天自动失效。
- 「稍后提醒」只存在内存（会话级），重启后不再补发，避免幽灵提醒。
- 应用启动时若发现错过 ≤ 30 分钟的提醒，合并为一条「你有 N 项提醒」；超过则只更新托盘红点。

### 5.5 跨天事件切分

月视图按天切段：`segment = [max(event.start, dayStart), min(event.end, dayEnd)]`。首段显示标题，后续段只显示延续条；全天事件同理但按 `dayKey` 比较。周视图不做切分，用绝对定位 + 裁剪。

### 5.6 快速添加解析

按「从强特征到弱特征」顺序消费，每一步都把命中的片段从文本中移除：

1. 标签 `#([^\s#]+)`
2. 优先级 `(?:^|\s)(!{1,3})(?=\s|$)`
3. 重复 `每天|每日|每周([一二三四五六日天])|每月(\d{1,2})[日号]|每年(\d{1,2})月(\d{1,2})[日号]`
4. 提醒 `提前(\d+)分钟`
5. 时间 `(\d{1,2}):(\d{2})|(上午|下午|晚上|中午)(\d{1,2})点(半)?`
6. 日期 `今天|明天|后天|大后天|(下)?周[一二三四五六日天]|(\d{1,2})月(\d{1,2})[日号]|(\d{4})-(\d{2})-(\d{2})`
7. 剩余 trim 后作为标题

解析结果结构：

```ts
export interface ParsedInput {
  title: string;
  dueDate: string | null;
  dueAt: string | null;
  priority: Priority;
  tags: string[];
  recurrence: RecurrenceRule | null;
  remindMinutes: number | null;
  matched: Array<"date" | "time" | "recurrence" | "priority" | "tag" | "reminder">;
}
```

`matched` 用于在输入框下方渲染 chips；不含 `date/time` 时显示「未识别日期」提示，但不阻断保存。解析器必须无副作用、纯函数，便于单测覆盖 50+ 条用例。

### 5.7 排序

默认排序键（升序）：

```
1. done（未完成在前）
2. 是否逾期（逾期在前）
3. dueDate/dueAt 是否有值（有日期在前）
4. 日期升序
5. priority 降序
6. sortOrder 升序
7. createdAt 升序
```

手动拖拽后写入 `sortOrder`，并把智能清单切换为「手动排序」模式（该模式下只按 `sortOrder` 排，其余键失效）。模式状态存 `localStorage`（纯 UI 偏好，可丢）。

---

## 6. 前端架构

### 6.1 目录

```
src/features/agenda/
├── api.ts                  # invoke 封装
├── types.ts                # 与 Rust 对应的类型
├── dateUtils.ts            # dayKey / monthGrid / weekRange / format
├── recurrence.ts           # 展开预览、人类可读描述
├── parser.ts               # 快速添加解析
├── todoFilters.ts          # 智能清单规则（与 Rust 保持同一份定义）
├── useAgenda.ts            # 快照加载 + 事件订阅 + 乐观更新
├── useReminder.ts          # 通知权限、Toast 联动
└── components/
    ├── AgendaWorkspace.tsx
    ├── AgendaSidebar.tsx
    ├── MiniMonth.tsx
    ├── SmartListNav.tsx
    ├── CalendarToolbar.tsx
    ├── MonthGrid.tsx
    ├── WeekGrid.tsx
    ├── EventBlock.tsx
    ├── EventDrawer.tsx
    ├── TodoListView.tsx
    ├── TodoRow.tsx
    ├── TodoDrawer.tsx
    └── QuickAddBar.tsx
```

### 6.2 工作区切换与 MainWindow 改造

`MainWindow.tsx` 已有 3277 行，**不建议**把 Agenda 再塞进去。分三步：

**Step 1（准备，纯机械）**：把标题栏 + 窗口控制 + 背景层抽成 `components/WindowChrome.tsx`，props：

```ts
interface WindowChromeProps {
  title: string;
  leading?: React.ReactNode;   // 工作区切换器
  trailing?: React.ReactNode;  // 设置 / 关于 / 窗口按钮
  children: React.ReactNode;
}
```

这一步不改任何逻辑，先用现有 UI 回归验证。

**Step 2（接入）**：`App.tsx` 提升 `workspace` 状态：

```tsx
const [workspace, setWorkspace] = useState<"notes" | "agenda">("notes");

<WindowChrome title={appName} leading={<WorkspaceSwitcher value={workspace} onChange={setWorkspace} />}>
  <div hidden={workspace !== "notes"}><MainWindow /></div>
  <div hidden={workspace !== "agenda"}><AgendaWorkspace /></div>
</WindowChrome>
```

用 `hidden` 而不是卸载，保留滚动位置与选中项；代价是两个工作区常驻内存（实测应在 20MB 内）。若后续内存吃紧，再引入「首次访问才挂载 + 切走后保留快照」。

**Step 3（收尾）**：`MainWindow` 内部移除重复的 chrome 代码，只保留内容区。

`SettingsPanel` 的 `config` 状态目前在 `MainWindow` 内。为避免重复实现，Step 2 时把「配置读取 + 保存 + `config-changed` 订阅」抽成 `useAppConfig()`（放在 `features/settings/useAppConfig.ts`），两个工作区共用同一实例（通过 Context 提供），`SettingsPanel` 的 props 不变。

### 6.3 组件树

```
AgendaWorkspace
├── AgendaSidebar
│   ├── WorkspaceSwitcher（笔记 / 日程 / 待办）
│   ├── MiniMonth（点选日期 → 主区跳转）
│   ├── SmartListNav（今天/明天/本周/逾期/全部/已完成 + 计数）
│   └── TagFilter（标签云，多选）
├── AgendaMain
│   ├── CalendarToolbar（月/周切换、今天、前后翻页、新建）
│   ├── MonthGrid | WeekGrid
│   │   └── EventBlock（拖拽、点击）
│   └── TodoListView（按日期分组）
│       └── TodoRow（勾选、双击编辑、右键菜单）
├── DetailDrawer
│   ├── EventDrawer
│   └── TodoDrawer
└── QuickAddBar（浮层，快捷键唤起）
```

「日程」与「待办」共享左侧栏，只切换主区；移动端不在范围内。

### 6.4 数据流与乐观更新

```ts
export function useAgenda(range: { start: string; end: string }) {
  const [snapshot, setSnapshot] = useState<AgendaSnapshot>(EMPTY_SNAPSHOT);
  const epoch = useRef(0);

  const reload = useCallback(async () => {
    const current = ++epoch.current;
    const next = await agendaSnapshot(range.start, range.end);
    if (current === epoch.current) setSnapshot(next);
  }, [range.start, range.end]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const unlisten = listen("agenda-changed", () => void reload());
    return () => { void unlisten.then((fn) => fn()); };
  }, [reload]);

  return { snapshot, reload };
}
```

勾选待办采用乐观更新 + 失败回滚：

```ts
async function toggle(todo: Todo) {
  const before = snapshot;
  setSnapshot((prev) => patchTodo(prev, todo.id, { done: !todo.done }));
  try {
    const saved = await agendaTodoToggle(todo.id, !todo.done);
    setSnapshot((prev) => patchTodo(prev, todo.id, saved));
  } catch (error) {
    setSnapshot(before);
    showToast(getErrorMessage(error));
  }
}
```

规则：

- 只有「勾选 / 改优先级 / 拖拽排序」走乐观更新；新建、删除、改时间等结构性变更等 Rust 返回后再更新，避免 id 与排序错乱。
- 每次 reload 递增 `epoch`，丢弃过期响应（与 `MainWindow` 的 `useLoadEpoch` 同思路）。

### 6.5 样式与颜色

全部使用现有 Tailwind token，不新增全局 CSS 变量：

| 用途           | 类名                                                        |
| -------------- | ----------------------------------------------------------- |
| 工作区容器     | `app-surface-frame bg-cloud`                                |
| 侧栏           | `bg-paper/40 border-r border-paper-deep/30`                 |
| 选中项         | `bg-bamboo-mist/70 text-bamboo`                             |
| 今天格         | `bg-bamboo-mist/40 border-bamboo/30`                        |
| 非本月/周末    | `text-ink-ghost/60`                                         |
| 逾期           | `text-red-400` + `bg-danger-bg`                             |
| 抽屉           | `bg-cloud border-l border-paper-deep/40`                    |

事件色板（6 色），边框/文字用 `chroma-js` 按背景亮度派生，逻辑照抄 `Tile.tsx`：

```ts
export const EVENT_COLORS = [
  "#2d5a3d", // 竹
  "#c2703d", // 赭
  "#4a6fa5", // 靛
  "#8b5e8f", // 紫
  "#b08a2e", // 金
  "#5f7a6a", // 灰绿
];
```

### 6.6 i18n

- 前端新增 `agenda.*` 命名空间，key 以「区域.对象.动作」命名，例：`agenda.todo.smartList.today`、`agenda.calendar.month.today`。
- 三份 JSON 必须同时提交；`src/locales/resources.test.ts` 已校验 key 对齐，扩展该测试覆盖 `agenda` 命名空间。
- Rust 侧 `locales.rs` 增加：托盘标签、通知标题/正文模板、窗口标题。
- 日期格式：用 `Intl.DateTimeFormat(i18n.language, ...)`，不要手写 `MM月DD日`。

---

## 7. 集成清单（文件级）

| 文件                                          | 改动                                                                 | 风险 | 备注                                                     |
| --------------------------------------------- | -------------------------------------------------------------------- | ---- | -------------------------------------------------------- |
| `src-tauri/src/services/agenda.rs`（新）       | Store / 类型 / 校验 / 重复展开                                        | 中   | 建议配 20+ 单测                                          |
| `src-tauri/src/services/notes.rs`              | `DATA_DIR_ITEMS` 加 `agenda`；保留目录判断加 `agenda`                  | **高** | 漏改会导致切换数据目录后日程丢失                         |
| `src-tauri/src/lib.rs`                         | 注册 `AgendaState` + 14 个命令                                        | 低   | 命令名统一 `agenda_` 前缀                                |
| `src-tauri/src/desktop.rs`                     | 托盘菜单加「快速添加待办」「今日日程」；工具提示显示计数              | 中   | `build_tray_menu` 目前用 `specs[0..4]` 位置索引，必须改成按 id 查找 |
| `src-tauri/Cargo.toml`                         | `tauri-plugin-notification = "2"`                                     | 低   | Windows toast 依赖安装包身份，便携版需降级                |
| `src-tauri/capabilities/default.json`          | `notification:default`；窗口 label 加 `quickadd`                      | 低   | 新窗口不加则 invoke 被拒                                  |
| `src-tauri/tauri.conf.json`                    | 无需改（复用 assetProtocol）                                          | 低   | 日程不涉及本地资源协议                                    |
| `package.json`                                 | `@tauri-apps/plugin-notification`                                     | 低   |                                                          |
| `src/features/agenda/*`（新）                  | 类型 / API / hooks / 组件                                             | 中   |                                                          |
| `src/App.tsx`                                  | 工作区状态、`quickadd` 路由分支                                        | 中   | 与 `windowRoutes.ts` 同步                                |
| `src/features/windows/windowRoutes.ts`         | `AppView` 加 `"quickadd"`                                             | 低   | 现有 `buildUrl` 可直接复用                                |
| `src/components/WindowChrome.tsx`（新）        | 从 `MainWindow` 抽出标题栏/窗口控制                                    | **高** | 先做纯移动 + 回归，不加功能                               |
| `src/components/MainWindow.tsx`                | 移除 chrome、接收 `leading`；不改业务逻辑                              | 高   | 3277 行，改动必须小步                                    |
| `src/components/NotePad.tsx`                   | 第三页签「待办」（P1）                                                | 中   | 只读今天/逾期 + 勾选                                      |
| `src/components/Tile.tsx`                      | 支持 `dataSource="today-todos"`（P1）                                 | 中   | 复用现有拖拽/缩放                                        |
| `src/features/settings/types.ts` + `AppConfig` | 新增 `weekStartsOn`、`eventReminderMinutes`、`todoReminderEnabled`、`quietHours`、`quickAddShortcut`、`todoCompleteBehavior` | 中   | Rust 端每个字段都要 `#[serde(default)]`；前端要有兜底默认值 |
| `src/locales/*`                                | `agenda` 命名空间                                                     | 低   | 三语同步                                                 |
| `Docs/*`                                       | 本文档与 PRD                                                          | 低   |                                                          |

### 7.1 托盘菜单改造要点

现状：

```rust
let specs = tray_menu_specs(locale, config.close_to_tray, autostart);
let show_main = MenuItem::with_id(app, specs[0].id, specs[0].label, ...)?;
// ... specs[4] 是退出
```

新增菜单项后索引全部错位。改为：

```rust
fn spec<'a>(specs: &'a [TrayMenuSpec], id: &str) -> &'a TrayMenuSpec {
    specs.iter().find(|s| s.id == id).expect("menu spec missing")
}
```

并同步扩展 `tray_menu_action` 的 id → 动作映射。计数更新用 `MenuItem::set_text`，由 `agenda-changed` 触发、500ms 防抖，避免每次勾选都重建整个菜单。

### 7.2 配置字段

```rust
#[serde(default = "default_week_starts_on")]
pub week_starts_on: u8,              // 0=周日, 1=周一
#[serde(default = "default_event_reminder")]
pub event_reminder_minutes: i64,     // 10
#[serde(default = "default_true")]
pub todo_reminder_enabled: bool,
#[serde(default)]
pub quiet_hours: Option<QuietHours>, // { start: "22:00", end: "08:00" }
#[serde(default = "default_quick_add_shortcut")]
pub quick_add_shortcut: String,
#[serde(default = "default_todo_complete_behavior")]
pub todo_complete_behavior: String,  // "delay" | "instant" | "keep"
```

前端 `AppConfig` 对应字段设为可选（`weekStartsOn?: 0 | 1`），读取时统一 `?? 1`，避免旧配置文件缺字段导致 `undefined` 扩散。

---

## 8. 测试计划

### 8.1 前端（Vitest）

| 文件                        | 用例重点                                                                 |
| --------------------------- | ------------------------------------------------------------------------ |
| `dateUtils.test.ts`         | 月网格 42 格；跨年月份；周起始日 0/1；闰年 2 月；`dayKey` 不受 UTC 影响   |
| `recurrence.test.ts`        | 每月 31 日落到小月最后一天；每周多选星期；count/until 边界；2 月 29 日      |
| `parser.test.ts`            | 50+ 条中英文输入；标签/优先级/时间/日期混排；无法解析时标题完整保留        |
| `todoFilters.test.ts`       | 今天/明天/本周/逾期边界（23:59、00:00）；跨周；已完成排除                  |
| `useAgenda.test.ts`         | 过期响应丢弃；乐观更新回滚；事件触发重载                                   |
| `resources.test.ts`（扩展） | `agenda.*` key 三语对齐                                                    |

### 8.2 Rust

| 模块                  | 用例                                                                 |
| --------------------- | -------------------------------------------------------------------- |
| `agenda::store`       | CRUD；原子写；`.bak` 生成；损坏文件重命名并返回空集；并发 update 串行 |
| `agenda::recurrence`  | 与前端同规则的黄金用例（同一份 JSON fixture，双端断言一致）           |
| `agenda::reminder`    | 去重键；重启不重复通知；免打扰；错过 ≤30 分钟补发；时区回拨重算       |
| `services::notes`     | 数据目录迁移包含 `agenda/`；旧目录清理；`rescue_loose_legacy_notes` 不误吞 |
| `updater`（回归）     | 新增插件后更新安装握手仍正常                                          |

### 8.3 手工矩阵

- 平台：Windows 10/11 x64、Windows ARM64、macOS 15 Apple Silicon / Intel。
- 主题：浅色 / 深色 / 跟随系统；字体 12–20px。
- 语言：zh-CN / zh-HK / en-US。
- DPI：100% / 150% / 200%。
- 场景：双窗口同时勾选同一条待办；切换数据目录；通知权限拒绝；系统时间跨天；休眠唤醒后提醒。

---

## 9. 里程碑

| 阶段 | 范围                                                             | 完成定义（DoD）                                                        |
| ---- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| M0   | 数据层与命令：`agenda.rs`、类型、原子写、14 个命令、单元测试       | Rust 测试全绿；可用 `invoke` 在控制台完成 CRUD；数据目录迁移用例通过     |
| M1   | 待办工作区：列表、行内编辑、智能清单、标签、搜索、拖拽排序         | 三语 UI 完整；1 万条压测达标；勾选/撤销/删除全链路可用                   |
| M2   | 日历工作区：月/周视图、事件 CRUD、拖拽改期、详情抽屉、颜色         | 跨天/全天/重叠事件渲染正确；切月 < 100ms；明暗主题对比度达标             |
| M3   | 提醒与桌面：通知、免打扰、稍后提醒、托盘计数、角标                 | 通知误差 ≤60s；重启不重复；权限拒绝有降级；便携版有说明                  |
| M4   | 联动与打磨：笔记转待办、来源回跳、便签页签、今日磁贴、快速添加     | 每个入口有独立回归用例；旧功能无回归；README/PRD/DEV 同步更新            |

依赖关系：M1 与 M2 可并行（共享 M0）；M3 依赖 M2 的 occurrence 结构；M4 依赖 M1/M2 稳定。

---

## 10. 风险与备选方案

| 风险                         | 说明                                             | 应对                                                             |
| ---------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| `MainWindow` 抽取回归        | 3277 行、状态密集，抽 chrome 容易碰坏拖拽/窗口控制 | 纯移动 + 逐屏对比；先合并再改行为；保留 `WindowChrome` 快照对比    |
| 重复规则边界                 | 月末、闰年、DST 都能出 bug                        | 限定规则子集；前后端共用黄金用例；`guard` 上限                     |
| Windows 便携版通知失效       | 无 AppUserModelID，toast 可能不显示               | 检测 `platform::has_package_identity`，无身份时降级应用内提醒      |
| 数据目录迁移漏搬 `agenda`    | 用户切换目录后以为数据丢了                        | 纳入 `DATA_DIR_ITEMS` + 单测 + 发布前手工验证                      |
| 范围蔓延                     | 日历功能天然无边界                               | P0 锁定「月 + 周 + 不重复」；重复/日视图/ICS 全部后排              |
| 三语 key 漏译                | 发布前集中补翻容易漏                             | key 清单先冻结；CI 校验三份 JSON 的 key 集合一致                   |

### 备选方案对比

**A. 改用 SQLite（`rusqlite`）**

- 优点：查询、索引、事务、部分更新都更强；1 万条以上更从容。
- 缺点：新增原生依赖与编译时间；需要 schema 迁移机制；用户不能再直接用编辑器查看/修复数据；与现有「文件即数据」的备份心智冲突。
- 结论：当前量级不值得，保留为 v2 选项（若引入标签统计、跨年归档再评估）。

**B. 使用 `tauri-plugin-store`**

- 优点：现成 KV、自动落盘。
- 缺点：整文件读写、无 schema、无锁语义，多窗口下仍需自己加锁；与现有 `AppConfig` 读写风格重复。
- 结论：不用，直接复用 `json_io::write_json_atomic`。

**C. 使用 `rrule` crate 支持完整 RFC 5545**

- 优点：规则齐全，未来做 ICS 导入可直接复用。
- 缺点：依赖体积、API 学习成本、我们当前只需要四种频率。
- 结论：P0 自研子集；若 P2 做 ICS 导入，再评估替换。

**D. 日程独立窗口**

- 优点：不动 `MainWindow`，风险最低。
- 缺点：多一个 WebView、窗口管理复杂、与「一个DeskMate」心智不符。
- 结论：仅作为 M0 阶段的临时调试入口（`?view=agenda`），正式版走工作区切换。

---

## 附录 A：命令签名（Rust）

```rust
#[tauri::command]
fn agenda_snapshot(
    state: tauri::State<'_, AgendaState>,
    range_start: DateTime<Utc>,
    range_end: DateTime<Utc>,
) -> Result<AgendaSnapshot, AppError>;

#[tauri::command]
fn agenda_event_create(
    app: tauri::AppHandle,
    state: tauri::State<'_, AgendaState>,
    request: EventInput,
) -> Result<AgendaEvent, AppError>;

#[tauri::command]
fn agenda_todo_create(
    app: tauri::AppHandle,
    state: tauri::State<'_, AgendaState>,
    request: TodoInput,
) -> Result<Todo, AppError>;

#[tauri::command]
fn agenda_todo_toggle(
    app: tauri::AppHandle,
    state: tauri::State<'_, AgendaState>,
    id: String,
    done: bool,
) -> Result<Todo, AppError>;

#[tauri::command]
fn agenda_counts(
    state: tauri::State<'_, AgendaState>,
    today_start: DateTime<Utc>,
    today_end: DateTime<Utc>,
) -> Result<AgendaCounts, AppError>;
```

写操作统一在返回前 `app.emit("agenda-changed", payload)`；读操作不广播。

## 附录 B：i18n key 草案

```
agenda.workspace.notes / calendar / todos
agenda.calendar.today / month / week / prev / next / newEvent
agenda.calendar.allDay / noEvents / moreCount
agenda.event.title / notes / location / start / end / color / reminder
agenda.event.repeat.none / daily / weekly / monthly / yearly
agenda.event.deleteScope.single / all
agenda.todo.smartList.today / tomorrow / thisWeek / overdue / all / done
agenda.todo.priority.none / low / medium / high
agenda.todo.due.today / tomorrow / overdueByDays / noDate
agenda.todo.action.complete / reschedule / addTag / convertToEvent / delete
agenda.todo.completedToast / undo
agenda.quickAdd.placeholder / parsedDate / unrecognizedDate / saveAsTodo / saveAsEvent
agenda.settings.weekStartsOn / defaultReminder / todoReminder / quietHours / quickAddShortcut
agenda.empty.today / empty.calendar / empty.search
errors.agendaNotFound / agendaTitleEmpty / agendaInvalidRange / agendaStoreCorrupt
```

## 附录 C：验收清单（发布前）

- [ ] 新建待办 → 勾选 → 重启 → 状态与完成时间保留
- [ ] 创建跨天事件 → 月视图两段、周视图两段、全天区显示正确
- [ ] 修改系统时区后，事件时刻按新时区渲染，全天事件日期不变
- [ ] 切换数据目录后 `agenda/` 完整迁移，旧目录无残留
- [ ] 删除 `todos.json` 后启动，应用不崩溃、提示备份路径
- [ ] 通知权限拒绝时，功能可继续使用且有明确提示
- [ ] 双窗口同时勾选同一条待办，最终状态一致
- [ ] 三语切换后，日历星期、日期格式、通知文案均正确
- [ ] 旧版笔记的增删改查、导入导出、磁贴、便签零回归
