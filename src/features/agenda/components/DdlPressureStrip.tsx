import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ddlPressure } from "../ddlPressure";
import { parseDayKey } from "../dateUtils";
import type { Todo } from "../types";

interface DdlPressureStripProps {
  todos: Todo[];
  today: string;
  locale: string;
  compact?: boolean;
}

function barColor(count: number, high: number): string {
  if (count >= 4) return "bg-red-400";
  if (count >= 3) return "bg-amber-400";
  if (high > 0) return "bg-amber-300";
  return "bg-bamboo/70";
}

export function DdlPressureStrip({ todos, today, locale, compact = false }: DdlPressureStripProps) {
  const { t } = useTranslation();
  const pressure = useMemo(() => ddlPressure(todos, today, 14), [todos, today]);
  const max = Math.max(1, ...pressure.days.map((day) => day.count));

  const peakLabel = pressure.peak
    ? `${new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric" }).format(
        parseDayKey(pressure.peak.date),
      )} · ${t("agenda.pressure.peakCount", {
        count: pressure.peak.count,
        defaultValue: "{{count}} 项",
      })}`
    : "";

  return (
    <div
      className={`rounded-lg border border-paper-deep/40 bg-paper/40 ${
        compact ? "px-2 py-1.5" : "px-3 py-2"
      }`}
    >
      {!compact ? (
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[11.5px] font-body text-ink-faint">
            {t("agenda.pressure.title", { defaultValue: "未来 14 天 DDL" })}
            <span className="ml-1.5 font-mono text-ink-ghost">{pressure.total}</span>
          </span>
          <span className="text-[10.5px] font-body text-ink-ghost truncate">
            {pressure.overdueCount > 0 ? (
              <span className="text-red-400 mr-1.5">
                {t("agenda.pressure.overdue", {
                  count: pressure.overdueCount,
                  defaultValue: "{{count}} 项逾期",
                })}
              </span>
            ) : null}
            {pressure.peak
              ? t("agenda.pressure.peak", {
                  day: peakLabel,
                  defaultValue: "峰值 {{day}}",
                })
              : t("agenda.pressure.clear", { defaultValue: "暂无临期 DDL" })}
          </span>
        </div>
      ) : null}

      <div className={`flex items-end gap-[2px] ${compact ? "h-6" : "h-8"}`}>
        {pressure.days.map((day) => {
          const height = day.count === 0 ? 0 : Math.max(8, Math.round((day.count / max) * 100));
          return (
            <div
              key={day.date}
              title={`${day.date} · ${day.count}`}
              className="flex-1 flex flex-col justify-end h-full"
            >
              <div
                className={`w-full rounded-sm ${
                  day.count === 0 ? "bg-paper-deep/50" : barColor(day.count, day.high)
                }`}
                style={{ height: day.count === 0 ? "2px" : `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      {!compact ? (
        <div className="mt-1 flex justify-between text-[9.5px] font-mono text-ink-ghost/70">
          <span>{today.slice(5)}</span>
          <span>{pressure.days[pressure.days.length - 1]?.date.slice(5)}</span>
        </div>
      ) : null}
    </div>
  );
}
