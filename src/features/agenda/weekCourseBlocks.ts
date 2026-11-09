import { useMemo } from "react";
import { addDaysToKey } from "./dateUtils";
import { courseMatchesWeek } from "./timetable";
import type { Course, CourseOverride, TimetableSettings } from "./types";

export interface WeekCourseBlock {
  key: string;
  /** 该课程在本周的具体日期 */
  day: string;
  course: Course;
  startPeriod: number;
  endPeriod: number;
  location: string;
  cancelled: boolean;
  /** 相对当天 00:00 的开始分钟数 */
  startMinutes: number;
  /** 相对当天 00:00 的结束分钟数 */
  endMinutes: number;
}

/** "HH:MM" → 从 00:00 起的分钟数 */
export function clockToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

/**
 * 把「每周重复」的课程展开成周视图里可以按时间轴摆放的块。
 *
 * - 按当前学期周次过滤（未设学期 / 未开学时不过滤）；
 * - 应用调课例外：cancel 的课程标记为停课（仍显示，画删除线），move 的课程改节次；
 * - 用课程表设置里的「每节具体时刻」把节次换算成当天的分钟偏移，
 *   这样课程才能和日程落在同一条时间轴上。
 *
 * @param weekStart 本周周一（YYYY-MM-DD）。周视图可以翻看任意一周，
 *                  所以这里显式传入而不是用「今天」。
 */
export function expandWeekCourseBlocks(
  courses: Course[],
  overrides: CourseOverride[],
  settings: TimetableSettings,
  weekStart: string,
  semesterWeekNumber: number | null = null,
): WeekCourseBlock[] {
  const periodMinutes = new Map<number, { start: number; end: number }>();
  for (const item of settings.periodTimes) {
    periodMinutes.set(item.period, {
      start: clockToMinutes(item.start),
      end: clockToMinutes(item.end),
    });
  }

  const overrideByCourseDay = new Map<string, CourseOverride>();
  for (const override of overrides) {
    overrideByCourseDay.set(`${override.courseId}:${override.date}`, override);
  }

  const blocks: WeekCourseBlock[] = [];

  for (let index = 0; index < 7; index += 1) {
    const day = addDaysToKey(weekStart, index);
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

      const startPeriod =
        moved && override?.startPeriod ? override.startPeriod : course.startPeriod;
      const endPeriod =
        moved && override?.endPeriod ? override.endPeriod : course.endPeriod;

      const start = periodMinutes.get(startPeriod);
      const end = periodMinutes.get(endPeriod);
      // 没有配置节次时刻的课程退回到「每节 45 分钟」的估算，
      // 避免整块课程因为缺时刻而消失
      const fallbackStart = (startPeriod - 1) * 60;
      const fallbackEnd = fallbackStart + 45 * (endPeriod - startPeriod + 1);

      blocks.push({
        key: `${course.id}-${day}`,
        day,
        course,
        startPeriod,
        endPeriod,
        location:
          moved && override?.location ? override.location : course.location,
        cancelled,
        startMinutes: start?.start ?? fallbackStart,
        endMinutes: end?.end ?? fallbackEnd,
      });
    }
  }

  return blocks.sort((left, right) => {
    if (left.day !== right.day) return left.day.localeCompare(right.day);
    return left.startMinutes - right.startMinutes;
  });
}

/** 按日期分组，供周视图逐列渲染。 */
export function groupCourseBlocksByDay(
  blocks: WeekCourseBlock[],
): Map<string, WeekCourseBlock[]> {
  const buckets = new Map<string, WeekCourseBlock[]>();
  for (const block of blocks) {
    const list = buckets.get(block.day);
    if (list) list.push(block);
    else buckets.set(block.day, [block]);
  }
  return buckets;
}

/** 供组件使用的 hook 包装。 */
export function useWeekCourseBlocks(
  courses: Course[],
  overrides: CourseOverride[],
  settings: TimetableSettings,
  weekStart: string,
  semesterWeekNumber: number | null,
): WeekCourseBlock[] {
  return useMemo(
    () =>
      expandWeekCourseBlocks(
        courses,
        overrides,
        settings,
        weekStart,
        semesterWeekNumber,
      ),
    [courses, overrides, settings, weekStart, semesterWeekNumber],
  );
}
