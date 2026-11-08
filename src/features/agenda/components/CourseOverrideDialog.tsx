import { useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "../../../components/Toast";
import { getErrorMessage } from "../../notes/api";
import { SelectField } from "./SelectField";
import type { Course, CourseOverride, CourseOverrideInput } from "../types";

interface CourseOverrideDialogProps {
  course: Course;
  today: string;
  overrides: CourseOverride[];
  onClose: () => void;
  onSave: (input: CourseOverrideInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const PERIODS = Array.from({ length: 12 }, (_, index) => index + 1);

export function CourseOverrideDialog({
  course,
  today,
  overrides,
  onClose,
  onSave,
  onDelete,
}: CourseOverrideDialogProps) {
  const { t } = useTranslation();
  const [date, setDate] = useState(today);
  const [action, setAction] = useState<"cancel" | "move">("cancel");
  const [startPeriod, setStartPeriod] = useState(course.startPeriod);
  const [endPeriod, setEndPeriod] = useState(course.endPeriod);
  const [location, setLocation] = useState(course.location);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const mine = overrides
    .filter((item) => item.courseId === course.id)
    .sort((left, right) => right.date.localeCompare(left.date));

  const save = async () => {
    if (!date || saving) return;
    setSaving(true);
    try {
      await onSave({
        courseId: course.id,
        date,
        action,
        startPeriod: action === "move" ? startPeriod : null,
        endPeriod: action === "move" ? endPeriod : null,
        location: action === "move" ? location.trim() || null : null,
        note: note.trim(),
      });
      showToast(t("agenda.toast.saved", { defaultValue: "已保存" }), "info");
      setNote("");
    } catch (cause) {
      showToast(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-ink/20 backdrop-blur-[1px]"
      onMouseDown={onClose}
    >
      <div
        className="w-[400px] max-w-full max-h-[84vh] flex flex-col bg-cloud rounded-xl border border-paper-deep/50 shadow-2xl overflow-hidden"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="h-11 px-4 flex items-center justify-between border-b border-paper-deep/30 shrink-0">
          <span className="text-[12px] font-body font-medium text-ink-soft truncate">
            {t("agenda.override.title", {
              name: course.name,
              defaultValue: "单次调课 / 停课 · {{name}}",
            })}
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

        <div className="px-4 py-3 space-y-2 overflow-y-auto">
          <p className="text-[9.5px] font-body text-ink-ghost leading-relaxed">
            {t("agenda.override.hint", {
              defaultValue: "只影响所选日期，不修改课程本身；课程表、智能排期与本周统计都会应用。",
            })}
          </p>

          <label className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-body text-ink-faint">
              {t("agenda.override.date", { defaultValue: "日期" })}
            </span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-7 px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[10.5px] font-body text-ink-soft outline-none focus:border-bamboo/40"
            />
          </label>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-body text-ink-faint">
              {t("agenda.override.action", { defaultValue: "类型" })}
            </span>
            <div className="flex items-center rounded-md bg-paper-warm/70 p-0.5">
              {[
                { value: "cancel" as const, label: t("agenda.override.cancel", { defaultValue: "停课" }) },
                { value: "move" as const, label: t("agenda.override.move", { defaultValue: "调课" }) },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAction(option.value)}
                  className={`px-2.5 h-6 rounded text-[10px] font-body cursor-pointer ${
                    action === option.value
                      ? "bg-cloud text-bamboo shadow-[0_1px_2px_rgba(26,26,24,0.06)]"
                      : "text-ink-ghost hover:text-ink-soft"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {action === "move" ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-body text-ink-faint">
                  {t("agenda.course.startPeriod", { defaultValue: "开始节" })}
                </span>
                <div className="flex gap-1.5">
                  <div className="w-[72px]">
                    <SelectField
                      value={startPeriod}
                      onChange={(value) => {
                        setStartPeriod(value);
                        if (value > endPeriod) setEndPeriod(value);
                      }}
                      ariaLabel="start period"
                      options={PERIODS.map((period) => ({ value: period, label: String(period) }))}
                      className="h-7 w-full px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[10.5px] font-body text-ink-soft outline-none"
                    />
                  </div>
                  <div className="w-[72px]">
                    <SelectField
                      value={endPeriod}
                      onChange={setEndPeriod}
                      ariaLabel="end period"
                      options={PERIODS.map((period) => ({ value: period, label: String(period) }))}
                      className="h-7 w-full px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[10.5px] font-body text-ink-soft outline-none"
                    />
                  </div>
                </div>
              </div>
              <label className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-body text-ink-faint">
                  {t("agenda.course.location", { defaultValue: "地点" })}
                </span>
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder={t("agenda.course.locationPlaceholder", { defaultValue: "教一101" })}
                  className="h-7 w-[190px] px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[10.5px] font-body text-ink-soft outline-none focus:border-bamboo/40"
                />
              </label>
            </>
          ) : null}

          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("agenda.override.notePlaceholder", { defaultValue: "备注（可选），如：老师出差" })}
            className="w-full h-7 px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[10.5px] font-body text-ink-soft outline-none focus:border-bamboo/40"
          />

          <button
            type="button"
            disabled={!date || saving}
            onClick={() => void save()}
            className="w-full h-7 rounded-lg bg-bamboo text-cloud text-[11px] font-body hover:bg-bamboo-light disabled:opacity-40 cursor-pointer"
          >
            {saving ? t("common.saving", { defaultValue: "保存中…" }) : t("common.save", { defaultValue: "保存" })}
          </button>

          {mine.length > 0 ? (
            <div className="pt-1">
              <div className="text-[10px] font-body text-ink-faint mb-1">
                {t("agenda.override.existing", { defaultValue: "已有例外" })}
              </div>
              <div className="space-y-1">
                {mine.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg border border-paper-deep/40 bg-paper/30"
                  >
                    <span className="text-[9.5px] font-mono text-ink-faint">{item.date.slice(5)}</span>
                    <span className="text-[9.5px] font-body text-ink-soft">
                      {item.action === "cancel"
                        ? t("agenda.override.cancel", { defaultValue: "停课" })
                        : t("agenda.override.moveTo", {
                            start: item.startPeriod,
                            end: item.endPeriod,
                            defaultValue: "调至 {{start}}-{{end}} 节",
                          })}
                    </span>
                    {item.location ? (
                      <span className="text-[9px] font-body text-ink-ghost truncate">{item.location}</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void onDelete(item.id).catch((cause) => showToast(getErrorMessage(cause)))}
                      className="ml-auto text-[9px] font-body text-ink-ghost hover:text-red-400 cursor-pointer"
                    >
                      {t("common.delete", { defaultValue: "删除" })}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
