import type { Course, PeriodTime, TimetableSettings } from "./types";
import { parseDayKey } from "./dateUtils";

export const DEFAULT_PERIOD_TIMES: PeriodTime[] = [
  { period: 1, start: "08:00", end: "08:45" },
  { period: 2, start: "08:55", end: "09:40" },
  { period: 3, start: "10:00", end: "10:45" },
  { period: 4, start: "10:55", end: "11:40" },
  { period: 5, start: "14:00", end: "14:45" },
  { period: 6, start: "14:55", end: "15:40" },
  { period: 7, start: "16:00", end: "16:45" },
  { period: 8, start: "16:55", end: "17:40" },
  { period: 9, start: "19:00", end: "19:45" },
  { period: 10, start: "19:55", end: "20:40" },
  { period: 11, start: "20:50", end: "21:35" },
  { period: 12, start: "21:45", end: "22:30" },
];

export function defaultTimetableSettings(): TimetableSettings {
  return {
    semesterStart: null,
    periodTimes: DEFAULT_PERIOD_TIMES.map((item) => ({ ...item })),
  };
}

export function periodTime(settings: TimetableSettings, period: number): PeriodTime | undefined {
  return settings.periodTimes.find((item) => item.period === period);
}

export function formatPeriodTime(settings: TimetableSettings, period: number): string {
  const item = periodTime(settings, period);
  return item ? `${item.start}–${item.end}` : "";
}

export function formatCourseTime(course: Course, settings: TimetableSettings): string {
  const start = periodTime(settings, course.startPeriod);
  const end = periodTime(settings, course.endPeriod);
  if (!start || !end) return "";
  return `${start.start}–${end.end}`;
}

/** Week 1 starts on semesterStart; returns 0 before the semester, null when unset. */
export function semesterWeek(semesterStart: string | null, today: string): number | null {
  if (!semesterStart) return null;
  const start = parseDayKey(semesterStart);
  const current = parseDayKey(today);
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const currentUtc = Date.UTC(current.getFullYear(), current.getMonth(), current.getDate());
  const days = Math.floor((currentUtc - startUtc) / 86_400_000);
  if (days < 0) return 0;
  return Math.floor(days / 7) + 1;
}

/**
 * Best-effort parser for the free-text weeks field:
 * "1-16周", "1-8,10-16周", "单周", "双周", "第3周".
 * Empty or unrecognized values are treated as "every week".
 */
export function courseMatchesWeek(weeks: string, week: number): boolean {
  const text = weeks.trim();
  if (!text) return true;
  if (week <= 0) return false;

  const normalized = text
    .replace(/[，、]/g, ",")
    .replace(/[～—–~]/g, "-")
    .replace(/\s+/g, "");

  const odd = /单周|odd/i.test(normalized);
  const even = /双周|even/i.test(normalized);
  if (odd && !even && week % 2 === 0) return false;
  if (even && !odd && week % 2 === 1) return false;

  const ranges = [...normalized.matchAll(/(\d{1,2})-(\d{1,2})/g)];
  const singles = [...normalized.matchAll(/(?<![\d-])(\d{1,2})(?![\d-])/g)];

  if (ranges.length === 0 && singles.length === 0) return true;

  for (const match of ranges) {
    if (week >= Number(match[1]) && week <= Number(match[2])) return true;
  }
  for (const match of singles) {
    if (week === Number(match[1])) return true;
  }
  return false;
}

export function coursesForWeek(courses: Course[], week: number): Course[] {
  return courses.filter((course) => courseMatchesWeek(course.weeks, week));
}
