import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "../../../components/Toast";
import { getErrorMessage } from "../../notes/api";
import { todayKey } from "../dateUtils";
import {
  DEFAULT_PERIOD_TIMES,
  DEFAULT_TIMETABLE_SCHEDULE,
  cloneSchedule,
  generatePeriodTimes,
  majorPeriodCount,
  resolveSeason,
  resolveSessionStarts,
  semesterWeek,
} from "../timetable";
import type {
  PeriodTime,
  TimetableSchedule,
  TimetableSettings,
} from "../types";

interface TimetableSettingsDialogProps {
  settings: TimetableSettings;
  onClose: () => void;
  onSave: (settings: TimetableSettings) => Promise<void>;
}

type TimesMode = "auto" | "manual";

const SESSION_KEYS = ["morning", "afternoon", "evening"] as const;
type SessionKey = (typeof SESSION_KEYS)[number];

function NumberField({
  value,
  onChange,
  min = 0,
  max = 240,
  suffix,
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        aria-label={ariaLabel}
        value={value}
        min={min}
        max={max}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
        className="w-14 h-7 px-1.5 rounded border border-paper-deep bg-paper-warm/80 text-[10px] font-mono text-ink-soft outline-none focus:border-bamboo/40"
      />
      {suffix ? (
        <span className="text-[9.5px] font-body text-ink-ghost">{suffix}</span>
      ) : null}
    </div>
  );
}

function TimeField({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="time"
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-7 px-1.5 rounded border border-paper-deep bg-paper-warm/80 text-[10px] font-mono text-ink-soft outline-none focus:border-bamboo/40"
    />
  );
}

export function TimetableSettingsDialog({
  settings,
  onClose,
  onSave,
}: TimetableSettingsDialogProps) {
  const { t } = useTranslation();
  const [semesterStart, setSemesterStart] = useState(settings.semesterStart ?? "");
  const [mode, setMode] = useState<TimesMode>(
    settings.schedule ? "auto" : "manual",
  );
  const [schedule, setSchedule] = useState<TimetableSchedule>(
    settings.schedule ? cloneSchedule(settings.schedule) : cloneSchedule(DEFAULT_TIMETABLE_SCHEDULE),
  );
  const [periodTimes, setPeriodTimes] = useState<PeriodTime[]>(() => {
    const defaults = DEFAULT_PERIOD_TIMES;
    return defaults.map((fallback) => {
      const provided = settings.periodTimes.find((item) => item.period === fallback.period);
      return provided ?? fallback;
    });
  });
  const [saving, setSaving] = useState(false);

  const now = useMemo(() => new Date(), []);
  const currentWeek = useMemo(
    () => semesterWeek(semesterStart || null, todayKey()),
    [semesterStart],
  );

  const activeSeason = resolveSeason(schedule, now);
  const activeStarts = resolveSessionStarts(schedule, now);
  const preview = useMemo(
    () => generatePeriodTimes(schedule, activeStarts),
    [schedule, activeStarts],
  );
  const perMajor = majorPeriodCount(schedule);
  const totalPeriods =
    schedule.sessionPeriods.morning +
    schedule.sessionPeriods.afternoon +
    schedule.sessionPeriods.evening;

  const patchSchedule = (patch: Partial<TimetableSchedule>) => {
    setSchedule((previous) => ({ ...previous, ...patch }));
  };

  const patchSessionPeriods = (
    key: SessionKey,
    value: number,
  ) => {
    setSchedule((previous) => ({
      ...previous,
      sessionPeriods: { ...previous.sessionPeriods, [key]: value },
    }));
  };

  const patchStarts = (
    group: "sessionStarts" | "summerStarts" | "winterStarts",
    key: SessionKey,
    value: string,
  ) => {
    setSchedule((previous) => ({
      ...previous,
      [group]: { ...previous[group], [key]: value },
    }));
  };

  const updateTime = (period: number, field: "start" | "end", value: string) => {
    setPeriodTimes((previous) =>
      previous.map((item) =>
        item.period === period ? { ...item, [field]: value } : item,
      ),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const generated = generatePeriodTimes(schedule, activeStarts);
      await onSave({
        semesterStart: semesterStart || null,
        periodTimes: mode === "auto" ? generated : periodTimes,
        schedule: mode === "auto" ? schedule : null,
      });
      onClose();
    } catch (cause) {
      showToast(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const sessionLabel: Record<SessionKey, string> = {
    morning: t("agenda.timetable.morning", { defaultValue: "早上" }),
    afternoon: t("agenda.timetable.afternoon", { defaultValue: "下午" }),
    evening: t("agenda.timetable.evening", { defaultValue: "晚上" }),
  };

  const renderStartGroup = (
    group: "sessionStarts" | "summerStarts" | "winterStarts",
    title: string,
  ) => (
    <div className="rounded-lg border border-paper-deep/40 bg-paper/30 px-2.5 py-2 space-y-1.5">
      <div className="text-[10px] font-body text-ink-faint">{title}</div>
      <div className="grid grid-cols-3 gap-2">
        {SESSION_KEYS.map((key) => (
          <label key={key} className="flex items-center gap-1.5">
            <span className="text-[9.5px] font-body text-ink-ghost w-6 shrink-0">
              {sessionLabel[key]}
            </span>
            <TimeField
              ariaLabel={`${title}-${key}`}
              value={schedule[group][key]}
              onChange={(value) => patchStarts(group, key, value)}
            />
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/20 backdrop-blur-[1px]"
      onMouseDown={onClose}
    >
      <div
        className="w-[640px] max-w-full max-h-[86vh] flex flex-col bg-cloud rounded-xl border border-paper-deep/50 shadow-2xl overflow-hidden"
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
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
                onClick={() => {
                  setMode("auto");
                  setSchedule(cloneSchedule(DEFAULT_TIMETABLE_SCHEDULE));
                }}
                className="text-[10px] font-body text-ink-ghost hover:text-bamboo transition-colors cursor-pointer"
              >
                {t("agenda.timetable.reset", { defaultValue: "恢复默认" })}
              </button>
            </div>

            <div className="rounded-lg border border-paper-deep/40 overflow-hidden">
              <div className="flex items-center gap-3 px-2.5 py-1.5 border-b border-paper-deep/20 bg-paper-warm/40">
                {(
                  [
                    ["auto", t("agenda.timetable.modeAuto", { defaultValue: "按作息参数自动推算" })],
                    ["manual", t("agenda.timetable.modeManual", { defaultValue: "逐节手动设置" })],
                  ] as Array<[TimesMode, string]>
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="timetable-times-mode"
                      checked={mode === value}
                      onChange={() => setMode(value)}
                      className="accent-bamboo"
                    />
                    <span className="text-[10px] font-body text-ink-soft">{label}</span>
                  </label>
                ))}
              </div>

              {mode === "auto" ? (
                <div className="space-y-3 p-2.5">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-body text-ink-faint">
                        {t("agenda.timetable.periodMinutes", { defaultValue: "每小节时长" })}
                      </span>
                      <NumberField
                        ariaLabel={t("agenda.timetable.periodMinutes", { defaultValue: "每小节时长" })}
                        value={schedule.periodMinutes}
                        min={5}
                        max={240}
                        onChange={(value) => patchSchedule({ periodMinutes: value })}
                        suffix={t("agenda.timetable.minutes", { defaultValue: "分钟" })}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-body text-ink-faint">
                        {t("agenda.timetable.majorPeriodMinutes", { defaultValue: "每大节时长" })}
                      </span>
                      <NumberField
                        ariaLabel={t("agenda.timetable.majorPeriodMinutes", { defaultValue: "每大节时长" })}
                        value={schedule.majorPeriodMinutes}
                        min={schedule.periodMinutes}
                        max={480}
                        onChange={(value) => patchSchedule({ majorPeriodMinutes: value })}
                        suffix={t("agenda.timetable.minutes", { defaultValue: "分钟" })}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-body text-ink-faint">
                        {t("agenda.timetable.shortBreak", { defaultValue: "小课间" })}
                      </span>
                      <NumberField
                        ariaLabel={t("agenda.timetable.shortBreak", { defaultValue: "小课间" })}
                        value={schedule.shortBreakMinutes}
                        min={0}
                        max={180}
                        onChange={(value) => patchSchedule({ shortBreakMinutes: value })}
                        suffix={t("agenda.timetable.minutes", { defaultValue: "分钟" })}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-body text-ink-faint">
                        {t("agenda.timetable.longBreak", { defaultValue: "大课间" })}
                      </span>
                      <NumberField
                        ariaLabel={t("agenda.timetable.longBreak", { defaultValue: "大课间" })}
                        value={schedule.longBreakMinutes}
                        min={0}
                        max={240}
                        onChange={(value) => patchSchedule({ longBreakMinutes: value })}
                        suffix={t("agenda.timetable.minutes", { defaultValue: "分钟" })}
                      />
                    </label>
                  </div>

                  <div className="text-[9.5px] font-body text-ink-ghost">
                    {t("agenda.timetable.majorHint", {
                      count: perMajor,
                      defaultValue: "每大节含 {{count}} 小节（大节时长不含课间）",
                    })}
                  </div>

                  <div className="rounded-lg border border-paper-deep/40 bg-paper/30 px-2.5 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-body text-ink-faint">
                        {t("agenda.timetable.dailyPeriods", { defaultValue: "每日节数与开始时间" })}
                      </span>
                      <span className="text-[9.5px] font-body text-ink-ghost">
                        {t("agenda.timetable.totalPeriods", {
                          count: totalPeriods,
                          defaultValue: "共 {{count}} 节",
                        })}
                      </span>
                    </div>
                    {SESSION_KEYS.map((key) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-[9.5px] font-body text-ink-ghost w-6 shrink-0">
                          {sessionLabel[key]}
                        </span>
                        <NumberField
                          ariaLabel={`${sessionLabel[key]}节数`}
                          value={schedule.sessionPeriods[key]}
                          min={0}
                          max={20}
                          onChange={(value) => patchSessionPeriods(key, value)}
                        />
                        <span className="text-[9.5px] font-body text-ink-ghost">
                          {t("agenda.timetable.periodsUnit", { defaultValue: "节" })}
                        </span>
                        <TimeField
                          ariaLabel={`${sessionLabel[key]}开始时间`}
                          value={schedule.sessionStarts[key]}
                          onChange={(value) => patchStarts("sessionStarts", key, value)}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-paper-deep/40 bg-paper/30 px-2.5 py-2 space-y-2">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="timetable-season"
                          checked={!schedule.seasonal}
                          onChange={() => patchSchedule({ seasonal: false })}
                          className="accent-bamboo"
                        />
                        <span className="text-[10px] font-body text-ink-soft">
                          {t("agenda.timetable.seasonYearRound", { defaultValue: "全年一致" })}
                        </span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="timetable-season"
                          checked={schedule.seasonal}
                          onChange={() => patchSchedule({ seasonal: true })}
                          className="accent-bamboo"
                        />
                        <span className="text-[10px] font-body text-ink-soft">
                          {t("agenda.timetable.seasonal", { defaultValue: "夏令时 / 冬令时" })}
                        </span>
                      </label>
                    </div>

                    {schedule.seasonal ? (
                      <div className="space-y-2">
                        {renderStartGroup(
                          "summerStarts",
                          t("agenda.timetable.summer", { defaultValue: "夏令时" }),
                        )}
                        <div className="flex items-center gap-2 px-0.5">
                          <span className="text-[9.5px] font-body text-ink-ghost">
                            {t("agenda.timetable.summerSwitch", { defaultValue: "夏令时起" })}
                          </span>
                          <input
                            type="text"
                            aria-label={t("agenda.timetable.summerSwitch", { defaultValue: "夏令时起" })}
                            value={schedule.summerStartDate}
                            placeholder="MM-DD"
                            onChange={(event) =>
                              patchSchedule({ summerStartDate: event.target.value })
                            }
                            className="w-16 h-6 px-1.5 rounded border border-paper-deep bg-paper-warm/80 text-[10px] font-mono text-ink-soft outline-none focus:border-bamboo/40"
                          />
                        </div>
                        {renderStartGroup(
                          "winterStarts",
                          t("agenda.timetable.winter", { defaultValue: "冬令时" }),
                        )}
                        <div className="flex items-center gap-2 px-0.5">
                          <span className="text-[9.5px] font-body text-ink-ghost">
                            {t("agenda.timetable.winterSwitch", { defaultValue: "冬令时起" })}
                          </span>
                          <input
                            type="text"
                            aria-label={t("agenda.timetable.winterSwitch", { defaultValue: "冬令时起" })}
                            value={schedule.winterStartDate}
                            placeholder="MM-DD"
                            onChange={(event) =>
                              patchSchedule({ winterStartDate: event.target.value })
                            }
                            className="w-16 h-6 px-1.5 rounded border border-paper-deep bg-paper-warm/80 text-[10px] font-mono text-ink-soft outline-none focus:border-bamboo/40"
                          />
                        </div>
                        <div className="text-[9.5px] font-body text-ink-ghost">
                          {t("agenda.timetable.seasonCurrent", {
                            season:
                              activeSeason === "summer"
                                ? t("agenda.timetable.summer", { defaultValue: "夏令时" })
                                : t("agenda.timetable.winter", { defaultValue: "冬令时" }),
                            defaultValue: "当前生效：{{season}}",
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-paper-deep/40 overflow-hidden">
                    <div className="px-2.5 py-1 bg-paper-warm/50 text-[9.5px] font-body text-ink-ghost">
                      {t("agenda.timetable.preview", { defaultValue: "推算结果" })}
                    </div>
                    <div className="px-2.5 py-1.5 grid grid-cols-4 gap-x-3 gap-y-0.5">
                      {preview.map((item) => (
                        <div
                          key={item.period}
                          className="text-[9.5px] font-mono text-ink-ghost"
                        >
                          {t("agenda.course.periodShort", {
                            period: item.period,
                            defaultValue: "第{{period}}节",
                          })}{" "}
                          {item.start}–{item.end}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
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
                      <TimeField
                        ariaLabel={`第${item.period}节开始`}
                        value={item.start}
                        onChange={(value) => updateTime(item.period, "start", value)}
                      />
                      <span className="text-[10px] text-ink-ghost/50">–</span>
                      <TimeField
                        ariaLabel={`第${item.period}节结束`}
                        value={item.end}
                        onChange={(value) => updateTime(item.period, "end", value)}
                      />
                    </div>
                  ))}
                </div>
              )}
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
