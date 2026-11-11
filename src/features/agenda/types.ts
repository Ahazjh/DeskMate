export type Priority = 0 | 1 | 2 | 3;

export interface Todo {
  id: string;
  title: string;
  notes: string;
  done: boolean;
  completedAt: string | null;
  dueDate: string | null;
  dueAt: string | null;
  priority: Priority;
  tags: string[];
  courseId: string | null;
  platform: string;
  kind: "task" | "assignment" | "reminder";
  remindMinutes: number | null;
  estimateMinutes: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgendaEvent {
  id: string;
  title: string;
  notes: string;
  allDay: boolean;
  startAt: string;
  endAt: string;
  startDate: string | null;
  endDate: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgendaSnapshot {
  todos: Todo[];
  events: AgendaEvent[];
  courses: Course[];
  dailyTasks: DailyTask[];
  dailyChecks: Record<string, string[]>;
  courseOverrides: CourseOverride[];
  partnerProfile: PartnerProfile;
  partnerCourses: Course[];
  timetableSettings: TimetableSettings;
}

export interface PeriodTime {
  period: number;
  start: string;
  end: string;
}

/** 早 / 下午 / 晚上三段的节数分布 */
export interface SessionPeriodCounts {
  morning: number;
  afternoon: number;
  evening: number;
}

/** 早 / 下午 / 晚上三段的开始上课时间（HH:mm） */
export interface SessionStartTimes {
  morning: string;
  afternoon: string;
  evening: string;
}

/**
 * 课表的作息参数。节次时刻由这些参数推算出来，
 * 用户也可以逐节微调 —— 那部分存在 periodTimes 里。
 */
export interface TimetableSchedule {
  /** 每小节课时长（分钟） */
  periodMinutes: number;
  /** 每大节时长（分钟，不含课间） */
  majorPeriodMinutes: number;
  /** 小课间（分钟），同一大节内两小节之间 */
  shortBreakMinutes: number;
  /** 大课间（分钟），两个大节之间 */
  longBreakMinutes: number;
  /** 每日节数分布 */
  sessionPeriods: SessionPeriodCounts;
  /** 三段开始上课时间 */
  sessionStarts: SessionStartTimes;
  /** 是否启用夏令时 / 冬令时两套作息 */
  seasonal: boolean;
  /** 夏令时三段开始时间 */
  summerStarts: SessionStartTimes;
  /** 冬令时三段开始时间 */
  winterStarts: SessionStartTimes;
  /** 切换到夏令时的日期（MM-DD，每年重复） */
  summerStartDate: string;
  /** 切换到冬令时的日期（MM-DD，每年重复） */
  winterStartDate: string;
}

export interface TimetableSettings {
  semesterStart: string | null;
  periodTimes: PeriodTime[];
  /**
   * 作息参数。为 null 表示沿用逐节手动设置的时刻（老数据），
   * 非 null 时节次时刻由参数推算。
   */
  schedule: TimetableSchedule | null;
}

export interface Course {
  id: string;
  name: string;
  weekday: number;
  startPeriod: number;
  endPeriod: number;
  location: string;
  teacher: string;
  weeks: string;
  color: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseOverride {
  id: string;
  courseId: string;
  date: string;
  action: "cancel" | "move";
  startPeriod: number | null;
  endPeriod: number | null;
  location: string | null;
  note: string;
  createdAt: string;
}

export interface CourseOverrideInput {
  courseId: string;
  date: string;
  action: "cancel" | "move";
  startPeriod?: number | null;
  endPeriod?: number | null;
  location?: string | null;
  note?: string;
}

export type PartnerRelation = "partner" | "sibling" | "classmate" | "friend" | "other";

export interface PartnerProfile {
  name: string;
  relation: PartnerRelation;
  color: string | null;
}

export interface CourseFileImport {
  courses: CourseInput[];
  warnings: string[];
  sheet: string;
}

export interface CourseInput {
  name: string;
  weekday: number;
  startPeriod: number;
  endPeriod: number;
  location?: string;
  teacher?: string;
  weeks?: string;
  color?: string | null;
  note?: string;
}

export interface DailyTask {
  id: string;
  title: string;
  color: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyTaskInput {
  title: string;
  color?: string | null;
  active?: boolean;
}

export interface TodoInput {
  title: string;
  notes?: string;
  dueDate?: string | null;
  dueAt?: string | null;
  priority?: Priority;
  tags?: string[];
  courseId?: string | null;
  platform?: string;
  kind?: "task" | "assignment" | "reminder";
  remindMinutes?: number | null;
  estimateMinutes?: number | null;
}

export interface ReminderSettings {
  enabled: boolean;
  defaultMinutes: number;
  todoReminders: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  autoReview: boolean;
  muteDuringCourses: boolean;
}

export interface ReminderItem {
  key: string;
  kind: "todo" | "event";
  id: string;
  title: string;
  body: string;
  fireAt: string;
}

export interface EventInput {
  title: string;
  notes?: string;
  allDay?: boolean;
  startAt: string;
  endAt: string;
  startDate?: string | null;
  endDate?: string | null;
  color?: string | null;
}

export type SmartList = "today" | "tomorrow" | "week" | "overdue" | "all" | "done";

export type AgendaMode = "todos" | "calendar" | "courses" | "daily";

export type CalendarView = "month" | "week";
