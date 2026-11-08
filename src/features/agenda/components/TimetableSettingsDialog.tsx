import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "../../../components/Toast";
import { getErrorMessage } from "../../notes/api";
import { todayKey } from "../dateUtils";
import { defaultTimetableSettings, semesterWeek } from "../timetable";
import type { PeriodTime, TimetableSettings } from "../types";

interface TimetableSettingsDialogProps {
  settings: TimetableSettings;
  onClose: () => void;
  onSave: (settings: TimetableSettings) => Promise<void>;
}

export function TimetableSettingsDialog({
  settings,
  onClose,
  onSave,
}: TimetableSettingsDialogProps) {
  const { t } = useTranslation();
  const [semesterStart, setSemesterStart] = useState(settings.semesterStart ?? "");
  const [periodTimes, setPeriodTimes] = useState<PeriodTime[]>(() => {
    const defaults = defaultTimetableSettings().periodTimes;
    return defaults.map((fallback) => {
      const provided = settings.periodTimes.find((item) => item.period === fallback.period);
      return provided ?? fallback;
    });
  });
  const [saving, setSaving] = useState(false);

  const currentWeek = useMemo(
    () => semesterWeek(semesterStart || null, todayKey()),
    [semesterStart],
  );

  const updateTime = (period: number, field: "start" | "end", value: string) => {
    setPeriodTimes((previous) =>
      previous.map((item) => (item.period === period ? { ...item, [field]: value } : item)),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        semesterStart: semesterStart || null,
        periodTimes,
      });
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
        className="w-[560px] max-w-full max-h-[84vh] flex flex-col bg-cloud rounded-xl border border-paper-deep/50 shadow-2xl overflow-hidden"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="h-11 px-4 flex items-center justify-between border-b border-paper-deep/30 shrink-0">
          <span className="text-[12px] font-body font-medium text-ink-soft">
            {t("agenda.timetable.settingsTitle", { defaultValue: "课程表设置" })}
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

        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          <div className="rounded-lg border border-paper-deep/40 bg-paper/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-body font-medium text-ink-soft">
                  {t("agenda.timetable.semesterStart", { defaultValue: "学期开始日期" })}
                </div>
                <div className="mt-0.5 text-[9.5px] font-body text-ink-ghost">
                  {currentWeek === null
                    ? t("agenda.timetable.weekUnset", { defaultValue: "设置后可推算当前第几周" })
                    : currentWeek === 0
                      ? t("agenda.timetable.weekNotStarted", { defaultValue: "还没到开学日期" })
                      : t("agenda.timetable.currentWeek", {
                          week: currentWeek,
                          defaultValue: "当前第 {{week}} 周",
                        })}
                </div>
              </div>
              <input
                type="date"
                value={semesterStart}
                onChange={(event) => setSemesterStart(event.target.value)}
                className="h-8 px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft outline-none focus:border-bamboo/40"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-[10px] font-body text-ink-ghost">
                {t("agenda.timetable.periodTimes", { defaultValue: "每节具体时刻" })}
              </span>
              <button
                type="button"
                onClick={() => setPeriodTimes(defaultTimetableSettings().periodTimes)}
                className="text-[10px] font-body text-ink-ghost hover:text-bamboo transition-colors cursor-pointer"
              >
                {t("agenda.timetable.reset", { defaultValue: "恢复默认" })}
              </button>
            </div>
            <div className="rounded-lg border border-paper-deep/40 overflow-hidden">
              {periodTimes.map((item) => (
                <div
                  key={item.period}
                  className="flex items-center gap-2 px-2.5 py-1 border-b border-paper-deep/20 last:border-0"
                >
                  <span className="w-10 text-[10px] font-mono text-ink-ghost">
                    {t("agenda.course.periodShort", {
                      period: item.period,
                      defaultValue: "第{{period}}节",
                    })}
                  </span>
                  <input
                    type="time"
                    value={item.start}
                    onChange={(event) => updateTime(item.period, "start", event.target.value)}
                    className="flex-1 h-7 px-1.5 rounded border border-paper-deep bg-paper-warm/80 text-[10px] font-body text-ink-soft outline-none focus:border-bamboo/40"
                  />
                  <span className="text-[10px] text-ink-ghost/50">–</span>
                  <input
                    type="time"
                    value={item.end}
                    onChange={(event) => updateTime(item.period, "end", event.target.value)}
                    className="flex-1 h-7 px-1.5 rounded border border-paper-deep bg-paper-warm/80 text-[10px] font-body text-ink-soft outline-none focus:border-bamboo/40"
                  />
                </div>
              ))}
            </div>
          </div>

          <p className="text-[9.5px] font-body text-ink-ghost leading-relaxed">
            {t("agenda.timetable.hint", {
              defaultValue: "这些时刻只影响课程表的显示与当前周推算，不会修改日程或待办的时间。",
            })}
          </p>
        </div>

        <div className="px-4 py-2.5 border-t border-paper-deep/30 flex items-center justify-end gap-2 shrink-0">
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
    </div>
  );
}
