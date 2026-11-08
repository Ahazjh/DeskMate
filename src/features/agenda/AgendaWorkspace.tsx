import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "../../components/Toast";
import {
  createCategory,
  createNote,
  getErrorMessage,
  listCategories,
  listNotes,
  updateNote,
} from "../notes/api";
import { openNoteInEditor } from "../windows/api";
import {
  addDays,
  addDaysToKey,
  addMonths,
  dayKey,
  formatDayHeading,
  formatMonthTitle,
  parseDayKey,
  startOfWeek,
  todayKey,
} from "./dateUtils";
import { filterTodos } from "./todoFilters";
import { eventStartKey } from "./eventUtils";
import { courseMatchesWeek, semesterWeek } from "./timetable";
import { generateDailyReview, onReminder, openAgendaWidget } from "./api";
import { useAgenda } from "./useAgenda";
import type {
  AgendaEvent,
  AgendaMode,
  CalendarView,
  Course,
  CourseInput,
  CourseOverrideInput,
  DailyTask,
  DailyTaskInput,
  ReminderItem,
  SmartList,
  Todo,
  TodoInput,
  EventInput,
} from "./types";
import { AgendaSidebar } from "./components/AgendaSidebar";
import { MonthGrid } from "./components/MonthGrid";
import { WeekGrid } from "./components/WeekGrid";
import { TodoListView } from "./components/TodoListView";
import { TodoDrawer } from "./components/TodoDrawer";
import { EventDrawer } from "./components/EventDrawer";
import { CourseGrid } from "./components/CourseGrid";
import { CourseDrawer } from "./components/CourseDrawer";
import { CourseImportDialog } from "./components/CourseImportDialog";
import { DailyView } from "./components/DailyView";
import { DailyDrawer } from "./components/DailyDrawer";
import { TimetableSettingsDialog } from "./components/TimetableSettingsDialog";
import { ReminderBanner } from "./components/ReminderBanner";
import { ReminderSettingsDialog } from "./components/ReminderSettingsDialog";
import { PlanDialog } from "./components/PlanDialog";
import { DdlPressureStrip } from "./components/DdlPressureStrip";
import { SemesterProgressBar } from "./components/SemesterProgressBar";
import { TimetablePrintView } from "./components/TimetablePrintView";
import { CourseOverrideDialog } from "./components/CourseOverrideDialog";
import { buildWeeklyReview } from "./weeklyReview";
import { buildSharedFreeGrid } from "./sharedSlots";
import { PartnerDialog } from "./components/PartnerDialog";
import type { PlanBlock } from "./schedulePlanner";

type TodoDrawerState = { todo: Todo | null } | null;
type EventDrawerState = { event: AgendaEvent | null; day: string; minutes?: number } | null;
type CourseDrawerState = { course: Course | null; weekday: number; period: number } | null;
type DailyDrawerState = { task: DailyTask | null } | null;

interface AgendaWorkspaceProps {
  initialMode?: AgendaMode;
  initialCalendarView?: CalendarView;
}

export function AgendaWorkspace({
  initialMode = "todos",
  initialCalendarView = "month",
}: AgendaWorkspaceProps = {}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "zh-CN";

  const {
    snapshot,
    loading,
    error,
    reload,
    addTodo,
    editTodo,
    toggle,
    removeTodo,
    addEvent,
    editEvent,
    removeEvent,
    addCourse,
    editCourse,
    removeCourse,
    importCourseRows,
    addCourseOverride,
    removeCourseOverride,
    savePartner,
    clearAllCourses,
    clearPartnerCourseRows,
    importPartnerCourseRows,
    removePartnerCourse,
    addDailyTask,
    editDailyTask,
    removeDailyTask,
    toggleDaily,
    saveTimetable,
  } = useAgenda();

  const [mode, setMode] = useState<AgendaMode>(initialMode);
  const [calendarView, setCalendarView] = useState<CalendarView>(initialCalendarView);
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => todayKey());
  const [activeList, setActiveList] = useState<SmartList>("today");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [todoDrawer, setTodoDrawer] = useState<TodoDrawerState>(null);
  const [eventDrawer, setEventDrawer] = useState<EventDrawerState>(null);
  const [courseDrawer, setCourseDrawer] = useState<CourseDrawerState>(null);
  const [dailyDrawer, setDailyDrawer] = useState<DailyDrawerState>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [timetableSettingsOpen, setTimetableSettingsOpen] = useState(false);
  const [reminderSettingsOpen, setReminderSettingsOpen] = useState(false);
  const [reminder, setReminder] = useState<ReminderItem | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [overrideCourse, setOverrideCourse] = useState<Course | null>(null);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [partnerVisible, setPartnerVisible] = useState(
    () => localStorage.getItem("deskmate-partner-visible") !== "false",
  );
  const [weeklyBusy, setWeeklyBusy] = useState(false);
  const [onlyCurrentWeek, setOnlyCurrentWeek] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const unlisten = onReminder((item) => setReminder(item));
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const handleOpenReminder = (item: ReminderItem) => {
    setReminder(null);
    if (item.kind === "todo") {
      const todo = snapshot.todos.find((entry) => entry.id === item.id);
      if (todo) {
        setMode("todos");
        setTodoDrawer({ todo });
        return;
      }
    } else {
      const event = snapshot.events.find((entry) => entry.id === item.id);
      if (event) {
        setMode("calendar");
        setEventDrawer({ event, day: eventStartKey(event) });
        return;
      }
    }
    showToast(t("agenda.reminder.openFailed", { defaultValue: "找不到对应事项" }));
  };

  const handleGenerateReview = async () => {
    setReviewing(true);
    try {
      await generateDailyReview(todayKey(now));
      showToast(
        t("agenda.review.generated", { defaultValue: "回顾笔记已生成" }),
        "info",
      );
    } catch (cause) {
      showToast(getErrorMessage(cause));
    } finally {
      setReviewing(false);
    }
  };

  const handleOpenWidget = async () => {
    try {
      await openAgendaWidget();
    } catch (cause) {
      showToast(getErrorMessage(cause));
    }
  };

  const handleGeneratePlan = async (blocks: PlanBlock[]) => {
    const existing = new Set(
      snapshot.events.map((event) => `${event.title}|${event.startAt}`),
    );
    let created = 0;
    for (const block of blocks) {
      const title = `[计划] ${block.title}`;
      if (existing.has(`${title}|${block.startAt}`)) continue;
      await addEvent({
        title,
        notes: `由智能排期生成 · 预估 ${block.minutes} 分钟`,
        startAt: block.startAt,
        endAt: block.endAt,
      });
      created += 1;
    }
    if (created === 0) {
      showToast(
        t("agenda.plan.none", { defaultValue: "这些计划已经在日程里了" }),
        "info",
      );
    }
  };

  const handleCreateCourseNote = async (course: Course) => {
    try {
      const week = semesterWeek(snapshot.timetableSettings.semesterStart, today);
      const title =
        week !== null && week > 0
          ? `第 ${week} 周 · ${course.name}`
          : `${course.name} · ${today}`;
      const categories = await listCategories();
      if (!categories.includes(course.name)) {
        await createCategory(course.name);
      }
      const meta = [
        `- 日期：${today}`,
        course.location ? `- 地点：${course.location}` : null,
        course.teacher ? `- 教师：${course.teacher}` : null,
        course.weeks ? `- 周次：${course.weeks}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      const note = await createNote({
        title,
        content: `# ${title}\n\n${meta}\n\n## 课堂笔记\n\n`,
        category: course.name,
      });
      showToast(
        t("agenda.note.created", { name: course.name, defaultValue: "已归档到「{{name}}」分类" }),
        "info",
      );
      await openNoteInEditor(note.id);
    } catch (cause) {
      showToast(getErrorMessage(cause));
    }
  };

  const handleGenerateWeeklyReview = async () => {
    if (weeklyBusy) return;
    setWeeklyBusy(true);
    try {
      const review = buildWeeklyReview(snapshot, today);
      const existing = (await listNotes()).find((note) => note.title === review.title);
      if (existing) {
        await updateNote(existing.id, review);
      } else {
        await createNote(review);
      }
      showToast(
        t("agenda.review.weeklyGenerated", { defaultValue: "本周回顾已生成" }),
        "info",
      );
    } catch (cause) {
      showToast(getErrorMessage(cause));
    } finally {
      setWeeklyBusy(false);
    }
  };

  const handleSaveOverride = async (input: CourseOverrideInput) => {
    await addCourseOverride(input);
  };

  const hasPartner = snapshot.partnerCourses.length > 0;
  const showPartnerCourses = hasPartner && partnerVisible;

  const togglePartnerVisible = () => {
    setPartnerVisible((previous) => {
      const next = !previous;
      localStorage.setItem("deskmate-partner-visible", String(next));
      return next;
    });
  };

  const handleClearCourses = async () => {
    if (
      !window.confirm(
        t("agenda.course.clearConfirm", {
          defaultValue: "确定清空本学期全部课程？此操作不可撤销，调课例外也会一起清除。",
        }),
      )
    ) {
      return;
    }
    try {
      const removed = await clearAllCourses();
      showToast(
        t("agenda.course.cleared", {
          count: removed,
          defaultValue: "已清空 {{count}} 门课程",
        }),
        "info",
      );
    } catch (cause) {
      showToast(getErrorMessage(cause));
    }
  };

  const handleClearPartnerCourses = async () => {
    if (
      !window.confirm(
        t("agenda.partner.clearConfirm", {
          defaultValue: "确定清空对方全部课程？昵称与关系会保留。",
        }),
      )
    ) {
      return;
    }
    try {
      const removed = await clearPartnerCourseRows();
      showToast(
        t("agenda.partner.cleared", {
          count: removed,
          defaultValue: "已清空 {{count}} 门对方课程",
        }),
        "info",
      );
    } catch (cause) {
      showToast(getErrorMessage(cause));
    }
  };

  const weekStartKey = useMemo(() => dayKey(startOfWeek(parseDayKey(selectedDay))), [selectedDay]);
  const selectedWeekday = useMemo(
    () => ((parseDayKey(selectedDay).getDay() + 6) % 7) + 1,
    [selectedDay],
  );

  const visibleTodos = useMemo(() => {
    const base = filterTodos(snapshot.todos, activeList, now, activeTag);
    const query = search.trim().toLowerCase();
    if (!query) return base;
    return base.filter((todo) =>
      [todo.title, todo.notes, ...todo.tags].join(" ").toLowerCase().includes(query),
    );
  }, [snapshot.todos, activeList, activeTag, search, now]);

  const activeDailyTasks = useMemo(
    () => snapshot.dailyTasks.filter((task) => task.active),
    [snapshot.dailyTasks],
  );
  const today = todayKey(now);
  const dailyDone = activeDailyTasks.filter((task) =>
    (snapshot.dailyChecks[today] ?? []).includes(task.id),
  ).length;

  const currentWeek = semesterWeek(snapshot.timetableSettings.semesterStart, today);
  const visibleCourses = useMemo(() => {
    if (!onlyCurrentWeek || currentWeek === null || currentWeek <= 0) {
      return snapshot.courses;
    }
    return snapshot.courses.filter((course) => courseMatchesWeek(course.weeks, currentWeek));
  }, [snapshot.courses, onlyCurrentWeek, currentWeek]);

  const sharedFree = useMemo(
    () =>
      buildSharedFreeGrid(snapshot.courses, snapshot.partnerCourses, currentWeek),
    [snapshot.courses, snapshot.partnerCourses, currentWeek],
  );

  const pendingByCourse = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const todo of snapshot.todos) {
      if (!todo.done && todo.courseId) {
        counts[todo.courseId] = (counts[todo.courseId] ?? 0) + 1;
      }
    }
    return counts;
  }, [snapshot.todos]);

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

  const defaultDueDateForList =
    activeList === "today" || activeList === "week"
      ? todayKey()
      : activeList === "tomorrow"
        ? addDaysToKey(todayKey(), 1)
        : null;

  const shiftCalendar = (direction: -1 | 1) => {
    setCursor((previous) =>
      calendarView === "month" ? addMonths(previous, direction) : addDays(previous, direction * 7),
    );
  };

  const goToday = () => {
    const now = new Date();
    setCursor(now);
    setSelectedDay(dayKey(now));
  };

  const handleSelectDayFromMini = (key: string) => {
    setSelectedDay(key);
    setCursor(parseDayKey(key));
    setMode("calendar");
  };

  const handleSelectDayInCalendar = (key: string) => {
    setSelectedDay(key);
    setCursor(parseDayKey(key));
  };

  const handleToggle = (todo: Todo) => {
    void toggle(todo).catch((cause) => showToast(getErrorMessage(cause)));
  };

  const handleDeleteTodo = (todo: Todo) => {
    if (
      !window.confirm(t("agenda.confirmDelete", { defaultValue: "确定删除？此操作不可撤销。" }))
    ) {
      return;
    }
    void removeTodo(todo.id)
      .then(() => {
        setTodoDrawer(null);
        showToast(t("agenda.toast.deleted", { defaultValue: "已删除" }));
      })
      .catch((cause) => showToast(getErrorMessage(cause)));
  };

  const handleDeleteEvent = (event: AgendaEvent) => {
    if (
      !window.confirm(t("agenda.confirmDelete", { defaultValue: "确定删除？此操作不可撤销。" }))
    ) {
      return;
    }
    void removeEvent(event.id)
      .then(() => {
        setEventDrawer(null);
        showToast(t("agenda.toast.deleted", { defaultValue: "已删除" }));
      })
      .catch((cause) => showToast(getErrorMessage(cause)));
  };

  const handleTodoSave = async (input: TodoInput) => {
    if (todoDrawer?.todo) {
      await editTodo(todoDrawer.todo.id, input);
    } else {
      await addTodo(input);
    }
    showToast(t("agenda.toast.saved", { defaultValue: "已保存" }));
  };

  const handleEventSave = async (input: EventInput) => {
    if (eventDrawer?.event) {
      await editEvent(eventDrawer.event.id, input);
    } else {
      await addEvent(input);
    }
    showToast(t("agenda.toast.saved", { defaultValue: "已保存" }));
  };

  const handleQuickCreate = async (title: string, dueDate: string | null) => {
    await addTodo({ title, dueDate, priority: 0, tags: [] });
  };

  const handleCourseSave = async (input: CourseInput) => {
    if (courseDrawer?.course) {
      await editCourse(courseDrawer.course.id, input);
    } else {
      await addCourse(input);
    }
    showToast(t("agenda.toast.saved", { defaultValue: "已保存" }));
  };

  const handleDeleteCourse = (course: Course) => {
    if (
      !window.confirm(t("agenda.confirmDelete", { defaultValue: "确定删除？此操作不可撤销。" }))
    ) {
      return;
    }
    void removeCourse(course.id)
      .then(() => {
        setCourseDrawer(null);
        showToast(t("agenda.toast.deleted", { defaultValue: "已删除" }));
      })
      .catch((cause) => showToast(getErrorMessage(cause)));
  };

  const handleImportCourses = async (rows: CourseInput[]) => {
    const created = await importCourseRows(rows);
    showToast(
      t("agenda.import.imported", {
        count: created.length,
        defaultValue: "已导入 {{count}} 门课程",
      }),
    );
  };

  const handleDailySave = async (input: DailyTaskInput) => {
    if (dailyDrawer?.task) {
      await editDailyTask(dailyDrawer.task.id, input);
    } else {
      await addDailyTask(input);
    }
    showToast(t("agenda.toast.saved", { defaultValue: "已保存" }));
  };

  const handleDeleteDaily = (task: DailyTask) => {
    if (
      !window.confirm(t("agenda.confirmDelete", { defaultValue: "确定删除？此操作不可撤销。" }))
    ) {
      return;
    }
    void removeDailyTask(task.id)
      .then(() => {
        setDailyDrawer(null);
        showToast(t("agenda.toast.deleted", { defaultValue: "已删除" }));
      })
      .catch((cause) => showToast(getErrorMessage(cause)));
  };

  const handleToggleDaily = (task: DailyTask, done: boolean) => {
    void toggleDaily(task, today, done).catch((cause) => showToast(getErrorMessage(cause)));
  };

  return (
    <div className="flex flex-1 min-w-0 min-h-0">
      <AgendaSidebar
        mode={mode}
        cursor={cursor}
        selectedDay={selectedDay}
        events={snapshot.events}
        todos={snapshot.todos}
        courses={snapshot.courses}
        dailyTasks={snapshot.dailyTasks}
        dailyChecks={snapshot.dailyChecks}
        currentWeek={currentWeek}
        activeList={activeList}
        activeTag={activeTag}
        locale={locale}
        onModeChange={setMode}
        onSelectDay={handleSelectDayFromMini}
        onCursorChange={setCursor}
        onSelectList={(list) => {
          setActiveList(list);
          setMode("todos");
        }}
        onSelectTag={setActiveTag}
      />

      <main className="flex-1 min-w-0 flex flex-col bg-cloud/50">
        <div className="h-11 px-4 flex items-center justify-between border-b border-paper-deep/30 shrink-0 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {mode === "calendar" ? (
              <>
                <span className="text-[12px] font-body font-medium text-ink-soft truncate">
                  {calendarView === "month"
                    ? formatMonthTitle(cursor, locale)
                    : `${formatDayHeading(weekStartKey, locale)} – ${formatDayHeading(
                        addDaysToKey(weekStartKey, 6),
                        locale,
                      )}`}
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={t("agenda.calendar.prev", { defaultValue: "上一页" })}
                    onClick={() => shiftCalendar(-1)}
                    className="w-6 h-6 flex items-center justify-center rounded text-ink-ghost hover:bg-paper-warm hover:text-ink-soft transition-colors cursor-pointer"
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={goToday}
                    className="h-6 px-2 rounded text-[10px] font-body text-ink-faint hover:bg-paper-warm hover:text-ink-soft transition-colors cursor-pointer"
                  >
                    {t("agenda.calendar.today", { defaultValue: "今天" })}
                  </button>
                  <button
                    type="button"
                    aria-label={t("agenda.calendar.next", { defaultValue: "下一页" })}
                    onClick={() => shiftCalendar(1)}
                    className="w-6 h-6 flex items-center justify-center rounded text-ink-ghost hover:bg-paper-warm hover:text-ink-soft transition-colors cursor-pointer"
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              </>
            ) : mode === "courses" ? (
              <span className="text-[12px] font-body font-medium text-ink-soft truncate">
                {t("agenda.nav.courses", { defaultValue: "课程表" })}
                <span className="ml-1.5 text-[10px] font-mono text-ink-ghost">
                  {snapshot.courses.length}
                </span>
                {currentWeek !== null ? (
                  <span className="ml-2 text-[10px] font-body text-bamboo">
                    {currentWeek > 0
                      ? t("agenda.timetable.weekShort", {
                          week: currentWeek,
                          defaultValue: "第 {{week}} 周",
                        })
                      : t("agenda.timetable.notStartedShort", { defaultValue: "未开学" })}
                  </span>
                ) : null}
                <SemesterProgressBar
                  semesterStart={snapshot.timetableSettings.semesterStart}
                  weeks={snapshot.courses.map((course) => course.weeks)}
                  today={today}
                />
              </span>
            ) : mode === "daily" ? (
              <span className="text-[12px] font-body font-medium text-ink-soft truncate">
                {t("agenda.nav.daily", { defaultValue: "每日必做" })}
                <span className="ml-1.5 text-[10px] font-mono text-ink-ghost">
                  {dailyDone}/{activeDailyTasks.length}
                </span>
              </span>
            ) : (
              <span className="text-[12px] font-body font-medium text-ink-soft truncate">
                {activeTag ? `#${activeTag} · ` : ""}
                {listLabel(activeList)}
                <span className="ml-1.5 text-[10px] font-mono text-ink-ghost">
                  {visibleTodos.length}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPlanOpen(true)}
              title={t("agenda.plan.title", { defaultValue: "智能排期" })}
              className="h-7 px-2 rounded-lg border border-paper-deep/50 text-[10px] font-body text-ink-faint hover:text-bamboo hover:border-bamboo/40 hover:bg-bamboo-mist/40 transition-colors cursor-pointer"
            >
              {t("agenda.plan.open", { defaultValue: "排期" })}
            </button>
            <button
              type="button"
              onClick={() => setReminderSettingsOpen(true)}
              aria-label={t("agenda.reminder.settingsTitle", { defaultValue: "提醒设置" })}
              title={t("agenda.reminder.settingsTitle", { defaultValue: "提醒设置" })}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-paper-deep/50 text-ink-ghost hover:text-bamboo hover:border-bamboo/40 hover:bg-bamboo-mist/40 transition-colors cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => void handleOpenWidget()}
              title={t("agenda.widget.openCombined", { defaultValue: "打开合并后的桌面小窗（日程 / 待办）" })}
              className="h-7 px-2 rounded-lg border border-paper-deep/50 text-[10px] font-body text-ink-faint hover:text-bamboo hover:border-bamboo/40 hover:bg-bamboo-mist/40 transition-colors cursor-pointer"
            >
              {t("agenda.widget.openCombinedShort", { defaultValue: "桌面小窗" })}
            </button>
            {mode === "calendar" ? (
              <>
                <div className="flex items-center rounded-md bg-paper-warm/70 p-0.5">
                  {[
                    {
                      value: "month" as CalendarView,
                      label: t("agenda.view.month", { defaultValue: "月" }),
                    },
                    {
                      value: "week" as CalendarView,
                      label: t("agenda.view.week", { defaultValue: "周" }),
                    },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setCalendarView(option.value)}
                      className={`px-2.5 h-6 rounded text-[10px] font-body transition-colors cursor-pointer ${
                        calendarView === option.value
                          ? "bg-cloud text-bamboo shadow-[0_1px_2px_rgba(26,26,24,0.06)]"
                          : "text-ink-ghost hover:text-ink-soft"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setTodoDrawer({ todo: null })}
                  className="h-7 px-2.5 rounded-lg border border-paper-deep/50 text-[11px] font-body text-ink-faint hover:text-bamboo hover:border-bamboo/40 hover:bg-bamboo-mist/40 transition-colors cursor-pointer"
                >
                  + {t("agenda.nav.todos", { defaultValue: "待办" })}
                </button>
                <button
                  type="button"
                  onClick={() => setEventDrawer({ event: null, day: selectedDay })}
                  className="h-7 px-2.5 rounded-lg bg-bamboo text-cloud text-[11px] font-body hover:bg-bamboo-light transition-colors cursor-pointer"
                >
                  + {t("agenda.nav.calendar", { defaultValue: "日程" })}
                </button>
              </>
            ) : mode === "courses" ? (
              <>
                <button
                  type="button"
                  disabled={currentWeek === null || currentWeek <= 0}
                  onClick={() => setOnlyCurrentWeek((value) => !value)}
                  className={`h-7 px-2 rounded-lg border text-[10px] font-body transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    onlyCurrentWeek && currentWeek !== null && currentWeek > 0
                      ? "bg-bamboo-mist/70 border-bamboo/30 text-bamboo"
                      : "border-paper-deep/50 text-ink-faint hover:text-ink-soft"
                  }`}
                >
                  {t("agenda.timetable.currentWeekOnly", { defaultValue: "本周" })}
                </button>
                <button
                  type="button"
                  onClick={() => setTimetableSettingsOpen(true)}
                  aria-label={t("agenda.timetable.settingsTitle", {
                    defaultValue: "课程表设置",
                  })}
                  title={t("agenda.timetable.settingsTitle", { defaultValue: "课程表设置" })}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-paper-deep/50 text-ink-ghost hover:text-bamboo hover:border-bamboo/40 hover:bg-bamboo-mist/40 transition-colors cursor-pointer"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setPartnerOpen(true)}
                  title={t("agenda.partner.title", { defaultValue: "双人课表" })}
                  className={`h-7 px-2.5 rounded-lg border text-[11px] font-body transition-colors cursor-pointer ${
                    snapshot.partnerCourses.length > 0
                      ? "border-bamboo/40 bg-bamboo-mist/50 text-bamboo"
                      : "border-paper-deep/50 text-ink-faint hover:text-bamboo hover:border-bamboo/40 hover:bg-bamboo-mist/40"
                  }`}
                >
                  {t("agenda.partner.short", { defaultValue: "双人" })}
                </button>
                {hasPartner ? (
                  <button
                    type="button"
                    onClick={togglePartnerVisible}
                    title={
                      partnerVisible
                        ? t("agenda.partner.hide", { defaultValue: "隐藏对方课表" })
                        : t("agenda.partner.show", { defaultValue: "显示对方课表" })
                    }
                    className={`w-7 h-7 flex items-center justify-center rounded-lg border text-[11px] transition-colors cursor-pointer ${
                      partnerVisible
                        ? "border-paper-deep/50 text-bamboo hover:bg-bamboo-mist/40"
                        : "border-paper-deep/50 text-ink-ghost hover:text-ink-soft"
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </svg>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPrintOpen(true)}
                  className="h-7 px-2.5 rounded-lg border border-paper-deep/50 text-[11px] font-body text-ink-faint hover:text-bamboo hover:border-bamboo/40 hover:bg-bamboo-mist/40 transition-colors cursor-pointer"
                >
                  {t("agenda.print.open", { defaultValue: "打印" })}
                </button>
                <button
                  type="button"
                  disabled={weeklyBusy}
                  onClick={() => void handleGenerateWeeklyReview()}
                  className="h-7 px-2.5 rounded-lg border border-paper-deep/50 text-[11px] font-body text-ink-faint hover:text-bamboo hover:border-bamboo/40 hover:bg-bamboo-mist/40 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {weeklyBusy
                    ? t("common.saving", { defaultValue: "生成中…" })
                    : t("agenda.review.weekly", { defaultValue: "周回顾" })}
                </button>
                <button
                  type="button"
                  onClick={() => void handleClearCourses()}
                  title={t("agenda.course.clear", { defaultValue: "清空本学期课表" })}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-paper-deep/50 text-ink-ghost hover:text-red-400 hover:border-red-300/60 hover:bg-danger-bg transition-colors cursor-pointer"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className="h-7 px-2.5 rounded-lg border border-paper-deep/50 text-[11px] font-body text-ink-faint hover:text-bamboo hover:border-bamboo/40 hover:bg-bamboo-mist/40 transition-colors cursor-pointer"
                >
                  {t("agenda.course.import", { defaultValue: "导入" })}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCourseDrawer({ course: null, weekday: selectedWeekday, period: 1 })
                  }
                  className="h-7 px-2.5 rounded-lg bg-bamboo text-cloud text-[11px] font-body hover:bg-bamboo-light transition-colors cursor-pointer"
                >
                  + {t("agenda.course.new", { defaultValue: "课程" })}
                </button>
              </>
            ) : mode === "daily" ? (
              <>
                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() => void handleGenerateReview()}
                  title={t("agenda.review.hint", {
                    defaultValue: "把今天完成的待办、日程、课程与每日必做写成一篇笔记",
                  })}
                  className="h-7 px-2.5 rounded-lg border border-paper-deep/50 text-[11px] font-body text-ink-faint hover:text-bamboo hover:border-bamboo/40 hover:bg-bamboo-mist/40 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {reviewing
                    ? t("common.saving", { defaultValue: "生成中…" })
                    : t("agenda.review.generate", { defaultValue: "生成今日回顾" })}
                </button>
                <button
                  type="button"
                  onClick={() => setDailyDrawer({ task: null })}
                  className="h-7 px-2.5 rounded-lg bg-bamboo text-cloud text-[11px] font-body hover:bg-bamboo-light transition-colors cursor-pointer"
                >
                  + {t("agenda.daily.addShort", { defaultValue: "每日必做" })}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setTodoDrawer({ todo: null })}
                  className="h-7 px-2.5 rounded-lg border border-paper-deep/50 text-[11px] font-body text-ink-faint hover:text-bamboo hover:border-bamboo/40 hover:bg-bamboo-mist/40 transition-colors cursor-pointer"
                >
                  + {t("agenda.nav.todos", { defaultValue: "待办" })}
                </button>
                <button
                  type="button"
                  onClick={() => setEventDrawer({ event: null, day: selectedDay })}
                  className="h-7 px-2.5 rounded-lg bg-bamboo text-cloud text-[11px] font-body hover:bg-bamboo-light transition-colors cursor-pointer"
                >
                  + {t("agenda.nav.calendar", { defaultValue: "日程" })}
                </button>
              </>
            )}
          </div>
        </div>

        {error ? (
          <div className="px-4 py-1.5 flex items-center justify-between gap-3 bg-danger-bg/60 border-b border-red-200/40">
            <span className="text-[11px] font-body text-red-400 truncate">{error}</span>
            <button
              type="button"
              onClick={() => void reload()}
              className="text-[11px] font-body text-red-400 hover:text-red-500 underline shrink-0 cursor-pointer"
            >
              {t("common.retry", { defaultValue: "重试" })}
            </button>
          </div>
        ) : null}

        {loading &&
        snapshot.todos.length === 0 &&
        snapshot.events.length === 0 &&
        snapshot.courses.length === 0 &&
        snapshot.dailyTasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[12px] font-body text-ink-ghost">
            {t("common.loading", { defaultValue: "加载中…" })}
          </div>
        ) : mode === "calendar" ? (
          calendarView === "month" ? (
            <MonthGrid
              cursor={cursor}
              selectedDay={selectedDay}
              events={snapshot.events}
              courses={snapshot.courses}
              partnerCourses={snapshot.partnerCourses}
              partnerName={snapshot.partnerProfile.name}
              partnerColor={snapshot.partnerProfile.color ?? "#7F77DD"}
              partnerRelation={snapshot.partnerProfile.relation}
              showPartner={showPartnerCourses}
              week={currentWeek}
              locale={locale}
              onSelectDay={handleSelectDayInCalendar}
              onOpenEvent={(event) => setEventDrawer({ event, day: eventStartKey(event) })}
              onCreateEvent={(day) => setEventDrawer({ event: null, day })}
              onOpenCourse={(course) =>
                setCourseDrawer({ course, weekday: course.weekday, period: course.startPeriod })
              }
              onOpenPartner={() => setPartnerOpen(true)}
            />
          ) : (
            <WeekGrid
              weekStart={weekStartKey}
              selectedDay={selectedDay}
              events={snapshot.events}
              locale={locale}
              onSelectDay={handleSelectDayInCalendar}
              onOpenEvent={(event) => setEventDrawer({ event, day: eventStartKey(event) })}
              onCreateEvent={(day, minutes) => setEventDrawer({ event: null, day, minutes })}
            />
          )
        ) : mode === "courses" ? (
          <CourseGrid
            courses={visibleCourses}
            settings={snapshot.timetableSettings}
            overrides={snapshot.courseOverrides.filter((item) => item.date === selectedDay)}
            partnerCourses={snapshot.partnerCourses}
            partnerName={snapshot.partnerProfile.name}
            partnerColor={snapshot.partnerProfile.color ?? "#D4537E"}
            partnerRelation={snapshot.partnerProfile.relation}
            showPartner={showPartnerCourses}
            sharedFree={sharedFree}
            onOpenPartner={() => setPartnerOpen(true)}
            pendingByCourse={pendingByCourse}
            locale={locale}
            onCreate={(weekday, period) => setCourseDrawer({ course: null, weekday, period })}
            onEdit={(course) =>
              setCourseDrawer({
                course,
                weekday: course.weekday,
                period: course.startPeriod,
              })
            }
          />
        ) : mode === "daily" ? (
          <DailyView
            tasks={snapshot.dailyTasks}
            checks={snapshot.dailyChecks}
            today={today}
            locale={locale}
            onToggle={handleToggleDaily}
            onEdit={(task) => setDailyDrawer({ task })}
            onDelete={handleDeleteDaily}
            onAdd={() => setDailyDrawer({ task: null })}
          />
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="px-4 pt-3 shrink-0">
              <DdlPressureStrip todos={snapshot.todos} today={today} locale={locale} />
            </div>
            <TodoListView
              todos={visibleTodos}
              list={activeList}
              search={search}
              defaultDueDate={defaultDueDateForList}
              locale={locale}
              onSearchChange={setSearch}
              onCreate={handleQuickCreate}
              onNewDetailed={() => setTodoDrawer({ todo: null })}
              onToggle={handleToggle}
              onOpen={(todo) => setTodoDrawer({ todo })}
              onDelete={handleDeleteTodo}
            />
          </div>
        )}
      </main>

      {todoDrawer ? (
        <TodoDrawer
          todo={todoDrawer.todo}
          defaultDueDate={defaultDueDateForList}
          onClose={() => setTodoDrawer(null)}
          onSave={handleTodoSave}
          onDelete={handleDeleteTodo}
        />
      ) : null}

      {eventDrawer ? (
        <EventDrawer
          event={eventDrawer.event}
          defaultDay={eventDrawer.day}
          defaultMinutes={eventDrawer.minutes}
          locale={locale}
          onClose={() => setEventDrawer(null)}
          onSave={handleEventSave}
          onDelete={handleDeleteEvent}
        />
      ) : null}

      {courseDrawer ? (
        <CourseDrawer
          course={courseDrawer.course}
          defaultWeekday={courseDrawer.weekday}
          defaultPeriod={courseDrawer.period}
          todos={snapshot.todos}
          overrides={snapshot.courseOverrides}
          onClose={() => setCourseDrawer(null)}
          onSave={handleCourseSave}
          onDelete={handleDeleteCourse}
          onAddTask={async (input) => {
            await addTodo(input);
          }}
          onToggleTask={handleToggle}
          onDeleteTask={handleDeleteTodo}
          onOpenTask={(todo) => {
            setCourseDrawer(null);
            setTodoDrawer({ todo });
          }}
          onCreateNote={(course) => void handleCreateCourseNote(course)}
          onOpenOverride={(course) => setOverrideCourse(course)}
        />
      ) : null}

      {dailyDrawer ? (
        <DailyDrawer
          task={dailyDrawer.task}
          onClose={() => setDailyDrawer(null)}
          onSave={handleDailySave}
          onDelete={handleDeleteDaily}
        />
      ) : null}

      {importOpen ? (
        <CourseImportDialog
          onClose={() => setImportOpen(false)}
          onImport={handleImportCourses}
        />
      ) : null}

      {timetableSettingsOpen ? (
        <TimetableSettingsDialog
          settings={snapshot.timetableSettings}
          onClose={() => setTimetableSettingsOpen(false)}
          onSave={async (settings) => {
            await saveTimetable(settings);
          }}
        />
      ) : null}

      {planOpen ? (
        <PlanDialog
          snapshot={snapshot}
          today={today}
          locale={locale}
          onClose={() => setPlanOpen(false)}
          onGenerate={handleGeneratePlan}
        />
      ) : null}

      {printOpen ? (
        <TimetablePrintView
          courses={visibleCourses}
          settings={snapshot.timetableSettings}
          locale={locale}
          onClose={() => setPrintOpen(false)}
        />
      ) : null}

      {overrideCourse ? (
        <CourseOverrideDialog
          course={overrideCourse}
          today={selectedDay}
          overrides={snapshot.courseOverrides}
          onClose={() => setOverrideCourse(null)}
          onSave={handleSaveOverride}
          onDelete={removeCourseOverride}
        />
      ) : null}

      {partnerOpen ? (
        <PartnerDialog
          profile={snapshot.partnerProfile}
          courses={snapshot.partnerCourses}
          visible={partnerVisible}
          onToggleVisible={togglePartnerVisible}
          onClearCourses={handleClearPartnerCourses}
          onClose={() => setPartnerOpen(false)}
          onSaveProfile={savePartner}
          onImport={importPartnerCourseRows}
          onDeleteCourse={removePartnerCourse}
        />
      ) : null}

      {reminderSettingsOpen ? (
        <ReminderSettingsDialog onClose={() => setReminderSettingsOpen(false)} />
      ) : null}

      {reminder ? (
        <ReminderBanner
          item={reminder}
          onOpen={handleOpenReminder}
          onClose={() => setReminder(null)}
        />
      ) : null}
    </div>
  );
}
