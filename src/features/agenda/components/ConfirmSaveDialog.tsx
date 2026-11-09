import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface ConfirmSaveDialogProps {
  open: boolean;
  /** 抽屉类型对应的中文名，用于提示文案 */
  label: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

/**
 * 抽屉互斥时的「未保存内容」确认框。
 * 三个选项：保存并继续 / 放弃并继续 / 取消本次操作。
 */
export function ConfirmSaveDialog({
  open,
  label,
  onSave,
  onDiscard,
  onCancel,
}: ConfirmSaveDialogProps) {
  const { t } = useTranslation();
  const saveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      saveRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      <div className="absolute inset-0 bg-ink/25" onClick={onCancel} />
      <div className="relative w-[320px] rounded-xl border border-paper-deep/60 bg-cloud shadow-lg px-4 py-3.5">
        <div className="text-[13px] font-body font-medium text-ink">
          {t("agenda.drawer.unsavedTitle", { defaultValue: "有未保存的修改" })}
        </div>
        <div className="mt-1 text-[11.5px] font-body text-ink-faint leading-relaxed">
          {t("agenda.drawer.unsavedHint", {
            label,
            defaultValue: "当前「{{label}}」里的内容还没有保存，要保存吗？",
          })}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 h-7 rounded-lg text-[11px] font-body text-ink-faint hover:bg-paper-warm transition-colors cursor-pointer"
          >
            {t("agenda.drawer.unsavedCancel", { defaultValue: "取消" })}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="px-3 h-7 rounded-lg text-[11px] font-body text-red-500 hover:bg-paper-warm transition-colors cursor-pointer"
          >
            {t("agenda.drawer.unsavedDiscard", { defaultValue: "放弃" })}
          </button>
          <button
            ref={saveRef}
            type="button"
            onClick={onSave}
            className="px-4 h-7 rounded-lg bg-bamboo text-cloud text-[11px] font-body hover:bg-bamboo-light transition-colors cursor-pointer"
          >
            {t("agenda.drawer.unsavedSave", { defaultValue: "保存" })}
          </button>
        </div>
      </div>
    </div>
  );
}
