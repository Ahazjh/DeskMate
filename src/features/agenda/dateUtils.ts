export type WeekStart = 0 | 1;

export const WEEK_STARTS_ON: WeekStart = 1;

const MINUTES_PER_DAY = 24 * 60;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Local calendar key. Never use toISOString() here: it shifts across UTC midnight. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayKey(now: Date = new Date()): string {
  return dayKey(now);
}

/** Local midnight for a `YYYY-MM-DD` key. */
export function parseDayKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

export function addDaysToKey(key: string, amount: number): string {
  return dayKey(addDays(parseDayKey(key), amount));
}

export function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function startOfWeek(date: Date, weekStartsOn: WeekStart = WEEK_STARTS_ON): Date {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (base.getDay() - weekStartsOn + 7) % 7;
  return addDays(base, -diff);
}

/** Fixed 42 cells so month height never jumps. */
export function monthGrid(
  year: number,
  month: number,
  weekStartsOn: WeekStart = WEEK_STARTS_ON,
): string[] {
  const first = new Date(year, month, 1);
  const gridStart = startOfWeek(first, weekStartsOn);
  return Array.from({ length: 42 }, (_, index) => dayKey(addDays(gridStart, index)));
}

export function weekKeys(startKey: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDaysToKey(startKey, index));
}

export function startOfDayIso(key: string): string {
  return parseDayKey(key).toISOString();
}

export function endOfDayIso(key: string): string {
  const date = parseDayKey(key);
  date.setDate(date.getDate() + 1);
  date.setMilliseconds(date.getMilliseconds() - 1);
  return date.toISOString();
}

export function combineDateTime(key: string, time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const date = parseDayKey(key);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date.toISOString();
}

export function isoDayKey(iso: string): string {
  return dayKey(new Date(iso));
}

export function isoTime(iso: string): string {
  const date = new Date(iso);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function minutesFromMidnight(iso: string): number {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
}

export function durationMinutes(startIso: string, endIso: string): number {
  return Math.max(0, (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
}

export function isSameMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month;
}

export function formatMonthTitle(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(date);
}

export function formatDayHeading(key: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parseDayKey(key));
}

export function formatClock(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

export function weekdayLabels(locale: string, weekStartsOn: WeekStart = WEEK_STARTS_ON): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  // 2024-01-01 is a Monday; use it as a stable anchor for label generation.
  const anchor = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(addDays(anchor, (index + weekStartsOn - 1 + 7) % 7)),
  );
}

export function minutesPerDay(): number {
  return MINUTES_PER_DAY;
}
