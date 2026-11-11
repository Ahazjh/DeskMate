import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { weekdayLabels } from "../dateUtils";
import { resolvePeriodTimes } from "../timetable";
import type { Course, TimetableSettings } from "../types";

interface TimetablePrintViewProps {
  courses: Course[];
  settings: TimetableSettings;
  locale: string;
  onClose: () => void;
}

const DAYS = [1, 2, 3, 4, 5, 6, 7];

export function TimetablePrintView({
  courses,
  settings,
  locale,
  onClose,
}: TimetablePrintViewProps) {
  const { t } = useTranslation();
  const labels = weekdayLabels(locale);
  // 节数随「课程表设置」变化
  const periodList = useMemo(
    () => resolvePeriodTimes(settings).map((item) => item.period),
    [settings],
  );
  const timeByPeriod = useMemo(
    () => new Map(resolvePeriodTimes(settings).map((item) => [item.period, item])),
    [settings],
  );

  return (
    <div
      className="fixed inset-0 z-[80] bg-ink/30 backdrop-blur-[1px] overflow-y-auto p-6"
      onMouseDown={onClose}
    >
      <style>{`@media print {
        body * { visibility: hidden; }
        .timetable-print, .timetable-print * { visibility: visible; }
        .timetable-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border-radius: 0; padding: 0; }
        .timetable-print .no-print { display: none !important; }
        @page { size: A4 landscape; margin: 10mm; }
      }`}</style>

      <div
        className="timetable-print mx-auto max-w-[980px] bg-white text-black rounded-xl shadow-2xl p-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-end justify-between mb-3">
          <div>
            <h1 className="text-[18px] font-medium m-0">{t("agenda.print.title", { defaultValue: "课程表" })}</h1>
            <p className="text-[11px] text-black/50 mt-0.5 m-0">
              {t("agenda.print.hint", { defaultValue: "DeskMate · 本地离线生成，可直接打印或另存为 PDF" })}
            </p>
          </div>
          <span className="text-[10px] text-black/40">
            {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date())}
          </span>
        </div>

        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th className="w-[52px] border border-black/15 bg-black/[0.04] py-1 font-medium">
                {t("agenda.course.period", { defaultValue: "节次" })}
              </th>
              {labels.map((label) => (
                <th key={label} className="border border-black/15 bg-black/[0.04] py-1 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periodList.map((period) => {
              const time = timeByPeriod.get(period);
              return (
                <tr key={period}>
                  <th className="border border-black/15 py-1 font-normal text-[9px] text-black/60">
                    <div>{period}</div>
                    {time ? <div className="text-[8px] text-black/40">{time.start}</div> : null}
                  </th>
                  {DAYS.map((day) => {
                    const cell = courses.filter(
                      (course) =>
                        course.weekday === day &&
                        course.startPeriod <= period &&
                        course.endPeriod >= period,
                    );
                    return (
                      <td
                        key={`${day}-${period}`}
                        className="border border-black/15 align-top px-1 py-1 h-[38px]"
                      >
                        {cell.map((course) => (
                          <div key={course.id} className="leading-tight">
                            <div className="text-[9.5px] font-medium truncate">{course.name}</div>
                            {period === course.startPeriod ? (
                              <div className="text-[8px] text-black/50 truncate">
                                {[course.location, course.weeks].filter(Boolean).join(" · ")}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="no-print mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-7 px-3 rounded-lg text-[11px] font-body text-black/50 hover:bg-black/5 cursor-pointer"
          >
            {t("common.close", { defaultValue: "关闭" })}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-7 px-4 rounded-lg bg-[#1a1a18] text-white text-[11px] font-body hover:bg-black cursor-pointer"
          >
            {t("agenda.print.print", { defaultValue: "打印 / 另存为 PDF" })}
          </button>
        </div>
      </div>
    </div>
  );
}
