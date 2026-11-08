import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "../../../components/Toast";
import { getErrorMessage } from "../../notes/api";
import { reminderSettings, saveReminderSettings } from "../api";
import { SelectField } from "./SelectField";
import type { ReminderSettings } from "../types";

interface ReminderSettingsDialogProps {
  onClose: () => void;
}

const LEAD_OPTIONS = [0, 5, 10, 15, 30, 60];

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: true,
  defaultMinutes: 10,
  todoReminders: true,
  quietHoursEnabled: false,
  quietStart: "22:00",
  quietEnd: "08:00",
  autoReview: true,
  muteDuringCourses: true,
};

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 py-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 w-3.5 h-3.5 accent-bamboo cursor-pointer"
      />
      <span className="min-w-0">
        <span className="block text-[11px] font-body text-ink-soft">{label}</span>
        {hint ? (
          <span className="block mt-0.5 text-[9.5px] font-body text-ink-ghost leading-relaxed">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function ReminderSettingsDialog({ onClose }: ReminderSettingsDialogProps) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void reminderSettings()
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch((cause) => showToast(getErrorMessage(cause)))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const update = <K extends keyof ReminderSettings>(key: K, value: ReminderSettings[K]) => {
    setSettings((previous) => ({ ...previous, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveReminderSettings(settings);
      showToast(t("agenda.toast.saved", { defaultValue: "已保存" }), "info");
      onClose();
    } catch (cause) {
      showToast(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/20 backdrop-blur-[1px]"
      onMouseDown={onClose}
    >
      <div
        className="w-[420px] max-w-full flex flex-col bg-cloud rounded-xl border border-paper-deep/50 shadow-2xl overflow-hidden"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="h-11 px-4 flex items-center justify-between border-b border-paper-deep/30 shrink-0">
          <span className="text-[12px] font-body font-medium text-ink-soft">
            {t("agenda.reminder.settingsTitle", { defaultValue: "提醒设置" })}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close", { defaultValue: "关闭" })}
            className="w-6 h-6 flex items-center justify-center rounded text-ink-ghost hover:text-ink-soft hover:bg-paper-warm cursor-pointer"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-3 space-y-1">
          <Toggle
            checked={settings.enabled}
            onChange={(value) => update("enabled", value)}
            label={t("agenda.reminder.enabled", { defaultValue: "启用提醒" })}
            hint={t("agenda.reminder.hint", {
              defaultValue: "后台每 30 秒检查一次；系统通知不可用时仍会显示应用内提醒条。",
            })}
          />

          <label className="flex items-center justify-between py-1.5">
            <span className="text-[11px] font-body text-ink-soft">
              {t("agenda.reminder.defaultMinutes", { defaultValue: "默认提前" })}
            </span>
            <div className="w-[140px]">
              <SelectField
                value={settings.defaultMinutes}
                onChange={(value) => update("defaultMinutes", value)}
                ariaLabel={t("agenda.reminder.defaultMinutes", { defaultValue: "默认提前" })}
                options={LEAD_OPTIONS.map((value) => ({
                  value,
                  label: `${value} ${t("agenda.reminder.minutesUnit", { defaultValue: "分钟" })}`,
                }))}
                className="h-7 w-full px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft outline-none focus:border-bamboo/40"
              />
            </div>
          </label>

          <Toggle
            checked={settings.todoReminders}
            onChange={(value) => update("todoReminders", value)}
            label={t("agenda.reminder.todoReminders", { defaultValue: "待办与课程提醒" })}
          />

          <Toggle
            checked={settings.quietHoursEnabled}
            onChange={(value) => update("quietHoursEnabled", value)}
            label={t("agenda.reminder.quietHours", { defaultValue: "免打扰时段" })}
          />
          {settings.quietHoursEnabled ? (
            <div className="flex items-center gap-2 pl-5 pb-1.5">
              <input
                type="time"
                value={settings.quietStart}
                onChange={(event) => update("quietStart", event.target.value)}
                className="h-7 px-1.5 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft outline-none"
              />
              <span className="text-[10px] text-ink-ghost">
                {t("agenda.reminder.to", { defaultValue: "至" })}
              </span>
              <input
                type="time"
                value={settings.quietEnd}
                onChange={(event) => update("quietEnd", event.target.value)}
                className="h-7 px-1.5 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft outline-none"
              />
            </div>
          ) : null}

          <Toggle
            checked={settings.muteDuringCourses}
            onChange={(value) => update("muteDuringCourses", value)}
            label={t("agenda.reminder.muteDuringCourses", { defaultValue: "上课时自动静音" })}
            hint={t("agenda.reminder.muteDuringCoursesHint", {
              defaultValue: "按课程表节次判断，课堂中不弹提醒；下课后 30 分钟内的提醒会补发。",
            })}
          />

          <Toggle
            checked={settings.autoReview}
            onChange={(value) => update("autoReview", value)}
            label={t("agenda.reminder.autoReview", { defaultValue: "自动生成每日回顾" })}
            hint={t("agenda.review.hint", {
              defaultValue: "次日启动时把前一天完成的待办、日程、课程与每日必做写成一篇笔记。",
            })}
          />
        </div>

        <div className="px-4 py-2.5 border-t border-paper-deep/30 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-7 px-3 rounded-lg text-[11px] font-body text-ink-faint hover:bg-paper-warm cursor-pointer"
          >
            {t("common.cancel", { defaultValue: "取消" })}
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void handleSave()}
            className="h-7 px-4 rounded-lg bg-bamboo text-cloud text-[11px] font-body hover:bg-bamboo-light disabled:opacity-50 cursor-pointer"
          >
            {saving
              ? t("common.saving", { defaultValue: "保存中…" })
              : t("common.save", { defaultValue: "保存" })}
          </button>
        </div>
      </div>
    </div>
  );
}
