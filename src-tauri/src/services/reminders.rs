use crate::json_io::write_json_atomic;
use crate::services::agenda::{AgendaSnapshot, AgendaState};
use crate::services::notes::{default_store, AppError, SaveNoteRequest};
use chrono::{DateTime, Datelike, Duration, Local, NaiveDate, Timelike, Utc};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    thread,
    time::Duration as StdDuration,
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

const TICK_SECONDS: u64 = 30;
const MISSED_WINDOW_MINUTES: i64 = 30;
pub const REVIEW_CATEGORY: &str = "每日回顾";
const REVIEW_TITLE_PREFIX: &str = "每日回顾 · ";

fn app_error(code: &str, message: impl Into<String>) -> AppError {
    AppError {
        code: code.to_string(),
        message: message.into(),
        details: Default::default(),
    }
}

fn default_true() -> bool {
    true
}

fn default_minutes() -> i64 {
    10
}

fn default_quiet_start() -> String {
    "22:00".to_string()
}

fn default_quiet_end() -> String {
    "08:00".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ReminderSettings {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_minutes")]
    pub default_minutes: i64,
    #[serde(default = "default_true")]
    pub todo_reminders: bool,
    #[serde(default)]
    pub quiet_hours_enabled: bool,
    #[serde(default = "default_quiet_start")]
    pub quiet_start: String,
    #[serde(default = "default_quiet_end")]
    pub quiet_end: String,
    #[serde(default = "default_true")]
    pub auto_review: bool,
    /// 上课时段自动静音提醒（不打断课堂）
    #[serde(default = "default_true")]
    pub mute_during_courses: bool,
}

impl Default for ReminderSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            default_minutes: 10,
            todo_reminders: true,
            quiet_hours_enabled: false,
            quiet_start: default_quiet_start(),
            quiet_end: default_quiet_end(),
            auto_review: true,
            mute_during_courses: true,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReminderFile {
    #[serde(default)]
    settings: ReminderSettings,
    #[serde(default)]
    fired: Vec<String>,
    #[serde(default)]
    snoozes: BTreeMap<String, DateTime<Utc>>,
    #[serde(default)]
    dismissed_days: BTreeMap<String, String>,
    #[serde(default)]
    last_review_day: Option<String>,
}

#[derive(Debug)]
pub struct ReminderState {
    path: Mutex<PathBuf>,
    inner: Mutex<ReminderFile>,
}

impl ReminderState {
    pub fn new(data_dir: &Path) -> Self {
        let path = data_dir.join("agenda").join("reminders.json");
        let file = load_file(&path);
        Self {
            path: Mutex::new(path),
            inner: Mutex::new(file),
        }
    }

    pub fn rebind(&self, data_dir: &Path) {
        let path = data_dir.join("agenda").join("reminders.json");
        let file = load_file(&path);
        *self.path.lock().unwrap_or_else(|p| p.into_inner()) = path;
        *self.inner.lock().unwrap_or_else(|p| p.into_inner()) = file;
    }

    fn persist(&self) -> Result<(), AppError> {
        let file = self.inner.lock().unwrap_or_else(|p| p.into_inner());
        let path = self.path.lock().unwrap_or_else(|p| p.into_inner());
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        write_json_atomic(&path, &*file)
    }

    pub fn settings(&self) -> ReminderSettings {
        self.inner
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .settings
            .clone()
    }

    pub fn set_settings(
        &self,
        mut settings: ReminderSettings,
    ) -> Result<ReminderSettings, AppError> {
        settings.default_minutes = settings.default_minutes.clamp(0, 240);
        settings.quiet_start =
            normalize_clock(&settings.quiet_start).unwrap_or_else(default_quiet_start);
        settings.quiet_end = normalize_clock(&settings.quiet_end).unwrap_or_else(default_quiet_end);
        self.inner
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .settings = settings.clone();
        self.persist()?;
        Ok(settings)
    }

    fn file_clone(&self) -> ReminderFile {
        self.inner.lock().unwrap_or_else(|p| p.into_inner()).clone()
    }

    fn mark_fired(&self, keys: Vec<String>) -> Result<(), AppError> {
        if keys.is_empty() {
            return Ok(());
        }
        {
            let mut file = self.inner.lock().unwrap_or_else(|p| p.into_inner());
            let mut seen: HashSet<String> = file.fired.iter().cloned().collect();
            for key in keys {
                seen.insert(key);
            }
            file.fired = seen.into_iter().collect();
            if file.fired.len() > 2000 {
                let drain = file.fired.len() - 2000;
                file.fired.drain(0..drain);
            }
        }
        self.persist()
    }

    fn snooze(&self, key: &str, until: DateTime<Utc>) -> Result<(), AppError> {
        {
            let mut file = self.inner.lock().unwrap_or_else(|p| p.into_inner());
            file.fired.retain(|item| item != key);
            file.snoozes.insert(key.to_string(), until);
        }
        self.persist()
    }

    fn dismiss_today(&self, key: &str, day: &str) -> Result<(), AppError> {
        {
            let mut file = self.inner.lock().unwrap_or_else(|p| p.into_inner());
            file.dismissed_days.insert(key.to_string(), day.to_string());
        }
        self.persist()
    }

    fn last_review_day(&self) -> Option<String> {
        self.inner
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .last_review_day
            .clone()
    }

    fn set_last_review_day(&self, day: &str) -> Result<(), AppError> {
        self.inner
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .last_review_day = Some(day.to_string());
        self.persist()
    }
}

fn load_file(path: &Path) -> ReminderFile {
    if !path.exists() {
        return ReminderFile::default();
    }
    match fs::read(path)
        .and_then(|bytes| serde_json::from_slice::<ReminderFile>(&bytes).map_err(Into::into))
    {
        Ok(file) => file,
        Err(error) => {
            eprintln!("reminders.json is corrupt ({error}); starting with defaults");
            ReminderFile::default()
        }
    }
}

fn normalize_clock(value: &str) -> Option<String> {
    let mut parts = value.trim().split(':');
    let hour = parts.next()?.parse::<u32>().ok()?;
    let minute = parts.next()?.parse::<u32>().ok()?;
    if parts.next().is_some() || hour > 23 || minute > 59 {
        return None;
    }
    Some(format!("{hour:02}:{minute:02}"))
}

fn clock_minutes(value: &str) -> Option<u32> {
    let mut parts = value.trim().split(':');
    Some(parts.next()?.parse::<u32>().ok()? * 60 + parts.next()?.parse::<u32>().ok()?)
}

pub fn in_quiet_hours(settings: &ReminderSettings, now: DateTime<Utc>) -> bool {
    if !settings.quiet_hours_enabled {
        return false;
    }
    let local = now.with_timezone(&Local);
    let current = local.hour() * 60 + local.minute();
    let start = clock_minutes(&settings.quiet_start).unwrap_or(22 * 60);
    let end = clock_minutes(&settings.quiet_end).unwrap_or(8 * 60);
    if start <= end {
        (start..end).contains(&current)
    } else {
        current >= start || current < end
    }
}

fn local_day(dt: DateTime<Utc>) -> NaiveDate {
    dt.with_timezone(&Local).date_naive()
}

fn local_day_key(day: NaiveDate) -> String {
    day.format("%Y-%m-%d").to_string()
}

fn local_datetime_to_utc(day: NaiveDate, hour: u32, minute: u32) -> Option<DateTime<Utc>> {
    day.and_hms_opt(hour, minute, 0)?
        .and_local_timezone(Local)
        .single()
        .map(|value| value.with_timezone(&Utc))
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ReminderItem {
    pub key: String,
    pub kind: String,
    pub id: String,
    pub title: String,
    pub body: String,
    pub fire_at: DateTime<Utc>,
}

/// 纯函数：算出当前应该（或刚刚应该）触发的提醒，便于单测覆盖。
pub fn due_reminders(
    snapshot: &AgendaSnapshot,
    settings: &ReminderSettings,
    now: DateTime<Utc>,
) -> Vec<ReminderItem> {
    let lead = Duration::minutes(settings.default_minutes.clamp(0, 240));
    let mut items = Vec::new();

    if settings.todo_reminders {
        for todo in &snapshot.todos {
            if todo.done {
                continue;
            }
            let fire_at = if let Some(due_at) = todo.due_at {
                let minutes = todo
                    .remind_minutes
                    .unwrap_or(settings.default_minutes)
                    .clamp(0, 240);
                due_at - Duration::minutes(minutes)
            } else if let Some(day) = todo
                .due_date
                .as_deref()
                .and_then(|value| NaiveDate::parse_from_str(value, "%Y-%m-%d").ok())
            {
                match local_datetime_to_utc(day, 9, 0) {
                    Some(value) => value,
                    None => continue,
                }
            } else {
                continue;
            };
            if fire_at > now {
                continue;
            }
            let clock = fire_at.with_timezone(&Local).format("%H:%M");
            let body = if todo.kind == "reminder" {
                format!("{clock} · 提醒")
            } else {
                format!("{clock} · 待办")
            };
            items.push(ReminderItem {
                key: format!("todo:{}:{}", todo.id, fire_at.timestamp()),
                kind: "todo".to_string(),
                id: todo.id.clone(),
                title: todo.title.clone(),
                body: format!("{} · {}", todo.title, body),
                fire_at,
            });
        }
    }

    for event in &snapshot.events {
        let fire_at = if event.all_day {
            let day = match event
                .start_date
                .as_deref()
                .and_then(|value| NaiveDate::parse_from_str(value, "%Y-%m-%d").ok())
            {
                Some(value) => value,
                None => continue,
            };
            match local_datetime_to_utc(day, 9, 0) {
                Some(value) => value,
                None => continue,
            }
        } else {
            event.start_at - lead
        };
        if fire_at > now {
            continue;
        }
        let clock = event.start_at.with_timezone(&Local).format("%H:%M");
        items.push(ReminderItem {
            key: format!("event:{}:{}", event.id, fire_at.timestamp()),
            kind: "event".to_string(),
            id: event.id.clone(),
            title: event.title.clone(),
            body: format!("{} · {clock} · 日程", event.title),
            fire_at,
        });
    }

    items.sort_by_key(|item| item.fire_at);
    items
}

fn notify(app: &AppHandle, item: &ReminderItem) {
    if let Err(error) = app
        .notification()
        .builder()
        .title("DeskMate · 提醒")
        .body(&item.body)
        .show()
    {
        eprintln!("failed to show system notification: {error}");
    }
    // 无论系统通知是否可用（便携版 Windows 可能没有包身份），
    // 应用内提醒条始终可用，提供「查看 / 稍后 / 今天不再提醒」。
    let _ = app.emit("agenda-reminder", item);
}

fn minutes_of_day(value: &str) -> Option<u32> {
    let mut parts = value.trim().split(':');
    let hour = parts.next()?.parse::<u32>().ok()?;
    let minute = parts.next()?.parse::<u32>().ok()?;
    if hour > 23 || minute > 59 {
        return None;
    }
    Some(hour * 60 + minute)
}

fn semester_week(start: Option<&str>, today: NaiveDate) -> Option<i64> {
    let start = NaiveDate::parse_from_str(start?, "%Y-%m-%d").ok()?;
    Some((today - start).num_days().div_euclid(7) + 1)
}

fn weeks_match(weeks: &str, week: i64) -> bool {
    let normalized = weeks.replace(' ', "");
    if normalized.is_empty() {
        return true;
    }
    if normalized.contains("单周") {
        return week % 2 == 1;
    }
    if normalized.contains("双周") {
        return week % 2 == 0;
    }
    for part in normalized.split(',') {
        let part = part.trim_end_matches('周');
        if let Some((start, end)) = part.split_once('-') {
            if let (Ok(start), Ok(end)) = (start.parse::<i64>(), end.parse::<i64>()) {
                if week >= start && week <= end {
                    return true;
                }
            }
        } else if let Ok(value) = part.parse::<i64>() {
            if week == value {
                return true;
            }
        }
    }
    false
}

/// 当前是否正在上课（含课间 5 分钟缓冲）；停课例外优先。
pub fn in_course_time(snapshot: &AgendaSnapshot, now: DateTime<Utc>) -> bool {
    let local = now.with_timezone(&Local);
    let weekday = local.weekday().number_from_monday() as i32;
    let current = local.hour() * 60 + local.minute();
    let today = local_day_key(local.date_naive());
    let week = semester_week(
        snapshot.timetable_settings.semester_start.as_deref(),
        local.date_naive(),
    );

    for course in &snapshot.courses {
        if course.weekday as i32 != weekday {
            continue;
        }
        if let Some(week) = week {
            if week > 0 && !weeks_match(&course.weeks, week) {
                continue;
            }
        }
        let cancelled = snapshot.course_overrides.iter().any(|item| {
            item.course_id == course.id && item.date == today && item.action == "cancel"
        });
        if cancelled {
            continue;
        }
        let start = snapshot
            .timetable_settings
            .period_times
            .iter()
            .find(|item| item.period == course.start_period)
            .and_then(|item| minutes_of_day(&item.start));
        let end = snapshot
            .timetable_settings
            .period_times
            .iter()
            .find(|item| item.period == course.end_period)
            .and_then(|item| minutes_of_day(&item.end));
        if let (Some(start), Some(end)) = (start, end) {
            if current >= start && current <= end + 5 {
                return true;
            }
        }
    }
    false
}

fn tick(app: &AppHandle) {
    let state = app.state::<ReminderState>();
    let file = state.file_clone();
    let settings = file.settings.clone();

    if settings.auto_review {
        maybe_generate_review(app, &state);
    }
    if !settings.enabled || in_quiet_hours(&settings, Utc::now()) {
        return;
    }

    let agenda = app.state::<AgendaState>();
    let snapshot = match agenda.with(|store| store.snapshot()) {
        Ok(value) => value,
        Err(error) => {
            eprintln!(
                "failed to read agenda snapshot for reminders: {}",
                error.message
            );
            return;
        }
    };

    let now = Utc::now();
    if settings.mute_during_courses && in_course_time(&snapshot, now) {
        return;
    }
    let today = local_day_key(Local::now().date_naive());
    let window = Duration::minutes(MISSED_WINDOW_MINUTES);
    let fired: HashSet<String> = file.fired.iter().cloned().collect();
    let mut newly_fired = Vec::new();

    for item in due_reminders(&snapshot, &settings, now) {
        // 过期太久的提醒不补弹，只标记为已处理，避免启动后历史轰炸。
        if item.fire_at < now - window {
            if !fired.contains(&item.key) {
                newly_fired.push(item.key.clone());
            }
            continue;
        }
        if fired.contains(&item.key) {
            continue;
        }
        if file
            .snoozes
            .get(&item.key)
            .is_some_and(|until| *until > now)
        {
            continue;
        }
        if file
            .dismissed_days
            .get(&item.key)
            .is_some_and(|day| day == &today)
        {
            continue;
        }
        notify(app, &item);
        newly_fired.push(item.key);
    }

    if let Err(error) = state.mark_fired(newly_fired) {
        eprintln!("failed to persist reminder state: {}", error.message);
    }
}

/// 把「当天完成的待办 / 日程 / 课程 / 每日必做」写成一篇本地笔记。
pub fn build_review_markdown(snapshot: &AgendaSnapshot, day: NaiveDate) -> String {
    let mut lines = vec![format!("# {REVIEW_TITLE_PREFIX}{}", local_day_key(day))];

    let done: Vec<_> = snapshot
        .todos
        .iter()
        .filter(|todo| {
            todo.done
                && todo
                    .completed_at
                    .map(local_day)
                    .is_some_and(|value| value == day)
        })
        .collect();
    if !done.is_empty() {
        lines.push(String::new());
        lines.push("## 完成的待办".to_string());
        for todo in done {
            let clock = todo
                .completed_at
                .map(|value| value.with_timezone(&Local).format("%H:%M").to_string())
                .unwrap_or_default();
            lines.push(format!("- [x] {}（完成于 {clock}）", todo.title));
        }
    }

    let events: Vec<_> = snapshot
        .events
        .iter()
        .filter(|event| {
            let start = local_day(event.start_at);
            let end = local_day(event.end_at);
            (start..=end).contains(&day)
        })
        .collect();
    if !events.is_empty() {
        lines.push(String::new());
        lines.push("## 当天日程".to_string());
        for event in events {
            let range = if event.all_day {
                "全天".to_string()
            } else {
                format!(
                    "{}–{}",
                    event.start_at.with_timezone(&Local).format("%H:%M"),
                    event.end_at.with_timezone(&Local).format("%H:%M")
                )
            };
            lines.push(format!("- {range} {}", event.title));
        }
    }

    let weekday = day.weekday().number_from_monday() as i32;
    let courses: Vec<_> = snapshot
        .courses
        .iter()
        .filter(|course| course.weekday as i32 == weekday)
        .collect();
    if !courses.is_empty() {
        lines.push(String::new());
        lines.push("## 当天课程".to_string());
        for course in courses {
            let place = if course.location.is_empty() {
                String::new()
            } else {
                format!(" · {}", course.location)
            };
            let weeks = if course.weeks.is_empty() {
                String::new()
            } else {
                format!(" · {}", course.weeks)
            };
            lines.push(format!(
                "- 第{}–{}节 {}{}{}",
                course.start_period, course.end_period, course.name, place, weeks
            ));
        }
    }

    let day_key = local_day_key(day);
    let checked: HashSet<&String> = snapshot
        .daily_checks
        .get(&day_key)
        .map(|ids| ids.iter().collect())
        .unwrap_or_default();
    let active: Vec<_> = snapshot
        .daily_tasks
        .iter()
        .filter(|task| task.active)
        .collect();
    if !active.is_empty() {
        lines.push(String::new());
        lines.push("## 每日必做".to_string());
        for task in active {
            let mark = if checked.contains(&task.id) { "x" } else { " " };
            lines.push(format!("- [{mark}] {}", task.title));
        }
    }

    if lines.len() == 1 {
        lines.push(String::new());
        lines.push("_这一天还没有记录。_".to_string());
    }
    lines.join("\n")
}

pub fn review_has_content(snapshot: &AgendaSnapshot, day: NaiveDate) -> bool {
    let day_key = local_day_key(day);
    snapshot.todos.iter().any(|todo| {
        todo.done
            && todo
                .completed_at
                .map(local_day)
                .is_some_and(|value| value == day)
    }) || snapshot
        .events
        .iter()
        .any(|event| (local_day(event.start_at)..=local_day(event.end_at)).contains(&day))
        || snapshot
            .courses
            .iter()
            .any(|course| course.weekday as i64 == day.weekday().number_from_monday() as i64)
        || !snapshot
            .daily_checks
            .get(&day_key)
            .map(|ids| ids.is_empty())
            .unwrap_or(true)
        || snapshot.daily_tasks.iter().any(|task| task.active)
}

pub fn generate_review(
    app: &AppHandle,
    snapshot: &AgendaSnapshot,
    day: NaiveDate,
) -> Result<String, AppError> {
    let title = format!("{REVIEW_TITLE_PREFIX}{}", local_day_key(day));
    let content = build_review_markdown(snapshot, day);
    let store = default_store()?;
    let note = if let Some(existing) = store
        .list_notes()?
        .into_iter()
        .find(|note| note.title == title && note.category == REVIEW_CATEGORY)
    {
        store.update_note(
            &existing.id,
            SaveNoteRequest {
                title,
                content,
                category: REVIEW_CATEGORY.to_string(),
            },
        )?
    } else {
        store.create_note(SaveNoteRequest {
            title,
            content,
            category: REVIEW_CATEGORY.to_string(),
        })?
    };
    let _ = app.emit("notes-changed", ());
    Ok(note.id)
}

/// 次日首次启动自动生成前一天的回顾；内容完整且不会反复改写。
fn maybe_generate_review(app: &AppHandle, state: &tauri::State<'_, ReminderState>) {
    let today = Local::now().date_naive();
    let yesterday = today.pred_opt().unwrap_or(today);
    let key = local_day_key(yesterday);
    if state.last_review_day().as_deref() == Some(key.as_str()) {
        return;
    }
    let agenda = app.state::<AgendaState>();
    let snapshot = match agenda.with(|store| store.snapshot()) {
        Ok(value) => value,
        Err(_) => return,
    };
    if !review_has_content(&snapshot, yesterday) {
        let _ = state.set_last_review_day(&key);
        return;
    }
    match generate_review(app, &snapshot, yesterday) {
        Ok(_) => {
            let _ = state.set_last_review_day(&key);
        }
        Err(error) => eprintln!("failed to generate daily review: {}", error.message),
    }
}

pub fn start_reminder_scheduler(app: AppHandle) {
    thread::spawn(move || {
        tick(&app);
        loop {
            thread::sleep(StdDuration::from_secs(TICK_SECONDS));
            tick(&app);
        }
    });
}

#[tauri::command]
pub fn agenda_reminder_settings_get(
    state: tauri::State<'_, ReminderState>,
) -> Result<ReminderSettings, AppError> {
    Ok(state.settings())
}

#[tauri::command]
pub fn agenda_reminder_settings_save(
    state: tauri::State<'_, ReminderState>,
    settings: ReminderSettings,
) -> Result<ReminderSettings, AppError> {
    state.set_settings(settings)
}

#[tauri::command]
pub fn agenda_reminder_snooze(
    state: tauri::State<'_, ReminderState>,
    key: String,
    minutes: i64,
) -> Result<(), AppError> {
    let clamped = minutes.clamp(1, 24 * 60);
    state.snooze(&key, Utc::now() + Duration::minutes(clamped))
}

#[tauri::command]
pub fn agenda_reminder_dismiss_today(
    state: tauri::State<'_, ReminderState>,
    key: String,
) -> Result<(), AppError> {
    state.dismiss_today(&key, &local_day_key(Local::now().date_naive()))
}

#[tauri::command]
pub fn agenda_review_generate(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    day: Option<String>,
) -> Result<String, AppError> {
    let target = match day {
        Some(value) => NaiveDate::parse_from_str(&value, "%Y-%m-%d")
            .map_err(|_| app_error("agendaInvalidDay", "日期格式应为 YYYY-MM-DD"))?,
        None => Local::now().date_naive(),
    };
    let snapshot = state.with(|store| store.snapshot())?;
    generate_review(&app, &snapshot, target)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::agenda::{
        AgendaEvent, Course, CourseOverride, DailyTask, PartnerProfile, TimetableSettings, Todo,
    };
    use chrono::TimeZone;
    use std::collections::BTreeMap;

    fn empty_snapshot() -> AgendaSnapshot {
        AgendaSnapshot {
            todos: Vec::new(),
            events: Vec::new(),
            courses: Vec::new(),
            daily_tasks: Vec::new(),
            daily_checks: BTreeMap::new(),
            course_overrides: Vec::new(),
            partner_profile: PartnerProfile::default(),
            partner_courses: Vec::new(),
            timetable_settings: TimetableSettings {
                semester_start: None,
                period_times: Vec::new(),
            },
        }
    }

    fn todo(id: &str, title: &str, due_at: Option<DateTime<Utc>>) -> Todo {
        Todo {
            id: id.to_string(),
            title: title.to_string(),
            notes: String::new(),
            done: false,
            completed_at: None,
            due_date: None,
            due_at,
            priority: 0,
            tags: Vec::new(),
            course_id: None,
            platform: String::new(),
            kind: "task".to_string(),
            remind_minutes: None,
            estimate_minutes: None,
            sort_order: 0,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn due_reminders_uses_lead_time_and_skips_done_and_future() {
        let now = Utc.with_ymd_and_hms(2026, 11, 7, 4, 0, 0).unwrap();
        let mut snapshot = empty_snapshot();
        snapshot
            .todos
            .push(todo("a", "交报价单", Some(now + Duration::minutes(8))));
        let mut done = todo("b", "已完成", Some(now - Duration::minutes(30)));
        done.done = true;
        snapshot.todos.push(done);
        snapshot
            .todos
            .push(todo("c", "还没到", Some(now + Duration::minutes(60))));

        let settings = ReminderSettings::default();
        let items = due_reminders(&snapshot, &settings, now);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, "a");
        assert_eq!(items[0].kind, "todo");
        assert_eq!(items[0].fire_at, now - Duration::minutes(2));
    }

    #[test]
    fn mutes_during_course_time_and_honors_cancel() {
        let mut snapshot = empty_snapshot();
        snapshot.courses.push(Course {
            id: "c1".to_string(),
            name: "高等数学".to_string(),
            weekday: 6,
            start_period: 1,
            end_period: 2,
            location: "教一101".to_string(),
            teacher: String::new(),
            weeks: "1-16周".to_string(),
            color: None,
            note: String::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });

        snapshot.timetable_settings = TimetableSettings::default();

        let inside = Local
            .with_ymd_and_hms(2026, 11, 7, 9, 0, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc);
        let outside = Local
            .with_ymd_and_hms(2026, 11, 7, 12, 0, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc);
        assert!(in_course_time(&snapshot, inside));
        assert!(!in_course_time(&snapshot, outside));

        snapshot.course_overrides.push(CourseOverride {
            id: "o1".to_string(),
            course_id: "c1".to_string(),
            date: "2026-11-07".to_string(),
            action: "cancel".to_string(),
            start_period: None,
            end_period: None,
            location: None,
            note: String::new(),
            created_at: Utc::now(),
        });
        assert!(!in_course_time(&snapshot, inside));
    }

    #[test]
    fn due_reminders_honors_custom_lead_time() {
        let now = Utc.with_ymd_and_hms(2026, 11, 7, 4, 0, 0).unwrap();
        let mut snapshot = empty_snapshot();
        let mut item = todo("a", "自定义提前量", Some(now + Duration::minutes(30)));
        item.remind_minutes = Some(45);
        snapshot.todos.push(item);
        // 提前 45 分钟意味着 15 分钟前就该弹了
        let items = due_reminders(&snapshot, &ReminderSettings::default(), now);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].fire_at, now - Duration::minutes(15));
    }

    #[test]
    fn due_reminders_can_disable_todo_reminders() {
        let now = Utc.with_ymd_and_hms(2026, 11, 7, 4, 0, 0).unwrap();
        let mut snapshot = empty_snapshot();
        snapshot.todos.push(todo("a", "待办", Some(now)));
        let mut settings = ReminderSettings::default();
        settings.todo_reminders = false;
        assert!(due_reminders(&snapshot, &settings, now).is_empty());
    }

    #[test]
    fn quiet_hours_handles_cross_midnight_range() {
        let mut settings = ReminderSettings::default();
        settings.quiet_hours_enabled = true;
        settings.quiet_start = "22:00".to_string();
        settings.quiet_end = "08:00".to_string();
        // 用本地时间构造，避免测试依赖机器时区
        let quiet = Local
            .with_ymd_and_hms(2026, 11, 7, 23, 0, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc);
        let awake = Local
            .with_ymd_and_hms(2026, 11, 7, 12, 0, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc);
        assert!(in_quiet_hours(&settings, quiet));
        assert!(!in_quiet_hours(&settings, awake));
    }

    #[test]
    fn quiet_hours_handles_same_day_range() {
        let mut settings = ReminderSettings::default();
        settings.quiet_hours_enabled = true;
        settings.quiet_start = "13:00".to_string();
        settings.quiet_end = "15:00".to_string();
        let inside = Local
            .with_ymd_and_hms(2026, 11, 7, 14, 0, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc);
        let outside = Local
            .with_ymd_and_hms(2026, 11, 7, 16, 0, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc);
        assert!(in_quiet_hours(&settings, inside));
        assert!(!in_quiet_hours(&settings, outside));
    }

    #[test]
    fn settings_clamp_lead_minutes_and_normalize_clock() {
        let dir = std::env::temp_dir().join(format!("deskmate-reminders-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(dir.join("agenda")).unwrap();
        let state = ReminderState::new(&dir);
        let saved = state
            .set_settings(ReminderSettings {
                enabled: true,
                default_minutes: 9999,
                todo_reminders: true,
                quiet_hours_enabled: true,
                quiet_start: "7:3".to_string(),
                quiet_end: "bad".to_string(),
                auto_review: false,
                mute_during_courses: true,
            })
            .unwrap();
        assert_eq!(saved.default_minutes, 240);
        assert_eq!(saved.quiet_start, "07:03");
        assert_eq!(saved.quiet_end, "08:00");
        assert_eq!(state.settings(), saved);
        assert!(dir.join("agenda").join("reminders.json").exists());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn snooze_removes_fired_key_so_it_can_fire_again() {
        let dir = std::env::temp_dir().join(format!("deskmate-reminders-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(dir.join("agenda")).unwrap();
        let state = ReminderState::new(&dir);
        state.mark_fired(vec!["todo:a:1".to_string()]).unwrap();
        assert!(state.file_clone().fired.contains(&"todo:a:1".to_string()));
        state
            .snooze("todo:a:1", Utc::now() + Duration::minutes(5))
            .unwrap();
        let file = state.file_clone();
        assert!(!file.fired.contains(&"todo:a:1".to_string()));
        assert!(file.snoozes.contains_key("todo:a:1"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn review_markdown_lists_completed_todos_and_daily_progress() {
        let day = NaiveDate::from_ymd_opt(2026, 11, 7).unwrap();
        let mut snapshot = empty_snapshot();
        let mut done = todo("a", "交报价单", None);
        done.done = true;
        done.completed_at = Some(
            Local
                .with_ymd_and_hms(2026, 11, 7, 15, 30, 0)
                .single()
                .unwrap()
                .with_timezone(&Utc),
        );
        snapshot.todos.push(done);
        snapshot.daily_tasks.push(DailyTask {
            id: "d1".to_string(),
            title: "背单词".to_string(),
            color: None,
            active: true,
            sort_order: 0,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
        snapshot
            .daily_checks
            .insert("2026-11-07".to_string(), vec!["d1".to_string()]);

        let markdown = build_review_markdown(&snapshot, day);
        assert!(markdown.contains("每日回顾 · 2026-11-07"));
        assert!(markdown.contains("- [x] 交报价单"));
        assert!(markdown.contains("- [x] 背单词"));
        assert!(review_has_content(&snapshot, day));
    }

    #[test]
    fn review_markdown_has_empty_state() {
        let day = NaiveDate::from_ymd_opt(2026, 11, 7).unwrap();
        let snapshot = empty_snapshot();
        assert!(build_review_markdown(&snapshot, day).contains("这一天还没有记录"));
        assert!(!review_has_content(&snapshot, day));
    }

    #[test]
    fn review_markdown_includes_events_on_that_day() {
        let day = NaiveDate::from_ymd_opt(2026, 11, 7).unwrap();
        let mut snapshot = empty_snapshot();
        snapshot.events.push(AgendaEvent {
            id: "e1".to_string(),
            title: "组会".to_string(),
            notes: String::new(),
            all_day: false,
            start_at: Local
                .with_ymd_and_hms(2026, 11, 7, 9, 0, 0)
                .single()
                .unwrap()
                .with_timezone(&Utc),
            end_at: Local
                .with_ymd_and_hms(2026, 11, 7, 10, 30, 0)
                .single()
                .unwrap()
                .with_timezone(&Utc),
            start_date: None,
            end_date: None,
            color: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
        assert!(build_review_markdown(&snapshot, day).contains("组会"));
    }

    #[test]
    fn review_markdown_includes_courses_on_that_weekday() {
        let day = NaiveDate::from_ymd_opt(2026, 11, 7).unwrap(); // Saturday = 6
        let mut snapshot = empty_snapshot();
        snapshot.courses.push(Course {
            id: "c1".to_string(),
            name: "高等数学".to_string(),
            weekday: 6,
            start_period: 3,
            end_period: 4,
            location: "教一101".to_string(),
            teacher: String::new(),
            weeks: "1-16周".to_string(),
            color: None,
            note: String::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
        snapshot.courses.push(Course {
            id: "c2".to_string(),
            name: "英语".to_string(),
            weekday: 1,
            start_period: 1,
            end_period: 2,
            location: String::new(),
            teacher: String::new(),
            weeks: String::new(),
            color: None,
            note: String::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
        let markdown = build_review_markdown(&snapshot, day);
        assert!(markdown.contains("高等数学"));
        assert!(!markdown.contains("英语"));
    }
}
