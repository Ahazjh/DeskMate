import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "../../../components/Toast";
import { getErrorMessage } from "../../notes/api";
import { addDaysToKey, formatDayHeading, todayKey } from "../dateUtils";
import { isOverdue, todoDay } from "../todoFilters";
import type { SmartList, Todo } from "../types";
import { TodoRow } from "./TodoRow";

interface TodoListViewProps {
  todos: Todo[];
  list: SmartList;
  search: string;
  defaultDueDate: string | null;
  locale: string;
  onSearchChange: (value: string) => void;
  onCreate: (title: string, dueDate: string | null) => Promise<void>;
  onNewDetailed: () => void;
  onToggle: (todo: Todo) => void;
  onOpen: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}

interface TodoGroup {
  key: string;
  label: string;
  todos: Todo[];
}

export function TodoListView({
  todos,
  list,
  search,
  defaultDueDate,
  locale,
  onSearchChange,
  onCreate,
  onNewDetailed,
  onToggle,
  onOpen,
  onDelete,
}: TodoListViewProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const today = todayKey();
  const tomorrow = addDaysToKey(today, 1);

  const groups = useMemo<TodoGroup[]>(() => {
    if (list === "done") {
      return [
        {
          key: "done",
          label: t("agenda.smart.done", { defaultValue: "已完成" }),
          todos,
        },
      ];
    }

    if (list === "today" || list === "tomorrow" || list === "overdue") {
      return [
        {
          key: list,
          label: t(`agenda.smart.${list}`, {
            defaultValue: { today: "今天", tomorrow: "明天", overdue: "逾期" }[list],
          }),
          todos,
        },
      ];
    }

    const buckets = new Map<string, Todo[]>();
    for (const todo of todos) {
      const day = todoDay(todo);
      const key = isOverdue(todo) ? "overdue" : (day ?? "none");
      const bucket = buckets.get(key);
      if (bucket) bucket.push(todo);
      else buckets.set(key, [todo]);
    }

    const order = (key: string) => {
      if (key === "overdue") return 0;
      if (key === today) return 1;
      if (key === tomorrow) return 2;
      if (key === "none") return 4;
      return 3;
    };

    return [...buckets.entries()]
      .sort(([left], [right]) => {
        const delta = order(left) - order(right);
        return delta !== 0 ? delta : left.localeCompare(right);
      })
      .map(([key, groupTodos]) => {
        let label: string;
        if (key === "overdue") {
          label = t("agenda.smart.overdue", { defaultValue: "逾期" });
        } else if (key === "none") {
          label = t("agenda.todo.noDate", { defaultValue: "无日期" });
        } else if (key === today) {
          label = `${t("agenda.smart.today", { defaultValue: "今天" })} · ${key.slice(5)}`;
        } else if (key === tomorrow) {
          label = `${t("agenda.smart.tomorrow", { defaultValue: "明天" })} · ${key.slice(5)}`;
        } else {
          label = formatDayHeading(key, locale);
        }
        return { key, label, todos: groupTodos };
      });
  }, [list, locale, t, today, todos, tomorrow]);

  const handleSubmit = async () => {
    const title = draft.trim();
    if (!title || submitting) return;
    setSubmitting(true);
    try {
      await onCreate(title, defaultDueDate);
      setDraft("");
    } catch (cause) {
      showToast(getErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-2.5 h-8 rounded-lg bg-paper-warm/80 border border-paper-deep/40 focus-within:border-bamboo/30 focus-within:bg-cloud transition-all">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-ink-ghost shrink-0"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t("agenda.todo.searchPlaceholder", { defaultValue: "搜索待办…" })}
              className="flex-1 text-[12px] font-body text-ink placeholder:text-ink-ghost/60 bg-transparent"
            />
          </div>
          <button
            type="button"
            onClick={onNewDetailed}
            className="h-8 px-3 rounded-lg bg-bamboo text-cloud text-[11px] font-body hover:bg-bamboo-light transition-colors cursor-pointer"
          >
            {t("agenda.todo.new", { defaultValue: "新建待办" })}
          </button>
        </div>

        {list !== "done" ? (
          <div className="mt-2 flex items-center gap-2 px-2.5 h-9 rounded-lg border border-dashed border-paper-deep/60 bg-cloud/40 focus-within:border-bamboo/40 transition-colors">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-bamboo/70 shrink-0"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder={t("agenda.todo.quickPlaceholder", {
                defaultValue: "记一条待办，回车保存",
              })}
              className="flex-1 text-[12px] font-body text-ink placeholder:text-ink-ghost/60 bg-transparent"
            />
            {defaultDueDate ? (
              <span className="text-[10px] font-mono text-ink-ghost shrink-0">
                {defaultDueDate.slice(5)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3">
        {todos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="text-[12px] font-body text-ink-ghost">
              {list === "done"
                ? t("agenda.todo.emptyDone", { defaultValue: "还没有已完成的待办" })
                : t("agenda.todo.empty", { defaultValue: "这里还没有待办" })}
            </div>
            {list !== "done" ? (
              <div className="mt-1 text-[10px] font-body text-ink-ghost/60">
                {t("agenda.todo.emptyHint", { defaultValue: "在上方输入框记一条，回车即可保存" })}
              </div>
            ) : null}
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.key} className="mb-2">
              {list === "all" || list === "week" ? (
                <div className="px-3 pt-2 pb-1 flex items-center gap-2">
                  <span
                    className={`text-[10px] font-body font-medium ${
                      group.key === "overdue" ? "text-red-400" : "text-ink-faint"
                    }`}
                  >
                    {group.label}
                  </span>
                  <span className="text-[9px] font-mono text-ink-ghost/60">
                    {group.todos.length}
                  </span>
                </div>
              ) : null}
              <div className="space-y-0.5">
                {group.todos.map((todo) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    onToggle={onToggle}
                    onOpen={onOpen}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
