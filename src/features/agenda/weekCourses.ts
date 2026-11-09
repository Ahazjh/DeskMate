import { useMemo } from "react";
import { addDaysToKey, startOfWeek, dayKey, WEEK_STARTS_ON } from "./dateUtils";
import { courseMatchesWeek } from "./timetable";
import type { Course, CourseOverride } from "./types";

export interface WeekCourseEntry {
  /** 唯一 key：课程 id + 日期 */
  key: string;
  /** 该课程在这一周的具体日期（YYYY-MM-DD） */
  day: string;
  course: Course;
  /** 调课到别的节次时的起止节 */
  startPeriod: number;
  endPeriod: number;
  /** 调课后的地点 */
  location: string;
  /** 是否被停课 */
  cancelled: boolean;
}

/**
 * 把「每周重复」的课程展开成本周具体某天的条目。
 *
 * - 按当前学期周次过滤（未设学期 / 未开学时不过滤）；
 * - 应用调课例外：cancel 的课程标记为停课，move 的课程改节次与地点；
 * - 结果按日期 + 开始节次排序，方便直接插进按天分组的待办列表。
 */
export function expandWeekCourses(
  courses: Course[],
  overrides: CourseOverride[],
  now: Date = new Date(),
  semesterWeekNumber: number | null = null,
): WeekCourseEntry[] {
  const weekStart = dayKey(startOfWeek(now, WEEK_STARTS_ON));
  const overrideByCourseDay = new Map<string, CourseOverride>();
  for (const override of overrides) {
    overrideByCourseDay.set(`${override.courseId}:${override.date}`, override);
  }

  const entries: WeekCourseEntry[] = [];

  for (let index = 0; index < 7; index += 1) {
    const day = addDaysToKey(weekStart, index);
    // weekday 1..7 → 周一..周日
    const weekday = index + 1;

    for (const course of courses) {
      if (course.weekday !== weekday) continue;
      if (
        semesterWeekNumber !== null &&
        semesterWeekNumber > 0 &&
        !courseMatchesWeek(course.weeks, semesterWeekNumber)
      ) {
        continue;
      }

      const override = overrideByCourseDay.get(`${course.id}:${day}`);
      const cancelled = override?.action === "cancel";
      const moved = override?.action === "move";

      entries.push({
        key: `${course.id}-${day}`,
        day,
        course,
        startPeriod: moved && override?.startPeriod ? override.startPeriod : course.startPeriod,
        endPeriod: moved && override?.endPeriod ? override.endPeriod : course.endPeriod,
        location:
          moved && override?.location ? override.location : course.location,
        cancelled,
      });
    }
  }

  return entries.sort((left, right) => {
    if (left.day !== right.day) return left.day.localeCompare(right.day);
    if (left.startPeriod !== right.startPeriod) {
      return left.startPeriod - right.startPeriod;
    }
    return left.course.name.localeCompare(right.course.name);
  });
}

/** 把周课程按日期分组，便于与待办按天合并展示。 */
export function groupWeekCoursesByDay(
  entries: WeekCourseEntry[],
): Map<string, WeekCourseEntry[]> {
  const buckets = new Map<string, WeekCourseEntry[]>();
  for (const entry of entries) {
    const list = buckets.get(entry.day);
    if (list) list.push(entry);
    else buckets.set(entry.day, [entry]);
  }
  return buckets;
}

/** 供组件使用的 hook 包装。 */
export function useWeekCourses(
  courses: Course[],
  overrides: CourseOverride[],
  now: Date,
  semesterWeekNumber: number | null,
): WeekCourseEntry[] {
  return useMemo(
    () => expandWeekCourses(courses, overrides, now, semesterWeekNumber),
    [courses, overrides, now, semesterWeekNumber],
  );
}
