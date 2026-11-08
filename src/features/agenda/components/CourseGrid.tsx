import { useTranslation } from "react-i18next";
import { weekdayLabels } from "../dateUtils";
import { EVENT_COLORS } from "../eventUtils";
import { formatCourseTime, periodTime } from "../timetable";
import { PartnerIcon } from "./PartnerIcon";
import type { Course, CourseOverride, PartnerRelation, TimetableSettings } from "../types";

interface CourseGridProps {
  courses: Course[];
  settings: TimetableSettings;
  overrides?: CourseOverride[];
  partnerCourses?: Course[];
  partnerName?: string;
  partnerColor?: string;
  partnerRelation?: PartnerRelation;
  showPartner?: boolean;
  sharedFree?: boolean[][];
  onOpenPartner?: () => void;
  pendingByCourse: Record<string, number>;
  locale: string;
  onCreate: (weekday: number, period: number) => void;
  onEdit: (course: Course) => void;
}

const PERIODS = Array.from({ length: 12 }, (_, index) => index + 1);
const DAYS = [1, 2, 3, 4, 5, 6, 7];

export function CourseGrid({
  courses,
  settings,
  overrides = [],
  partnerCourses = [],
  partnerName = "",
  partnerColor = "#D4537E",
  partnerRelation = "partner",
  showPartner = false,
  sharedFree,
  onOpenPartner,
  pendingByCourse,
  locale,
  onCreate,
  onEdit,
}: CourseGridProps) {
  const { t } = useTranslation();
  const labels = weekdayLabels(locale);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {showPartner ? (
        <div className="shrink-0 flex items-center gap-3 px-3 py-1 border-b border-paper-deep/20 bg-paper/30">
          <span className="flex items-center gap-1 text-[9px] font-body text-ink-faint">
            <span className="w-2.5 h-2 rounded-sm bg-[#1D9E75]" />
            {t("agenda.partner.me", { defaultValue: "我" })}
          </span>
          <span className="flex items-center gap-1 text-[9px] font-body text-ink-faint">
            <PartnerIcon relation={partnerRelation} size={9} color={partnerColor} />
            {partnerName || t("agenda.partner.other", { defaultValue: "对方" })}
          </span>
          <span className="flex items-center gap-1 text-[9px] font-body text-ink-ghost">
            <span className="w-1.5 h-1.5 rounded-full bg-bamboo/60" />
            {t("agenda.partner.commonFree", { defaultValue: "共同空档" })}
          </span>
        </div>
      ) : null}
      <div className="flex-1 min-h-0 overflow-auto">
        <div
          className={`grid h-full min-w-[680px] ${showPartner ? "min-h-[830px]" : "min-h-[560px]"}`}
          style={{
            gridTemplateColumns: "40px repeat(7, minmax(0, 1fr))",
            gridTemplateRows: showPartner
              ? "28px repeat(12, minmax(66px, 1fr))"
              : "28px repeat(12, minmax(40px, 1fr))",
          }}
        >
        <div className="flex items-center justify-center text-[9px] font-body text-ink-ghost/60 border-r border-b border-paper-deep/20">
          {t("agenda.course.period", { defaultValue: "节次" })}
        </div>
        {labels.map((label) => (
          <div
            key={label}
            className="flex items-center justify-center text-[10px] font-body text-ink-ghost border-r border-b border-paper-deep/20"
          >
            {label}
          </div>
        ))}

        {PERIODS.map((period) => {
          const time = periodTime(settings, period);
          return (
            <div
              key={`period-${period}`}
              className="flex flex-col items-center justify-center gap-[1px] text-[8px] font-mono text-ink-ghost/60 border-r border-b border-paper-deep/20"
              style={{ gridColumn: 1, gridRow: period + 1 }}
            >
              <span className="text-[9px] text-ink-ghost/80">{period}</span>
              {time ? (
                <>
                  <span>{time.start}</span>
                  <span>{time.end}</span>
                </>
              ) : null}
            </div>
          );
        })}

        {DAYS.map((weekday) =>
          PERIODS.map((period) => {
            const free = showPartner && sharedFree?.[weekday - 1]?.[period - 1] === true;
            return (
              <button
                key={`cell-${weekday}-${period}`}
                type="button"
                aria-label={t("agenda.course.addAt", {
                  weekday,
                  period,
                  defaultValue: "添加课程",
                })}
                onClick={() => onCreate(weekday, period)}
                className={`group relative border-r border-b border-paper-deep/15 hover:bg-bamboo-mist/25 transition-colors cursor-pointer ${
                  free ? "bg-bamboo-mist/25" : ""
                }`}
                style={{ gridColumn: weekday + 1, gridRow: period + 1 }}
              >
                {free ? (
                  <span className="absolute bottom-1 left-1 w-1.5 h-1.5 rounded-full bg-bamboo/45" />
                ) : null}
                <span className="absolute inset-0 flex items-center justify-center text-bamboo/40 opacity-0 group-hover:opacity-100 transition-opacity text-[14px] leading-none">
                  +
                </span>
              </button>
            );
          }),
        )}

        {courses.map((course, index) => {
          const color = course.color ?? EVENT_COLORS[index % EVENT_COLORS.length];
          const span = Math.max(1, course.endPeriod - course.startPeriod + 1);
          const compact = span === 1 && !showPartner;
          const override = overrides.find((item) => item.courseId === course.id);
          const cancelled = override?.action === "cancel";
          const moved = override?.action === "move";
          const shownLocation = moved ? override?.location || course.location : course.location;
          return (
            <button
              key={course.id}
              type="button"
              onClick={() => onEdit(course)}
              title={`${course.name}${
                shownLocation ? ` · ${shownLocation}` : ""
              }${course.weeks ? ` · ${course.weeks}` : ""}${
                cancelled ? " · 本次停课" : moved ? " · 本次调课" : ""
              }${pendingByCourse[course.id] ? ` · ${pendingByCourse[course.id]} 项未完成` : ""}`}
              className={`relative z-20 self-stretch m-0.5 rounded-md px-1.5 py-1 pr-5 text-left overflow-hidden hover:brightness-95 transition-all cursor-pointer ${
                cancelled ? "opacity-45 grayscale" : ""
              }`}
              style={{
                gridColumn: course.weekday + 1,
                gridRow: `${course.startPeriod + 1} / span ${span}`,
                backgroundColor: showPartner ? `${color}30` : `${color}24`,
                borderLeft: `3px solid ${color}`,
              }}
            >
              <span className="block text-[10.5px] font-body font-medium text-ink-soft truncate leading-tight">
                {course.name}
                {cancelled ? (
                  <span className="ml-1 text-[8px] font-normal text-red-400">停课</span>
                ) : null}
                {moved ? (
                  <span className="ml-1 text-[8px] font-normal text-amber-600">调课</span>
                ) : null}
              </span>
              {!compact ? (
                <>
                  <span className="block text-[9px] font-body text-ink-faint truncate leading-tight mt-0.5">
                    {shownLocation || course.teacher || " "}
                  </span>
                  {!showPartner ? (
                    <span className="block text-[9px] font-mono text-ink-ghost/80 truncate leading-tight">
                      {moved && override?.startPeriod
                        ? `第 ${override.startPeriod}${
                            override.endPeriod && override.endPeriod !== override.startPeriod
                              ? `-${override.endPeriod}`
                              : ""
                          } 节`
                        : formatCourseTime(course, settings)}
                    </span>
                  ) : null}
                  {!showPartner && span >= 2 && course.weeks ? (
                    <span className="block text-[9px] font-body text-ink-ghost/80 truncate leading-tight">
                      {course.weeks}
                    </span>
                  ) : null}
                </>
              ) : null}
              {pendingByCourse[course.id] ? (
                <span className="absolute top-1 right-1 min-w-[12px] h-3 px-0.5 rounded-full bg-bamboo text-cloud text-[8px] font-mono flex items-center justify-center">
                  {pendingByCourse[course.id]}
                </span>
              ) : null}
              <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-ink-ghost/50">
                {course.startPeriod}
                {course.endPeriod > course.startPeriod ? `-${course.endPeriod}` : ""}
              </span>
            </button>
          );
        })}

        {showPartner
          ? partnerCourses.map((course, index) => {
              const span = Math.max(1, course.endPeriod - course.startPeriod + 1);
              const color = course.color ?? EVENT_COLORS[(index + 4) % EVENT_COLORS.length];
              return (
                <button
                  key={`partner-${course.id}`}
                  type="button"
                  onClick={onOpenPartner}
                  title={`${partnerName || t("agenda.partner.other", { defaultValue: "对方" })} · ${
                    course.name
                  }${course.location ? ` · ${course.location}` : ""}`}
                  className="relative z-10 self-stretch m-0.5 rounded-md px-1 py-0.5 text-left overflow-hidden transition-colors cursor-pointer flex flex-col justify-end"
                  style={{
                    gridColumn: course.weekday + 1,
                    gridRow: `${course.startPeriod + 1} / span ${span}`,
                    backgroundColor: `${color}14`,
                    borderLeft: `2px dashed ${color}99`,
                  }}
                >
                  <span className="flex items-center gap-1 font-body leading-tight">
                    <PartnerIcon relation={partnerRelation} size={8} color={`${color}cc`} />
                    <span className="text-[9px] text-ink-ghost truncate">{course.name}</span>
                  </span>
                  {course.location ? (
                    <span className="block mt-0.5 text-[8px] font-body text-ink-ghost/70 truncate">
                      {course.location}
                    </span>
                  ) : null}
                </button>
              );
            })
          : null}
        </div>
      </div>
    </div>
  );
}
