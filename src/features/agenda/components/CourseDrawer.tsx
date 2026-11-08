import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "../../../components/Toast";
import { getErrorMessage } from "../../notes/api";
import { SelectField } from "./SelectField";
import { combineDateTime, isoDayKey, isoTime, todayKey } from "../dateUtils";
import { EVENT_COLORS } from "../eventUtils";
import type { Course, CourseInput, CourseOverride, Todo, TodoInput } from "../types";

type CourseTaskKind = "assignment" | "task" | "reminder";

interface CourseDrawerProps {
  course: Course | null;
  defaultWeekday: number;
  defaultPeriod: number;
  todos: Todo[];
  overrides: CourseOverride[];
  onClose: () => void;
  onSave: (input: CourseInput) => Promise<void>;
  onDelete: (course: Course) => void;
  onAddTask: (input: TodoInput) => Promise<void>;
  onToggleTask: (todo: Todo) => void;
  onDeleteTask: (todo: Todo) => void;
  onOpenTask: (todo: Todo) => void;
  onCreateNote: (course: Course) => void;
  onOpenOverride: (course: Course) => void;
}

const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 7];
const PERIOD_VALUES = Array.from({ length: 12 }, (_, index) => index + 1);
const TASK_KINDS: CourseTaskKind[] = ["assignment", "task", "reminder"];

export function CourseDrawer({
  course,
  defaultWeekday,
  defaultPeriod,
  todos,
  overrides,
  onClose,
  onSave,
  onDelete,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onOpenTask,
  onCreateNote,
  onOpenOverride,
}: CourseDrawerProps) {
  const { t } = useTranslation();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(course?.name ?? "");
  const [weekday, setWeekday] = useState(course?.weekday ?? defaultWeekday);
  const [startPeriod, setStartPeriod] = useState(course?.startPeriod ?? defaultPeriod);
  const [endPeriod, setEndPeriod] = useState(course?.endPeriod ?? defaultPeriod);
  const [location, setLocation] = useState(course?.location ?? "");
  const [teacher, setTeacher] = useState(course?.teacher ?? "");
  const [weeks, setWeeks] = useState(course?.weeks ?? "");
  const [color, setColor] = useState(course?.color ?? EVENT_COLORS[0]);
  const [note, setNote] = useState(course?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskKind, setTaskKind] = useState<CourseTaskKind>("assignment");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDate, setTaskDate] = useState(todayKey());
  const [taskTime, setTaskTime] = useState("");
  const [taskPlatform, setTaskPlatform] = useState("");
  const [taskSaving, setTaskSaving] = useState(false);

  const courseTasks = useMemo(() => {
    if (!course) return [];
    return todos
      .filter((todo) => todo.courseId === course.id)
      .sort((left, right) => {
        if (left.done !== right.done) return left.done ? 1 : -1;
        const leftDue = left.dueAt ?? left.dueDate ?? "9999-99-99";
        const rightDue = right.dueAt ?? right.dueDate ?? "9999-99-99";
        return leftDue.localeCompare(rightDue);
      });
  }, [course, todos]);

  const pendingTaskCount = courseTasks.filter((todo) => !todo.done).length;

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast(t("agenda.course.nameRequired", { defaultValue: "请填写课程名称" }));
      return;
    }

    const input: CourseInput = {
      name: trimmed,
      weekday,
      startPeriod,
      endPeriod: Math.max(startPeriod, endPeriod),
      location,
      teacher,
      weeks,
      color,
      note,
    };

    setSaving(true);
    try {
      await onSave(input);
      onClose();
    } catch (cause) {
      showToast(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const handleAddTask = async () => {
    if (!course) return;
    const trimmed = taskTitle.trim();
    if (!trimmed) {
      showToast(t("agenda.course.taskTitleRequired", { defaultValue: "请填写作业或待办内容" }));
      return;
    }

    const dueDate = taskDate || null;
    const dueAt = taskDate && taskTime ? combineDateTime(taskDate, taskTime) : null;

    setTaskSaving(true);
    try {
      await onAddTask({
        title: trimmed,
        dueDate,
        dueAt,
        priority: 1,
        tags: [],
        courseId: course.id,
        platform: taskKind === "assignment" ? taskPlatform : "",
        kind: taskKind,
      });
      setTaskTitle("");
      setTaskTime("");
      setTaskPlatform("");
      setTaskOpen(false);
      showToast(t("agenda.toast.saved", { defaultValue: "已保存" }));
    } catch (cause) {
      showToast(getErrorMessage(cause));
    } finally {
      setTaskSaving(false);
    }
  };

  const taskDueLabel = (todo: Todo) => {
    if (todo.dueAt) {
      return `${isoDayKey(todo.dueAt).slice(5)} ${isoTime(todo.dueAt)}`;
    }
    return todo.dueDate ? todo.dueDate.slice(5) : "";
  };

  const kindLabel = (kind: CourseTaskKind) =>
    t(`agenda.course.taskKind.${kind}`, {
      defaultValue: { assignment: "作业", task: "待办", reminder: "提醒" }[kind],
    });

  return (
    <aside className="w-[320px] shrink-0 flex flex-col border-l border-paper-deep/30 bg-cloud min-h-0">
      <div className="h-10 px-4 flex items-center justify-between border-b border-paper-deep/30 shrink-0">
        <span className="text-[12px] font-body font-medium text-ink-soft truncate">
          {course
            ? t("agenda.course.editTitle", { defaultValue: "编辑课程" })
            : t("agenda.course.add", { defaultValue: "添加课程" })}
        </span>
        <div className="flex items-center gap-1 ml-auto mr-1.5 shrink-0">
          {course ? (
            <>
              <button
                type="button"
                onClick={() => onCreateNote(course)}
                title={t("agenda.note.createHint", { defaultValue: "在笔记中归档本门课" })}
                className="h-6 px-2 rounded-md border border-paper-deep/50 text-[9.5px] font-body text-ink-faint hover:text-bamboo hover:border-bamboo/40 hover:bg-bamboo-mist/40 transition-colors cursor-pointer"
              >
                {t("agenda.note.create", { defaultValue: "记笔记" })}
              </button>
              <button
                type="button"
                onClick={() => onOpenOverride(course)}
                title={t("agenda.override.title", { name: course.name, defaultValue: "单次调课 / 停课" })}
                className="h-6 px-2 rounded-md border border-paper-deep/50 text-[9.5px] font-body text-ink-faint hover:text-bamboo hover:border-bamboo/40 hover:bg-bamboo-mist/40 transition-colors cursor-pointer"
              >
                {t("agenda.override.short", { defaultValue: "调课" })}
                {overrides.filter((item) => item.courseId === course.id).length > 0 ? (
                  <span className="ml-0.5 text-[8px] text-bamboo">
                    {overrides.filter((item) => item.courseId === course.id).length}
                  </span>
                ) : null}
              </button>
            </>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close", { defaultValue: "关闭" })}
          className="w-6 h-6 flex items-center justify-center rounded text-ink-ghost hover:text-ink-soft hover:bg-paper-warm cursor-pointer"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <input
          ref={nameRef}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("agenda.course.namePlaceholder", { defaultValue: "课程名称" })}
          className="w-full text-[14px] font-body text-ink placeholder:text-ink-ghost/60 bg-transparent border-b border-paper-deep/40 pb-1.5 focus:border-bamboo/50 outline-none"
        />

        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-body text-ink-ghost">
              {t("agenda.course.weekday", { defaultValue: "星期" })}
            </span>
            <SelectField
              value={weekday}
              ariaLabel={t("agenda.course.weekday", { defaultValue: "星期" })}
              onChange={(value) => setWeekday(value)}
              options={WEEKDAY_VALUES.map((value) => ({
                value,
                label: t(`agenda.weekday.${value}`, {
                  defaultValue: `周${"一二三四五六日"[value - 1]}`,
                }),
              }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-body text-ink-ghost">
              {t("agenda.course.startPeriod", { defaultValue: "开始节" })}
            </span>
            <SelectField
              value={startPeriod}
              ariaLabel={t("agenda.course.startPeriod", { defaultValue: "开始节" })}
              onChange={(value) => {
                setStartPeriod(value);
                if (endPeriod < value) setEndPeriod(value);
              }}
              options={PERIOD_VALUES.map((value) => ({
                value,
                label: t("agenda.timetable.periodShort", {
                  period: value,
                  defaultValue: `第${value}节`,
                }),
              }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-body text-ink-ghost">
              {t("agenda.course.endPeriod", { defaultValue: "结束节" })}
            </span>
            <SelectField
              value={endPeriod}
              ariaLabel={t("agenda.course.endPeriod", { defaultValue: "结束节" })}
              onChange={(value) => setEndPeriod(value)}
              options={PERIOD_VALUES.filter((value) => value >= startPeriod).map((value) => ({
                value,
                label: t("agenda.timetable.periodShort", {
                  period: value,
                  defaultValue: `第${value}节`,
                }),
              }))}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-body text-ink-ghost">
              {t("agenda.course.location", { defaultValue: "地点" })}
            </span>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder={t("agenda.course.locationPlaceholder", { defaultValue: "教一101" })}
              className="h-8 px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft placeholder:text-ink-ghost/50 focus:border-bamboo/40 outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-body text-ink-ghost">
              {t("agenda.course.teacher", { defaultValue: "教师" })}
            </span>
            <input
              value={teacher}
              onChange={(event) => setTeacher(event.target.value)}
              placeholder={t("agenda.course.teacherPlaceholder", { defaultValue: "张老师" })}
              className="h-8 px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft placeholder:text-ink-ghost/50 focus:border-bamboo/40 outline-none"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-body text-ink-ghost">
            {t("agenda.course.weeks", { defaultValue: "周次" })}
          </span>
          <input
            value={weeks}
            onChange={(event) => setWeeks(event.target.value)}
            placeholder={t("agenda.course.weeksPlaceholder", {
              defaultValue: "1-16周 / 单周 / 双周",
            })}
            className="h-8 px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft placeholder:text-ink-ghost/50 focus:border-bamboo/40 outline-none"
          />
        </label>

        <div>
          <div className="text-[10px] font-body text-ink-ghost pb-1">
            {t("agenda.course.color", { defaultValue: "颜色" })}
          </div>
          <div className="flex items-center gap-1.5">
            {EVENT_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={option}
                onClick={() => setColor(option)}
                className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                  color === option ? "ring-2 ring-offset-1 ring-ink-ghost/50 scale-105" : ""
                }`}
                style={{ backgroundColor: option }}
              />
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-body text-ink-ghost">
            {t("agenda.course.notes", { defaultValue: "备注" })}
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            placeholder={t("agenda.course.notesPlaceholder", {
              defaultValue: "考试范围、作业要求…",
            })}
            className="px-2 py-1.5 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft placeholder:text-ink-ghost/50 focus:border-bamboo/40 outline-none resize-none leading-relaxed"
          />
        </label>

        <div className="pt-3 border-t border-paper-deep/25">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-body text-ink-faint">
              {t("agenda.course.tasks", { defaultValue: "作业与待办" })}
              {pendingTaskCount > 0 ? (
                <span className="ml-1.5 font-mono text-[9px] text-bamboo">{pendingTaskCount}</span>
              ) : null}
            </span>
            {course ? (
              <button
                type="button"
                onClick={() => setTaskOpen((value) => !value)}
                className="text-[10px] font-body text-bamboo hover:text-bamboo-light cursor-pointer"
              >
                {taskOpen
                  ? t("common.cancel", { defaultValue: "取消" })
                  : `+ ${t("agenda.course.addTask", { defaultValue: "添加" })}`}
              </button>
            ) : null}
          </div>

          {!course ? (
            <p className="mt-1.5 text-[9.5px] font-body text-ink-ghost leading-relaxed">
              {t("agenda.course.saveFirst", {
                defaultValue: "先保存课程，之后可以在这里添加作业、待办或提醒。",
              })}
            </p>
          ) : (
            <>
              {courseTasks.length === 0 ? (
                <p className="mt-1.5 text-[9.5px] font-body text-ink-ghost">
                  {t("agenda.course.noTasks", { defaultValue: "还没有作业或待办" })}
                </p>
              ) : (
                <div className="mt-1 space-y-0.5">
                  {courseTasks.map((todo) => (
                    <div
                      key={todo.id}
                      className="group flex items-start gap-1.5 px-1 py-1.5 rounded hover:bg-paper-warm/60 transition-colors"
                    >
                      <button
                        type="button"
                        aria-label={
                          todo.done
                            ? t("agenda.todo.markUndone", { defaultValue: "标记为未完成" })
                            : t("agenda.todo.markDone", { defaultValue: "标记为完成" })
                        }
                        onClick={() => onToggleTask(todo)}
                        className={`mt-0.5 w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center transition-all cursor-pointer ${
                          todo.done
                            ? "bg-bamboo border-bamboo text-cloud"
                            : "border-paper-deep hover:border-bamboo/60 bg-cloud/60"
                        }`}
                      >
                        {todo.done ? (
                          <svg
                            width="8"
                            height="8"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : null}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span
                            className={`shrink-0 px-1 rounded-sm text-[8px] font-body ${
                              todo.kind === "assignment"
                                ? "bg-bamboo-mist text-bamboo"
                                : todo.kind === "reminder"
                                  ? "bg-amber-100/70 text-amber-700"
                                  : "bg-paper-warm text-ink-faint"
                            }`}
                          >
                            {kindLabel(todo.kind)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenTask(todo)}
                            title={t("agenda.course.openTask", {
                              defaultValue: "在待办中编辑",
                            })}
                            className={`min-w-0 text-left text-[11px] font-body truncate cursor-pointer ${
                              todo.done ? "text-ink-ghost line-through" : "text-ink-soft"
                            }`}
                          >
                            {todo.title}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] font-body text-ink-ghost">
                          {taskDueLabel(todo) ? (
                            <span className="font-mono tabular-nums">{taskDueLabel(todo)}</span>
                          ) : null}
                          {todo.platform ? <span>{todo.platform}</span> : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={t("common.delete", { defaultValue: "删除" })}
                        onClick={() => onDeleteTask(todo)}
                        className="w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center rounded text-ink-ghost/40 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all cursor-pointer"
                      >
                        <svg
                          width="8"
                          height="8"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        >
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {taskOpen ? (
                <div className="mt-2 rounded-lg border border-paper-deep/50 bg-paper-warm/25 p-2 space-y-1.5">
                  <div className="flex items-center gap-1">
                    {TASK_KINDS.map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => setTaskKind(kind)}
                        className={`flex-1 h-6 rounded text-[9.5px] font-body transition-colors cursor-pointer ${
                          taskKind === kind
                            ? "bg-bamboo text-cloud"
                            : "text-ink-faint hover:bg-paper-warm"
                        }`}
                      >
                        {kindLabel(kind)}
                      </button>
                    ))}
                  </div>
                  <input
                    value={taskTitle}
                    onChange={(event) => setTaskTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleAddTask();
                      }
                    }}
                    placeholder={t("agenda.course.taskPlaceholder", {
                      defaultValue: "作业 / 待办内容",
                    })}
                    className="w-full h-7 px-2 rounded border border-ink-ghost/50 bg-cloud/70 text-[11px] font-body text-ink-soft placeholder:text-ink-ghost/50 outline-none focus:border-bamboo/40"
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="date"
                      value={taskDate}
                      onChange={(event) => setTaskDate(event.target.value)}
                      className="h-7 px-1.5 rounded border border-ink-ghost/50 bg-cloud/70 text-[10px] font-body text-ink-soft outline-none focus:border-bamboo/40"
                    />
                    <input
                      type="time"
                      value={taskTime}
                      onChange={(event) => setTaskTime(event.target.value)}
                      className="h-7 px-1.5 rounded border border-ink-ghost/50 bg-cloud/70 text-[10px] font-body text-ink-soft outline-none focus:border-bamboo/40"
                    />
                  </div>
                  {taskKind === "assignment" ? (
                    <input
                      value={taskPlatform}
                      onChange={(event) => setTaskPlatform(event.target.value)}
                      placeholder={t("agenda.course.platformPlaceholder", {
                        defaultValue: "提交平台，如学习通 / 雨课堂",
                      })}
                      className="w-full h-7 px-2 rounded border border-ink-ghost/50 bg-cloud/70 text-[10px] font-body text-ink-soft placeholder:text-ink-ghost/50 outline-none focus:border-bamboo/40"
                    />
                  ) : null}
                  <div className="flex justify-end gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setTaskOpen(false)}
                      className="h-6 px-2 rounded text-[9.5px] font-body text-ink-ghost hover:bg-paper-warm cursor-pointer"
                    >
                      {t("common.cancel", { defaultValue: "取消" })}
                    </button>
                    <button
                      type="button"
                      disabled={taskSaving}
                      onClick={() => void handleAddTask()}
                      className="h-6 px-2.5 rounded bg-bamboo text-cloud text-[9.5px] font-body hover:bg-bamboo-light disabled:opacity-50 cursor-pointer"
                    >
                      {taskSaving
                        ? t("common.saving", { defaultValue: "保存中…" })
                        : t("common.save", { defaultValue: "保存" })}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="px-4 py-2.5 border-t border-paper-deep/30 flex items-center justify-between shrink-0">
        {course ? (
          <button
            type="button"
            onClick={() => onDelete(course)}
            className="text-[11px] font-body text-ink-ghost hover:text-red-400 transition-colors cursor-pointer"
          >
            {t("common.delete", { defaultValue: "删除" })}
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 h-7 rounded-lg text-[11px] font-body text-ink-faint hover:bg-paper-warm transition-colors cursor-pointer"
          >
            {t("common.cancel", { defaultValue: "取消" })}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="px-4 h-7 rounded-lg bg-bamboo text-cloud text-[11px] font-body hover:bg-bamboo-light disabled:opacity-50 transition-colors cursor-pointer"
          >
            {saving
              ? t("common.saving", { defaultValue: "保存中…" })
              : t("common.save", { defaultValue: "保存" })}
          </button>
        </div>
      </div>
    </aside>
  );
}
