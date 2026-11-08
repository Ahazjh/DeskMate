import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { addDaysToKey, parseDayKey } from "../dateUtils";
import type { DailyTask } from "../types";

interface DailyViewProps {
  tasks: DailyTask[];
  checks: Record<string, string[]>;
  today: string;
  locale: string;
  onToggle: (task: DailyTask, done: boolean) => void;
  onEdit: (task: DailyTask) => void;
  onDelete: (task: DailyTask) => void;
  onAdd: () => void;
}

export function DailyView({
  tasks,
  checks,
  today,
  locale,
  onToggle,
  onEdit,
  onDelete,
  onAdd,
}: DailyViewProps) {
  const { t } = useTranslation();
  const activeTasks = useMemo(() => tasks.filter((task) => task.active), [tasks]);
  const doneIds = useMemo(() => new Set(checks[today] ?? []), [checks, today]);
  const doneCount = activeTasks.filter((task) => doneIds.has(task.id)).length;
  const total = activeTasks.length;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const history = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDaysToKey(today, index - 6);
      const ids = new Set(checks[day] ?? []);
      const done = activeTasks.filter((task) => ids.has(task.id)).length;
      return {
        day,
        done,
        percent: total > 0 ? Math.round((done / total) * 100) : 0,
        weekday: new Intl.DateTimeFormat(locale, { weekday: "short" }).format(parseDayKey(day)),
      };
    });
  }, [activeTasks, checks, locale, today, total]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
      <div className="max-w-[720px]">
        <div className="rounded-xl border border-paper-deep/40 bg-paper/40 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-body font-medium text-ink-soft">
                {t("agenda.daily.progressTitle", { defaultValue: "今日进度" })}
              </div>
              <div className="mt-0.5 text-[10px] font-body text-ink-ghost">
                {t("agenda.daily.progressHint", {
                  defaultValue: "每天重新开始，勾选记录按日期保存",
                })}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[22px] font-mono tabular-nums text-bamboo leading-none">
                {doneCount}
              </span>
              <span className="text-[12px] font-mono text-ink-ghost"> / {total}</span>
            </div>
          </div>

          <div className="mt-3 h-1.5 rounded-full bg-paper-deep/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-bamboo transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="mt-3 space-y-0.5">
            {activeTasks.length === 0 ? (
              <div className="py-6 text-center text-[11px] font-body text-ink-ghost">
                {t("agenda.daily.empty", { defaultValue: "还没有每日必做，先加一条" })}
              </div>
            ) : (
              activeTasks.map((task) => {
                const done = doneIds.has(task.id);
                return (
                  <div
                    key={task.id}
                    className="group flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-paper-warm/60 transition-colors"
                  >
                    <button
                      type="button"
                      aria-label={
                        done
                          ? t("agenda.todo.markUndone", { defaultValue: "标记为未完成" })
                          : t("agenda.todo.markDone", { defaultValue: "标记为完成" })
                      }
                      onClick={() => onToggle(task, !done)}
                      className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-all cursor-pointer ${
                        done
                          ? "bg-bamboo border-bamboo text-cloud"
                          : "border-paper-deep hover:border-bamboo/60 bg-cloud/60"
                      }`}
                    >
                      {done ? (
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
                      ) : null}
                    </button>
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: task.color ?? "#2d5a3d" }}
                    />
                    <span
                      className={`flex-1 text-[12.5px] font-body truncate ${
                        done ? "text-ink-ghost line-through" : "text-ink-soft"
                      }`}
                    >
                      {task.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => onEdit(task)}
                      className="w-5 h-5 flex items-center justify-center rounded text-ink-ghost/50 opacity-0 group-hover:opacity-100 hover:text-bamboo hover:bg-bamboo-mist/60 transition-all cursor-pointer"
                      aria-label={t("common.edit", { defaultValue: "编辑" })}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(task)}
                      className="w-5 h-5 flex items-center justify-center rounded text-ink-ghost/40 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-danger-bg transition-all cursor-pointer"
                      aria-label={t("common.delete", { defaultValue: "删除" })}
                    >
                      <svg
                        width="9"
                        height="9"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      >
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={onAdd}
            className="mt-2 w-full h-8 rounded-lg border border-dashed border-paper-deep/60 text-[11px] font-body text-ink-ghost hover:text-bamboo hover:border-bamboo/40 hover:bg-bamboo-mist/20 transition-colors cursor-pointer"
          >
            + {t("agenda.daily.add", { defaultValue: "添加每日必做" })}
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-paper-deep/40 bg-paper/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-body font-medium text-ink-soft">
              {t("agenda.daily.history", { defaultValue: "近 7 天" })}
            </span>
            <span className="text-[9px] font-body text-ink-ghost">
              {t("agenda.daily.historyHint", { defaultValue: "按当前清单计算" })}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-2">
            {history.map((item) => (
              <div key={item.day} className="flex flex-col items-center gap-1">
                <span className="text-[9px] font-body text-ink-ghost">{item.weekday}</span>
                <div className="w-full h-12 rounded-md bg-paper-warm/70 flex items-end overflow-hidden">
                  <div
                    className={`w-full rounded-md transition-[height] duration-300 ${
                      item.day === today ? "bg-bamboo" : "bg-bamboo/45"
                    }`}
                    style={{ height: item.done > 0 ? `${Math.max(item.percent, 8)}%` : "0%" }}
                  />
                </div>
                <span
                  className={`text-[9px] font-mono tabular-nums ${
                    item.day === today ? "text-bamboo" : "text-ink-ghost"
                  }`}
                >
                  {item.done}/{total}
                </span>
                <span className="text-[8px] font-mono text-ink-ghost/50">{item.day.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 text-[9.5px] font-body text-ink-ghost/70 leading-relaxed">
          {t("agenda.daily.note", {
            defaultValue: "每日必做独立于待办，不进入待办列表；删除清单项会同时清除它的历史勾选。",
          })}
        </p>
      </div>
    </div>
  );
}
