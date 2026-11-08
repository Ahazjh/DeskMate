import { semesterWeek } from "./timetable";

export interface SemesterProgress {
  currentWeek: number | null;
  totalWeeks: number;
  percent: number;
  remaining: number;
}

/** 从「1-16周 / 1-8,10-16周 / 单周」等写法里取最大周次。 */
export function maxWeekFromCourses(weeks: string[]): number {
  let max = 0;
  for (const value of weeks) {
    for (const match of value.matchAll(/(\d{1,2})(?:\s*[-~–—]\s*(\d{1,2}))?/g)) {
      const end = Number(match[2] ?? match[1]);
      if (Number.isFinite(end) && end > max) max = end;
    }
  }
  return max;
}

export function semesterProgress(
  semesterStart: string | null,
  weeks: string[],
  today: string,
): SemesterProgress {
  const totalWeeks = Math.max(1, maxWeekFromCourses(weeks) || 16);
  const currentWeek = semesterWeek(semesterStart, today);
  if (currentWeek === null || currentWeek <= 0) {
    return { currentWeek, totalWeeks, percent: 0, remaining: totalWeeks };
  }
  return {
    currentWeek,
    totalWeeks,
    percent: Math.min(1, currentWeek / totalWeeks),
    remaining: Math.max(0, totalWeeks - currentWeek),
  };
}
