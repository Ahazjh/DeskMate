import { addDays, dayKey, parseDayKey, combineDateTime } from "./dateUtils";
import type { Priority } from "./types";

export type QuickChipKind =
  | "tag"
  | "priority"
  | "date"
  | "time"
  | "remind"
  | "recurrence";

export interface QuickChip {
  kind: QuickChipKind;
  label: string;
}

export interface QuickAddResult {
  title: string;
  tags: string[];
  priority: Priority;
  dueDate: string | null;
  dueAt: string | null;
  remindMinutes: number | null;
  recurrence: string | null;
  chips: QuickChip[];
  /** 语法能识别，但当前数据模型还没有落点，需提示用户。 */
  warnings: string[];
}

const TAG_PATTERN = /#([^\s#!，,。]+)/g;
const PRIORITY_PATTERN = /(^|\s)(!{1,3})(?=\s|$)/g;
const REMIND_PATTERN = /提前(\d{1,3})\s*(分钟|小时|分|时)/g;
const RECURRENCE_PATTERN = /(每天|每周[一二三四五六日天]?|每月\d{1,2}[号日]?)/g;
const ISO_DATE_PATTERN = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
const SLASH_DATE_PATTERN = /\b(\d{1,2})\/(\d{1,2})\b/g;
const CN_DATE_PATTERN = /(\d{1,2})月(\d{1,2})[日号]/g;
const RELATIVE_DATE_PATTERN = /(今天|明天|后天|大后天|下?周[一二三四五六日天])/g;
const CLOCK_PATTERN = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;
const CN_CLOCK_PATTERN = /(上午|中午|下午|晚上|晚|早)?(\d{1,2})点(半|(\d{1,2})分?)?/g;

const WEEKDAY_INDEX: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0,
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function key(date: Date): string {
  return dayKey(date);
}

function withYear(date: Date, month: number, day: number): string {
  const candidate = new Date(date.getFullYear(), month - 1, day);
  // 未写年份时，已经过去的月日默认指明年
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (candidate < today) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }
  return key(candidate);
}

function nextWeekday(base: Date, weekday: number, nextWeek: boolean): Date {
  const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const diff = (weekday - today.getDay() + 7) % 7;
  const offset = diff === 0 ? (nextWeek ? 7 : 0) : diff + (nextWeek ? 7 : 0);
  return addDays(today, offset);
}

function validClock(hour: number, minute: number): boolean {
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

/**
 * 本地规则解析，无副作用、不联网、不调 LLM。
 * 按顺序消费各类 token，剩余文本作为标题；解析失败不阻断保存。
 */
export function parseQuickAdd(input: string, now: Date = new Date()): QuickAddResult {
  let rest = input;
  const tags: string[] = [];
  const chips: QuickChip[] = [];
  const warnings: string[] = [];
  let priority: Priority = 0;
  let dueDate: string | null = null;
  let time: string | null = null;
  let remindMinutes: number | null = null;
  let recurrence: string | null = null;
  let dateUnrecognized = false;

  rest = rest.replace(TAG_PATTERN, (_match, tag: string) => {
    const normalized = tag.trim();
    if (normalized && !tags.includes(normalized) && tags.length < 20) {
      tags.push(normalized);
      chips.push({ kind: "tag", label: `#${normalized}` });
    }
    return " ";
  });

  rest = rest.replace(PRIORITY_PATTERN, (_match, prefix: string, marks: string) => {
    priority = Math.min(3, marks.length) as Priority;
    chips.push({ kind: "priority", label: "!".repeat(marks.length) });
    return prefix;
  });

  rest = rest.replace(REMIND_PATTERN, (_match, amount: string, unit: string) => {
    const value = Number(amount);
    remindMinutes = unit.startsWith("小") || unit === "时" ? value * 60 : value;
    chips.push({ kind: "remind", label: `提前 ${remindMinutes} 分钟` });
    return " ";
  });

  rest = rest.replace(RECURRENCE_PATTERN, (match) => {
    recurrence = match;
    chips.push({ kind: "recurrence", label: match });
    return " ";
  });

  rest = rest.replace(ISO_DATE_PATTERN, (match, year: string, month: string, day: string) => {
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      parsed.getFullYear() === Number(year) &&
      parsed.getMonth() === Number(month) - 1 &&
      parsed.getDate() === Number(day)
    ) {
      dueDate = key(parsed);
      chips.push({ kind: "date", label: match });
      return " ";
    }
    dateUnrecognized = true;
    return " ";
  });

  rest = rest.replace(SLASH_DATE_PATTERN, (match, month: string, day: string) => {
    const monthNumber = Number(month);
    const dayNumber = Number(day);
    if (monthNumber >= 1 && monthNumber <= 12 && dayNumber >= 1 && dayNumber <= 31) {
      dueDate = withYear(now, monthNumber, dayNumber);
      chips.push({ kind: "date", label: match });
      return " ";
    }
    dateUnrecognized = true;
    return " ";
  });

  rest = rest.replace(CN_DATE_PATTERN, (match, month: string, day: string) => {
    const monthNumber = Number(month);
    const dayNumber = Number(day);
    if (monthNumber >= 1 && monthNumber <= 12 && dayNumber >= 1 && dayNumber <= 31) {
      dueDate = withYear(now, monthNumber, dayNumber);
      chips.push({ kind: "date", label: match });
      return " ";
    }
    dateUnrecognized = true;
    return " ";
  });

  rest = rest.replace(RELATIVE_DATE_PATTERN, (match) => {
    if (match === "今天") {
      dueDate = key(now);
    } else if (match === "明天") {
      dueDate = key(addDays(now, 1));
    } else if (match === "后天") {
      dueDate = key(addDays(now, 2));
    } else if (match === "大后天") {
      dueDate = key(addDays(now, 3));
    } else {
      const nextWeek = match.startsWith("下");
      const weekdayChar = match.slice(-1);
      const weekday = WEEKDAY_INDEX[weekdayChar];
      if (weekday === undefined) {
        dateUnrecognized = true;
        return " ";
      }
      dueDate = key(nextWeekday(now, weekday, nextWeek));
    }
    chips.push({ kind: "date", label: match });
    return " ";
  });

  rest = rest.replace(CLOCK_PATTERN, (match, hour: string, minute: string) => {
    if (!validClock(Number(hour), Number(minute))) {
      return " ";
    }
    time = `${pad(Number(hour))}:${pad(Number(minute))}`;
    chips.push({ kind: "time", label: match });
    return " ";
  });

  rest = rest.replace(
    CN_CLOCK_PATTERN,
    (match, period: string | undefined, hour: string, half: string | undefined, minutes: string | undefined) => {
      let parsedHour = Number(hour);
      const parsedMinute = half === "半" ? 30 : minutes ? Number(minutes) : 0;
      if (/下午|晚上|晚/.test(period ?? "") && parsedHour < 12) {
        parsedHour += 12;
      }
      if (period === "中午" && parsedHour < 12) {
        parsedHour = 12;
      }
      if (!validClock(parsedHour, parsedMinute)) {
        dateUnrecognized = true;
        return " ";
      }
      time = `${pad(parsedHour)}:${pad(parsedMinute)}`;
      chips.push({ kind: "time", label: match });
      return " ";
    },
  );

  const title = rest.replace(/\s+/g, " ").trim();
  const effectiveDate = time && !dueDate ? key(now) : dueDate;
  const dueAt =
    effectiveDate && time ? combineDateTime(effectiveDate, time) : null;

  if (recurrence) {
    warnings.push("recurrence");
  }
  if (dateUnrecognized) {
    warnings.push("date");
  }

  return {
    title,
    tags,
    priority,
    dueDate: effectiveDate,
    dueAt,
    remindMinutes,
    recurrence,
    chips,
    warnings,
  };
}

/** 把解析结果映射为创建待办的请求体。 */
export function quickAddToInput(result: QuickAddResult) {
  return {
    title: result.title,
    priority: result.priority,
    tags: result.tags,
    dueDate: result.dueAt ? null : result.dueDate,
    dueAt: result.dueAt,
    remindMinutes: result.remindMinutes,
  };
}

/** 供 UI 展示日期 chip 的可读文本。 */
export function describeDueDate(value: string | null, now: Date = new Date()): string {
  if (!value) return "";
  const target = parseDayKey(value);
  const today = dayKey(now);
  if (value === today) return "今天";
  if (value === key(addDays(now, 1))) return "明天";
  if (value === key(addDays(now, 2))) return "后天";
  return `${target.getMonth() + 1}月${target.getDate()}日`;
}
