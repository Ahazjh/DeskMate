import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { monthGrid, parseDayKey, todayKey, weekdayLabels } from "../dateUtils";
import { eventColor, eventsForDay } from "../eventUtils";
import { courseMatchesWeek } from "../timetable";
import { PartnerIcon } from "./PartnerIcon";
import type { AgendaEvent, Course, PartnerRelation } from "../types";

interface MonthGridProps {
  cursor: Date;
  selectedDay: string;
  events: AgendaEvent[];
  courses?: Course[];
  partnerCourses?: Course[];
  partnerName?: string;
  partnerColor?: string;
  partnerRelation?: PartnerRelation;
  showPartner?: boolean;
  week?: number | null;
  locale: string;
  onSelectDay: (key: string) => void;
  onOpenEvent: (event: AgendaEvent) => void;
  onCreateEvent: (day: string) => void;
  onOpenCourse?: (course: Course) => void;
  onOpenPartner?: () => void;
}

const MAX_EVENT_CHIPS = 2;
const MAX_COURSE_CHIPS = 2;

export function MonthGrid({
  cursor,
  selectedDay,
  events,
  courses = [],
  partnerCourses = [],
  partnerName = "",
  partnerColor = "#7F77DD",
  partnerRelation = "partner",
  showPartner = false,
  week = null,
  locale,
  onSelectDay,
  onOpenEvent,
  onCreateEvent,
  onOpenCourse,
  onOpenPartner,
}: MonthGridProps) {
  const { t } = useTranslation();
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const days = useMemo(() => monthGrid(year, month), [year, month]);
  const labels = useMemo(() => weekdayLabels(locale), [locale]);
  const today = todayKey();

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="grid grid-cols-7 shrink-0 border-b border-paper-deep/30">
        {labels.map((label) => (
          <div
            key={label}
            className="h-8 flex items-center justify-center text-[10px] font-body text-ink-ghost/70"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-7 grid-rows-6">
        {days.map((key) => {
          const date = parseDayKey(key);
          const inMonth = date.getMonth() === month;
          const isToday = key === today;
          const isSelected = key === selectedDay;
          const dayEvents = eventsForDay(events, key);
          const weekday = ((date.getDay() + 6) % 7) + 1;
          const matchesWeek = (course: Course) =>
            week === null || week <= 0 || courseMatchesWeek(course.weeks, week);
          const dayCourses = courses.filter(
            (course) => course.weekday === weekday && matchesWeek(course),
          );
          const dayPartnerCourses = partnerCourses.filter(
            (course) => course.weekday === weekday && matchesWeek(course),
          );

          return (
            <div
              key={key}
              onClick={() => onSelectDay(key)}
              className={`group relative text-left border-r border-b border-paper-deep/20 p-1.5 min-h-0 overflow-hidden transition-colors cursor-pointer ${
                isSelected ? "bg-bamboo-mist/30" : "hover:bg-paper-warm/40"
              } ${inMonth ? "" : "bg-paper/20"}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-mono tabular-nums ${
                    isToday
                      ? "bg-bamboo text-cloud"
                      : inMonth
                        ? "text-ink-soft"
                        : "text-ink-ghost/40"
                  }`}
                >
                  {date.getDate()}
                </span>
                <span className="flex items-center gap-1">
                  {dayEvents.length > 0 ? (
                    <span className="text-[9px] font-mono text-ink-ghost/50">
                      {dayEvents.length}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label={t("agenda.calendar.newEvent", { defaultValue: "新建日程" })}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      onCreateEvent(key);
                    }}
                    className="w-4 h-4 flex items-center justify-center rounded text-ink-ghost opacity-0 group-hover:opacity-100 hover:bg-bamboo-mist hover:text-bamboo transition-all cursor-pointer"
                  >
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </span>
              </div>

              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, MAX_EVENT_CHIPS).map((event, index) => {
                  const color = eventColor(event, index);
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onOpenEvent(event);
                      }}
                      className="flex items-center gap-1 w-full px-1 py-0.5 rounded-sm text-[10px] font-body text-ink-soft truncate hover:brightness-95 transition-all cursor-pointer"
                      style={{ backgroundColor: `${color}1f`, borderLeft: `2px solid ${color}` }}
                      title={event.title}
                    >
                      {!event.allDay ? (
                        <span className="text-ink-ghost/80 font-mono text-[9px] shrink-0">
                          {new Date(event.startAt).toLocaleTimeString(locale, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : null}
                      <span className="truncate">{event.title}</span>
                    </button>
                  );
                })}
                {dayCourses.slice(0, MAX_COURSE_CHIPS).map((course) => (
                  <button
                    key={`course-${course.id}`}
                    type="button"
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      onOpenCourse?.(course);
                    }}
                    className="flex items-center gap-1 w-full px-1 py-0.5 rounded-sm text-[10px] font-body text-ink-soft truncate bg-bamboo-mist/60 hover:brightness-95 transition-all cursor-pointer"
                    style={{ borderLeft: "2px solid #1D9E75" }}
                    title={`${course.name} · 第${course.startPeriod}-${course.endPeriod}节`}
                  >
                    <span className="text-[8px] text-bamboo shrink-0">课</span>
                    <span className="truncate">{course.name}</span>
                  </button>
                ))}
                {showPartner
                  ? dayPartnerCourses.slice(0, 1).map((course) => (
                      <button
                        key={`partner-${course.id}`}
                        type="button"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          onOpenPartner?.();
                        }}
                        className="flex items-center gap-1 w-full px-1 py-0.5 rounded-sm text-[10px] font-body text-ink-faint truncate hover:brightness-95 transition-all cursor-pointer"
                        style={{
                          borderLeft: `2px solid ${partnerColor}`,
                          backgroundColor: `${partnerColor}1a`,
                        }}
                        title={`${partnerName || "对方"} · ${course.name}`}
                      >
                        <PartnerIcon relation={partnerRelation} size={8} color={partnerColor} />
                        <span className="truncate">
                          {partnerName ? `${partnerName} · ` : ""}
                          {course.name}
                        </span>
                      </button>
                    ))
                  : null}
                {dayEvents.length + dayCourses.length > MAX_EVENT_CHIPS + MAX_COURSE_CHIPS ? (
                  <span className="block px-1 text-[9px] font-body text-ink-ghost">
                    {t("agenda.calendar.more", {
                      count:
                        dayEvents.length +
                        dayCourses.length -
                        MAX_EVENT_CHIPS -
                        MAX_COURSE_CHIPS,
                      defaultValue: "+{{count}} 项",
                    })}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
