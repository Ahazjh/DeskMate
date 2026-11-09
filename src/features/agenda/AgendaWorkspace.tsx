import { useCallback, useEffect, useMemo, useState } from "react";
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
import { splitQueryKeywords } from "../notes/noteUtils";
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
import { ConfirmSaveDialog } from "./components/ConfirmSaveDialog";
import { DayAgendaPanel } from "./components/DayAgendaPanel";
import { useDrawerController, type DrawerKind, type DrawerTarget } from "./drawerController";
import { expandWeekCourses } from "./weekCourses";
import type { PlanBlock } from "./schedulePlanner";

const DRAWER_LABELS: Record<DrawerKind, string> = {
  todo: "待办",
  event: "日程",
  course: "课程",
  daily: "每日必做",
};


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
  // 点日历某一天时弹出的「当日安排」面板
  const [dayPanelOpen, setDayPanelOpen] = useState(false);

  // 抽屉互斥：同一时刻只显示一个抽屉
  const [pendingConfirm, setPendingConfirm] = useState<{
    kind: DrawerKind;
    resolve: (saved: boolean) => void;
  } | null>(null);

  const drawer = useDrawerController({
    onConfirmSave: async (kind) => {
      const result = await new Promise<boolean>((resolve) => {
        setPendingConfirm({ kind, resolve });
      });
      return result;
    },
  });

  const activeDrawer = drawer.active;
  const todoDrawer =
    activeDrawer?.kind === "todo" ? activeDrawer : null;
  const eventDrawer =
    activeDrawer?.kind === "event" ? activeDrawer : null;
  const courseDrawer =
    activeDrawer?.kind === "course" ? activeDrawer : null;
  const dailyDrawer =
    activeDrawer?.kind === "daily" ? activeDrawer : null;

  const openDrawer = drawer.open;
  const closeDrawer = drawer.close;

  // 当日面板与抽屉互斥：开抽屉时收起面板，开面板时收起抽屉
  const openDayPanel = useCallback(() => {
    closeDrawer();
    setDayPanelOpen(true);
  }, [closeDrawer]);

  const openDrawerWithPanelClosed = useCallback(
    (target: DrawerTarget) => {
      setDayPanelOpen(false);
      openDrawer(target);
    },
    [openDrawer],
  );
  // 各抽屉的 dirty 上报与保存登记：稳定引用，避免抽屉内部 effect 反复触发
  const setDirty = drawer.setDirty;
  const registerSave = drawer.registerSave;
  const runSave = drawer.runSave;

  const handleTodoDirty = useCallback(
    (dirty: boolean) => setDirty("todo", dirty),
    [setDirty],
  );
  const handleEventDirty = useCallback(
    (dirty: boolean) => setDirty("event", dirty),
    [setDirty],
  );
  const handleCourseDirty = useCallback(
    (dirty: boolean) => setDirty("course", dirty),
    [setDirty],
  );
  const handleDailyDirty = useCallback(
    (dirty: boolean) => setDirty("daily", dirty),
    [setDirty],
  );

  const handleTodoRegisterSave = useCallback(
    (save: (() => Promise<boolean>) | null) => registerSave("todo", save),
    [registerSave],
  );
  const handleEventRegisterSave = useCallback(
    (save: (() => Promise<boolean>) | null) => registerSave("event", save),
    [registerSave],
  );
  const handleCourseRegisterSave = useCallback(
    (save: (() => Promise<boolean>) | null) => registerSave("course", save),
    [registerSave],
  );
  const handleDailyRegisterSave = useCallback(
    (save: (() => Promise<boolean>) | null) => registerSave("daily", save),
    [registerSave],
  );

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
        openDrawerWithPanelClosed({ kind: "todo", todo });
        return;
      }
    } else {
      const event = snapshot.events.find((entry) => entry.id === item.id);
      if (event) {
        setMode("calendar");
        openDrawerWithPanelClosed({ kind: "event", event, day: eventStartKey(event) });
        return;
      }
    }
    showToast(t("agenda.reminder.openFailed", { defaultValue: "找不到对应事项" }));
  };

  const handleGenerateReview = async () => {
    setReviewing(true);
    try {
      const noteId = await generateDailyReview(todayKey(now));
      // 描述文字挂在图标上，鼠标移上去才显示；提示本身用不透明背景保证可读
      showToast(
        t("agenda.review.generated", { defaultValue: "回顾笔记已生成" }),
        "success",
        t("agenda.review.generatedHint", {
          defaultValue: "已自动打开今天的回顾笔记；每天首次启动时也会自动生成前一天的回顾。",
        }),
        { opaque: true },
      );
      // 点一下就直接拿到当天的报告
      await openNoteInEditor(noteId).catch(() => undefined);
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
    const keywords = splitQueryKeywords(search);
    if (keywords.length === 0) return base;
    // 多关键词 AND 关系；除标题/备注/标签外，也搜提交平台与优先级
    return base.filter((todo) => {
      const haystack = [
        todo.title,
        todo.notes,
        todo.platform,
        ...todo.tags,
        todo.priority > 0
          ? t(`agenda.priority.${todo.priority}`, { defaultValue: "优先级" })
          : "",
      ]
        .join(" ")
        .toLowerCase();
      return keywords.every((keyword) => haystack.includes(keyword));
    });
  }, [snapshot.todos, activeList, activeTag, search, now, t]);

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

  // 「本周」列表同步展示本周课程；其他清单不展示课程
  const weekCourseEntries = useMemo(() => {
    if (activeList !== "week") return [];
    const entries = expandWeekCourses(
      snapshot.courses,
      snapshot.courseOverrides,
      now,
      currentWeek,
    );
    const keywords = splitQueryKeywords(search);
    if (keywords.length === 0) return entries;
    return entries.filter((entry) => {
      const haystack = [
        entry.course.name,
        entry.location,
        entry.course.teacher,
        entry.course.note,
      ]
        .join(" ")
        .toLowerCase();
      return keywords.every((keyword) => haystack.includes(keyword));
    });
  }, [activeList, snapshot.courses, snapshot.courseOverrides, now, currentWeek, search]);

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
    openDayPanel();
  };

  const handleSelectDayInCalendar = (key: string) => {
    setSelectedDay(key);
    setCursor(parseDayKey(key));
    // 点日期即弹出当天的全部安排（日程 + 课程 + 待办），可点条目编辑
    openDayPanel();
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
        closeDrawer();
        showToast(t("agenda.toast.deleted", { defaultValue: "已删除" }), "success");
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
        closeDrawer();
        showToast(t("agenda.toast.deleted", { defaultValue: "已删除" }), "success");
      })
      .catch((cause) => showToast(getErrorMessage(cause)));
  };

  const handleTodoSave = async (input: TodoInput) => {
    if (todoDrawer?.todo) {
      await editTodo(todoDrawer.todo.id, input);
    } else {
      await addTodo(input);
    }
    showToast(t("agenda.toast.saved", { defaultValue: "已保存" }), "success");
  };

  const handleEventSave = async (input: EventInput) => {
    if (eventDrawer?.event) {
      await editEvent(eventDrawer.event.id, input);
    } else {
      await addEvent(input);
    }
    showToast(t("agenda.toast.saved", { defaultValue: "已保存" }), "success");
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
    showToast(t("agenda.toast.saved", { defaultValue: "已保存" }), "success");
  };

  const handleDeleteCourse = (course: Course) => {
    if (
      !window.confirm(t("agenda.confirmDelete", { defaultValue: "确定删除？此操作不可撤销。" }))
    ) {
      return;
    }
    void removeCourse(course.id)
      .then(() => {
        closeDrawer();
        showToast(t("agenda.toast.deleted", { defaultValue: "已删除" }), "success");
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
    showToast(t("agenda.toast.saved", { defaultValue: "已保存" }), "success");
  };

  const handleDeleteDaily = (task: DailyTask) => {
    if (
      !window.confirm(t("agenda.confirmDelete", { defaultValue: "确定删除？此操作不可撤销。" }))
    ) {
      return;
    }
    void removeDailyTask(task.id)
      .then(() => {
        closeDrawer();
        showToast(t("agenda.toast.deleted", { defaultValue: "已删除" }), "success");
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
        onModeChange={(next) => {
          setMode(next);
          // 离开待办视图时清掉搜索词：搜索框不在其它视图里，
          // 残留的搜索词会让列表莫名其妙是空的
          if (next !== "todos") {
            setSearch("");
          }
        }}
        onSelectDay={handleSelectDayFromMini}
        onCursorChange={setCursor}
        onSelectList={(list) => {
          setActiveList(list);
          setMode("todos");
          setSearch("");
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
                  onClick={() => openDrawerWithPanelClosed({ kind: "todo", todo: null })}
                  className="h-7 px-2.5 rounded-lg border border-paper-deep/50 text-[11px] font-body text-ink-faint hover:text-bamboo hover:border-bamboo/40 hover:bg-bamboo-mist/40 transition-colors cursor-pointer"
                >
                  + {t("agenda.nav.todos", { defaultValue: "待办" })}
                </button>
                <button
                  type="button"
                  onClick={() => openDrawerWithPanelClosed({ kind: "event", event: null, day: selectedDay })}
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
                    openDrawerWithPanelClosed({ kind: "course", course: null, weekday: selectedWeekday, period: 1 })
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
                    defaultValue:
                      "把今天完成的待办、日程、课程与每日必做写成一篇笔记并立即打开；每天首次启动时也会自动生成前一天的回顾。",
                  })}
                  className="h-7 px-2.5 rounded-lg border border-paper-deep/50 text-[11px] font-body text-ink-faint hover:text-bamboo hover:border-bamboo/40 hover:bg-bamboo-mist/40 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {reviewing
                    ? t("common.saving", { defaultValue: "生成中…" })
                    : t("agenda.review.generate", { defaultValue: "生成今日回顾" })}
                </button>
                <button
                  type="button"
                  onClick={() => openDrawerWithPanelClosed({ kind: "daily", task: null })}
                  className="h-7 px-2.5 rounded-lg bg-bamboo text-cloud text-[11px] font-body hover:bg-bamboo-light transition-colors cursor-pointer"
                >
                  + {t("agenda.daily.addShort", { defaultValue: "每日必做" })}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openDrawerWithPanelClosed({ kind: "todo", todo: null })}
                  className="h-7 px-2.5 rounded-lg border border-paper-deep/50 text-[11px] font-body text-ink-faint hover:text-bamboo hover:border-bamboo/40 hover:bg-bamboo-mist/40 transition-colors cursor-pointer"
                >
                  + {t("agenda.nav.todos", { defaultValue: "待办" })}
                </button>
                <button
                  type="button"
                  onClick={() => openDrawerWithPanelClosed({ kind: "event", event: null, day: selectedDay })}
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
              onOpenEvent={(event) => openDrawerWithPanelClosed({ kind: "event", event, day: eventStartKey(event) })}
              onCreateEvent={(day) => openDrawerWithPanelClosed({ kind: "event", event: null, day })}
              onOpenCourse={(course) =>
                openDrawerWithPanelClosed({ kind: "course", course, weekday: course.weekday, period: course.startPeriod })
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
              onOpenEvent={(event) => openDrawerWithPanelClosed({ kind: "event", event, day: eventStartKey(event) })}
              onCreateEvent={(day, minutes) => openDrawerWithPanelClosed({ kind: "event", event: null, day, minutes })}
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
            onCreate={(weekday, period) => openDrawerWithPanelClosed({ kind: "course", course: null, weekday, period })}
            onEdit={(course) =>
              openDrawerWithPanelClosed({
                kind: "course",
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
            onEdit={(task) => openDrawerWithPanelClosed({ kind: "daily", task })}
            onDelete={handleDeleteDaily}
            onAdd={() => openDrawerWithPanelClosed({ kind: "daily", task: null })}
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
              weekCourses={weekCourseEntries}
              timetableSettings={snapshot.timetableSettings}
              onSearchChange={setSearch}
              onCreate={handleQuickCreate}
              onNewDetailed={() => openDrawerWithPanelClosed({ kind: "todo", todo: null })}
              onToggle={handleToggle}
              onOpen={(todo) => openDrawerWithPanelClosed({ kind: "todo", todo })}
              onDelete={handleDeleteTodo}
              onOpenCourse={(entry) =>
                openDrawerWithPanelClosed({
                  kind: "course",
                  course: entry.course,
                  weekday: entry.course.weekday,
                  period: entry.startPeriod,
                })
              }
            />
          </div>
        )}
      </main>

      {dayPanelOpen ? (
        <DayAgendaPanel
          day={selectedDay}
          events={snapshot.events}
          courses={snapshot.courses}
          todos={snapshot.todos}
          overrides={snapshot.courseOverrides}
          timetableSettings={snapshot.timetableSettings}
          week={currentWeek}
          locale={locale}
          onClose={() => setDayPanelOpen(false)}
          onOpenEvent={(event) =>
            openDrawerWithPanelClosed({ kind: "event", event, day: eventStartKey(event) })
          }
          onOpenCourse={(course) =>
            openDrawerWithPanelClosed({
              kind: "course",
              course,
              weekday: course.weekday,
              period: course.startPeriod,
            })
          }
          onOpenTodo={(todo) => openDrawerWithPanelClosed({ kind: "todo", todo })}
          onCreateEvent={(day) => openDrawerWithPanelClosed({ kind: "event", event: null, day })}
          onCreateTodo={(day) => {
            openDrawerWithPanelClosed({ kind: "todo", todo: null });
            setSelectedDay(day);
          }}
        />
      ) : null}

      {todoDrawer ? (
        <TodoDrawer
          key={`todo-${todoDrawer.todo?.id ?? "new"}`}
          todo={todoDrawer.todo}
          defaultDueDate={defaultDueDateForList}
          onClose={closeDrawer}
          onSave={handleTodoSave}
          onDelete={handleDeleteTodo}
          onDirtyChange={handleTodoDirty}
          onRegisterSave={handleTodoRegisterSave}
        />
      ) : null}

      {eventDrawer ? (
        <EventDrawer
          key={`event-${eventDrawer.event?.id ?? `new-${eventDrawer.day}-${eventDrawer.minutes ?? ""}`}`}
          event={eventDrawer.event}
          defaultDay={eventDrawer.day}
          defaultMinutes={eventDrawer.minutes}
          locale={locale}
          onClose={closeDrawer}
          onSave={handleEventSave}
          onDelete={handleDeleteEvent}
          onDirtyChange={handleEventDirty}
          onRegisterSave={handleEventRegisterSave}
        />
      ) : null}

      {courseDrawer ? (
        <CourseDrawer
          key={`course-${courseDrawer.course?.id ?? `new-${courseDrawer.weekday}-${courseDrawer.period}`}`}
          course={courseDrawer.course}
          defaultWeekday={courseDrawer.weekday}
          defaultPeriod={courseDrawer.period}
          todos={snapshot.todos}
          overrides={snapshot.courseOverrides}
          onClose={closeDrawer}
          onSave={handleCourseSave}
          onDelete={handleDeleteCourse}
          onAddTask={async (input) => {
            await addTodo(input);
          }}
          onToggleTask={handleToggle}
          onDeleteTask={handleDeleteTodo}
          onOpenTask={(todo) => {
            openDrawerWithPanelClosed({ kind: "todo", todo });
          }}
          onCreateNote={(course) => void handleCreateCourseNote(course)}
          onOpenOverride={(course) => setOverrideCourse(course)}
          onDirtyChange={handleCourseDirty}
          onRegisterSave={handleCourseRegisterSave}
        />
      ) : null}

      {dailyDrawer ? (
        <DailyDrawer
          key={`daily-${dailyDrawer.task?.id ?? "new"}`}
          task={dailyDrawer.task}
          onClose={closeDrawer}
          onSave={handleDailySave}
          onDelete={handleDeleteDaily}
          onDirtyChange={handleDailyDirty}
          onRegisterSave={handleDailyRegisterSave}
        />
      ) : null}

      <ConfirmSaveDialog
        open={pendingConfirm !== null}
        label={pendingConfirm ? DRAWER_LABELS[pendingConfirm.kind] : ""}
        onSave={() => {
          const pending = pendingConfirm;
          if (!pending) return;
          setPendingConfirm(null);
          void runSave(pending.kind).then((ok: boolean) => pending.resolve(ok));
        }}
        onDiscard={() => {
          const pending = pendingConfirm;
          if (!pending) return;
          setPendingConfirm(null);
          pending.resolve(false);
        }}
        onCancel={() => {
          const pending = pendingConfirm;
          if (!pending) return;
          setPendingConfirm(null);
          pending.resolve(false);
        }}
      />

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
