import { describe, expect, it } from "vitest";
import { clockToMinutes, expandWeekCourseBlocks } from "./weekCourseBlocks";
import { defaultTimetableSettings } from "./timetable";
import type { Course, CourseOverride } from "./types";

const WEEK_START = "2026-11-09"; // 周一

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

describe("clockToMinutes", () => {
  it("把 HH:MM 转成分钟数", () => {
    expect(clockToMinutes("08:00")).toBe(480);
    expect(clockToMinutes("14:35")).toBe(875);
    expect(clockToMinutes("00:00")).toBe(0);
  });

  it("非法输入返回 0", () => {
    expect(clockToMinutes("")).toBe(0);
    expect(clockToMinutes("abc")).toBe(0);
  });
});

describe("expandWeekCourseBlocks", () => {
  const settings = defaultTimetableSettings();

  it("按周起始日展开七天", () => {
    const blocks = expandWeekCourseBlocks(
      [makeCourse({ weekday: 3 })],
      [],
      settings,
      WEEK_START,
      null,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].day).toBe("2026-11-11");
  });

  it("用节次时刻换算时间轴位置", () => {
    const blocks = expandWeekCourseBlocks(
      [makeCourse({ weekday: 1, startPeriod: 1, endPeriod: 2 })],
      [],
      settings,
      WEEK_START,
      null,
    );
    // 默认第 1 节 08:00–08:45，第 2 节 08:55–09:40
    expect(blocks[0].startMinutes).toBe(8 * 60);
    expect(blocks[0].endMinutes).toBe(9 * 60 + 40);
  });

  it("支持翻看任意一周", () => {
    const blocks = expandWeekCourseBlocks(
      [makeCourse({ weekday: 1 })],
      [],
      settings,
      "2026-11-16", // 下一周
      null,
    );
    expect(blocks[0].day).toBe("2026-11-16");
  });

  it("按学期周次过滤", () => {
    const blocks = expandWeekCourseBlocks(
      [makeCourse({ weekday: 1, weeks: "单周" })],
      [],
      settings,
      WEEK_START,
      2,
    );
    expect(blocks).toHaveLength(0);
  });

  it("停课标记为 cancelled 但仍然显示", () => {
    const blocks = expandWeekCourseBlocks(
      [makeCourse({ weekday: 1 })],
      [makeOverride({ date: "2026-11-09", action: "cancel" })],
      settings,
      WEEK_START,
      null,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].cancelled).toBe(true);
  });

  it("调课改写节次与地点，并重算时间轴位置", () => {
    const blocks = expandWeekCourseBlocks(
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
      settings,
      WEEK_START,
      null,
    );
    expect(blocks[0].startPeriod).toBe(5);
    expect(blocks[0].location).toBe("实验楼");
    // 第 5 节 14:00 开始
    expect(blocks[0].startMinutes).toBe(14 * 60);
  });

  it("自定义节次时刻后按新时刻换算", () => {
    const custom = {
      ...settings,
      periodTimes: [
        { period: 1, start: "07:30", end: "08:15" },
        { period: 2, start: "08:20", end: "09:05" },
      ],
    };
    const blocks = expandWeekCourseBlocks(
      [makeCourse({ weekday: 1 })],
      [],
      custom,
      WEEK_START,
      null,
    );
    expect(blocks[0].startMinutes).toBe(7 * 60 + 30);
    expect(blocks[0].endMinutes).toBe(9 * 60 + 5);
  });

  it("按开始时刻排序", () => {
    const blocks = expandWeekCourseBlocks(
      [
        makeCourse({ id: "b", weekday: 1, startPeriod: 5, endPeriod: 6, name: "B" }),
        makeCourse({ id: "a", weekday: 1, startPeriod: 1, endPeriod: 2, name: "A" }),
      ],
      [],
      settings,
      WEEK_START,
      null,
    );
    expect(blocks.map((block) => block.course.name)).toEqual(["A", "B"]);
  });
});
