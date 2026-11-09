import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatDayHeading, isoTime } from "../dateUtils";
import { eventColor, eventsForDay } from "../eventUtils";
import { formatCourseTime, courseMatchesWeek } from "../timetable";
import type {
  AgendaEvent,
  Course,
  CourseOverride,
  TimetableSettings,
  Todo,
} from "../types";

interface DayAgendaPanelProps {
  day: string;
  events: AgendaEvent[];
  courses: Course[];
  todos: Todo[];
  overrides: CourseOverride[];
  timetableSettings: TimetableSettings;
  week: number | null;
  locale: string;
  onClose: () => void;
  onOpenEvent: (event: AgendaEvent) => void;
  onOpenCourse: (course: Course) => void;
  onOpenTodo: (todo: Todo) => void;
  onCreateEvent: (day: string) => void;
  onCreateTodo: (day: string) => void;
}

/**
 * 当日日程面板：点某一天后弹出，列出这一天的全部日程、课程与待办。
 * 所有条目都可以点开编辑，也可以直接新建。
 */
export function DayAgendaPanel({
  day,
  events,
  courses,
  todos,
  overrides,
  timetableSettings,
  week,
  locale,
  onClose,
  onOpenEvent,
  onOpenCourse,
  onOpenTodo,
  onCreateEvent,
  onCreateTodo,
}: DayAgendaPanelProps) {
  const { t } = useTranslation();

  const dayEvents = useMemo(() => eventsForDay(events, day), [events, day]);

  const dayCourses = useMemo(() => {
    const weekday = ((new Date(`${day}T00:00:00`).getDay() + 6) % 7) + 1;
    const overrideByCourse = new Map<string, CourseOverride>();
    for (const override of overrides) {
      if (override.date === day) overrideByCourse.set(override.courseId, override);
    }

    return courses
      .filter((course) => {
        if (course.weekday !== weekday) return false;
        if (week !== null && week > 0 && !courseMatchesWeek(course.weeks, week)) {
          return false;
        }
        const override = overrideByCourse.get(course.id);
        if (override?.action === "cancel") return false;
        return true;
      })
      .map((course) => {
        const override = overrideByCourse.get(course.id);
        const moved = override?.action === "move";
        return {
          course,
          startPeriod: moved && override?.startPeriod ? override.startPeriod : course.startPeriod,
          endPeriod: moved && override?.endPeriod ? override.endPeriod : course.endPeriod,
          location:
            moved && override?.location ? override.location : course.location,
        };
      })
      .sort((left, right) => left.startPeriod - right.startPeriod);
  }, [courses, day, overrides, week]);

  const dayTodos = useMemo(
    () =>
      todos
        .filter((todo) => {
          const key = todo.dueAt ? todo.dueAt.slice(0, 10) : todo.dueDate;
          return key === day;
        })
        .sort((left, right) => {
          const leftTime = left.dueAt ? isoTime(left.dueAt) : "99:99";
          const rightTime = right.dueAt ? isoTime(right.dueAt) : "99:99";
          if (leftTime !== rightTime) return leftTime.localeCompare(rightTime);
          return right.priority - left.priority;
        }),
    [todos, day],
  );

  const isEmpty =
    dayEvents.length === 0 && dayCourses.length === 0 && dayTodos.length === 0;

  return (
    <aside className="w-[320px] shrink-0 flex flex-col border-l border-paper-deep/30 bg-cloud min-h-0">
      <div className="h-10 px-4 flex items-center justify-between border-b border-paper-deep/30 shrink-0">
        <span className="text-[12px] font-body font-medium text-ink-soft truncate">
          {formatDayHeading(day, locale)}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close", { defaultValue: "关闭" })}
          className="w-6 h-6 flex items-center justify-center rounded text-ink-ghost hover:text-ink-soft hover:bg-paper-warm cursor-pointer shrink-0"
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

      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-3">
        {/* 日程 */}
        <section>
          <div className="flex items-center justify-between pb-1">
            <span className="text-[10px] font-body text-ink-ghost">
              {t("agenda.widget.tabSchedule", { defaultValue: "日程" })}
            </span>
            <button
              type="button"
              onClick={() => onCreateEvent(day)}
              className="text-[10px] font-body text-bamboo hover:underline cursor-pointer"
            >
              {t("agenda.dayPanel.add", { defaultValue: "+ 添加" })}
            </button>
          </div>
          {dayEvents.length === 0 ? (
            <div className="text-[10.5px] font-body text-ink-ghost/70 py-1">
              {t("agenda.dayPanel.emptyEvent", { defaultValue: "这天没有日程" })}
            </div>
          ) : (
            <div className="space-y-0.5">
              {dayEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onOpenEvent(event)}
                  className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-paper-warm/70 transition-colors text-left cursor-pointer"
                >
                  <span
                    className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: eventColor(event) }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12px] font-body text-ink-soft truncate">
                      {event.title}
                    </span>
                    <span className="block text-[9.5px] font-mono text-ink-ghost">
                      {event.allDay
                        ? t("agenda.widget.allDay", { defaultValue: "全天" })
                        : `${isoTime(event.startAt)}–${isoTime(event.endAt)}`}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 课程 */}
        {dayCourses.length > 0 ? (
          <section>
            <div className="flex items-center justify-between pb-1">
              <span className="text-[10px] font-body text-ink-ghost">
                {t("agenda.widget.typeCourse", { defaultValue: "课程" })}
              </span>
            </div>
            <div className="space-y-0.5">
              {dayCourses.map((item) => (
                <button
                  key={item.course.id}
                  type="button"
                  onClick={() => onOpenCourse(item.course)}
                  className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-paper-warm/70 transition-colors text-left cursor-pointer"
                >
                  <span
                    className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.course.color ?? "#639922" }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12px] font-body text-ink-soft truncate">
                      {item.course.name}
                    </span>
                    <span className="block text-[9.5px] font-mono text-ink-ghost truncate">
                      {formatCourseTime(
                        {
                          ...item.course,
                          startPeriod: item.startPeriod,
                          endPeriod: item.endPeriod,
                        },
                        timetableSettings,
                      )}
                      {item.location ? ` · ${item.location}` : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* 待办 */}
        <section>
          <div className="flex items-center justify-between pb-1">
            <span className="text-[10px] font-body text-ink-ghost">
              {t("agenda.widget.tabTodos", { defaultValue: "待办" })}
            </span>
            <button
              type="button"
              onClick={() => onCreateTodo(day)}
              className="text-[10px] font-body text-bamboo hover:underline cursor-pointer"
            >
              {t("agenda.dayPanel.add", { defaultValue: "+ 添加" })}
            </button>
          </div>
          {dayTodos.length === 0 ? (
            <div className="text-[10.5px] font-body text-ink-ghost/70 py-1">
              {t("agenda.dayPanel.emptyTodo", { defaultValue: "这天没有待办" })}
            </div>
          ) : (
            <div className="space-y-0.5">
              {dayTodos.map((todo) => (
                <button
                  key={todo.id}
                  type="button"
                  onClick={() => onOpenTodo(todo)}
                  className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-paper-warm/70 transition-colors text-left cursor-pointer"
                >
                  <span
                    className={`mt-1 w-2.5 h-2.5 rounded border shrink-0 flex items-center justify-center ${
                      todo.done ? "bg-bamboo border-bamboo" : "border-paper-deep"
                    }`}
                    aria-hidden="true"
                  >
                    {todo.done ? (
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span
                      className={`block text-[12px] font-body truncate ${
                        todo.done ? "text-ink-ghost line-through" : "text-ink-soft"
                      }`}
                    >
                      {todo.title}
                    </span>
                    {todo.dueAt ? (
                      <span className="block text-[9.5px] font-mono text-ink-ghost">
                        {isoTime(todo.dueAt)}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {isEmpty ? (
          <div className="pt-2 text-center text-[10.5px] font-body text-ink-ghost/70">
            {t("agenda.dayPanel.emptyAll", { defaultValue: "这天还没有任何安排" })}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
