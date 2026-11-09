import { useTranslation } from "react-i18next";
import { formatCourseTime } from "../timetable";
import type { TimetableSettings } from "../types";
import type { WeekCourseEntry } from "../weekCourses";

interface WeekCourseRowProps {
  entry: WeekCourseEntry;
  settings: TimetableSettings;
  onOpen: (entry: WeekCourseEntry) => void;
}

/** 周待办列表里的课程条目：只读展示，点击可打开课程抽屉编辑。 */
export function WeekCourseRow({ entry, settings, onOpen }: WeekCourseRowProps) {
  const { t } = useTranslation();
  const { course, location, startPeriod, endPeriod, cancelled } = entry;
  const timeRange = formatCourseTime(
    { ...course, startPeriod, endPeriod },
    settings,
  );

  return (
    <div
      className={`group flex items-start gap-2.5 px-3 py-2 rounded-xl hover:bg-paper-warm/60 transition-colors cursor-pointer ${
        cancelled ? "opacity-50" : ""
      }`}
      onClick={() => onOpen(entry)}
    >
      <span
        className="mt-1 w-1 h-1 rounded-full shrink-0"
        style={{ backgroundColor: course.color ?? "#639922" }}
        aria-hidden="true"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[12.5px] font-body leading-snug truncate ${
              cancelled
                ? "text-ink-ghost line-through"
                : "text-ink-soft"
            }`}
          >
            {course.name}
          </span>
          <span className="shrink-0 px-1 rounded-sm bg-bamboo-mist/70 text-bamboo/80 text-[9px]">
            {t("agenda.week.courseTag", { defaultValue: "课" })}
          </span>
          {cancelled ? (
            <span className="shrink-0 px-1 rounded-sm bg-danger-bg text-red-400 text-[9px]">
              {t("agenda.course.cancelledTag", { defaultValue: "停课" })}
            </span>
          ) : null}
        </div>

        <div className="mt-0.5 flex items-center gap-2 text-[10px] font-body min-w-0">
          <span className="shrink-0 font-mono tabular-nums text-ink-ghost">
            {t("agenda.course.periodShort", {
              period: startPeriod,
              defaultValue: "第{{period}}节",
            })}
            {endPeriod !== startPeriod
              ? `-${t("agenda.course.periodShort", {
                  period: endPeriod,
                  defaultValue: "第{{period}}节",
                }).replace("第", "")}`
              : ""}
          </span>
          {timeRange ? (
            <span className="shrink-0 font-mono tabular-nums text-ink-ghost/80">
              {timeRange}
            </span>
          ) : null}
          {location ? (
            <span className="shrink-0 text-ink-ghost truncate">{location}</span>
          ) : null}
          {course.teacher ? (
            <span className="shrink-0 text-ink-ghost/80">{course.teacher}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
