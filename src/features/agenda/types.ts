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

export interface TimetableSettings {
  semesterStart: string | null;
  periodTimes: PeriodTime[];
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
