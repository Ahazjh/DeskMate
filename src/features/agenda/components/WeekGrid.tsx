import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { parseDayKey, todayKey, weekKeys } from "../dateUtils";
import { allDayEventsForDay, eventColor, layoutDayEvents } from "../eventUtils";
import type { AgendaEvent } from "../types";

interface WeekGridProps {
  weekStart: string;
  events: AgendaEvent[];
  locale: string;
  selectedDay: string;
  onSelectDay: (key: string) => void;
  onOpenEvent: (event: AgendaEvent) => void;
  onCreateEvent: (day: string, minutes: number) => void;
}

const HOUR_HEIGHT = 48;
const HOURS = Array.from({ length: 24 }, (_, index) => index);

export function WeekGrid({
  weekStart,
  events,
  locale,
  selectedDay,
  onSelectDay,
  onOpenEvent,
  onCreateEvent,
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

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex shrink-0 border-b border-paper-deep/30">
        <div className="w-12 shrink-0" />
        {days.map((key) => {
          const date = parseDayKey(key);
          const isToday = key === today;
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
            const layout = layoutDayEvents(events, key);
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

                {layout.map((item) => {
                  const color = eventColor(item.event);
                  const width = 100 / item.lanes;
                  return (
                    <button
                      key={item.event.id}
                      type="button"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onOpenEvent(item.event);
                      }}
                      className="absolute rounded px-1 py-0.5 text-left overflow-hidden text-[10px] font-body leading-tight text-ink-soft hover:brightness-95 transition-all cursor-pointer"
                      style={{
                        top: `${item.top}%`,
                        height: `${item.height}%`,
                        left: `calc(${item.lane * width}% + 1px)`,
                        width: `calc(${width}% - 2px)`,
                        backgroundColor: `${color}26`,
                        borderLeft: `2px solid ${color}`,
                      }}
                      title={item.event.title}
                    >
                      <span className="block truncate font-medium">{item.event.title}</span>
                      <span className="block truncate text-[9px] text-ink-ghost">
                        {new Date(item.event.startAt).toLocaleTimeString(locale, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
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
