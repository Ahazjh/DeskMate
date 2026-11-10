import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { showToast } from "../../components/Toast";
import { getErrorMessage } from "../notes/api";
import type { AgendaWidgetKind } from "../windows/windowRoutes";
import {
  agendaSnapshot,
  saveWidgetBounds,
  toggleDailyTask,
  toggleTodo,
} from "./api";
import {
  endOfDayIso,
  formatClock,
  isoDayKey,
  isoTime,
  startOfDayIso,
  todayKey,
} from "./dateUtils";
import { addDaysToKey } from "./dateUtils";
import { courseMatchesWeek, semesterWeek } from "./timetable";
import { DdlPressureStrip } from "./components/DdlPressureStrip";
import { DailyProgressStrip } from "./components/DailyProgressStrip";
import type { AgendaSnapshot, DailyTask } from "./types";

type ViewMode = "timeline" | "table";

const FONT_SCALE_KEY = "deskmate-widget-font-scale";
const FONT_SCALES = [
  { value: 0.9, key: "small" },
  { value: 1, key: "normal" },
  { value: 1.15, key: "large" },
  { value: 1.3, key: "xlarge" },
] as const;

function readFontScale(): number {
  const stored = Number(localStorage.getItem(FONT_SCALE_KEY));
  return FONT_SCALES.some((option) => option.value === stored) ? stored : 1;
}

interface WidgetItem {
  id: string;
  type: "event" | "course" | "todo";
  title: string;
  time: string;
  endTime: string;
  meta: string;
  status: string;
  sortKey: string;
  overdue: boolean;
  done: boolean;
  todoId: string | null;
}

interface AgendaWidgetWindowProps {
  kind?: AgendaWidgetKind;
}

interface WidgetLabels {
  allDay: string;
  typeEvent: string;
  typeCourse: string;
  typeTodo: string;
  high: string;
  medium: string;
  low: string;
  period: (value: number) => string;
}

function priorityLabel(priority: number, labels: WidgetLabels) {
  if (priority >= 3) return labels.high;
  if (priority === 2) return labels.medium;
  if (priority === 1) return labels.low;
  return "";
}

function buildScheduleItems(
  snapshot: AgendaSnapshot,
  today: string,
  locale: string,
  labels: WidgetLabels,
): WidgetItem[] {
  const items: WidgetItem[] = [];
  const dayStart = new Date(startOfDayIso(today)).getTime();
  const dayEnd = new Date(endOfDayIso(today)).getTime();

  for (const event of snapshot.events) {
    const start = new Date(event.startAt).getTime();
    const end = new Date(event.endAt).getTime();
    if (start > dayEnd || end < dayStart) continue;
    const allDay = event.allDay;
    items.push({
      id: `event-${event.id}`,
      type: "event",
      title: event.title,
      time: allDay ? labels.allDay : formatClock(event.startAt, locale),
      endTime: allDay ? "" : formatClock(event.endAt, locale),
      meta: event.notes.trim().split("\n")[0]?.slice(0, 48) ?? "",
      status: labels.typeEvent,
      sortKey: allDay ? "00:00" : isoTime(event.startAt),
      overdue: false,
      done: false,
      todoId: null,
    });
  }

  const weekday = ((new Date(`${today}T00:00:00`).getDay() + 6) % 7) + 1;
  const currentWeek = semesterWeek(snapshot.timetableSettings.semesterStart, today);
  for (const course of snapshot.courses) {
    if (course.weekday !== weekday) continue;
    if (currentWeek !== null && currentWeek > 0 && !courseMatchesWeek(course.weeks, currentWeek)) {
      continue;
    }
    const startPeriod = snapshot.timetableSettings.periodTimes.find(
      (item) => item.period === course.startPeriod,
    );
    const endPeriod = snapshot.timetableSettings.periodTimes.find(
      (item) => item.period === course.endPeriod,
    );
    const meta = [course.location, course.teacher, course.weeks].filter(Boolean).join(" · ");
    items.push({
      id: `course-${course.id}`,
      type: "course",
      title: course.name,
      time: startPeriod?.start ?? labels.period(course.startPeriod),
      endTime: endPeriod?.end ?? "",
      meta,
      status: labels.typeCourse,
      sortKey: startPeriod?.start ?? `50:${String(course.startPeriod).padStart(2, "0")}`,
      overdue: false,
      done: false,
      todoId: null,
    });
  }

  return items.sort((left, right) => left.sortKey.localeCompare(right.sortKey));
}

function buildTodoItems(
  snapshot: AgendaSnapshot,
  today: string,
  labels: WidgetLabels,
): WidgetItem[] {
  const items: WidgetItem[] = [];
  for (const todo of snapshot.todos) {
    const key = todo.dueAt ? isoDayKey(todo.dueAt) : todo.dueDate;
    const completedToday = todo.done && todo.completedAt && isoDayKey(todo.completedAt) === today;
    if (!key && !completedToday) continue;
    if (key && key > today && !completedToday) continue;
    const time = todo.dueAt ? isoTime(todo.dueAt) : "";
    const meta = [...todo.tags.map((tag) => `#${tag}`), todo.platform]
      .filter(Boolean)
      .join(" · ");
    items.push({
      id: `todo-${todo.id}`,
      type: "todo",
      title: todo.title,
      time,
      endTime: "",
      meta,
      status: priorityLabel(todo.priority, labels) || labels.typeTodo,
      sortKey: todo.done ? `99:${time || "99"}` : `${key && key < today ? "00" : "10"}:${time || "99"}`,
      overdue: !todo.done && Boolean(key && key < today),
      done: todo.done,
      todoId: todo.id,
    });
  }
  return items.sort((left, right) => left.sortKey.localeCompare(right.sortKey));
}

export function AgendaWidgetWindow(_props: AgendaWidgetWindowProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "zh-CN";
  const [snapshot, setSnapshot] = useState<AgendaSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const viewKey = "deskmate-widget-view";
  const pinKey = "deskmate-widget-pin";
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    localStorage.getItem(viewKey) === "table" ? "table" : "timeline",
  );
  const [pinned, setPinned] = useState(() => localStorage.getItem(pinKey) !== "false");
  const [fontScale, setFontScale] = useState(readFontScale);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(FONT_SCALE_KEY, String(fontScale));
  }, [fontScale]);

  const reload = useCallback(async () => {
    try {
      setSnapshot(await agendaSnapshot());
      setError(null);
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }, []);

  // Rust 端以 visible(false) 创建窗口；挂载后异步显示，避免在窗口创建
  // 命令里同步调用 show/set_focus 造成 WebView2 与命令线程互锁。
  useEffect(() => {
    void getCurrentWindow().show().catch(() => undefined);
  }, []);

  // 小窗有透明边距，深色模式下会透出 WebView 的白色背景；给根层铺不透明主题色
  useEffect(() => {
    document.documentElement.classList.add("widget-window");
    return () => document.documentElement.classList.remove("widget-window");
  }, []);

  useEffect(() => {
    void reload();
    const unlisten = listen("agenda-changed", () => void reload());
    const timer = globalThis.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      globalThis.clearInterval(timer);
      void unlisten.then((fn) => fn());
    };
  }, [reload]);

  useEffect(() => {
    localStorage.setItem(viewKey, viewMode);
  }, [viewKey, viewMode]);

  useEffect(() => {
    localStorage.setItem(pinKey, String(pinned));
    void getCurrentWindow().setAlwaysOnTop(pinned).catch(() => undefined);
  }, [pinKey, pinned]);

  // 记住用户拖动后的位置与尺寸，下次打开仍在原处。
  useEffect(() => {
    const current = getCurrentWindow();
    const unlisten = current
      .onMoved(({ payload }) => {
        void (async () => {
          try {
            const size = await current.innerSize();
            if (!size || !payload) return;
            await saveWidgetBounds("all", {
              x: payload.x,
              y: payload.y,
              width: size.width,
              height: size.height,
            });
          } catch {
            // 预览环境或权限受限时忽略，不影响小窗使用
          }
        })();
      })
      .catch(() => () => undefined);
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const today = todayKey(now);
  const currentWeek = snapshot
    ? semesterWeek(snapshot.timetableSettings.semesterStart, today)
    : null;
  const upcomingCourse = useMemo(() => {
    if (!snapshot) return null;
    for (let offset = 1; offset <= 7; offset += 1) {
      const key = addDaysToKey(today, offset);
      const weekday = ((new Date(`${key}T00:00:00`).getDay() + 6) % 7) + 1;
      const count = snapshot.courses.filter(
        (course) =>
          course.weekday === weekday &&
          (currentWeek === null || currentWeek <= 0 || courseMatchesWeek(course.weeks, currentWeek)),
      ).length;
      if (count > 0) return { weekday, count, offset };
    }
    return null;
  }, [snapshot, today, currentWeek]);
  const labels = useMemo<WidgetLabels>(
    () => ({
      allDay: t("agenda.widget.allDay", { defaultValue: "全天" }),
      typeEvent: t("agenda.widget.typeEvent", { defaultValue: "日程" }),
      typeCourse: t("agenda.widget.typeCourse", { defaultValue: "课程" }),
      typeTodo: t("agenda.widget.typeTodo", { defaultValue: "待办" }),
      high: t("agenda.widget.priorityHigh", { defaultValue: "高" }),
      medium: t("agenda.widget.priorityMedium", { defaultValue: "中" }),
      low: t("agenda.widget.priorityLow", { defaultValue: "低" }),
      period: (value: number) =>
        t("agenda.widget.period", {
          period: value,
          defaultValue: `第${value}节`,
        }),
    }),
    [t],
  );
  const scheduleItems = useMemo(
    () => (snapshot ? buildScheduleItems(snapshot, today, locale, labels) : []),
    [snapshot, today, locale, labels],
  );
  const todoItems = useMemo(
    () => (snapshot ? buildTodoItems(snapshot, today, labels) : []),
    [snapshot, today, labels],
  );

  // 每日必做进度：只统计启用的模板
  const activeDailyTasks = useMemo(
    () => (snapshot ? snapshot.dailyTasks.filter((task) => task.active) : []),
    [snapshot],
  );
  const dailyDoneIds = useMemo(() => {
    const ids = new Set<string>();
    if (!snapshot) return ids;
    for (const id of snapshot.dailyChecks[today] ?? []) {
      ids.add(id);
    }
    return ids;
  }, [snapshot, today]);

  const title = t("agenda.widget.combinedTitle", { defaultValue: "今日一览" });

  const handleToggle = async (item: WidgetItem) => {
    if (!item.todoId) return;
    try {
      await toggleTodo(item.todoId, !item.done);
      await reload();
    } catch (cause) {
      showToast(getErrorMessage(cause));
    }
  };

  const handleToggleDaily = async (task: DailyTask, done: boolean) => {
    try {
      await toggleDailyTask(task.id, today, done);
      await reload();
    } catch (cause) {
      showToast(getErrorMessage(cause));
    }
  };

  return (
    // 外层是透明的边距区：窗口本体是 transparent 窗口，这里留出 padding
    // 让圆角外的四角透出桌面。边距不接收鼠标事件，点击可穿透到桌面。
    <div className="h-screen w-screen p-1.5 bg-transparent select-none widget-hit-area">
      <div className="app-surface-frame relative h-full flex flex-col bg-cloud border border-paper-deep/60 shadow-[0_14px_36px_rgba(0,0,0,0.22)] overflow-hidden">
        <div
          data-tauri-drag-region="true"
          className="h-9 px-2.5 flex items-center justify-between border-b border-paper-deep/30 shrink-0 cursor-default gap-2"
        >
          <div className="min-w-0 flex items-center gap-1.5">
            <span className="text-[12.5px] font-body font-medium text-ink-soft truncate" title={title}>
              {title}
            </span>
            <span className="text-[10.5px] font-mono text-ink-ghost shrink-0">{today.slice(5)}</span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              title={t("agenda.widget.timeline", { defaultValue: "时间轴" })}
              className={`h-6 px-1.5 rounded text-[10.5px] font-body cursor-pointer ${
                viewMode === "timeline" ? "bg-bamboo-mist/70 text-bamboo" : "text-ink-ghost hover:bg-paper-warm"
              }`}
            >
              {t("agenda.widget.timelineShort", { defaultValue: "轴" })}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title={t("agenda.widget.table", { defaultValue: "表格" })}
              className={`h-6 px-1.5 rounded text-[10.5px] font-body cursor-pointer ${
                viewMode === "table" ? "bg-bamboo-mist/70 text-bamboo" : "text-ink-ghost hover:bg-paper-warm"
              }`}
            >
              {t("agenda.widget.tableShort", { defaultValue: "表" })}
            </button>
            <button
              type="button"
              onClick={() => setFontMenuOpen((value) => !value)}
              title={t("agenda.widget.fontSize.title", { defaultValue: "字体大小" })}
              className={`h-6 px-1.5 rounded text-[10.5px] font-mono cursor-pointer ${
                fontMenuOpen ? "bg-bamboo-mist/70 text-bamboo" : "text-ink-ghost hover:bg-paper-warm"
              }`}
            >
              Aa
            </button>
            <button
              type="button"
              onClick={() => setPinned((value) => !value)}
              title={t("agenda.widget.pin", { defaultValue: "置顶" })}
              className={`w-6 h-6 flex items-center justify-center rounded cursor-pointer ${
                pinned ? "text-bamboo" : "text-ink-ghost hover:bg-paper-warm"
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => void reload()}
              title={t("agenda.widget.refresh", { defaultValue: "刷新" })}
              className="w-6 h-6 flex items-center justify-center rounded text-ink-ghost hover:text-ink-soft hover:bg-paper-warm cursor-pointer"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => void getCurrentWindow().hide().catch(() => undefined)}
              title={t("common.close", { defaultValue: "关闭" })}
              className="w-6 h-6 flex items-center justify-center rounded text-ink-ghost hover:text-ink-soft hover:bg-paper-warm cursor-pointer"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {fontMenuOpen ? (
          <>
            <div
              className="absolute inset-0 z-40"
              onClick={() => setFontMenuOpen(false)}
            />
            <div className="absolute top-9 right-2 z-50 w-28 p-1 rounded-lg border border-paper-deep/50 bg-cloud shadow-[0_10px_28px_rgba(0,0,0,0.22)]">
              <div className="px-2 py-1 text-[9.5px] font-body text-ink-ghost">
                {t("agenda.widget.fontSize.title", { defaultValue: "字体大小" })}
              </div>
              {FONT_SCALES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setFontScale(option.value);
                    setFontMenuOpen(false);
                  }}
                  className={`w-full h-7 px-2 rounded-md text-left text-[11px] font-body cursor-pointer ${
                    fontScale === option.value
                      ? "bg-bamboo-mist/70 text-bamboo"
                      : "text-ink-faint hover:bg-paper-warm"
                  }`}
                >
                  {t(`agenda.widget.fontSize.${option.key}`, {
                    defaultValue: { small: "小", normal: "标准", large: "大", xlarge: "特大" }[option.key],
                  })}
                </button>
              ))}
            </div>
          </>
        ) : null}

        <div className="flex-1 min-h-0 flex flex-col" style={{ zoom: fontScale }}>
        {error ? (
            <div className="px-3 py-2 text-[11.5px] font-body text-red-400 border-b border-red-200/40">
              {error}
            </div>
          ) : null}

          <div className="flex-1 min-h-0 flex flex-col">
            <section className="flex-1 min-h-0 flex flex-col border-b border-paper-deep/25">
              <div className="h-6 px-2.5 flex items-center justify-between shrink-0 bg-paper/30">
                <span className="text-[11px] font-body text-ink-faint">
                  {t("agenda.widget.tabSchedule", { defaultValue: "日程" })}
                </span>
                <span className="text-[10px] font-mono text-ink-ghost">{scheduleItems.length}</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
            {!snapshot ? (
              <div className="h-full flex items-center justify-center text-[12.5px] font-body text-ink-ghost">
                {t("common.loading", { defaultValue: "加载中…" })}
              </div>
            ) : scheduleItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
                <div className="w-10 h-10 rounded-full border border-dashed border-paper-deep flex items-center justify-center text-ink-ghost">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M8 3v4M16 3v4M3 10h18" />
                  </svg>
                </div>
                <div className="text-[13.5px] font-body font-medium text-ink-soft">
                  {t("agenda.widget.emptySchedule", { defaultValue: "今天没有安排" })}
                </div>
                <div className="text-[11.5px] font-body text-ink-ghost leading-relaxed max-w-[240px]">
                  {t("agenda.widget.emptyScheduleHint", {
                    defaultValue: "今天的日程和课程会自动出现在这里；也可以在主窗口添加。",
                  })}

                </div>
                <button
                  type="button"
                  onClick={() => void reload()}
                  className="mt-1 h-6 px-2.5 rounded-md border border-paper-deep/60 text-[11.5px] font-body text-ink-faint hover:text-bamboo hover:border-bamboo/40 cursor-pointer"
                >
                  {t("agenda.widget.refresh", { defaultValue: "刷新" })}
                </button>
              </div>
            ) : viewMode === "timeline" ? (
              <div className="px-3 py-2.5">
                {scheduleItems.map((item, index) => (
                  <div key={item.id} className="flex gap-2.5">
                    <div className="w-[42px] shrink-0 pt-1 text-right">
                      <div className={`text-[11.5px] font-mono tabular-nums ${item.overdue ? "text-red-400" : "text-ink-faint"}`}>
                        {item.time || "--:--"}
                      </div>
                      {item.endTime ? (
                        <div className="text-[10.5px] font-mono text-ink-ghost">{item.endTime}</div>
                      ) : null}
                    </div>
                    <div className="relative w-3 shrink-0 flex justify-center">
                      <div className="absolute top-0 bottom-0 w-px bg-paper-deep/60" />
                      <div
                        className={`relative mt-1.5 w-2 h-2 rounded-full border ${
                          item.done
                            ? "bg-bamboo border-bamboo"
                            : item.type === "course"
                              ? "bg-cloud border-bamboo"
                              : "bg-cloud border-ink-ghost"
                        }`}
                      />
                      {index === scheduleItems.length - 1 ? (
                        <div className="absolute top-3 bottom-0 w-px bg-cloud" />
                      ) : null}
                    </div>
                    <div
                      className={`flex-1 min-w-0 mb-1.5 px-2 py-1.5 rounded-lg border ${
                        item.overdue ? "border-red-300/60 bg-red-50/40" : "border-paper-deep/40 bg-paper/40"
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        {item.todoId ? (
                          <button
                            type="button"
                            onClick={() => void handleToggle(item)}
                            aria-label={item.done ? "undo" : "done"}
                            className={`mt-0.5 w-3 h-3 shrink-0 rounded border flex items-center justify-center cursor-pointer ${
                              item.done ? "bg-bamboo border-bamboo" : "border-paper-deep bg-cloud/60"
                            }`}
                          >
                            {item.done ? (
                              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : null}
                          </button>
                        ) : null}
                        <span
                          className={`min-w-0 flex-1 text-[12.5px] font-body truncate ${
                            item.done ? "text-ink-ghost line-through" : "text-ink-soft"
                          }`}
                        >
                          {item.title}
                        </span>
                        <span
                          className={`shrink-0 px-1 rounded-sm text-[9.5px] font-body ${
                            item.overdue
                              ? "bg-red-100 text-red-500"
                              : item.type === "course"
                                ? "bg-bamboo-mist text-bamboo"
                                : "bg-paper-warm text-ink-faint"
                          }`}
                        >
                          {item.overdue
                            ? t("agenda.widget.overdue", { defaultValue: "逾期" })
                            : item.status}
                        </span>
                      </div>
                      {item.meta ? (
                        <div className="mt-0.5 text-[10.5px] font-body text-ink-ghost truncate pl-4">
                          {item.meta}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-cloud">
                  <tr className="border-b border-paper-deep/40 text-[10.5px] font-body text-ink-ghost">
                    <th className="w-[62px] px-2 py-1.5 font-normal">{t("agenda.widget.colTime", { defaultValue: "时间" })}</th>
                    <th className="px-2 py-1.5 font-normal">{t("agenda.widget.colTitle", { defaultValue: "事项" })}</th>
                    <th className="w-[86px] px-2 py-1.5 font-normal">{t("agenda.widget.colInfo", { defaultValue: "信息" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleItems.map((item) => (
                    <tr key={item.id} className="border-b border-paper-deep/25 hover:bg-paper-warm/40">
                      <td className={`px-2 py-1.5 align-top text-[11px] font-mono tabular-nums ${item.overdue ? "text-red-400" : "text-ink-faint"}`}>
                        {item.time || "--:--"}
                        {item.endTime ? <div className="text-[9.5px] text-ink-ghost">{item.endTime}</div> : null}
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <div className={`text-[12px] font-body truncate max-w-[150px] ${item.done ? "text-ink-ghost line-through" : "text-ink-soft"}`}>
                          {item.title}
                        </div>
                        {item.meta ? (
                          <div className="text-[10.5px] font-body text-ink-ghost truncate max-w-[150px]">{item.meta}</div>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <span className={`inline-block px-1 rounded-sm text-[10px] font-body ${
                          item.overdue
                            ? "bg-red-100 text-red-500"
                            : item.type === "course"
                              ? "bg-bamboo-mist text-bamboo"
                              : "bg-paper-warm text-ink-faint"
                        }`}>
                          {item.overdue
                            ? t("agenda.widget.overdue", { defaultValue: "逾期" })
                            : item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

            </section>

            <section className="flex-1 min-h-0 flex flex-col">
              <div className="h-6 px-2.5 flex items-center justify-between shrink-0 bg-paper/30">
                <span className="text-[11px] font-body text-ink-faint">
                  {t("agenda.widget.tabTodos", { defaultValue: "待办" })}
                </span>
                <span className="text-[10px] font-mono text-ink-ghost">{todoItems.length}</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-1.5 space-y-1">
                {todoItems.length === 0 ? (
                  <div className="py-3 text-center text-[11.5px] font-body text-ink-ghost">
                    {t("agenda.widget.emptyTodos", { defaultValue: "今天没有待办" })}
                  </div>
                ) : (
                  todoItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleToggle(item)}
                        aria-label={item.done ? "undo" : "done"}
                        className={`w-3 h-3 shrink-0 rounded border flex items-center justify-center cursor-pointer ${
                          item.done ? "bg-bamboo border-bamboo" : "border-paper-deep bg-cloud/60"
                        }`}
                      >
                        {item.done ? (
                          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : null}
                      </button>
                      <span
                        className={`flex-1 min-w-0 text-[12px] font-body truncate ${
                          item.done ? "text-ink-ghost line-through" : "text-ink-soft"
                        }`}
                      >
                        {item.title}
                      </span>
                      <span className="shrink-0 text-[10px] font-mono text-ink-ghost">
                        {item.time || "--:--"}
                      </span>
                    </div>
                  ))
                )}
              </div>
              {snapshot ? (
                <>
                  <DailyProgressStrip
                    tasks={activeDailyTasks}
                    doneIds={dailyDoneIds}
                    onToggle={(task, done) => void handleToggleDaily(task, done)}
                  />
                  <div className="px-2 pb-1 shrink-0">
                    <DdlPressureStrip todos={snapshot.todos} today={today} locale={locale} compact />
                  </div>
                </>
              ) : null}
            </section>
          </div>

          <div className="h-7 px-2.5 flex items-center justify-between border-t border-paper-deep/30 shrink-0 text-[10.5px] font-body text-ink-ghost">
            <span className="truncate">
              {t("agenda.widget.tabSchedule", { defaultValue: "日程" })}
              {t("agenda.widget.count", { count: scheduleItems.length, defaultValue: "{{count}} 项" })}
              {" · "}
              {t("agenda.widget.tabTodos", { defaultValue: "待办" })}
              {t("agenda.widget.count", { count: todoItems.length, defaultValue: "{{count}} 项" })}
              {upcomingCourse ? (
                <span className="ml-1 text-bamboo">
                  ·{" "}
                  {t("agenda.widget.upcomingCourses", {
                    day:
                      upcomingCourse.offset === 1
                        ? t("agenda.widget.tomorrow", { defaultValue: "明天" })
                        : t(`agenda.weekday.${upcomingCourse.weekday}`, {
                            defaultValue: `周${"一二三四五六日"[upcomingCourse.weekday - 1]}`,
                          }),
                    count: upcomingCourse.count,
                    defaultValue: "{{day}}有 {{count}} 节课",
                  })}
                </span>
              ) : null}
            </span>
            <span>
              {t("agenda.widget.updated", {
                time: formatClock(now.toISOString(), locale),
                defaultValue: "更新于 {{time}}",
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
