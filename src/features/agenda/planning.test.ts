import { describe, expect, it } from "vitest";
import { ddlPressure } from "./ddlPressure";
import { planSchedule } from "./schedulePlanner";
import { maxWeekFromCourses, semesterProgress } from "./semesterProgress";
import type { AgendaSnapshot, Course, Todo } from "./types";

const TODAY = "2026-11-07";

function todo(overrides: Partial<Todo> & Pick<Todo, "id" | "title">): Todo {
  return {
    notes: "",
    done: false,
    completedAt: null,
    dueDate: null,
    dueAt: null,
    priority: 0,
    tags: [],
    courseId: null,
    platform: "",
    kind: "task",
    remindMinutes: null,
    estimateMinutes: null,
    sortOrder: 0,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

function course(overrides: Partial<Course> & Pick<Course, "id" | "name" | "weekday">): Course {
  return {
    startPeriod: 1,
    endPeriod: 2,
    location: "",
    teacher: "",
    weeks: "1-16周",
    color: null,
    note: "",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

function snapshot(overrides: Partial<AgendaSnapshot> = {}): AgendaSnapshot {
  return {
    todos: [],
    events: [],
    courses: [],
    dailyTasks: [],
    dailyChecks: {},
    courseOverrides: [],
    partnerProfile: { name: "", relation: "partner", color: null },
    partnerCourses: [],
    timetableSettings: {
      semesterStart: null,
      periodTimes: [
        { period: 1, start: "08:00", end: "08:45" },
        { period: 2, start: "08:55", end: "09:40" },
        { period: 3, start: "10:00", end: "10:45" },
      ],
      schedule: null,
    },
    ...overrides,
  };
}

describe("semesterProgress", () => {
  it("从周次写法取最大周", () => {
    expect(maxWeekFromCourses(["1-16周", "1-8,10-18周", "单周"])).toBe(18);
  });

  it("无周次时默认 16 周", () => {
    expect(maxWeekFromCourses([])).toBe(0);
    const progress = semesterProgress(null, [], TODAY);
    expect(progress.totalWeeks).toBe(16);
    expect(progress.currentWeek).toBeNull();
    expect(progress.percent).toBe(0);
  });

  it("有学期开始日期时计算当前周与百分比", () => {
    const progress = semesterProgress("2026-09-01", ["1-16周"], TODAY);
    expect(progress.currentWeek).toBeGreaterThan(0);
    expect(progress.percent).toBeGreaterThan(0);
    expect(progress.percent).toBeLessThanOrEqual(1);
    expect(progress.remaining).toBeGreaterThanOrEqual(0);
  });
});

describe("ddlPressure", () => {
  it("按天统计未完成待办", () => {
    const pressure = ddlPressure(
      [
        todo({ id: "a", title: "今天", dueDate: TODAY }),
        todo({ id: "b", title: "明天", dueDate: "2026-11-08", priority: 3 }),
        todo({ id: "c", title: "明天2", dueDate: "2026-11-08" }),
        todo({ id: "d", title: "已完成", dueDate: "2026-11-08", done: true }),
      ],
      TODAY,
    );
    expect(pressure.days[0].count).toBe(1);
    expect(pressure.days[1].count).toBe(2);
    expect(pressure.days[1].high).toBe(1);
    expect(pressure.total).toBe(3);
    expect(pressure.peak?.date).toBe("2026-11-08");
  });

  it("逾期单独计数，不挤占今天", () => {
    const pressure = ddlPressure(
      [todo({ id: "a", title: "逾期", dueDate: "2026-11-01" })],
      TODAY,
    );
    expect(pressure.days[0].count).toBe(0);
    expect(pressure.overdueCount).toBe(1);
  });

  it("范围外的截止日不计入 14 天", () => {
    const pressure = ddlPressure(
      [todo({ id: "a", title: "下个月", dueDate: "2026-12-30" })],
      TODAY,
    );
    expect(pressure.total).toBe(0);
    expect(pressure.peak).toBeNull();
  });
});

describe("planSchedule", () => {
  it("避开课程空档并留出缓冲", () => {
    const result = planSchedule(
      snapshot({
        courses: [course({ id: "c1", name: "高数", weekday: 6 })],
        todos: [todo({ id: "t1", title: "写作业", dueDate: TODAY, estimateMinutes: 30 })],
      }),
      { from: TODAY, days: 1 },
    );
    expect(result.blocks).toHaveLength(1);
    expect(new Date(result.blocks[0].startAt).getHours()).toBe(9);
    expect(new Date(result.blocks[0].startAt).getMinutes()).toBe(45);
    expect(result.blocks[0].minutes).toBe(30);
  });

  it("没有课程时从每天起点开始", () => {
    const result = planSchedule(
      snapshot({ todos: [todo({ id: "t1", title: "写作业", dueDate: TODAY })] }),
      { from: TODAY, days: 1 },
    );
    expect(new Date(result.blocks[0].startAt).getHours()).toBe(8);
    expect(new Date(result.blocks[0].startAt).getMinutes()).toBe(0);
  });

  it("按 DDL 顺序安排多个待办", () => {
    const result = planSchedule(
      snapshot({
        todos: [
          todo({ id: "late", title: "后天", dueDate: "2026-11-09", estimateMinutes: 60 }),
          todo({ id: "early", title: "明天", dueDate: "2026-11-08", estimateMinutes: 60 }),
        ],
      }),
      { from: TODAY, days: 2 },
    );
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].todoId).toBe("early");
    expect(result.blocks[1].todoId).toBe("late");
  });

  it("停课例外会释放课程占用", () => {
    const withCourse = snapshot({
      courses: [course({ id: "c1", name: "高数", weekday: 6 })],
      todos: [todo({ id: "t1", title: "写作业", dueDate: TODAY, estimateMinutes: 30 })],
    });
    const cancelled = snapshot({
      ...withCourse,
      courseOverrides: [
        {
          id: "o1",
          courseId: "c1",
          date: TODAY,
          action: "cancel",
          startPeriod: null,
          endPeriod: null,
          location: null,
          note: "",
          createdAt: "2026-11-01T00:00:00.000Z",
        },
      ],
    });
    const result = planSchedule(cancelled, { from: TODAY, days: 1 });
    expect(new Date(result.blocks[0].startAt).getHours()).toBe(8);
  });

  it("逾期任务安排到今天", () => {
    const result = planSchedule(
      snapshot({ todos: [todo({ id: "t1", title: "补交", dueDate: "2026-11-01" })] }),
      { from: TODAY, days: 1 },
    );
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].date).toBe(TODAY);
  });

  it("时长超过所有空档时进入 skipped", () => {
    const result = planSchedule(
      snapshot({
        todos: [todo({ id: "t1", title: "大作业", dueDate: TODAY, estimateMinutes: 480 })],
      }),
      { from: TODAY, days: 1, dayStart: "08:00", dayEnd: "10:00" },
    );
    expect(result.blocks).toHaveLength(0);
    expect(result.skipped[0]).toMatchObject({ todoId: "t1", reason: "no-slot" });
  });

  it("没有 DDL 的待办不参与排期", () => {
    const result = planSchedule(
      snapshot({ todos: [todo({ id: "t1", title: "随手记" })] }),
      { from: TODAY, days: 1 },
    );
    expect(result.blocks).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });
});
