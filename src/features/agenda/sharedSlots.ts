import { courseMatchesWeek } from "./timetable";
import type { Course } from "./types";

/** 7 天 × 12 节的共同空档矩阵，索引 [weekday-1][period-1]。 */
export type SharedFreeGrid = boolean[][];

function busy(
  courses: Course[],
  weekday: number,
  period: number,
  week: number | null,
): boolean {
  return courses.some(
    (course) =>
      course.weekday === weekday &&
      course.startPeriod <= period &&
      course.endPeriod >= period &&
      (week === null || week <= 0 || courseMatchesWeek(course.weeks, week)),
  );
}

export function buildSharedFreeGrid(
  selfCourses: Course[],
  partnerCourses: Course[],
  week: number | null,
): SharedFreeGrid {
  return Array.from({ length: 7 }, (_, dayIndex) =>
    Array.from({ length: 12 }, (_, periodIndex) => {
      const weekday = dayIndex + 1;
      const period = periodIndex + 1;
      return (
        !busy(selfCourses, weekday, period, week) &&
        !busy(partnerCourses, weekday, period, week)
      );
    }),
  );
}

export function countSharedFreeSlots(grid: SharedFreeGrid): number {
  return grid.reduce(
    (total, day) => total + day.filter((free) => free).length,
    0,
  );
}
