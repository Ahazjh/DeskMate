import type {
  Course,
  PeriodTime,
  SessionStartTimes,
  TimetableSchedule,
  TimetableSettings,
} from "./types";
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

/** 每天最多排多少节 */
export const MAX_PERIODS_PER_DAY = 20;

export const DEFAULT_TIMETABLE_SCHEDULE: TimetableSchedule = {
  periodMinutes: 45,
  majorPeriodMinutes: 90,
  shortBreakMinutes: 10,
  longBreakMinutes: 15,
  sessionPeriods: { morning: 5, afternoon: 4, evening: 3 },
  sessionStarts: { morning: "08:00", afternoon: "13:30", evening: "18:30" },
  seasonal: false,
  summerStarts: { morning: "07:00", afternoon: "12:30", evening: "17:30" },
  winterStarts: { morning: "08:00", afternoon: "13:30", evening: "18:30" },
  summerStartDate: "05-01",
  winterStartDate: "10-01",
};

/** 深拷贝一份作息参数，避免各处共享同一份嵌套对象 */
export function cloneSchedule(schedule: TimetableSchedule): TimetableSchedule {
  return {
    ...schedule,
    sessionPeriods: { ...schedule.sessionPeriods },
    sessionStarts: { ...schedule.sessionStarts },
    summerStarts: { ...schedule.summerStarts },
    winterStarts: { ...schedule.winterStarts },
  };
}

export function defaultTimetableSettings(): TimetableSettings {
  return {
    semesterStart: null,
    periodTimes: DEFAULT_PERIOD_TIMES.map((item) => ({ ...item })),
    schedule: cloneSchedule(DEFAULT_TIMETABLE_SCHEDULE),
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? Math.round(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** "08:30" → 510（当天零点起的分钟数）；格式不对返回 null */
export function clockToMinutes(clock: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((clock ?? "").trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/** 510 → "08:30"；跨天则按 24 小时折返 */
export function minutesToClock(minutes: number): string {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** 一大节含几小节：按「每大节时长 ÷ 每小节时长」推算 */
export function majorPeriodCount(schedule: TimetableSchedule): number {
  const periodMinutes = clampInt(schedule.periodMinutes, 5, 240, 45);
  const majorMinutes = clampInt(
    schedule.majorPeriodMinutes,
    periodMinutes,
    480,
    90,
  );
  return Math.max(1, Math.round(majorMinutes / periodMinutes));
}

function monthDayOf(date: Date): number {
  return (date.getMonth() + 1) * 100 + date.getDate();
}

/** "05-01" → 501；格式不对返回 null */
export function toMonthDay(text: string): number | null {
  const match = /^(\d{1,2})-(\d{1,2})$/.exec((text ?? "").trim());
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return month * 100 + day;
}

/** 该日期处于夏令时还是冬令时 */
export function resolveSeason(
  schedule: TimetableSchedule,
  date: Date = new Date(),
): "summer" | "winter" {
  if (!schedule.seasonal) return "winter";
  const current = monthDayOf(date);
  const summer = toMonthDay(schedule.summerStartDate);
  const winter = toMonthDay(schedule.winterStartDate);
  if (summer === null || winter === null || summer === winter) return "winter";
  if (summer < winter) {
    return current >= summer && current < winter ? "summer" : "winter";
  }
  // 切换日期跨年（如夏令时 10-01 起、冬令时 05-01 起）
  return current >= summer || current < winter ? "summer" : "winter";
}

/** 该日期应当使用的三段开始时间 */
export function resolveSessionStarts(
  schedule: TimetableSchedule,
  date: Date = new Date(),
): SessionStartTimes {
  if (!schedule.seasonal) return schedule.sessionStarts;
  return resolveSeason(schedule, date) === "summer"
    ? schedule.summerStarts
    : schedule.winterStarts;
}

/**
 * 按作息参数推算每一节的起止时刻。
 *
 * 规则：
 * - 一大节含 N 小节（N = 每大节时长 ÷ 每小节时长），同一大节内两小节之间是**小课间**
 * - 跨大节是**大课间**
 * - 早 / 下午 / 晚上三段各自独立，开始时间以各自设置为准（午休、晚间空档不受课间影响）
 */
export function generatePeriodTimes(
  schedule: TimetableSchedule,
  starts: SessionStartTimes,
): PeriodTime[] {
  const periodMinutes = clampInt(schedule.periodMinutes, 5, 240, 45);
  const shortBreak = clampInt(schedule.shortBreakMinutes, 0, 180, 10);
  const longBreak = clampInt(schedule.longBreakMinutes, 0, 240, 15);
  const perMajor = majorPeriodCount(schedule);

  const sessions: Array<{ count: number; start: string }> = [
    {
      count: clampInt(schedule.sessionPeriods.morning, 0, MAX_PERIODS_PER_DAY, 5),
      start: starts.morning,
    },
    {
      count: clampInt(schedule.sessionPeriods.afternoon, 0, MAX_PERIODS_PER_DAY, 4),
      start: starts.afternoon,
    },
    {
      count: clampInt(schedule.sessionPeriods.evening, 0, MAX_PERIODS_PER_DAY, 3),
      start: starts.evening,
    },
  ];

  const result: PeriodTime[] = [];
  let period = 1;

  for (const session of sessions) {
    const begin = clockToMinutes(session.start);
    if (begin === null || session.count <= 0) continue;
    let cursor = begin;

    for (let index = 0; index < session.count; index += 1) {
      const start = cursor;
      const end = start + periodMinutes;
      result.push({
        period,
        start: minutesToClock(start),
        end: minutesToClock(end),
      });
      cursor = end;
      if (index < session.count - 1) {
        // 本节是大节里的第几个小节：整除说明刚上完一大节，接大课间
        const within = index + 1;
        cursor += within % perMajor === 0 ? longBreak : shortBreak;
      }
      period += 1;
    }
  }

  return result;
}

/**
 * 取当前生效的节次时刻表。
 * - 用了作息参数就按参数推算（并按时令切换）
 * - 老数据没有作息参数时，仍沿用逐节手动设置的时刻
 */
export function resolvePeriodTimes(
  settings: TimetableSettings,
  date: Date = new Date(),
): PeriodTime[] {
  if (settings.schedule) {
    return generatePeriodTimes(
      settings.schedule,
      resolveSessionStarts(settings.schedule, date),
    );
  }
  return settings.periodTimes;
}

export function periodTime(
  settings: TimetableSettings,
  period: number,
  date: Date = new Date(),
): PeriodTime | undefined {
  return resolvePeriodTimes(settings, date).find((item) => item.period === period);
}

export function formatPeriodTime(
  settings: TimetableSettings,
  period: number,
  date: Date = new Date(),
): string {
  const item = periodTime(settings, period, date);
  return item ? `${item.start}–${item.end}` : "";
}

export function formatCourseTime(
  course: Course,
  settings: TimetableSettings,
  date: Date = new Date(),
): string {
  const start = periodTime(settings, course.startPeriod, date);
  const end = periodTime(settings, course.endPeriod, date);
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
