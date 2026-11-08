import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { showToast } from "../../components/Toast";
import { createTodo } from "./api";
import { getErrorMessage } from "../notes/api";
import { addDaysToKey, combineDateTime, isoDayKey, isoTime, todayKey } from "./dateUtils";
import { describeDueDate, parseQuickAdd, quickAddToInput } from "./quickAdd";

type DueChoice = number | null | "auto" | "custom";

const QUICK_DUE_OPTIONS = [
  { days: 0, key: "today" },
  { days: 1, key: "tomorrow" },
  { days: 2, key: "dayAfter" },
  { days: null, key: "noDate" },
] as const;

const CHIP_STYLE: Record<string, string> = {
  tag: "bg-bamboo-mist/70 text-bamboo",
  priority: "bg-amber-100/70 text-amber-700",
  date: "bg-paper-warm text-ink-faint",
  time: "bg-paper-warm text-ink-faint",
  remind: "bg-blue-50 text-blue-600",
  recurrence: "bg-paper-deep/40 text-ink-ghost",
};

export function QuickTodoWindow() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [dueChoice, setDueChoice] = useState<DueChoice>("auto");
  const [customDate, setCustomDate] = useState(() => todayKey());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 小窗有透明边距，深色模式下会透出 WebView 的白色背景；给根层铺不透明主题色
  useEffect(() => {
    document.documentElement.classList.add("widget-window");
    return () => document.documentElement.classList.remove("widget-window");
  }, []);

  useEffect(() => {
    const current = getCurrentWindow();
    // 不依赖 show() 的 Promise 链：任意一步失败都会让输入框拿不到键盘焦点。
    // Rust 端已直接 show + set_focus，这里只做兜底。
    void current.show().catch(() => undefined);
    void current.setFocus().catch(() => undefined);
    const focusInput = () => inputRef.current?.focus();
    focusInput();
    const timers = [80, 250, 600].map((delay) => globalThis.setTimeout(focusInput, delay));
    const unlisten = current.onFocusChanged(({ payload: focused }) => {
      if (focused) focusInput();
    });
    return () => {
      timers.forEach((timer) => globalThis.clearTimeout(timer));
      void unlisten.then((fn) => fn());
    };
  }, []);

  const parsed = useMemo(() => parseQuickAdd(title), [title]);

  const resolved = useMemo(() => {
    if (dueChoice === "auto") return parsed;
    const date =
      dueChoice === "custom"
        ? customDate || todayKey()
        : dueChoice === null
          ? null
          : addDaysToKey(todayKey(), dueChoice);
    const time = parsed.dueAt ? isoTime(parsed.dueAt) : null;
    return {
      ...parsed,
      dueDate: date,
      dueAt: date && time ? combineDateTime(date, time) : null,
    };
  }, [parsed, dueChoice, customDate]);

  const hide = () => {
    setTitle("");
    setDueChoice("auto");
    setCustomDate(todayKey());
    setError(null);
    setSaving(false);
    // 窗口隐藏后 WebView 可能被挂起，hide() 的 Promise 不一定会 resolve；
    // 绝不能 await 它，否则 saving 会卡死并禁用输入框。
    void getCurrentWindow().hide().catch(() => undefined);
  };

  const save = async () => {
    const input = quickAddToInput(resolved);
    const finalTitle = input.title || title.trim();
    if (!finalTitle) {
      setError(t("quickTodo.empty", { defaultValue: "先写点什么" }));
      inputRef.current?.focus();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createTodo({ ...input, title: finalTitle });
      showToast(t("agenda.toast.saved", { defaultValue: "已保存" }), "info");
      hide();
    } catch (cause) {
      setError(getErrorMessage(cause));
      setSaving(false);
    }
  };

  const activeOption = (days: number | null) => {
    if (dueChoice !== "auto") return dueChoice === days;
    if (!resolved.dueAt && !resolved.dueDate) return false;
    const key = resolved.dueAt ? isoDayKey(resolved.dueAt) : resolved.dueDate;
    return days === null ? false : key === addDaysToKey(todayKey(), days);
  };

  return (
    <div className="h-screen w-screen p-2 bg-transparent select-none">
      <div className="app-surface-frame h-full flex flex-col bg-cloud border border-paper-deep/60 shadow-[0_14px_36px_rgba(0,0,0,0.22)] overflow-hidden">
        <div
          data-tauri-drag-region="true"
          className="h-8 px-3 flex items-center justify-between border-b border-paper-deep/30 shrink-0 cursor-default"
        >
          <span className="text-[10px] font-body tracking-wider uppercase text-ink-ghost">
            {t("quickTodo.title", { defaultValue: "快速待办" })}
          </span>
          <span className="text-[9px] font-body text-ink-ghost/70">
            {t("quickTodo.hintSyntax", {
              defaultValue: "#标签 · !优先级 · 明天 15:00 · 提前30分钟",
            })}
          </span>
          <button
            type="button"
            onClick={() => void hide()}
            aria-label={t("common.close", { defaultValue: "关闭" })}
            className="w-5 h-5 flex items-center justify-center rounded text-ink-ghost hover:text-ink-soft hover:bg-paper-warm transition-colors cursor-pointer"
          >
            <svg
              width="9"
              height="9"
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

        <div className="flex-1 min-h-0 px-3 py-2 flex flex-col gap-1.5">
          <input
            ref={inputRef}
            value={title}
            disabled={saving}
            onChange={(event) => {
              setTitle(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void save();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                void hide();
              }
            }}
            placeholder={t("quickTodo.placeholder", { defaultValue: "记一条待办，回车保存" })}
            className="w-full text-[15px] font-body text-ink placeholder:text-ink-ghost/60 bg-transparent border-b border-paper-deep/40 pb-2 focus:border-bamboo/50 outline-none disabled:opacity-60"
          />

          <div className="h-[22px] flex items-center gap-1 overflow-x-auto shrink-0">
            {resolved.chips.length === 0 ? (
              <span className="text-[9px] font-body text-ink-ghost/60">
                {t("quickTodo.parsed", { defaultValue: "输入时自动识别标签、日期与优先级" })}
              </span>
            ) : (
              resolved.chips.map((chip, index) => (
                <span
                  key={`${chip.kind}-${index}-${chip.label}`}
                  className={`shrink-0 h-[18px] px-1.5 rounded-md text-[9px] font-body leading-[18px] ${
                    CHIP_STYLE[chip.kind] ?? "bg-paper-warm text-ink-faint"
                  }`}
                >
                  {chip.label}
                </span>
              ))
            )}
          </div>

          {resolved.warnings.length > 0 || resolved.dueAt || resolved.dueDate ? (
            <div className="min-h-[14px] flex items-center gap-2 text-[9px] font-body text-ink-ghost shrink-0">
              {resolved.dueAt || resolved.dueDate ? (
                <span className="text-bamboo">
                  {describeDueDate(resolved.dueAt ? isoDayKey(resolved.dueAt) : resolved.dueDate)}
                  {resolved.dueAt ? ` ${isoTime(resolved.dueAt)}` : ""}
                </span>
              ) : null}
              {resolved.warnings.includes("recurrence") ? (
                <span>{t("quickTodo.warnRecurrence", { defaultValue: "重复规则暂未支持" })}</span>
              ) : null}
              {resolved.warnings.includes("date") ? (
                <span>{t("quickTodo.warnDate", { defaultValue: "有日期未能识别" })}</span>
              ) : null}
            </div>
          ) : (
            <div className="h-[14px] shrink-0" />
          )}

          <div className="flex items-center gap-1.5">
            {QUICK_DUE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setDueChoice(option.days)}
                className={`h-6 px-2 rounded-md text-[10px] font-body transition-colors cursor-pointer ${
                  activeOption(option.days)
                    ? "bg-bamboo text-cloud"
                    : "text-ink-faint hover:text-ink-soft hover:bg-paper-warm"
                }`}
              >
                {t(`quickTodo.due.${option.key}`, {
                  defaultValue: {
                    today: "今天",
                    tomorrow: "明天",
                    dayAfter: "后天",
                    noDate: "无日期",
                  }[option.key],
                })}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDueChoice("custom")}
              title={t("quickTodo.due.custom", { defaultValue: "自定义日期" })}
              className={`h-6 px-2 rounded-md text-[10px] font-body transition-colors cursor-pointer ${
                dueChoice === "custom"
                  ? "bg-bamboo text-cloud"
                  : "text-ink-faint hover:text-ink-soft hover:bg-paper-warm"
              }`}
            >
              {t("quickTodo.due.custom", { defaultValue: "自定义" })}
            </button>
            <span className="ml-auto text-[9px] font-body text-ink-ghost/70">
              {t("quickTodo.hint", { defaultValue: "Enter 保存 · Esc 关闭" })}
            </span>
          </div>

          {dueChoice === "custom" ? (
            <div className="flex items-center gap-2 h-[24px] shrink-0">
              <input
                type="date"
                value={customDate}
                onChange={(event) => setCustomDate(event.target.value)}
                className="h-6 px-2 rounded-md border border-paper-deep bg-paper-warm/80 text-[10px] font-body text-ink-soft outline-none focus:border-bamboo/40"
              />
              <span className="text-[9px] font-body text-ink-ghost">
                {t("quickTodo.due.customHint", { defaultValue: "选择任意日期" })}
              </span>
            </div>
          ) : null}

          {error ? (
            <div className="text-[10px] font-body text-red-400 truncate">{error}</div>
          ) : (
            <div className="h-[12px]" />
          )}
        </div>
      </div>
    </div>
  );
}
