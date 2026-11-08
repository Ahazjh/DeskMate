import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "../../../components/Toast";
import { getErrorMessage } from "../../notes/api";
import { formatDayHeading } from "../dateUtils";
import { formatPlanRange, planSchedule, type PlanBlock } from "../schedulePlanner";
import type { AgendaSnapshot } from "../types";

interface PlanDialogProps {
  snapshot: AgendaSnapshot;
  today: string;
  locale: string;
  onClose: () => void;
  onGenerate: (blocks: PlanBlock[]) => Promise<void>;
}

type Range = "today" | "week";

export function PlanDialog({ snapshot, today, locale, onClose, onGenerate }: PlanDialogProps) {
  const { t } = useTranslation();
  const [range, setRange] = useState<Range>("today");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [generating, setGenerating] = useState(false);

  const result = useMemo(
    () =>
      planSchedule(snapshot, {
        from: today,
        days: range === "today" ? 1 : 7,
      }),
    [snapshot, today, range],
  );

  const keyOf = (block: PlanBlock) => `${block.todoId}-${block.startAt}`;

  useEffect(() => {
    setSelected(new Set(result.blocks.map((block) => `${block.todoId}-${block.startAt}`)));
  }, [result.blocks]);

  const effectiveSelection = result.blocks.filter((block) => selected.has(keyOf(block)));

  const toggle = (block: PlanBlock) => {
    const key = keyOf(block);
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (effectiveSelection.length === 0 || generating) return;
    setGenerating(true);
    try {
      await onGenerate(effectiveSelection);
      showToast(
        t("agenda.plan.generated", {
          count: effectiveSelection.length,
          defaultValue: "已写入 {{count}} 个计划块",
        }),
        "info",
      );
      onClose();
    } catch (cause) {
      showToast(getErrorMessage(cause));
    } finally {
      setGenerating(false);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, PlanBlock[]>();
    for (const block of result.blocks) {
      const list = map.get(block.date) ?? [];
      list.push(block);
      map.set(block.date, list);
    }
    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [result.blocks]);

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
            {t("agenda.plan.title", { defaultValue: "智能排期" })}
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

        <div className="px-4 py-2 flex items-center gap-2 border-b border-paper-deep/20 shrink-0">
          <div className="flex items-center rounded-md bg-paper-warm/70 p-0.5">
            {[
              { value: "today" as Range, label: t("agenda.plan.today", { defaultValue: "今天" }) },
              { value: "week" as Range, label: t("agenda.plan.week", { defaultValue: "本周" }) },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setRange(option.value);
                  setSelected(new Set());
                }}
                className={`px-2.5 h-6 rounded text-[10px] font-body transition-colors cursor-pointer ${
                  range === option.value
                    ? "bg-cloud text-bamboo shadow-[0_1px_2px_rgba(26,26,24,0.06)]"
                    : "text-ink-ghost hover:text-ink-soft"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="text-[10px] font-body text-ink-ghost">
            {t("agenda.plan.hint", {
              defaultValue: "按 DDL 与预估时长填入空档；默认全选，可逐项取消。",
            })}
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
          {grouped.length === 0 ? (
            <div className="py-10 text-center text-[11px] font-body text-ink-ghost">
              {t("agenda.plan.empty", {
                defaultValue: "没有可排期的待办：先给待办设置截止日期，或调大时间范围。",
              })}
            </div>
          ) : (
            grouped.map(([date, blocks]) => (
              <div key={date}>
                <div className="text-[10px] font-body text-ink-faint mb-1.5">
                  {formatDayHeading(date, locale)}
                </div>
                <div className="space-y-1">
                  {blocks.map((block) => {
                    const active = selected.has(keyOf(block));
                    return (
                      <button
                        key={keyOf(block)}
                        type="button"
                        onClick={() => toggle(block)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          active
                            ? "border-bamboo/40 bg-bamboo-mist/40"
                            : "border-paper-deep/40 bg-paper/30 opacity-60"
                        }`}
                      >
                        <span
                          className={`w-3 h-3 shrink-0 rounded border flex items-center justify-center ${
                            active ? "bg-bamboo border-bamboo" : "border-paper-deep bg-cloud/60"
                          }`}
                        >
                          {active ? (
                            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : null}
                        </span>
                        <span className="w-[86px] shrink-0 text-[9.5px] font-mono text-ink-faint">
                          {formatPlanRange(block)}
                        </span>
                        <span className="flex-1 min-w-0 text-[11px] font-body text-ink-soft truncate">
                          {block.title}
                        </span>
                        <span className="shrink-0 text-[9px] font-body text-ink-ghost">
                          {block.minutes}′
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {result.skipped.length > 0 ? (
            <div className="rounded-lg bg-amber-100/50 border border-amber-200/50 px-3 py-2">
              <div className="text-[10px] font-body text-amber-700">
                {t("agenda.plan.skipped", {
                  count: result.skipped.length,
                  defaultValue: "{{count}} 项没有足够空档，未排入",
                })}
              </div>
              <div className="mt-1 text-[9px] font-body text-amber-700/80 truncate">
                {result.skipped.map((item) => item.title).join(" · ")}
              </div>
            </div>
          ) : null}
        </div>

        <div className="px-4 py-2.5 border-t border-paper-deep/30 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-body text-ink-ghost">
            {t("agenda.plan.selected", {
              count: effectiveSelection.length,
              defaultValue: "将写入 {{count}} 个日程",
            })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 h-7 rounded-lg text-[11px] font-body text-ink-faint hover:bg-paper-warm cursor-pointer"
            >
              {t("common.cancel", { defaultValue: "取消" })}
            </button>
            <button
              type="button"
              disabled={effectiveSelection.length === 0 || generating}
              onClick={() => void handleGenerate()}
              className="px-4 h-7 rounded-lg bg-bamboo text-cloud text-[11px] font-body hover:bg-bamboo-light disabled:opacity-40 cursor-pointer"
            >
              {generating
                ? t("common.saving", { defaultValue: "保存中…" })
                : t("agenda.plan.generate", { defaultValue: "写入日程" })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
