import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "../../../components/Toast";
import { getErrorMessage } from "../../notes/api";
import { EVENT_COLORS } from "../eventUtils";
import type { DailyTask, DailyTaskInput } from "../types";

interface DailyDrawerProps {
  task: DailyTask | null;
  onClose: () => void;
  onSave: (input: DailyTaskInput) => Promise<void>;
  onDelete: (task: DailyTask) => void;
}

export function DailyDrawer({ task, onClose, onSave, onDelete }: DailyDrawerProps) {
  const { t } = useTranslation();
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(task?.title ?? "");
  const [color, setColor] = useState(task?.color ?? EVENT_COLORS[0]);
  const [active, setActive] = useState(task?.active ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      showToast(t("agenda.daily.titleRequired", { defaultValue: "请填写内容" }));
      return;
    }

    setSaving(true);
    try {
      await onSave({ title: trimmed, color, active });
      onClose();
    } catch (cause) {
      showToast(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="w-[320px] shrink-0 flex flex-col border-l border-paper-deep/30 bg-cloud min-h-0">
      <div className="h-10 px-4 flex items-center justify-between border-b border-paper-deep/30 shrink-0">
        <span className="text-[12px] font-body font-medium text-ink-soft">
          {task
            ? t("agenda.daily.editTitle", { defaultValue: "编辑每日必做" })
            : t("agenda.daily.add", { defaultValue: "添加每日必做" })}
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
          placeholder={t("agenda.daily.titlePlaceholder", { defaultValue: "例如：背 30 个单词" })}
          className="w-full text-[14px] font-body text-ink placeholder:text-ink-ghost/60 bg-transparent border-b border-paper-deep/40 pb-1.5 focus:border-bamboo/50 outline-none"
        />

        <div>
          <div className="text-[10px] font-body text-ink-ghost pb-1">
            {t("agenda.course.color", { defaultValue: "颜色" })}
          </div>
          <div className="flex items-center gap-1.5">
            {EVENT_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={option}
                onClick={() => setColor(option)}
                className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                  color === option ? "ring-2 ring-offset-1 ring-ink-ghost/50 scale-105" : ""
                }`}
                style={{ backgroundColor: option }}
              />
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between">
          <span className="text-[11px] font-body text-ink-faint">
            {t("agenda.daily.active", { defaultValue: "启用" })}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            onClick={() => setActive((value) => !value)}
            className={`w-8 h-4 rounded-full transition-colors cursor-pointer ${
              active ? "bg-bamboo" : "bg-paper-deep"
            }`}
          >
            <span
              className={`block w-3 h-3 rounded-full bg-cloud transition-transform ${
                active ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>

        <p className="text-[9.5px] font-body text-ink-ghost/70 leading-relaxed pt-1">
          {t("agenda.daily.drawerHint", {
            defaultValue: "停用后不再出现在今日清单，但历史勾选记录会保留。",
          })}
        </p>
      </div>

      <div className="px-4 py-2.5 border-t border-paper-deep/30 flex items-center justify-between shrink-0">
        {task ? (
          <button
            type="button"
            onClick={() => onDelete(task)}
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
