import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { parseDayKey, todayKey, weekKeys } from "../dateUtils";
import { allDayEventsForDay, eventColor, timedEventsForDay } from "../eventUtils";
import type { AgendaEvent, Course } from "../types";
import type { WeekCourseBlock } from "../weekCourseBlocks";

interface WeekGridProps {
  weekStart: string;
  events: AgendaEvent[];
  /** 周视图里同时显示的课程块（已按周次与调课例外展开） */
  courseBlocks?: WeekCourseBlock[];
  locale: string;
  selectedDay: string;
  onSelectDay: (key: string) => void;
  onOpenEvent: (event: AgendaEvent) => void;
  onCreateEvent: (day: string, minutes: number) => void;
  onOpenCourse?: (course: Course) => void;
}

const HOUR_HEIGHT = 48;
const HOURS = Array.from({ length: 24 }, (_, index) => index);

/** 时间轴上的一块内容（日程或课程），统一参与 lane 分配 */
interface TimelineItem {
  id: string;
  kind: "event" | "course";
  title: string;
  subtitle: string;
  color: string;
  startMinutes: number;
  endMinutes: number;
  cancelled: boolean;
  event?: AgendaEvent;
  course?: Course;
}

/**
 * 课程与日程放在同一条时间轴上，重叠时各自占一列，
 * 避免课程被日程盖住（反之亦然）。
 */
function layoutTimelineItems(items: TimelineItem[]): {
  item: TimelineItem;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}[] {
  const positioned = items
    .map((item) => ({
      item,
      start: Math.max(0, Math.min(item.startMinutes, 24 * 60)),
      end: Math.max(0, Math.min(item.endMinutes, 24 * 60)),
    }))
    .map((entry) => ({
      item: entry.item,
      top: (entry.start / 1440) * 100,
      height: Math.max(((entry.end - entry.start) / 1440) * 100, 1.2),
    }))
    .sort((left, right) => left.top - right.top || right.height - left.height);

  const laneEnds: number[] = [];
  const laidOut = positioned.map((entry) => {
    let lane = laneEnds.findIndex((end) => end <= entry.top);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = entry.top + entry.height;
    return { ...entry, lane };
  });

  const lanes = Math.max(laneEnds.length, 1);
  return laidOut.map((entry) => ({ ...entry, lanes }));
}

export function WeekGrid({
  weekStart,
  events,
  courseBlocks = [],
  locale,
  selectedDay,
  onSelectDay,
  onOpenEvent,
  onCreateEvent,
  onOpenCourse,
}: WeekGridProps) {
  const { t } = useTranslation();
  const days = useMemo(() => weekKeys(weekStart), [weekStart]);
  const today = todayKey();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * HOUR_HEIGHT;
    }
  }, [weekStart]);

  const blocksByDay = useMemo(() => {
    const map = new Map<string, WeekCourseBlock[]>();
    for (const block of courseBlocks) {
      const list = map.get(block.day);
      if (list) list.push(block);
      else map.set(block.day, [block]);
    }
    return map;
  }, [courseBlocks]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex shrink-0 border-b border-paper-deep/30">
        <div className="w-12 shrink-0" />
        {days.map((key) => {
          const date = parseDayKey(key);
          const isToday = key === today;
          const dayCourseCount = blocksByDay.get(key)?.length ?? 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
              className={`flex-1 min-w-0 py-1.5 border-l border-paper-deep/20 text-center transition-colors cursor-pointer ${
                key === selectedDay ? "bg-bamboo-mist/30" : "hover:bg-paper-warm/40"
              }`}
            >
              <div className="text-[9px] font-body text-ink-ghost/70">
                {new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date)}
              </div>
              <div
                className={`mx-auto mt-0.5 w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-mono tabular-nums ${
                  isToday ? "bg-bamboo text-cloud" : "text-ink-soft"
                }`}
              >
                {date.getDate()}
              </div>
              {dayCourseCount > 0 ? (
                <div className="mt-0.5 text-[8.5px] font-mono text-bamboo/80">
                  {t("agenda.week.courseCount", {
                    count: dayCourseCount,
                    defaultValue: "{{count}} 节课",
                  })}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex shrink-0 border-b border-paper-deep/30 min-h-[30px]">
        <div className="w-12 shrink-0 flex items-center justify-end pr-1.5 text-[9px] font-body text-ink-ghost/70">
          {t("agenda.calendar.allDay", { defaultValue: "全天" })}
        </div>
        {days.map((key) => (
          <div key={key} className="flex-1 min-w-0 border-l border-paper-deep/20 p-0.5 space-y-0.5">
            {allDayEventsForDay(events, key).map((event, index) => {
              const color = eventColor(event, index);
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onOpenEvent(event)}
                  className="w-full text-left px-1 py-0.5 rounded-sm text-[10px] font-body text-ink-soft truncate cursor-pointer"
                  style={{ backgroundColor: `${color}22`, borderLeft: `2px solid ${color}` }}
                  title={event.title}
                >
                  {event.title}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="flex relative" style={{ height: HOURS.length * HOUR_HEIGHT }}>
          <div className="w-12 shrink-0 relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute right-1.5 -translate-y-1/2 text-[9px] font-mono text-ink-ghost/60"
                style={{ top: hour * HOUR_HEIGHT }}
              >
                {hour === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>

          {days.map((key) => {
            const dayCourseBlocks = blocksByDay.get(key) ?? [];

            const timelineItems: TimelineItem[] = [
              ...timedEventsForDay(events, key).map((event) => {
                const color = eventColor(event);
                return {
                  id: `event-${event.id}`,
                  kind: "event" as const,
                  title: event.title,
                  subtitle: new Date(event.startAt).toLocaleTimeString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  color,
                  startMinutes:
                    (new Date(event.startAt).getTime() -
                      parseDayKey(key).getTime()) /
                    60000,
                  endMinutes:
                    (new Date(event.endAt).getTime() -
                      parseDayKey(key).getTime()) /
                    60000,
                  cancelled: false,
                  event,
                };
              }),
              ...dayCourseBlocks.map((block) => ({
                id: `course-${block.key}`,
                kind: "course" as const,
                title: block.course.name,
                subtitle: [
                  t("agenda.course.periodShort", {
                    period: block.startPeriod,
                    defaultValue: "第{{period}}节",
                  }),
                  block.location,
                ]
                  .filter(Boolean)
                  .join(" · "),
                color: block.course.color ?? "#639922",
                startMinutes: block.startMinutes,
                endMinutes: block.endMinutes,
                cancelled: block.cancelled,
                course: block.course,
              })),
            ];

            const layout = layoutTimelineItems(timelineItems);

            return (
              <div
                key={key}
                className={`flex-1 min-w-0 relative border-l border-paper-deep/20 ${
                  key === selectedDay ? "bg-bamboo-mist/10" : ""
                }`}
                onClick={(clickEvent) => {
                  if ((clickEvent.target as HTMLElement).closest("button")) return;
                  const rect = clickEvent.currentTarget.getBoundingClientRect();
                  const ratio = (clickEvent.clientY - rect.top) / rect.height;
                  const minutes = Math.min(
                    23 * 60 + 30,
                    Math.max(0, Math.round((ratio * 1440) / 30) * 30),
                  );
                  onCreateEvent(key, minutes);
                }}
              >
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute inset-x-0 border-t border-paper-deep/15"
                    style={{ top: hour * HOUR_HEIGHT }}
                  />
                ))}

                {layout.map((entry) => {
                  const width = 100 / entry.lanes;
                  const isCourse = entry.item.kind === "course";
                  return (
                    <button
                      key={entry.item.id}
                      type="button"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        if (isCourse && entry.item.course) {
                          onOpenCourse?.(entry.item.course);
                          return;
                        }
                        if (entry.item.event) {
                          onOpenEvent(entry.item.event);
                        }
                      }}
                      className={`absolute rounded px-1 py-0.5 text-left overflow-hidden text-[10px] font-body leading-tight transition-all cursor-pointer ${
                        isCourse
                          ? "text-ink-soft border-l-2 border-dashed"
                          : "text-ink-soft border-l-2 border-solid hover:brightness-95"
                      } ${entry.item.cancelled ? "opacity-50" : ""}`}
                      style={{
                        top: `${entry.top}%`,
                        height: `${entry.height}%`,
                        left: `calc(${entry.lane * width}% + 1px)`,
                        width: `calc(${width}% - 2px)`,
                        backgroundColor: isCourse
                          ? `${entry.item.color}1f`
                          : `${entry.item.color}26`,
                        borderLeftColor: entry.item.color,
                        borderLeftStyle: isCourse ? "dashed" : "solid",
                      }}
                      title={`${entry.item.title}${
                        entry.item.subtitle ? ` · ${entry.item.subtitle}` : ""
                      }`}
                    >
                      <span
                        className={`block truncate font-medium ${
                          entry.item.cancelled ? "line-through" : ""
                        }`}
                      >
                        {isCourse ? (
                          <span className="text-[8px] text-bamboo mr-0.5 align-middle">
                            {t("agenda.week.courseTag", { defaultValue: "课" })}
                          </span>
                        ) : null}
                        {entry.item.title}
                      </span>
                      <span className="block truncate text-[9px] text-ink-ghost">
                        {entry.item.subtitle}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
