import { useTranslation } from "react-i18next";
import type { DailyTask } from "../types";

interface DailyProgressStripProps {
  tasks: DailyTask[];
  doneIds: Set<string>;
  /** 点击某条未完成事项时的回调（用于在小窗里直接勾选完成） */
  onToggle?: (task: DailyTask, done: boolean) => void;
}

/**
 * 桌面小窗里的每日必做区块：上方是进度条，下方列出当天未完成的事项。
 *
 * 小窗以「一眼看到今天还差什么」为主，所以未完成项直接列出来，
 * 能在小窗里直接勾选完成，不必回到主窗口。
 */
export function DailyProgressStrip({ tasks, doneIds, onToggle }: DailyProgressStripProps) {
  const { t } = useTranslation();

  if (tasks.length === 0) return null;

  const done = tasks.filter((task) => doneIds.has(task.id)).length;
  const total = tasks.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const pending = tasks.filter((task) => !doneIds.has(task.id));

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

      {pending.length > 0 ? (
        <div className="mt-1.5 space-y-0.5">
          <div className="text-[9.5px] font-body text-ink-ghost/70">
            {t("agenda.widget.dailyPending", {
              count: pending.length,
              defaultValue: "还有 {{count}} 项未完成",
            })}
          </div>
          {pending.map((task) => (
            <div key={task.id} className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label={t("agenda.todo.markDone", { defaultValue: "标记为完成" })}
                onClick={() => onToggle?.(task, true)}
                className="w-3 h-3 shrink-0 rounded border border-paper-deep flex items-center justify-center hover:border-bamboo/60 hover:bg-bamboo-mist/60 transition-colors cursor-pointer"
              >
                <svg
                  width="7"
                  height="7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-bamboo opacity-0 hover:opacity-100"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
              <span className="flex-1 min-w-0 text-[11px] font-body text-ink-soft truncate">
                {task.title}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-body text-bamboo/80">
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {t("agenda.widget.dailyAllDone", { defaultValue: "今天都做完了" })}
        </div>
      )}
    </div>
  );
}
