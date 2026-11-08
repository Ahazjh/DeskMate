// Dev-only browser preview: mounts the real AgendaWorkspace against an in-memory
// Tauri command mock. Not referenced by the app bundle; safe to delete with preview/.
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import "../src/App.css";
import i18n, { initializeI18n } from "../src/locales";
import { ToastContainer, showToast } from "../src/components/Toast";
import { AgendaWorkspace } from "../src/features/agenda/AgendaWorkspace";
import { QuickTodoWindow } from "../src/features/agenda/QuickTodoWindow";
import { AgendaWidgetWindow } from "../src/features/agenda/AgendaWidgetWindow";
import { addDaysToKey } from "../src/features/agenda/dateUtils";
import { defaultTimetableSettings } from "../src/features/agenda/timetable";
import type {
  AgendaEvent,
  AgendaMode,
  AgendaSnapshot,
  CalendarView,
  Course,
  CourseInput,
  DailyTask,
  TimetableSettings,
  Todo,
} from "../src/features/agenda/types";

function at(dayOffset: number, hour: number, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function todayKey(offset = 0): string {
  return addDaysToKey(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(
      new Date().getDate(),
    ).padStart(2, "0")}`,
    offset,
  );
}

const now = new Date().toISOString();
let nextId = 100;

const todos: Todo[] = [
  {
    id: "t1",
    title: "把 Q4 报价单发给张工",
    notes: "附上折扣表和去年同期的成交价，抄送李经理。",
    done: false,
    completedAt: null,
    dueDate: todayKey(0),
    dueAt: at(0, 15, 0),
    priority: 3,
    tags: ["工作", "Q4"],
    sortOrder: 1024,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "t2",
    title: "整理评审会议纪要",
    notes: "",
    done: false,
    completedAt: null,
    dueDate: todayKey(0),
    dueAt: null,
    priority: 2,
    tags: ["工作"],
    sortOrder: 2048,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "t3",
    title: "预约牙医",
    notes: "",
    done: false,
    completedAt: null,
    dueDate: todayKey(1),
    dueAt: at(1, 10, 30),
    priority: 1,
    tags: ["生活"],
    sortOrder: 3072,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "t4",
    title: "读完《设计中的设计》",
    notes: "",
    done: false,
    completedAt: null,
    dueDate: null,
    dueAt: null,
    priority: 0,
    tags: ["阅读"],
    sortOrder: 4096,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "t5",
    title: "提交上月报销单",
    notes: "",
    done: false,
    completedAt: null,
    dueDate: todayKey(-1),
    dueAt: null,
    priority: 2,
    tags: ["工作"],
    sortOrder: 5120,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "t6",
    title: "回复客户邮件",
    notes: "",
    done: true,
    completedAt: now,
    dueDate: todayKey(0),
    dueAt: null,
    priority: 1,
    tags: ["工作"],
    courseId: null,
    platform: "",
    kind: "task",
    sortOrder: 6144,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "t7",
    title: "高等数学 第三章习题 1-10",
    notes: "",
    done: false,
    completedAt: null,
    dueDate: todayKey(2),
    dueAt: at(2, 23, 59),
    priority: 2,
    tags: ["作业"],
    courseId: "c1",
    platform: "学习通",
    kind: "assignment",
    sortOrder: 7168,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "t8",
    title: "英语作文提交",
    notes: "",
    done: false,
    completedAt: null,
    dueDate: todayKey(1),
    dueAt: at(1, 20, 0),
    priority: 2,
    tags: ["作业"],
    courseId: "c2",
    platform: "雨课堂",
    kind: "assignment",
    sortOrder: 8192,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "t9",
    title: "数据结构实验课预习",
    notes: "",
    done: false,
    completedAt: null,
    dueDate: todayKey(0),
    dueAt: at(0, 18, 0),
    priority: 1,
    tags: ["课程"],
    courseId: "c3",
    platform: "",
    kind: "reminder",
    sortOrder: 9216,
    createdAt: now,
    updatedAt: now,
  },
];

const events: AgendaEvent[] = [
  {
    id: "e1",
    title: "产品评审",
    notes: "会议室 A，带上交互稿。",
    allDay: false,
    startAt: at(0, 10, 0),
    endAt: at(0, 11, 0),
    startDate: null,
    endDate: null,
    color: "#2d5a3d",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "e2",
    title: "牙医",
    notes: "",
    allDay: false,
    startAt: at(0, 15, 30),
    endAt: at(0, 16, 0),
    startDate: null,
    endDate: null,
    color: "#c2703d",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "e3",
    title: "出差 · 杭州",
    notes: "",
    allDay: true,
    startAt: at(1, 0, 0),
    endAt: at(2, 0, 0),
    startDate: todayKey(1),
    endDate: todayKey(1),
    color: "#4a6fa5",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "e4",
    title: "设计评审",
    notes: "",
    allDay: false,
    startAt: at(1, 14, 0),
    endAt: at(1, 15, 30),
    startDate: null,
    endDate: null,
    color: "#8b5e8f",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "e5",
    title: "站会",
    notes: "",
    allDay: false,
    startAt: at(2, 9, 0),
    endAt: at(2, 9, 30),
    startDate: null,
    endDate: null,
    color: "#b08a2e",
    createdAt: now,
    updatedAt: now,
  },
];

const courses: Course[] = [
  {
    id: "c1",
    name: "高等数学",
    weekday: 1,
    startPeriod: 1,
    endPeriod: 2,
    location: "教一101",
    teacher: "张老师",
    weeks: "1-16周",
    color: "#2d5a3d",
    note: "",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "c2",
    name: "大学英语",
    weekday: 3,
    startPeriod: 3,
    endPeriod: 4,
    location: "外语楼203",
    teacher: "李老师",
    weeks: "1-16周",
    color: "#4a6fa5",
    note: "",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "c3",
    name: "数据结构",
    weekday: 2,
    startPeriod: 5,
    endPeriod: 6,
    location: "计算机楼302",
    teacher: "王老师",
    weeks: "1-16周",
    color: "#8b5e8f",
    note: "",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "c4",
    name: "体育",
    weekday: 4,
    startPeriod: 7,
    endPeriod: 8,
    location: "体育馆",
    teacher: "赵老师",
    weeks: "1-16周",
    color: "#b08a2e",
    note: "",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "c5",
    name: "设计心理学",
    weekday: 5,
    startPeriod: 9,
    endPeriod: 10,
    location: "艺术楼101",
    teacher: "陈老师",
    weeks: "1-16周",
    color: "#c2703d",
    note: "",
    createdAt: now,
    updatedAt: now,
  },
];

const dailyTasks: DailyTask[] = [
  {
    id: "d1",
    title: "背 30 个单词",
    color: "#2d5a3d",
    active: true,
    sortOrder: 1024,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "d2",
    title: "运动 30 分钟",
    color: "#c2703d",
    active: true,
    sortOrder: 2048,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "d3",
    title: "阅读 20 页",
    color: "#4a6fa5",
    active: true,
    sortOrder: 3072,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "d4",
    title: "睡前复盘 5 分钟",
    color: "#8b5e8f",
    active: true,
    sortOrder: 4096,
    createdAt: now,
    updatedAt: now,
  },
];

const dailyChecks: Record<string, string[]> = {
  [todayKey(0)]: ["d1", "d2"],
  [todayKey(-1)]: ["d1", "d2", "d3"],
  [todayKey(-2)]: ["d1"],
  [todayKey(-3)]: ["d1", "d2", "d3", "d4"],
  [todayKey(-4)]: ["d2"],
};

let timetableSettings: TimetableSettings = {
  ...defaultTimetableSettings(),
  semesterStart: todayKey(-49),
};

function cloneTodo(todo: Todo): Todo {
  return { ...todo, tags: [...todo.tags] };
}

function cloneEvent(event: AgendaEvent): AgendaEvent {
  return { ...event };
}

function cloneCourse(course: Course): Course {
  return { ...course };
}

function cloneDailyTask(task: DailyTask): DailyTask {
  return { ...task };
}

function cloneSnapshot(): AgendaSnapshot {
  return {
    todos: todos.map(cloneTodo),
    events: events.map(cloneEvent),
    courses: courses.map(cloneCourse),
    dailyTasks: dailyTasks.map(cloneDailyTask),
    dailyChecks: Object.fromEntries(
      Object.entries(dailyChecks).map(([date, ids]) => [date, [...ids]]),
    ),
    courseOverrides: [],
    partnerProfile: { name: "小夏", relation: "sibling", color: "#D4537E" },
    partnerCourses: [
      {
        id: "pc1",
        name: "大学英语",
        weekday: 2,
        startPeriod: 3,
        endPeriod: 4,
        location: "外语楼203",
        teacher: "李老师",
        weeks: "1-16周",
        color: "#D4537E",
        note: "",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "pc2",
        name: "线性代数",
        weekday: 4,
        startPeriod: 6,
        endPeriod: 7,
        location: "教三202",
        teacher: "王老师",
        weeks: "1-16周",
        color: "#D4537E",
        note: "",
        createdAt: now,
        updatedAt: now,
      },
    ],
    timetableSettings: {
      semesterStart: timetableSettings.semesterStart,
      periodTimes: timetableSettings.periodTimes.map((item) => ({ ...item })),
    },
  };
}

const callbacks = new Map<number, unknown>();
let callbackId = 0;

function findTodo(id: string): Todo {
  const todo = todos.find((item) => item.id === id);
  if (!todo) throw { code: "agendaNotFound", message: "待办不存在", details: { id } };
  return todo;
}

function findCourse(id: string): Course {
  const course = courses.find((item) => item.id === id);
  if (!course) throw { code: "agendaNotFound", message: "课程不存在", details: { id } };
  return course;
}

function findDailyTask(id: string): DailyTask {
  const task = dailyTasks.find((item) => item.id === id);
  if (!task) throw { code: "agendaNotFound", message: "每日必做不存在", details: { id } };
  return task;
}

function findEvent(id: string): AgendaEvent {
  const event = events.find((item) => item.id === id);
  if (!event) throw { code: "agendaNotFound", message: "日程不存在", details: { id } };
  return event;
}

async function invoke(command: string, args: Record<string, unknown> = {}): Promise<unknown> {
  if (command === "agenda_snapshot") return cloneSnapshot();
  if (command === "plugin:event|listen") return 1;
  if (command === "plugin:event|unlisten") return null;
  if (command === "plugin:dialog|open") return "C:/preview/timetable.xls";
  if (command === "agenda_course_file_import") {
    return {
      sheet: "Sheet0",
      warnings: [],
      courses: [
        { name: "概率论与数理统计A", weekday: 3, startPeriod: 1, endPeriod: 2, location: "广B213", teacher: "夏治南", weeks: "1-16周", color: null, note: "校区：屏峰校区" },
        { name: "模拟电子技术A", weekday: 4, startPeriod: 1, endPeriod: 2, location: "广A415", teacher: "徐红", weeks: "5-16周", color: null, note: "校区：屏峰校区" },
        { name: "电路原理 B", weekday: 5, startPeriod: 6, endPeriod: 7, location: "广B512", teacher: "周叶剑", weeks: "1,3,4-16周", color: null, note: "校区：屏峰校区" },
      ],
    };
  }
  if (command.startsWith("plugin:")) return null;
  if (command === "agenda_reminder_settings_get") {
    return {
      enabled: true,
      defaultMinutes: 10,
      todoReminders: true,
      quietHoursEnabled: false,
      quietStart: "22:00",
      quietEnd: "08:00",
      autoReview: true,
    };
  }
  if (command === "agenda_reminder_settings_save") return args.settings;
  if (command === "agenda_reminder_snooze" || command === "agenda_reminder_dismiss_today") {
    return null;
  }
  if (command === "agenda_review_generate") return "preview-review";
  if (command === "agenda_widget_bounds_save") return null;
  if (command === "open_agenda_widget") return "preview-widget";

  const stamp = new Date().toISOString();

  if (command === "agenda_todo_create") {
    const request = args.request as Record<string, unknown>;
    const maxSort = todos.reduce((max, todo) => Math.max(max, todo.sortOrder), 0);
    const todo: Todo = {
      id: `t${nextId++}`,
      title: String(request.title ?? ""),
      notes: String(request.notes ?? ""),
      done: false,
      completedAt: null,
      dueDate: (request.dueDate as string | null) ?? null,
      dueAt: (request.dueAt as string | null) ?? null,
      priority: (request.priority as Todo["priority"]) ?? 0,
      tags: (request.tags as string[]) ?? [],
      courseId: (request.courseId as string | null) ?? null,
      platform: String(request.platform ?? ""),
      kind: (request.kind as Todo["kind"]) ?? "task",
      remindMinutes: (request.remindMinutes as number | null) ?? null,
      sortOrder: maxSort + 1024,
      createdAt: stamp,
      updatedAt: stamp,
    };
    todos.push(todo);
    return cloneTodo(todo);
  }

  if (command === "agenda_todo_update") {
    const todo = findTodo(String(args.id));
    const request = args.request as Record<string, unknown>;
    todo.title = String(request.title ?? "");
    todo.notes = String(request.notes ?? "");
    todo.dueDate = (request.dueDate as string | null) ?? null;
    todo.dueAt = (request.dueAt as string | null) ?? null;
    todo.priority = (request.priority as Todo["priority"]) ?? 0;
    todo.tags = (request.tags as string[]) ?? [];
    todo.courseId = (request.courseId as string | null) ?? null;
    todo.platform = String(request.platform ?? "");
    todo.kind = (request.kind as Todo["kind"]) ?? "task";
    todo.remindMinutes = (request.remindMinutes as number | null) ?? null;
    todo.updatedAt = stamp;
    return cloneTodo(todo);
  }

  if (command === "agenda_todo_toggle") {
    const todo = findTodo(String(args.id));
    todo.done = Boolean(args.done);
    todo.completedAt = todo.done ? stamp : null;
    todo.updatedAt = stamp;
    return cloneTodo(todo);
  }

  if (command === "agenda_todo_delete") {
    const index = todos.findIndex((item) => item.id === args.id);
    if (index >= 0) todos.splice(index, 1);
    return null;
  }

  if (command === "agenda_todo_reorder") {
    const ids = (args.ids as string[]) ?? [];
    ids.forEach((id, index) => {
      const todo = todos.find((item) => item.id === id);
      if (todo) todo.sortOrder = (index + 1) * 1024;
    });
    return null;
  }

  if (command === "agenda_event_create") {
    const request = args.request as Record<string, unknown>;
    const event: AgendaEvent = {
      id: `e${nextId++}`,
      title: String(request.title ?? ""),
      notes: String(request.notes ?? ""),
      allDay: Boolean(request.allDay),
      startAt: String(request.startAt),
      endAt: String(request.endAt),
      startDate: (request.startDate as string | null) ?? null,
      endDate: (request.endDate as string | null) ?? null,
      color: (request.color as string | null) ?? null,
      createdAt: stamp,
      updatedAt: stamp,
    };
    events.push(event);
    return cloneEvent(event);
  }

  if (command === "agenda_event_update") {
    const event = findEvent(String(args.id));
    const request = args.request as Record<string, unknown>;
    event.title = String(request.title ?? "");
    event.notes = String(request.notes ?? "");
    event.allDay = Boolean(request.allDay);
    event.startAt = String(request.startAt);
    event.endAt = String(request.endAt);
    event.startDate = (request.startDate as string | null) ?? null;
    event.endDate = (request.endDate as string | null) ?? null;
    event.color = (request.color as string | null) ?? null;
    event.updatedAt = stamp;
    return cloneEvent(event);
  }

  if (command === "agenda_event_delete") {
    const index = events.findIndex((item) => item.id === args.id);
    if (index >= 0) events.splice(index, 1);
    return null;
  }

  if (command === "agenda_course_create") {
    const request = args.request as CourseInput;
    const course: Course = {
      id: `c${nextId++}`,
      name: String(request.name ?? ""),
      weekday: Number(request.weekday ?? 1),
      startPeriod: Number(request.startPeriod ?? 1),
      endPeriod: Number(request.endPeriod ?? 1),
      location: String(request.location ?? ""),
      teacher: String(request.teacher ?? ""),
      weeks: String(request.weeks ?? ""),
      color: request.color ?? null,
      note: String(request.note ?? ""),
      createdAt: stamp,
      updatedAt: stamp,
    };
    courses.push(course);
    return cloneCourse(course);
  }

  if (command === "agenda_course_update") {
    const course = findCourse(String(args.id));
    const request = args.request as CourseInput;
    course.name = String(request.name ?? "");
    course.weekday = Number(request.weekday ?? course.weekday);
    course.startPeriod = Number(request.startPeriod ?? course.startPeriod);
    course.endPeriod = Number(request.endPeriod ?? course.endPeriod);
    course.location = String(request.location ?? "");
    course.teacher = String(request.teacher ?? "");
    course.weeks = String(request.weeks ?? "");
    course.color = request.color ?? null;
    course.note = String(request.note ?? "");
    course.updatedAt = stamp;
    return cloneCourse(course);
  }

  if (command === "agenda_course_delete") {
    const index = courses.findIndex((item) => item.id === args.id);
    if (index >= 0) courses.splice(index, 1);
    return null;
  }

  if (command === "agenda_courses_import") {
    const rows = (args.courses as CourseInput[]) ?? [];
    const created: Course[] = [];
    for (const row of rows) {
      const duplicated = courses.some(
        (course) =>
          course.name === row.name &&
          course.weekday === row.weekday &&
          course.startPeriod === row.startPeriod &&
          course.endPeriod === row.endPeriod,
      );
      if (duplicated) continue;
      const course: Course = {
        id: `c${nextId++}`,
        name: row.name,
        weekday: row.weekday,
        startPeriod: row.startPeriod,
        endPeriod: row.endPeriod,
        location: row.location ?? "",
        teacher: row.teacher ?? "",
        weeks: row.weeks ?? "",
        color: row.color ?? null,
        note: row.note ?? "",
        createdAt: stamp,
        updatedAt: stamp,
      };
      courses.push(course);
      created.push(course);
    }
    return created.map(cloneCourse);
  }

  if (command === "agenda_daily_create") {
    const request = args.request as { title?: string; color?: string | null; active?: boolean };
    const maxSort = dailyTasks.reduce((max, task) => Math.max(max, task.sortOrder), 0);
    const task: DailyTask = {
      id: `d${nextId++}`,
      title: String(request.title ?? ""),
      color: request.color ?? null,
      active: request.active ?? true,
      sortOrder: maxSort + 1024,
      createdAt: stamp,
      updatedAt: stamp,
    };
    dailyTasks.push(task);
    return cloneDailyTask(task);
  }

  if (command === "agenda_daily_update") {
    const task = findDailyTask(String(args.id));
    const request = args.request as { title?: string; color?: string | null; active?: boolean };
    task.title = String(request.title ?? "");
    task.color = request.color ?? null;
    task.active = request.active ?? true;
    task.updatedAt = stamp;
    return cloneDailyTask(task);
  }

  if (command === "agenda_daily_delete") {
    const index = dailyTasks.findIndex((item) => item.id === args.id);
    if (index >= 0) dailyTasks.splice(index, 1);
    for (const [date, ids] of Object.entries(dailyChecks)) {
      const next = ids.filter((id) => id !== args.id);
      if (next.length > 0) dailyChecks[date] = next;
      else delete dailyChecks[date];
    }
    return null;
  }

  if (command === "agenda_daily_toggle") {
    const taskId = String(args.taskId);
    const date = String(args.date);
    const done = Boolean(args.done);
    const ids = new Set(dailyChecks[date] ?? []);
    if (done) ids.add(taskId);
    else ids.delete(taskId);
    if (ids.size > 0) dailyChecks[date] = [...ids];
    else delete dailyChecks[date];
    return [...ids];
  }

  if (command === "agenda_partner_profile_save") {
    return args.profile;
  }
  if (command === "agenda_partner_courses_import") {
    const rows = (args.courses as Array<Record<string, unknown>>) ?? [];
    return rows.map((row, index) => ({
      id: `pc-import-${nextId++}`,
      name: String(row.name ?? ""),
      weekday: Number(row.weekday ?? 1),
      startPeriod: Number(row.startPeriod ?? 1),
      endPeriod: Number(row.endPeriod ?? 1),
      location: String(row.location ?? ""),
      teacher: String(row.teacher ?? ""),
      weeks: String(row.weeks ?? ""),
      color: null,
      note: String(row.note ?? ""),
      createdAt: stamp,
      updatedAt: stamp,
      index,
    }));
  }
  if (command === "agenda_partner_course_delete") return null;
  if (command === "agenda_courses_clear") return 0;
  if (command === "agenda_partner_courses_clear") return 0;
  if (command === "agenda_courses_clear") return 0;
  if (command === "agenda_partner_courses_clear") return 0;

  if (command === "agenda_course_override_create") {
    const request = args.request as Record<string, unknown>;
    const entry = {
      id: `override-${nextId++}`,
      courseId: String(request.courseId ?? ""),
      date: String(request.date ?? todayKey()),
      action: (request.action as "cancel" | "move") ?? "cancel",
      startPeriod: (request.startPeriod as number | null) ?? null,
      endPeriod: (request.endPeriod as number | null) ?? null,
      location: (request.location as string | null) ?? null,
      note: String(request.note ?? ""),
      createdAt: new Date().toISOString(),
    };
    return entry;
  }
  if (command === "agenda_course_override_delete") return null;
  if (command === "agenda_widget_bounds_get") return null;
  if (command === "notes_list" || command === "categories_list") return [];
  if (command === "notes_create") {
    const request = args.request as Record<string, unknown>;
    return {
      id: `note-${nextId++}`,
      title: String(request.title ?? ""),
      fileName: "preview.md",
      category: String(request.category ?? ""),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      wordCount: 0,
      content: String(request.content ?? ""),
    };
  }
  if (command === "notes_update" || command === "categories_create") return null;
  if (command === "open_note_in_editor") return null;

  if (command === "agenda_timetable_settings_save") {
    timetableSettings = args.settings as TimetableSettings;
    return {
      semesterStart: timetableSettings.semesterStart,
      periodTimes: timetableSettings.periodTimes.map((item) => ({ ...item })),
    };
  }

  return null;
}

(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
  invoke,
  transformCallback: (callback: unknown) => {
    const id = ++callbackId;
    callbacks.set(id, callback);
    return id;
  },
  unregisterCallback: (id: number) => callbacks.delete(id),
  metadata: { currentWindow: { label: "main" } },
};
(
  window as unknown as { __TAURI_EVENT_PLUGIN_INTERNALS__: unknown }
).__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => undefined };

function PreviewShell({
  initialMode,
  initialCalendarView,
}: {
  initialMode: AgendaMode;
  initialCalendarView: CalendarView;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.body.style.background = theme === "dark" ? "#222120" : "#f6f3ec";
  }, [theme]);

  return (
    <div className="h-screen flex flex-col bg-cloud font-body text-ink overflow-hidden">
      <header className="h-11 shrink-0 flex items-center justify-between border-b border-paper-deep/30 bg-paper/55 px-4 select-none">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[15px] font-serif font-medium text-ink-soft tracking-wide leading-none">
            DeskMate
          </span>
          <div className="flex items-center rounded-md bg-paper-warm/70 p-0.5">
            <button
              type="button"
              onClick={() =>
                showToast(
                  "预览只覆盖日程、课程表、待办与每日必做；笔记工作区请在桌面版中查看。",
                  "info",
                )
              }
              className="px-2.5 h-6 flex items-center rounded text-[11px] font-body text-ink-ghost hover:text-ink-soft cursor-pointer"
            >
              笔记
            </button>
            <span className="px-2.5 h-6 flex items-center rounded bg-cloud text-bamboo shadow-[0_1px_2px_rgba(26,26,24,0.06)] text-[11px] font-body">
              日程待办
            </span>
          </div>
          <span className="text-[11px] text-ink-ghost leading-none">—</span>
          <span className="text-[11px] text-ink-faint leading-none truncate">日程与待办</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="px-2 py-0.5 rounded-full border border-paper-deep/60 text-[10px] font-body text-ink-ghost"
            title="勾选、添加、编辑都会生效，刷新页面即恢复演示数据；系统通知与托盘不在预览范围内。"
          >
            浏览器预览 · 数据仅存内存
          </span>
          <button
            type="button"
            onClick={() => setTheme((value) => (value === "light" ? "dark" : "light"))}
            className="h-6 px-2 rounded-md border border-paper-deep/60 text-[10px] font-body text-ink-faint hover:text-bamboo hover:border-bamboo/40 transition-colors cursor-pointer"
          >
            {theme === "light" ? "深色" : "浅色"}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-6 px-2 rounded-md border border-paper-deep/60 text-[10px] font-body text-ink-faint hover:text-bamboo hover:border-bamboo/40 transition-colors cursor-pointer"
          >
            重置
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        <AgendaWorkspace initialMode={initialMode} initialCalendarView={initialCalendarView} />
      </div>
      <ToastContainer />
    </div>
  );
}

async function bootstrap() {
  await initializeI18n("zh-CN");
  const params = new URLSearchParams(window.location.search);
  const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

  // ?quick=1 单独渲染快速待办小窗，便于在浏览器里验证语法解析 chips
  if (params.get("quick")) {
    root.render(
      <I18nextProvider i18n={i18n}>
        <QuickTodoWindow />
        <ToastContainer />
      </I18nextProvider>,
    );
    return;
  }

  // ?widget=schedule|todos 单独渲染桌面小窗预览
  const widget = params.get("widget");
  if (widget === "schedule" || widget === "todos" || widget === "all") {
    root.render(
      <I18nextProvider i18n={i18n}>
        <AgendaWidgetWindow kind={widget as "all" | "schedule" | "todos"} />
        <ToastContainer />
      </I18nextProvider>,
    );
    return;
  }

  const requestedMode = params.get("mode");
  const initialMode =
    requestedMode === "calendar" || requestedMode === "courses" || requestedMode === "daily"
      ? requestedMode
      : "todos";

  root.render(
    <React.StrictMode>
      <I18nextProvider i18n={i18n}>
        <PreviewShell
          initialMode={initialMode}
          initialCalendarView={params.get("view") === "week" ? "week" : "month"}
        />
      </I18nextProvider>
    </React.StrictMode>,
  );
}

void bootstrap();
