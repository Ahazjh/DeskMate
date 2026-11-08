import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "../../../components/Toast";
import { getErrorMessage } from "../../notes/api";
import { addDaysToKey, combineDateTime, isoDayKey, isoTime, parseDayKey } from "../dateUtils";
import { DEFAULT_EVENT_COLOR, EVENT_COLORS } from "../eventUtils";
import type { AgendaEvent, EventInput } from "../types";

interface EventDrawerProps {
  event: AgendaEvent | null;
  defaultDay: string;
  defaultMinutes?: number;
  locale: string;
  onClose: () => void;
  onSave: (input: EventInput) => Promise<void>;
  onDelete: (event: AgendaEvent) => void;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function EventDrawer({
  event,
  defaultDay,
  defaultMinutes,
  locale,
  onClose,
  onSave,
  onDelete,
}: EventDrawerProps) {
  const { t } = useTranslation();
  const titleRef = useRef<HTMLInputElement>(null);

  const initialStart = event ? isoTime(event.startAt) : minutesToTime(defaultMinutes ?? 9 * 60);
  const initialEndMinutes =
    defaultMinutes !== undefined ? Math.min(defaultMinutes + 60, 23 * 60 + 59) : 10 * 60;

  const [title, setTitle] = useState(event?.title ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startDay, setStartDay] = useState(
    event ? (event.startDate ?? isoDayKey(event.startAt)) : defaultDay,
  );
  const [endDay, setEndDay] = useState(
    event ? (event.endDate ?? isoDayKey(event.endAt)) : defaultDay,
  );
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(
    event ? isoTime(event.endAt) : minutesToTime(initialEndMinutes),
  );
  const [color, setColor] = useState(event?.color ?? DEFAULT_EVENT_COLOR);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      showToast(t("agenda.event.titleRequired", { defaultValue: "请先填写标题" }));
      return;
    }

    const safeEndDay = endDay < startDay ? startDay : endDay;
    let startAt: string;
    let endAt: string;

    if (allDay) {
      startAt = combineDateTime(startDay, "00:00");
      endAt = combineDateTime(addDaysToKey(safeEndDay, 1), "00:00");
    } else {
      startAt = combineDateTime(startDay, startTime);
      endAt = combineDateTime(safeEndDay, endTime);
      if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
        endAt = new Date(new Date(startAt).getTime() + 30 * 60000).toISOString();
      }
    }

    const input: EventInput = {
      title: trimmed,
      notes,
      allDay,
      startAt,
      endAt,
      startDate: allDay ? startDay : null,
      endDate: allDay ? safeEndDay : null,
      color,
    };

    setSaving(true);
    try {
      await onSave(input);
      onClose();
    } catch (cause) {
      showToast(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const dayLabel = (key: string) =>
    parseDayKey(key).toLocaleDateString(locale, { month: "short", day: "numeric" });

  return (
    <aside className="w-[320px] shrink-0 flex flex-col border-l border-paper-deep/30 bg-cloud min-h-0">
      <div className="h-10 px-4 flex items-center justify-between border-b border-paper-deep/30 shrink-0">
        <span className="text-[12px] font-body font-medium text-ink-soft">
          {event
            ? t("agenda.event.editTitle", { defaultValue: "编辑日程" })
            : t("agenda.event.new", { defaultValue: "新建日程" })}
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
          placeholder={t("agenda.event.titlePlaceholder", { defaultValue: "日程标题" })}
          className="w-full text-[14px] font-body text-ink placeholder:text-ink-ghost/60 bg-transparent border-b border-paper-deep/40 pb-1.5 focus:border-bamboo/50 outline-none"
        />

        <label className="flex items-center justify-between">
          <span className="text-[11px] font-body text-ink-faint">
            {t("agenda.calendar.allDay", { defaultValue: "全天" })}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={allDay}
            onClick={() => setAllDay((value) => !value)}
            className={`w-8 h-4 rounded-full transition-colors cursor-pointer ${
              allDay ? "bg-bamboo" : "bg-paper-deep"
            }`}
          >
            <span
              className={`block w-3 h-3 rounded-full bg-cloud transition-transform ${
                allDay ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-body text-ink-ghost">
              {t("agenda.event.startDate", { defaultValue: "开始日期" })}
            </span>
            <input
              type="date"
              value={startDay}
              onChange={(event) => {
                setStartDay(event.target.value);
                if (endDay < event.target.value) setEndDay(event.target.value);
              }}
              className="h-8 px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft focus:border-bamboo/40 outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-body text-ink-ghost">
              {t("agenda.event.endDate", { defaultValue: "结束日期" })}
            </span>
            <input
              type="date"
              value={endDay}
              min={startDay}
              onChange={(event) => setEndDay(event.target.value)}
              className="h-8 px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft focus:border-bamboo/40 outline-none"
            />
          </label>
        </div>

        {!allDay ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-body text-ink-ghost">
                {t("agenda.event.startTime", { defaultValue: "开始时间" })}
              </span>
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="h-8 px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft focus:border-bamboo/40 outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-body text-ink-ghost">
                {t("agenda.event.endTime", { defaultValue: "结束时间" })}
              </span>
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="h-8 px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft focus:border-bamboo/40 outline-none"
              />
            </label>
          </div>
        ) : (
          <div className="text-[10px] font-body text-ink-ghost">
            {dayLabel(startDay)} – {dayLabel(endDay)}
          </div>
        )}

        <div>
          <div className="text-[10px] font-body text-ink-ghost pb-1">
            {t("agenda.event.color", { defaultValue: "颜色" })}
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

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-body text-ink-ghost">
            {t("agenda.event.notes", { defaultValue: "备注" })}
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={5}
            placeholder={t("agenda.event.notesPlaceholder", {
              defaultValue: "地点、参与人、议程…",
            })}
            className="px-2 py-1.5 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft placeholder:text-ink-ghost/50 focus:border-bamboo/40 outline-none resize-none leading-relaxed"
          />
        </label>
      </div>

      <div className="px-4 py-2.5 border-t border-paper-deep/30 flex items-center justify-between shrink-0">
        {event ? (
          <button
            type="button"
            onClick={() => onDelete(event)}
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
