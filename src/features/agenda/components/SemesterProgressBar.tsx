import { useTranslation } from "react-i18next";
import { semesterProgress } from "../semesterProgress";

interface SemesterProgressBarProps {
  semesterStart: string | null;
  weeks: string[];
  today: string;
}

export function SemesterProgressBar({ semesterStart, weeks, today }: SemesterProgressBarProps) {
  const { t } = useTranslation();
  const progress = semesterProgress(semesterStart, weeks, today);
  if (progress.currentWeek === null || progress.currentWeek <= 0) return null;

  return (
    <div className="flex items-center gap-2 min-w-[150px]" title={t("agenda.progress.hint", { defaultValue: "按学期开始日期与课程周次推算" })}>
      <span className="text-[9px] font-body text-ink-ghost whitespace-nowrap">
        {t("agenda.progress.label", {
          current: progress.currentWeek,
          total: progress.totalWeeks,
          defaultValue: "第 {{current}} / {{total}} 周",
        })}
      </span>
      <div className="flex-1 h-1 rounded-full bg-paper-deep/40 overflow-hidden min-w-[50px]">
        <div
          className="h-full rounded-full bg-bamboo transition-[width] duration-300"
          style={{ width: `${Math.round(progress.percent * 100)}%` }}
        />
      </div>
      <span className="text-[8.5px] font-mono text-ink-ghost/70 whitespace-nowrap">
        {t("agenda.progress.remaining", {
          count: progress.remaining,
          defaultValue: "剩 {{count}} 周",
        })}
      </span>
    </div>
  );
}
