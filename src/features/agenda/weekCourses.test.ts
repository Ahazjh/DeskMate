import { describe, expect, it } from "vitest";
import { expandWeekCourses } from "./weekCourses";
import type { Course, CourseOverride } from "./types";

function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: "c1",
    name: "高等数学",
    weekday: 1,
    startPeriod: 1,
    endPeriod: 2,
    location: "教一101",
    teacher: "张老师",
    weeks: "",
    color: null,
    note: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeOverride(overrides: Partial<CourseOverride> = {}): CourseOverride {
  return {
    id: "o1",
    courseId: "c1",
    date: "2026-11-09",
    action: "cancel",
    startPeriod: null,
    endPeriod: null,
    location: null,
    note: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("expandWeekCourses", () => {
  it("把每周重复的课程展开成本周具体日期", () => {
    // 2026-11-09 是周一
    const now = new Date(2026, 10, 9);
    const entries = expandWeekCourses([makeCourse({ weekday: 1 })], [], now, null);
    expect(entries).toHaveLength(1);
    expect(entries[0].day).toBe("2026-11-09");
    expect(entries[0].course.name).toBe("高等数学");
    expect(entries[0].startPeriod).toBe(1);
    expect(entries[0].endPeriod).toBe(2);
    expect(entries[0].cancelled).toBe(false);
  });

  it("只展开 weekday 匹配的课程", () => {
    const now = new Date(2026, 10, 9);
    // 周一开课 → 本周只有周一那一条
    const entries = expandWeekCourses([makeCourse({ weekday: 1 })], [], now, null);
    expect(entries).toHaveLength(1);
    expect(entries[0].day).toBe("2026-11-09");

    // 周三开课 → 落在本周三
    const wed = expandWeekCourses([makeCourse({ weekday: 3 })], [], now, null);
    expect(wed).toHaveLength(1);
    expect(wed[0].day).toBe("2026-11-11");
  });

  it("按学期周次过滤", () => {
    const now = new Date(2026, 10, 9);
    // 单周课程在第 2 周不上课
    const entries = expandWeekCourses(
      [makeCourse({ weekday: 1, weeks: "单周" })],
      [],
      now,
      2,
    );
    expect(entries).toHaveLength(0);
  });

  it("停课例外被标记为 cancelled", () => {
    const now = new Date(2026, 10, 9);
    const entries = expandWeekCourses(
      [makeCourse({ weekday: 1 })],
      [makeOverride({ date: "2026-11-09", action: "cancel" })],
      now,
      null,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].cancelled).toBe(true);
  });

  it("调课例外改写节次与地点", () => {
    const now = new Date(2026, 10, 9);
    const entries = expandWeekCourses(
      [makeCourse({ weekday: 1 })],
      [
        makeOverride({
          date: "2026-11-09",
          action: "move",
          startPeriod: 5,
          endPeriod: 6,
          location: "实验楼",
        }),
      ],
      now,
      null,
    );
    expect(entries[0].startPeriod).toBe(5);
    expect(entries[0].endPeriod).toBe(6);
    expect(entries[0].location).toBe("实验楼");
    expect(entries[0].cancelled).toBe(false);
  });

  it("按日期与开始节次排序", () => {
    const now = new Date(2026, 10, 9);
    const entries = expandWeekCourses(
      [
        makeCourse({ id: "b", weekday: 1, startPeriod: 3, endPeriod: 4, name: "B" }),
        makeCourse({ id: "a", weekday: 1, startPeriod: 1, endPeriod: 2, name: "A" }),
        makeCourse({ id: "c", weekday: 2, startPeriod: 1, endPeriod: 2, name: "C" }),
      ],
      [],
      now,
      null,
    );
    expect(entries.map((entry) => entry.course.name)).toEqual(["A", "B", "C"]);
  });
});
