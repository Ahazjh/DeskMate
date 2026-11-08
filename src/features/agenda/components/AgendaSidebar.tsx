import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { AgendaEvent, AgendaMode, Course, DailyTask, SmartList, Todo } from "../types";
import { allTags, countTodos, SMART_LISTS } from "../todoFilters";
import { todayKey } from "../dateUtils";
import { MiniMonth } from "./MiniMonth";

interface AgendaSidebarProps {
  mode: AgendaMode;
  cursor: Date;
  selectedDay: string;
  events: AgendaEvent[];
  todos: Todo[];
  courses: Course[];
  dailyTasks: DailyTask[];
  dailyChecks: Record<string, string[]>;
  currentWeek: number | null;
  activeList: SmartList;
  activeTag: string | null;
  locale: string;
  onModeChange: (mode: AgendaMode) => void;
  onSelectDay: (key: string) => void;
  onCursorChange: (next: Date) => void;
  onSelectList: (list: SmartList) => void;
  onSelectTag: (tag: string | null) => void;
}

export function AgendaSidebar({
  mode,
  cursor,
  selectedDay,
  events,
  todos,
  courses,
  dailyTasks,
  dailyChecks,
  currentWeek,
  activeList,
  activeTag,
  locale,
  onModeChange,
  onSelectDay,
  onCursorChange,
  onSelectList,
  onSelectTag,
}: AgendaSidebarProps) {
  const { t } = useTranslation();
  const counts = useMemo(() => countTodos(todos), [todos]);
  const tags = useMemo(() => allTags(todos), [todos]);
  const weeklyPeriods = useMemo(
    () =>
      courses.reduce(
        (total, course) => total + Math.max(1, course.endPeriod - course.startPeriod + 1),
        0,
      ),
    [courses],
  );
  const today = todayKey();
  const activeDaily = dailyTasks.filter((task) => task.active);
  const dailyDone = activeDaily.filter((task) =>
    (dailyChecks[today] ?? []).includes(task.id),
  ).length;

  const listLabel = (list: SmartList) =>
    t(`agenda.smart.${list}`, {
      defaultValue: {
        today: "今天",
        tomorrow: "明天",
        week: "本周",
        overdue: "逾期",
        all: "全部",
        done: "已完成",
      }[list],
    });

  return (
    <aside className="w-[240px] shrink-0 flex flex-col border-r border-paper-deep/30 bg-paper/40 min-h-0">
      <div className="px-3 pt-3 shrink-0">
        <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-paper-warm/70 p-0.5">
          {[
            {
              value: "calendar" as AgendaMode,
              label: t("agenda.nav.calendar", { defaultValue: "日程" }),
            },
            {
              value: "courses" as AgendaMode,
              label: t("agenda.nav.courses", { defaultValue: "课程表" }),
            },
            {
              value: "todos" as AgendaMode,
              label: t("agenda.nav.todos", { defaultValue: "待办" }),
            },
            {
              value: "daily" as AgendaMode,
              label: t("agenda.nav.daily", { defaultValue: "每日必做" }),
            },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onModeChange(option.value)}
              className={`h-7 rounded-md text-[11px] font-body transition-all cursor-pointer ${
                mode === option.value
                  ? "bg-cloud text-bamboo shadow-[0_1px_2px_rgba(26,26,24,0.06)]"
                  : "text-ink-ghost hover:text-ink-soft"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <MiniMonth
        cursor={cursor}
        selectedDay={selectedDay}
        events={events}
        locale={locale}
        onSelectDay={onSelectDay}
        onCursorChange={onCursorChange}
      />

      <div className="h-px bg-paper-deep/40 mx-3 shrink-0" />

      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        {mode === "courses" ? (
          <>
            <div className="px-2 pb-1 text-[10px] font-mono tracking-wider uppercase text-ink-ghost/60">
              {t("agenda.course.overview", { defaultValue: "课程概览" })}
            </div>
            <div className="mx-1 rounded-lg bg-paper-warm/50 p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-body">
                <span className="text-ink-ghost">
                  {t("agenda.course.total", { defaultValue: "本学期" })}
                </span>
                <span className="font-mono text-ink-soft">
                  {courses.length} {t("agenda.course.countUnit", { defaultValue: "门" })}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-body">
                <span className="text-ink-ghost">
                  {t("agenda.course.perWeek", { defaultValue: "每周" })}
                </span>
                <span className="font-mono text-ink-soft">
                  {weeklyPeriods} {t("agenda.course.periodUnit", { defaultValue: "节" })}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-body">
                <span className="text-ink-ghost">
                  {t("agenda.course.currentWeek", { defaultValue: "当前" })}
                </span>
                <span className="font-mono text-bamboo">
                  {currentWeek === null
                    ? t("agenda.course.weekUnset", { defaultValue: "未设学期" })
                    : currentWeek > 0
                      ? t("agenda.timetable.weekShort", {
                          week: currentWeek,
                          defaultValue: "第 {{week}} 周",
                        })
                      : t("agenda.timetable.notStartedShort", { defaultValue: "未开学" })}
                </span>
              </div>
            </div>
            <p className="px-2 pt-2 text-[9.5px] font-body text-ink-ghost leading-relaxed">
              {t("agenda.course.sidebarHint", {
                defaultValue: "点网格空白处添加课程，也可以从表格或图片导入。",
              })}
            </p>
          </>
        ) : mode === "daily" ? (
          <>
            <div className="px-2 pb-1 text-[10px] font-mono tracking-wider uppercase text-ink-ghost/60">
              {t("agenda.daily.progressTitle", { defaultValue: "今日进度" })}
            </div>
            <div className="mx-1 rounded-lg bg-paper-warm/50 p-3">
              <div className="flex items-end justify-between">
                <span className="text-[24px] font-mono tabular-nums text-bamboo leading-none">
                  {dailyDone}
                </span>
                <span className="text-[11px] font-mono text-ink-ghost">/ {activeDaily.length}</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-paper-deep/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-bamboo transition-[width] duration-300"
                  style={{
                    width: `${
                      activeDaily.length > 0
                        ? Math.round((dailyDone / activeDaily.length) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <p className="px-2 pt-2 text-[9.5px] font-body text-ink-ghost leading-relaxed">
              {t("agenda.daily.sidebarHint", {
                defaultValue: "每天 0 点重新开始，近 7 天记录在右侧。",
              })}
            </p>
          </>
        ) : (
          <>
            <div className="px-2 pb-1 text-[10px] font-mono tracking-wider uppercase text-ink-ghost/60">
              {t("agenda.smartListTitle", { defaultValue: "待办清单" })}
            </div>
            <div className="space-y-0.5">
              {SMART_LISTS.map((list) => {
                const active = mode === "todos" && activeList === list;
                const count = counts[list];
                return (
                  <button
                    key={list}
                    type="button"
                    onClick={() => onSelectList(list)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] font-body transition-colors cursor-pointer ${
                      active
                        ? "bg-bamboo-mist/70 text-bamboo"
                        : "text-ink-soft hover:bg-paper-warm/80"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          list === "overdue" && count > 0 ? "bg-red-400" : "bg-ink-ghost/40"
                        }`}
                      />
                      {listLabel(list)}
                    </span>
                    {count > 0 ? (
                      <span
                        className={`text-[10px] font-mono tabular-nums ${
                          list === "overdue" ? "text-red-400" : "text-ink-ghost"
                        }`}
                      >
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {tags.length > 0 ? (
              <>
                <div className="px-2 pt-3 pb-1 text-[10px] font-mono tracking-wider uppercase text-ink-ghost/60">
                  {t("agenda.tags", { defaultValue: "标签" })}
                </div>
                <div className="flex flex-wrap gap-1 px-1.5">
                  {tags.map((tag) => {
                    const active = activeTag === tag;
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          onSelectTag(active ? null : tag);
                          onModeChange("todos");
                        }}
                        className={`px-2 h-6 rounded-full text-[10px] font-body transition-colors cursor-pointer ${
                          active
                            ? "bg-bamboo text-cloud"
                            : "bg-paper-warm text-ink-faint hover:text-ink-soft"
                        }`}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                  {activeTag ? (
                    <button
                      type="button"
                      onClick={() => onSelectTag(null)}
                      className="px-2 h-6 rounded-full text-[10px] font-body text-ink-ghost hover:text-ink-soft cursor-pointer"
                    >
                      {t("common.clear", { defaultValue: "清除" })}
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}
