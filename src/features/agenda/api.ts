import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { AgendaWidgetKind } from "../windows/windowRoutes";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  AgendaEvent,
  AgendaSnapshot,
  Course,
  CourseInput,
  CourseFileImport,
  CourseOverride,
  PartnerProfile,
  CourseOverrideInput,
  DailyTask,
  DailyTaskInput,
  EventInput,
  ReminderItem,
  ReminderSettings,
  Todo,
  TodoInput,
  TimetableSettings,
} from "./types";

export function agendaSnapshot(): Promise<AgendaSnapshot> {
  return invoke("agenda_snapshot");
}

export function createTodo(request: TodoInput): Promise<Todo> {
  return invoke("agenda_todo_create", { request });
}

export function updateTodo(id: string, request: TodoInput): Promise<Todo> {
  return invoke("agenda_todo_update", { id, request });
}

export function toggleTodo(id: string, done: boolean): Promise<Todo> {
  return invoke("agenda_todo_toggle", { id, done });
}

export function deleteTodo(id: string): Promise<void> {
  return invoke("agenda_todo_delete", { id });
}

export function reorderTodos(ids: string[]): Promise<void> {
  return invoke("agenda_todo_reorder", { ids });
}

export function createEvent(request: EventInput): Promise<AgendaEvent> {
  return invoke("agenda_event_create", { request });
}

export function updateEvent(id: string, request: EventInput): Promise<AgendaEvent> {
  return invoke("agenda_event_update", { id, request });
}

export function deleteEvent(id: string): Promise<void> {
  return invoke("agenda_event_delete", { id });
}

export function createCourse(request: CourseInput): Promise<Course> {
  return invoke("agenda_course_create", { request });
}

export function updateCourse(id: string, request: CourseInput): Promise<Course> {
  return invoke("agenda_course_update", { id, request });
}

export function deleteCourse(id: string): Promise<void> {
  return invoke("agenda_course_delete", { id });
}

export function createCourseOverride(request: CourseOverrideInput): Promise<CourseOverride> {
  return invoke("agenda_course_override_create", { request });
}

export function deleteCourseOverride(id: string): Promise<void> {
  return invoke("agenda_course_override_delete", { id });
}

export async function pickCourseFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "课表文件", extensions: ["xls", "xlsx"] }],
  });
  return typeof selected === "string" ? selected : null;
}

export function savePartnerProfile(profile: PartnerProfile): Promise<PartnerProfile> {
  return invoke("agenda_partner_profile_save", { profile });
}

export function importPartnerCourses(courses: CourseInput[]): Promise<Course[]> {
  return invoke("agenda_partner_courses_import", { courses });
}

export function deletePartnerCourse(id: string): Promise<void> {
  return invoke("agenda_partner_course_delete", { id });
}

export function clearCourses(): Promise<number> {
  return invoke("agenda_courses_clear");
}

export function clearPartnerCourses(): Promise<number> {
  return invoke("agenda_partner_courses_clear");
}

export function importCourseFile(path: string): Promise<CourseFileImport> {
  return invoke("agenda_course_file_import", { path });
}

export function importCourses(courses: CourseInput[]): Promise<Course[]> {
  return invoke("agenda_courses_import", { courses });
}

export function createDailyTask(request: DailyTaskInput): Promise<DailyTask> {
  return invoke("agenda_daily_create", { request });
}

export function updateDailyTask(id: string, request: DailyTaskInput): Promise<DailyTask> {
  return invoke("agenda_daily_update", { id, request });
}

export function deleteDailyTask(id: string): Promise<void> {
  return invoke("agenda_daily_delete", { id });
}

export function toggleDailyTask(id: string, date: string, done: boolean): Promise<string[]> {
  return invoke("agenda_daily_toggle", { taskId: id, date, done });
}

export function saveTimetableSettings(settings: TimetableSettings): Promise<TimetableSettings> {
  return invoke("agenda_timetable_settings_save", { settings });
}

export function reminderSettings(): Promise<ReminderSettings> {
  return invoke("agenda_reminder_settings_get");
}

export function saveReminderSettings(settings: ReminderSettings): Promise<ReminderSettings> {
  return invoke("agenda_reminder_settings_save", { settings });
}

export function snoozeReminder(key: string, minutes: number): Promise<void> {
  return invoke("agenda_reminder_snooze", { key, minutes });
}

export function dismissReminderToday(key: string): Promise<void> {
  return invoke("agenda_reminder_dismiss_today", { key });
}

export function generateDailyReview(day?: string | null): Promise<string> {
  return invoke("agenda_review_generate", { day: day ?? null });
}

export function onReminder(handler: (item: ReminderItem) => void): Promise<() => void> {
  return listen<ReminderItem>("agenda-reminder", (event) => handler(event.payload));
}

export interface WidgetBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getWidgetBounds(kind: AgendaWidgetKind): Promise<WidgetBounds | null> {
  return invoke("agenda_widget_bounds_get", { kind });
}

export function saveWidgetBounds(
  kind: AgendaWidgetKind,
  bounds: WidgetBounds,
): Promise<void> {
  return invoke("agenda_widget_bounds_save", { kind, bounds });
}

export async function openAgendaWidget(): Promise<string> {
  const bounds =
    (await getWidgetBounds("all").catch(() => null)) ??
    (await getWidgetBounds("schedule").catch(() => null));
  return invoke("open_agenda_widget", { bounds });
}
