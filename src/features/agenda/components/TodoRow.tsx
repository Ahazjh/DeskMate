import { useTranslation } from "react-i18next";
import { addDaysToKey, isoTime, todayKey } from "../dateUtils";
import { dueTone, todoDay } from "../todoFilters";
import type { Todo } from "../types";

interface TodoRowProps {
  todo: Todo;
  onToggle: (todo: Todo) => void;
  onOpen: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}

const PRIORITY_STYLES: Record<number, string> = {
  0: "",
  1: "bg-ink-ghost/40",
  2: "bg-amber-400",
  3: "bg-red-400",
};

export function TodoRow({ todo, onToggle, onOpen, onDelete }: TodoRowProps) {
  const { t } = useTranslation();
  const tone = dueTone(todo);
  const day = todoDay(todo);
  const today = todayKey();
  const tomorrow = addDaysToKey(today, 1);

  let dueLabel = "";
  if (tone === "overdue" && day) {
    dueLabel = `${t("agenda.smart.overdue", { defaultValue: "逾期" })} · ${day.slice(5)}`;
  } else if (day === today) {
    dueLabel = todo.dueAt ? isoTime(todo.dueAt) : t("agenda.smart.today", { defaultValue: "今天" });
  } else if (day === tomorrow) {
    dueLabel = t("agenda.smart.tomorrow", { defaultValue: "明天" });
  } else if (day) {
    dueLabel = day.slice(5);
  }

  const toneClass =
    tone === "overdue"
      ? "text-red-400"
      : tone === "today"
        ? "text-bamboo"
        : tone === "soon"
          ? "text-ink-faint"
          : "text-ink-ghost";

  return (
    <div
      className="group flex items-start gap-2.5 px-3 py-2 rounded-xl hover:bg-paper-warm/60 transition-colors cursor-pointer"
      onClick={() => onOpen(todo)}
    >
      <button
        type="button"
        aria-label={
          todo.done
            ? t("agenda.todo.markUndone", { defaultValue: "标记为未完成" })
            : t("agenda.todo.markDone", { defaultValue: "标记为完成" })
        }
        onClick={(event) => {
          event.stopPropagation();
          onToggle(todo);
        }}
        className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-all cursor-pointer ${
          todo.done
            ? "bg-bamboo border-bamboo text-cloud"
            : "border-paper-deep hover:border-bamboo/60 bg-cloud/60"
        }`}
      >
        {todo.done ? (
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

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {todo.priority > 0 ? (
            <span
              className={`w-1 h-1 rounded-full shrink-0 ${PRIORITY_STYLES[todo.priority]}`}
              title={t(`agenda.priority.${todo.priority}`, { defaultValue: "优先级" })}
            />
          ) : null}
          <span
            className={`text-[12.5px] font-body leading-snug truncate ${
              todo.done ? "text-ink-ghost line-through" : "text-ink-soft"
            }`}
          >
            {todo.title}
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-2 text-[10px] font-body min-w-0">
          {dueLabel ? (
            <span className={`shrink-0 font-mono tabular-nums ${toneClass}`}>{dueLabel}</span>
          ) : null}
          {todo.kind === "assignment" || todo.kind === "reminder" ? (
            <span className="shrink-0 px-1 rounded-sm bg-bamboo-mist/70 text-bamboo/80 text-[9px]">
              {todo.kind === "assignment"
                ? t("agenda.todo.kind.assignment", { defaultValue: "作业" })
                : t("agenda.todo.kind.reminder", { defaultValue: "提醒" })}
            </span>
          ) : null}
          {todo.platform ? <span className="shrink-0 text-ink-ghost">{todo.platform}</span> : null}
          {todo.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="shrink-0 text-ink-ghost">
              #{tag}
            </span>
          ))}
          {todo.notes.trim() ? (
            <span className="shrink-0 text-ink-ghost/50">
              {t("agenda.todo.hasNotes", { defaultValue: "备注" })}
            </span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        aria-label={t("common.delete", { defaultValue: "删除" })}
        onClick={(event) => {
          event.stopPropagation();
          onDelete(todo);
        }}
        className="mt-0.5 w-5 h-5 shrink-0 flex items-center justify-center rounded text-ink-ghost/40 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-danger-bg transition-all cursor-pointer"
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
}
