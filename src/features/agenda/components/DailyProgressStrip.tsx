import { useTranslation } from "react-i18next";
import type { DailyTask } from "../types";

interface DailyProgressStripProps {
  tasks: DailyTask[];
  doneIds: Set<string>;
}

/**
 * 桌面小窗里的每日必做进度条。
 * 只展示当天的完成情况，不提供勾选入口（小窗以浏览为主）。
 */
export function DailyProgressStrip({ tasks, doneIds }: DailyProgressStripProps) {
  const { t } = useTranslation();

  if (tasks.length === 0) return null;

  const done = tasks.filter((task) => doneIds.has(task.id)).length;
  const total = tasks.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="px-2.5 pt-1.5 pb-1 shrink-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-body text-ink-faint truncate">
          {t("agenda.widget.dailyTitle", { defaultValue: "每日必做" })}
        </span>
        <span className="shrink-0 text-[10px] font-mono tabular-nums text-ink-ghost">
          {done}/{total}
        </span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-paper-deep/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-bamboo transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
