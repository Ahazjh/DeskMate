import { describe, expect, test } from "vitest";
import {
  courseMatchesWeek,
  defaultTimetableSettings,
  formatCourseTime,
  semesterWeek,
} from "./timetable";
import type { Course } from "./types";

const settings = defaultTimetableSettings();

function course(overrides: Partial<Course> = {}): Course {
  return {
    id: "c1",
    name: "高等数学",
    weekday: 1,
    startPeriod: 1,
    endPeriod: 2,
    location: "",
    teacher: "",
    weeks: "",
    color: null,
    note: "",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("timetable utilities", () => {
  test("calculates semester weeks from the start date", () => {
    expect(semesterWeek(null, "2026-11-06")).toBeNull();
    expect(semesterWeek("2026-09-14", "2026-09-13")).toBe(0);
    expect(semesterWeek("2026-09-14", "2026-09-14")).toBe(1);
    expect(semesterWeek("2026-09-14", "2026-09-20")).toBe(1);
    expect(semesterWeek("2026-09-14", "2026-09-21")).toBe(2);
    expect(semesterWeek("2026-09-14", "2026-11-06")).toBe(8);
  });

  test("parses free-text week ranges", () => {
    expect(courseMatchesWeek("", 3)).toBe(true);
    expect(courseMatchesWeek("1-16周", 1)).toBe(true);
    expect(courseMatchesWeek("1-16周", 16)).toBe(true);
    expect(courseMatchesWeek("1-16周", 17)).toBe(false);
    expect(courseMatchesWeek("1-8,10-16周", 9)).toBe(false);
    expect(courseMatchesWeek("1-8,10-16周", 10)).toBe(true);
    expect(courseMatchesWeek("第3周", 3)).toBe(true);
    expect(courseMatchesWeek("第3周", 4)).toBe(false);
  });

  test("handles odd and even week markers", () => {
    expect(courseMatchesWeek("单周", 3)).toBe(true);
    expect(courseMatchesWeek("单周", 4)).toBe(false);
    expect(courseMatchesWeek("双周", 4)).toBe(true);
    expect(courseMatchesWeek("双周", 3)).toBe(false);
    expect(courseMatchesWeek("1-16周 单周", 5)).toBe(true);
    expect(courseMatchesWeek("1-16周 单周", 6)).toBe(false);
  });

  test("treats unparseable week text as every week", () => {
    expect(courseMatchesWeek("开学后", 5)).toBe(true);
  });

  test("formats course clock time from period settings", () => {
    expect(formatCourseTime(course(), settings)).toBe("08:00–09:40");
    // 默认作息：第 5 节 11:50 开始（早上 5 节），第 6 节 14:15 结束（下午 13:30 开始）
    expect(formatCourseTime(course({ startPeriod: 5, endPeriod: 6 }), settings)).toBe(
      "11:50–14:15",
    );
  });
});
