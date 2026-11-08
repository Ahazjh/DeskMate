import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  addMonths,
  formatMonthTitle,
  monthGrid,
  parseDayKey,
  todayKey,
  weekdayLabels,
} from "../dateUtils";
import { eventsForDay } from "../eventUtils";
import type { AgendaEvent } from "../types";

interface MiniMonthProps {
  cursor: Date;
  selectedDay: string;
  events: AgendaEvent[];
  locale: string;
  onSelectDay: (key: string) => void;
  onCursorChange: (next: Date) => void;
}

export function MiniMonth({
  cursor,
  selectedDay,
  events,
  locale,
  onSelectDay,
  onCursorChange,
}: MiniMonthProps) {
  const { t } = useTranslation();
  const days = useMemo(
    () => monthGrid(cursor.getFullYear(), cursor.getMonth()),
    [cursor.getFullYear(), cursor.getMonth()],
  );
  const labels = useMemo(() => weekdayLabels(locale), [locale]);
  const today = todayKey();

  return (
    <div className="px-3 pt-2 pb-3">
      <div className="flex items-center justify-between px-1 pb-1.5">
        <span className="text-[11px] font-body font-medium text-ink-soft">
          {formatMonthTitle(cursor, locale)}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label={t("agenda.calendar.prev", { defaultValue: "上个月" })}
            onClick={() => onCursorChange(addMonths(cursor, -1))}
            className="w-5 h-5 flex items-center justify-center rounded text-ink-ghost hover:bg-paper-warm hover:text-ink-soft transition-colors cursor-pointer"
          >
            <svg
              width="10"
              height="10"
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
            aria-label={t("agenda.calendar.next", { defaultValue: "下个月" })}
            onClick={() => onCursorChange(addMonths(cursor, 1))}
            className="w-5 h-5 flex items-center justify-center rounded text-ink-ghost hover:bg-paper-warm hover:text-ink-soft transition-colors cursor-pointer"
          >
            <svg
              width="10"
              height="10"
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
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {labels.map((label) => (
          <div
            key={label}
            className="h-5 flex items-center justify-center text-[9px] font-body text-ink-ghost/70"
          >
            {label}
          </div>
        ))}
        {days.map((key) => {
          const date = parseDayKey(key);
          const inMonth = date.getMonth() === cursor.getMonth();
          const isToday = key === today;
          const isSelected = key === selectedDay;
          const hasEvent = eventsForDay(events, key).length > 0;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
              className={`relative h-6 flex items-center justify-center rounded text-[10px] font-body tabular-nums transition-colors cursor-pointer ${
                isSelected
                  ? "bg-bamboo text-cloud"
                  : isToday
                    ? "text-bamboo font-medium hover:bg-bamboo-mist/60"
                    : inMonth
                      ? "text-ink-soft hover:bg-paper-warm"
                      : "text-ink-ghost/40 hover:bg-paper-warm/60"
              }`}
            >
              {date.getDate()}
              {hasEvent && !isSelected ? (
                <span className="absolute bottom-0.5 w-0.5 h-0.5 rounded-full bg-bamboo/70" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
