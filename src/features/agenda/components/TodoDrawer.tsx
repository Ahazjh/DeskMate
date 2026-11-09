import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "../../../components/Toast";
import { getErrorMessage } from "../../notes/api";
import { combineDateTime, isoDayKey, isoTime, todayKey } from "../dateUtils";
import { SelectField } from "./SelectField";
import type { Priority, Todo, TodoInput } from "../types";

interface TodoDrawerProps {
  todo: Todo | null;
  defaultDueDate: string | null;
  onClose: () => void;
  onSave: (input: TodoInput) => Promise<void>;
  onDelete: (todo: Todo) => void;
  /** 抽屉互斥：上报未保存状态并登记保存处理器 */
  onDirtyChange?: (dirty: boolean) => void;
  onRegisterSave?: (save: (() => Promise<boolean>) | null) => void;
}

const PRIORITIES: Priority[] = [0, 1, 2, 3];

export function TodoDrawer({
  todo,
  defaultDueDate,
  onClose,
  onSave,
  onDelete,
  onDirtyChange,
  onRegisterSave,
}: TodoDrawerProps) {
  const { t } = useTranslation();
  const titleRef = useRef<HTMLInputElement>(null);
  const initialDueDate = todo?.dueDate ?? (todo?.dueAt ? isoDayKey(todo.dueAt) : (defaultDueDate ?? ""));
  const [title, setTitle] = useState(todo?.title ?? "");
  const [notes, setNotes] = useState(todo?.notes ?? "");
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [dueTime, setDueTime] = useState(todo?.dueAt ? isoTime(todo.dueAt) : "");
  const [priority, setPriority] = useState<Priority>(todo?.priority ?? 0);
  const [estimateMinutes, setEstimateMinutes] = useState(todo?.estimateMinutes ?? 0);
  const [tags, setTags] = useState((todo?.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);

  // 与初始值比较得出「有未保存输入」
  const dirty = useMemo(() => {
    const initialTags = (todo?.tags ?? []).join(", ");
    return (
      title !== (todo?.title ?? "") ||
      notes !== (todo?.notes ?? "") ||
      dueDate !== initialDueDate ||
      dueTime !== (todo?.dueAt ? isoTime(todo.dueAt) : "") ||
      priority !== (todo?.priority ?? 0) ||
      estimateMinutes !== (todo?.estimateMinutes ?? 0) ||
      tags !== initialTags
    );
  }, [
    title,
    notes,
    dueDate,
    dueTime,
    priority,
    estimateMinutes,
    tags,
    todo,
    initialDueDate,
  ]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSave = useCallback(async (): Promise<boolean> => {
    const trimmed = title.trim();
    if (!trimmed) {
      showToast(t("agenda.todo.titleRequired", { defaultValue: "请先填写标题" }));
      return false;
    }

    const resolvedDate = dueTime && !dueDate ? todayKey() : dueDate;
    const input: TodoInput = {
      title: trimmed,
      notes,
      dueDate: resolvedDate || null,
      dueAt: resolvedDate && dueTime ? combineDateTime(resolvedDate, dueTime) : null,
      priority,
      estimateMinutes: estimateMinutes > 0 ? estimateMinutes : null,
      tags: tags
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      courseId: todo?.courseId ?? null,
      platform: todo?.platform ?? "",
      kind: todo?.kind ?? "task",
    };

    setSaving(true);
    try {
      await onSave(input);
      onClose();
      return true;
    } catch (cause) {
      showToast(getErrorMessage(cause));
      return false;
    } finally {
      setSaving(false);
    }
  }, [title, notes, dueDate, dueTime, priority, estimateMinutes, tags, todo, onSave, onClose, t]);

  // 登记保存处理器，供抽屉互斥时调用
  useEffect(() => {
    onRegisterSave?.(() => handleSave());
    return () => onRegisterSave?.(null);
  }, [handleSave, onRegisterSave]);

  return (
    <aside className="w-[320px] shrink-0 flex flex-col border-l border-paper-deep/30 bg-cloud min-h-0">
      <div className="h-10 px-4 flex items-center justify-between border-b border-paper-deep/30 shrink-0">
        <span className="text-[12px] font-body font-medium text-ink-soft">
          {todo
            ? t("agenda.todo.editTitle", { defaultValue: "编辑待办" })
            : t("agenda.todo.new", { defaultValue: "新建待办" })}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close", { defaultValue: "关闭" })}
          className="w-6 h-6 flex items-center justify-center rounded text-ink-ghost hover:text-ink-soft hover:bg-paper-warm cursor-pointer"
        >
          <svg
            width="10"
            height="10"
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

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <input
          ref={titleRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("agenda.todo.titlePlaceholder", { defaultValue: "要做什么？" })}
          className="w-full text-[14px] font-body text-ink placeholder:text-ink-ghost/60 bg-transparent border-b border-paper-deep/40 pb-1.5 focus:border-bamboo/50 outline-none"
        />

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-body text-ink-ghost">
              {t("agenda.todo.dueDate", { defaultValue: "日期" })}
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="h-8 px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft focus:border-bamboo/40 outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-body text-ink-ghost">
              {t("agenda.todo.dueTime", { defaultValue: "时间" })}
            </span>
            <input
              type="time"
              value={dueTime}
              onChange={(event) => setDueTime(event.target.value)}
              className="h-8 px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft focus:border-bamboo/40 outline-none"
            />
          </label>
        </div>

        <div>
          <div className="text-[10px] font-body text-ink-ghost pb-1">
            {t("agenda.todo.priority", { defaultValue: "优先级" })}
          </div>
          <div className="flex items-center gap-1">
            {PRIORITIES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPriority(value)}
                className={`flex-1 h-7 rounded-md text-[10px] font-body transition-colors cursor-pointer ${
                  priority === value
                    ? "bg-bamboo text-cloud"
                    : "bg-paper-warm/60 text-ink-faint hover:text-ink-soft"
                }`}
              >
                {t(`agenda.priority.${value}`, {
                  defaultValue: ["无", "低", "中", "高"][value],
                })}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-body text-ink-ghost">
            {t("agenda.todo.estimate", { defaultValue: "预估" })}
            <div className="w-[110px]">
              <SelectField
                value={estimateMinutes}
                onChange={setEstimateMinutes}
                ariaLabel={t("agenda.todo.estimate", { defaultValue: "预估" })}
                options={[
                  { value: 0, label: t("agenda.todo.estimateUnset", { defaultValue: "未估算" }) },
                  ...[15, 30, 45, 60, 90, 120].map((value) => ({
                    value,
                    label: t("agenda.todo.estimateMinutes", {
                      count: value,
                      defaultValue: "{{count}} 分钟",
                    }),
                  })),
                ]}
                className="h-7 w-full px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft outline-none"
              />
            </div>

            {t("agenda.todo.tags", { defaultValue: "标签" })}
          </span>
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder={t("agenda.todo.tagsPlaceholder", { defaultValue: "工作, 生活" })}
            className="h-8 px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft placeholder:text-ink-ghost/50 focus:border-bamboo/40 outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-body text-ink-ghost">
            {t("agenda.todo.notes", { defaultValue: "备注" })}
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={5}
            placeholder={t("agenda.todo.notesPlaceholder", { defaultValue: "补充说明…" })}
            className="px-2 py-1.5 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft placeholder:text-ink-ghost/50 focus:border-bamboo/40 outline-none resize-none leading-relaxed"
          />
        </label>
      </div>

      <div className="px-4 py-2.5 border-t border-paper-deep/30 flex items-center justify-between shrink-0">
        {todo ? (
          <button
            type="button"
            onClick={() => onDelete(todo)}
            className="text-[11px] font-body text-ink-ghost hover:text-red-400 transition-colors cursor-pointer"
          >
            {t("common.delete", { defaultValue: "删除" })}
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 h-7 rounded-lg text-[11px] font-body text-ink-faint hover:bg-paper-warm transition-colors cursor-pointer"
          >
            {t("common.cancel", { defaultValue: "取消" })}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="px-4 h-7 rounded-lg bg-bamboo text-cloud text-[11px] font-body hover:bg-bamboo-light disabled:opacity-50 transition-colors cursor-pointer"
          >
            {saving
              ? t("common.saving", { defaultValue: "保存中…" })
              : t("common.save", { defaultValue: "保存" })}
          </button>
        </div>
      </div>
    </aside>
  );
}
