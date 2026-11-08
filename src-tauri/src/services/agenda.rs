use crate::json_io::write_json_atomic;
use crate::services::notes::AppError;
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

const SCHEMA_VERSION: u32 = 1;
const MAX_TITLE_CHARS: usize = 200;
const MAX_TAG_CHARS: usize = 24;
const MAX_TAGS: usize = 20;
const SORT_ORDER_STEP: i64 = 1024;
const MAX_COURSES: usize = 500;
const MAX_DAILY_TASKS: usize = 100;

fn app_error(code: &str, message: impl Into<String>) -> AppError {
    AppError {
        code: code.to_string(),
        message: message.into(),
        details: Default::default(),
    }
}

fn not_found(kind: &str, id: &str) -> AppError {
    let mut error = app_error("agendaNotFound", format!("{kind} {id} 不存在"));
    error.details.insert("id".into(), id.to_string());
    error
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub done: bool,
    #[serde(default)]
    pub completed_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub due_date: Option<String>,
    #[serde(default)]
    pub due_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub priority: u8,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub course_id: Option<String>,
    #[serde(default)]
    pub platform: String,
    #[serde(default = "default_todo_kind")]
    pub kind: String,
    /// 自定义提醒提前量（分钟）；None 表示使用全局默认。
    #[serde(default)]
    pub remind_minutes: Option<i64>,
    /// 预估需要多少分钟，用于空档排期；None 表示未估算。
    #[serde(default)]
    pub estimate_minutes: Option<i64>,
    #[serde(default)]
    pub sort_order: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgendaEvent {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub all_day: bool,
    pub start_at: DateTime<Utc>,
    pub end_at: DateTime<Utc>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub end_date: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TodoFile {
    #[serde(default)]
    schema_version: u32,
    #[serde(default)]
    todos: Vec<Todo>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EventFile {
    #[serde(default)]
    schema_version: u32,
    #[serde(default)]
    events: Vec<AgendaEvent>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoInput {
    pub title: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub due_date: Option<String>,
    #[serde(default)]
    pub due_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub priority: u8,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub course_id: Option<String>,
    #[serde(default)]
    pub platform: String,
    #[serde(default = "default_todo_kind")]
    pub kind: String,
    #[serde(default)]
    pub remind_minutes: Option<i64>,
    #[serde(default)]
    pub estimate_minutes: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventInput {
    pub title: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub all_day: bool,
    pub start_at: DateTime<Utc>,
    pub end_at: DateTime<Utc>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub end_date: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Course {
    pub id: String,
    pub name: String,
    pub weekday: u8,
    pub start_period: u8,
    pub end_period: u8,
    #[serde(default)]
    pub location: String,
    #[serde(default)]
    pub teacher: String,
    #[serde(default)]
    pub weeks: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub note: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseInput {
    pub name: String,
    pub weekday: u8,
    pub start_period: u8,
    pub end_period: u8,
    #[serde(default)]
    pub location: String,
    #[serde(default)]
    pub teacher: String,
    #[serde(default)]
    pub weeks: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DailyTask {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default = "default_true")]
    pub active: bool,
    #[serde(default)]
    pub sort_order: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyTaskInput {
    pub title: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default = "default_true")]
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PeriodTime {
    pub period: u8,
    pub start: String,
    pub end: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TimetableSettings {
    #[serde(default)]
    pub semester_start: Option<String>,
    #[serde(default = "default_period_times")]
    pub period_times: Vec<PeriodTime>,
}

impl Default for TimetableSettings {
    fn default() -> Self {
        Self {
            semester_start: None,
            period_times: default_period_times(),
        }
    }
}

/// 第二个人（伴侣 / 兄弟姐妹 / 同学等）的课表档案。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PartnerProfile {
    #[serde(default)]
    pub name: String,
    /// partner | sibling | classmate | friend | other
    #[serde(default)]
    pub relation: String,
    #[serde(default)]
    pub color: Option<String>,
}

impl Default for PartnerProfile {
    fn default() -> Self {
        Self {
            name: String::new(),
            relation: "partner".to_string(),
            color: None,
        }
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PartnerFile {
    #[serde(default)]
    schema_version: u32,
    #[serde(default)]
    profile: PartnerProfile,
    #[serde(default)]
    courses: Vec<Course>,
}

/// 单次调课 / 停课例外，不修改课程本身。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CourseOverride {
    pub id: String,
    pub course_id: String,
    pub date: String,
    /// cancel（停课）或 move（调到其他节次/地点）
    pub action: String,
    #[serde(default)]
    pub start_period: Option<u8>,
    #[serde(default)]
    pub end_period: Option<u8>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub note: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseOverrideInput {
    pub course_id: String,
    pub date: String,
    pub action: String,
    #[serde(default)]
    pub start_period: Option<u8>,
    #[serde(default)]
    pub end_period: Option<u8>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub note: String,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CourseOverrideFile {
    #[serde(default)]
    schema_version: u32,
    #[serde(default)]
    overrides: Vec<CourseOverride>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TimetableSettingsFile {
    #[serde(default)]
    schema_version: u32,
    #[serde(default)]
    settings: TimetableSettings,
}

fn default_period_times() -> Vec<PeriodTime> {
    const TIMES: [(&str, &str); 12] = [
        ("08:00", "08:45"),
        ("08:55", "09:40"),
        ("10:00", "10:45"),
        ("10:55", "11:40"),
        ("14:00", "14:45"),
        ("14:55", "15:40"),
        ("16:00", "16:45"),
        ("16:55", "17:40"),
        ("19:00", "19:45"),
        ("19:55", "20:40"),
        ("20:50", "21:35"),
        ("21:45", "22:30"),
    ];

    TIMES
        .iter()
        .enumerate()
        .map(|(index, (start, end))| PeriodTime {
            period: (index + 1) as u8,
            start: (*start).to_string(),
            end: (*end).to_string(),
        })
        .collect()
}

fn default_true() -> bool {
    true
}

fn default_todo_kind() -> String {
    "task".into()
}

fn normalize_todo_kind(value: &str) -> String {
    match value.trim() {
        "assignment" => "assignment".into(),
        "reminder" => "reminder".into(),
        _ => "task".into(),
    }
}

fn normalize_course_id(value: Option<String>) -> Option<String> {
    value
        .map(|id| id.trim().to_string())
        .filter(|id| !id.is_empty())
}

fn normalize_remind_minutes(value: Option<i64>) -> Option<i64> {
    value.map(|minutes| minutes.clamp(0, 240))
}

fn normalize_estimate_minutes(value: Option<i64>) -> Option<i64> {
    value.map(|minutes| minutes.clamp(5, 480))
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CourseFile {
    #[serde(default)]
    schema_version: u32,
    #[serde(default)]
    courses: Vec<Course>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DailyFile {
    #[serde(default)]
    schema_version: u32,
    #[serde(default)]
    tasks: Vec<DailyTask>,
    #[serde(default)]
    checks: BTreeMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgendaSnapshot {
    pub todos: Vec<Todo>,
    pub events: Vec<AgendaEvent>,
    pub courses: Vec<Course>,
    pub daily_tasks: Vec<DailyTask>,
    pub daily_checks: BTreeMap<String, Vec<String>>,
    pub course_overrides: Vec<CourseOverride>,
    pub partner_profile: PartnerProfile,
    pub partner_courses: Vec<Course>,
    pub timetable_settings: TimetableSettings,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgendaChanged {
    pub kind: String,
    pub ids: Vec<String>,
}

fn normalize_title(raw: &str) -> Result<String, AppError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(app_error("agendaTitleEmpty", "标题不能为空"));
    }
    Ok(trimmed.chars().take(MAX_TITLE_CHARS).collect())
}

fn normalize_tags(tags: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();

    for tag in tags {
        let trimmed = tag.trim().trim_start_matches('#').trim();
        if trimmed.is_empty() {
            continue;
        }
        let value: String = trimmed.chars().take(MAX_TAG_CHARS).collect();
        if seen.insert(value.to_lowercase()) {
            normalized.push(value);
        }
        if normalized.len() >= MAX_TAGS {
            break;
        }
    }

    normalized
}

fn normalize_day(value: Option<String>) -> Result<Option<String>, AppError> {
    let Some(raw) = value else {
        return Ok(None);
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    NaiveDate::parse_from_str(trimmed, "%Y-%m-%d")
        .map_err(|_| app_error("agendaInvalidDate", "日期格式无效"))?;
    Ok(Some(trimmed.to_string()))
}

fn normalize_color(value: Option<String>) -> Option<String> {
    value.and_then(|color| {
        let trimmed = color.trim();
        if trimmed.len() == 7
            && trimmed.starts_with('#')
            && trimmed[1..].chars().all(|c| c.is_ascii_hexdigit())
        {
            Some(trimmed.to_lowercase())
        } else {
            None
        }
    })
}

fn normalize_course(input: CourseInput) -> Result<CourseInput, AppError> {
    let name = normalize_title(&input.name)?;
    if !(1..=7).contains(&input.weekday) {
        return Err(app_error("agendaInvalidCourse", "星期需在 1-7 之间"));
    }
    if !(1..=12).contains(&input.start_period) {
        return Err(app_error("agendaInvalidCourse", "开始节次需在 1-12 之间"));
    }

    let end_period =
        if (1..=12).contains(&input.end_period) && input.end_period >= input.start_period {
            input.end_period
        } else {
            input.start_period
        };

    Ok(CourseInput {
        name,
        weekday: input.weekday,
        start_period: input.start_period,
        end_period,
        location: input.location.trim().to_string(),
        teacher: input.teacher.trim().to_string(),
        weeks: input.weeks.trim().to_string(),
        color: normalize_color(input.color),
        note: input.note.trim().to_string(),
    })
}

fn normalize_daily(input: DailyTaskInput) -> Result<DailyTaskInput, AppError> {
    Ok(DailyTaskInput {
        title: normalize_title(&input.title)?,
        color: normalize_color(input.color),
        active: input.active,
    })
}

fn normalize_clock(value: &str) -> Option<String> {
    let (hour, minute) = value.trim().split_once(':')?;
    let hour = hour.parse::<u32>().ok()?;
    let minute = minute.parse::<u32>().ok()?;
    if hour >= 24 || minute >= 60 {
        return None;
    }
    Some(format!("{hour:02}:{minute:02}"))
}

fn normalize_timetable_settings(input: TimetableSettings) -> Result<TimetableSettings, AppError> {
    let semester_start = normalize_day(input.semester_start)?;
    let defaults = default_period_times();
    let mut period_times = Vec::with_capacity(defaults.len());

    for default in defaults {
        let provided = input
            .period_times
            .iter()
            .find(|item| item.period == default.period);

        let start = match provided {
            Some(item) => normalize_clock(&item.start).ok_or_else(|| {
                let mut error = app_error("agendaInvalidTime", "节次开始时间格式无效");
                error
                    .details
                    .insert("period".into(), item.period.to_string());
                error
            })?,
            None => default.start,
        };
        let end = match provided {
            Some(item) => normalize_clock(&item.end).ok_or_else(|| {
                let mut error = app_error("agendaInvalidTime", "节次结束时间格式无效");
                error
                    .details
                    .insert("period".into(), item.period.to_string());
                error
            })?,
            None => default.end,
        };
        if end <= start {
            let mut error = app_error("agendaInvalidTime", "节次结束时间需晚于开始时间");
            error
                .details
                .insert("period".into(), default.period.to_string());
            return Err(error);
        }

        period_times.push(PeriodTime {
            period: default.period,
            start,
            end,
        });
    }

    Ok(TimetableSettings {
        semester_start,
        period_times,
    })
}

#[derive(Debug, Clone)]
pub struct AgendaStore {
    root: PathBuf,
}

impl AgendaStore {
    pub fn new(data_dir: &Path) -> Self {
        Self {
            root: data_dir.join("agenda"),
        }
    }

    fn todos_path(&self) -> PathBuf {
        self.root.join("todos.json")
    }

    fn events_path(&self) -> PathBuf {
        self.root.join("events.json")
    }

    fn courses_path(&self) -> PathBuf {
        self.root.join("courses.json")
    }

    fn daily_path(&self) -> PathBuf {
        self.root.join("daily.json")
    }

    fn timetable_settings_path(&self) -> PathBuf {
        self.root.join("timetable.json")
    }

    fn course_overrides_path(&self) -> PathBuf {
        self.root.join("course_overrides.json")
    }

    fn partner_path(&self) -> PathBuf {
        self.root.join("partner.json")
    }

    fn ensure_root(&self) -> Result<(), AppError> {
        fs::create_dir_all(&self.root)?;
        Ok(())
    }

    fn load_json<T>(&self, path: &Path, label: &str) -> Result<T, AppError>
    where
        T: DeserializeOwned + Default,
    {
        if !path.exists() {
            return Ok(T::default());
        }

        let bytes = fs::read(path)?;
        match serde_json::from_slice::<T>(&bytes) {
            Ok(value) => Ok(value),
            Err(error) => {
                let backup = quarantine(path, label)?;
                eprintln!(
                    "agenda {label} is corrupt ({error}); moved to {}",
                    backup.display()
                );
                Ok(T::default())
            }
        }
    }

    fn save_json<T>(&self, path: &Path, value: &T) -> Result<(), AppError>
    where
        T: Serialize,
    {
        self.ensure_root()?;
        if path.exists() {
            let backup = PathBuf::from(format!("{}.bak", path.to_string_lossy()));
            let _ = fs::copy(path, backup);
        }
        write_json_atomic(path, value)
    }

    pub fn snapshot(&self) -> Result<AgendaSnapshot, AppError> {
        let mut todos = self
            .load_json::<TodoFile>(&self.todos_path(), "todos")?
            .todos;
        let mut events = self
            .load_json::<EventFile>(&self.events_path(), "events")?
            .events;
        let mut courses = self
            .load_json::<CourseFile>(&self.courses_path(), "courses")?
            .courses;
        let daily = self.load_json::<DailyFile>(&self.daily_path(), "daily")?;
        let mut daily_tasks = daily.tasks;
        let timetable_settings = self
            .load_json::<TimetableSettingsFile>(&self.timetable_settings_path(), "timetable")?
            .settings;
        let partner = self.load_json::<PartnerFile>(&self.partner_path(), "partner")?;
        let partner_profile = partner.profile;
        let mut partner_courses = partner.courses;
        partner_courses.sort_by(|left, right| {
            left.weekday
                .cmp(&right.weekday)
                .then(left.start_period.cmp(&right.start_period))
                .then(left.name.cmp(&right.name))
        });
        let mut course_overrides = self
            .load_json::<CourseOverrideFile>(&self.course_overrides_path(), "course-overrides")?
            .overrides;
        course_overrides.sort_by(|left, right| {
            left.date
                .cmp(&right.date)
                .then(left.start_period.cmp(&right.start_period))
        });

        todos.sort_by(|left, right| {
            left.sort_order
                .cmp(&right.sort_order)
                .then(left.created_at.cmp(&right.created_at))
        });
        events.sort_by(|left, right| left.start_at.cmp(&right.start_at));
        courses.sort_by(|left, right| {
            left.weekday
                .cmp(&right.weekday)
                .then(left.start_period.cmp(&right.start_period))
                .then(left.name.cmp(&right.name))
        });
        daily_tasks.sort_by(|left, right| {
            left.sort_order
                .cmp(&right.sort_order)
                .then(left.created_at.cmp(&right.created_at))
        });

        Ok(AgendaSnapshot {
            todos,
            events,
            courses,
            daily_tasks,
            daily_checks: daily.checks,
            course_overrides,
            partner_profile,
            partner_courses,
            timetable_settings,
        })
    }

    fn mutate_todos<T>(
        &self,
        mutate: impl FnOnce(&mut Vec<Todo>) -> Result<T, AppError>,
    ) -> Result<T, AppError> {
        let mut file = self.load_json::<TodoFile>(&self.todos_path(), "todos")?;
        file.schema_version = SCHEMA_VERSION;
        let output = mutate(&mut file.todos)?;
        self.save_json(&self.todos_path(), &file)?;
        Ok(output)
    }

    fn mutate_events<T>(
        &self,
        mutate: impl FnOnce(&mut Vec<AgendaEvent>) -> Result<T, AppError>,
    ) -> Result<T, AppError> {
        let mut file = self.load_json::<EventFile>(&self.events_path(), "events")?;
        file.schema_version = SCHEMA_VERSION;
        let output = mutate(&mut file.events)?;
        self.save_json(&self.events_path(), &file)?;
        Ok(output)
    }

    fn mutate_courses<T>(
        &self,
        mutate: impl FnOnce(&mut Vec<Course>) -> Result<T, AppError>,
    ) -> Result<T, AppError> {
        let mut file = self.load_json::<CourseFile>(&self.courses_path(), "courses")?;
        file.schema_version = SCHEMA_VERSION;
        let output = mutate(&mut file.courses)?;
        self.save_json(&self.courses_path(), &file)?;
        Ok(output)
    }

    fn mutate_daily<T>(
        &self,
        mutate: impl FnOnce(&mut DailyFile) -> Result<T, AppError>,
    ) -> Result<T, AppError> {
        let mut file = self.load_json::<DailyFile>(&self.daily_path(), "daily")?;
        file.schema_version = SCHEMA_VERSION;
        let output = mutate(&mut file)?;
        self.save_json(&self.daily_path(), &file)?;
        Ok(output)
    }

    pub fn create_todo(&self, input: TodoInput) -> Result<Todo, AppError> {
        let TodoInput {
            title,
            notes,
            due_date,
            due_at,
            priority,
            tags,
            course_id,
            platform,
            kind,
            remind_minutes,
            estimate_minutes,
        } = input;
        let title = normalize_title(&title)?;
        let due_date = normalize_day(due_date)?;
        let tags = normalize_tags(tags);
        let now = Utc::now();

        self.mutate_todos(move |todos| {
            let sort_order =
                todos.iter().map(|todo| todo.sort_order).max().unwrap_or(0) + SORT_ORDER_STEP;

            let todo = Todo {
                id: Uuid::new_v4().to_string(),
                title,
                notes: notes.trim().to_string(),
                done: false,
                completed_at: None,
                due_date,
                due_at,
                priority: priority.min(3),
                tags,
                course_id: normalize_course_id(course_id),
                platform: platform.trim().to_string(),
                kind: normalize_todo_kind(&kind),
                remind_minutes: normalize_remind_minutes(remind_minutes),
                estimate_minutes: normalize_estimate_minutes(estimate_minutes),
                sort_order,
                created_at: now,
                updated_at: now,
            };
            todos.push(todo.clone());
            Ok(todo)
        })
    }

    pub fn update_todo(&self, id: &str, input: TodoInput) -> Result<Todo, AppError> {
        let TodoInput {
            title,
            notes,
            due_date,
            due_at,
            priority,
            tags,
            course_id,
            platform,
            kind,
            remind_minutes,
            estimate_minutes,
        } = input;
        let title = normalize_title(&title)?;
        let due_date = normalize_day(due_date)?;
        let tags = normalize_tags(tags);
        let id = id.to_string();

        self.mutate_todos(move |todos| {
            let todo = todos
                .iter_mut()
                .find(|todo| todo.id == id)
                .ok_or_else(|| not_found("待办", &id))?;

            todo.title = title;
            todo.notes = notes.trim().to_string();
            todo.due_date = due_date;
            todo.due_at = due_at;
            todo.priority = priority.min(3);
            todo.tags = tags;
            todo.course_id = normalize_course_id(course_id);
            todo.platform = platform.trim().to_string();
            todo.kind = normalize_todo_kind(&kind);
            todo.remind_minutes = normalize_remind_minutes(remind_minutes);
            todo.estimate_minutes = normalize_estimate_minutes(estimate_minutes);
            todo.updated_at = Utc::now();
            Ok(todo.clone())
        })
    }

    pub fn toggle_todo(&self, id: &str, done: bool) -> Result<Todo, AppError> {
        let id = id.to_string();

        self.mutate_todos(move |todos| {
            let todo = todos
                .iter_mut()
                .find(|todo| todo.id == id)
                .ok_or_else(|| not_found("待办", &id))?;

            todo.done = done;
            todo.completed_at = if done { Some(Utc::now()) } else { None };
            todo.updated_at = Utc::now();
            Ok(todo.clone())
        })
    }

    pub fn delete_todo(&self, id: &str) -> Result<(), AppError> {
        let id = id.to_string();

        self.mutate_todos(move |todos| {
            let before = todos.len();
            todos.retain(|todo| todo.id != id);
            if todos.len() == before {
                return Err(not_found("待办", &id));
            }
            Ok(())
        })
    }

    pub fn reorder_todos(&self, ids: &[String]) -> Result<(), AppError> {
        let ids = ids.to_vec();

        self.mutate_todos(move |todos| {
            for (index, id) in ids.iter().enumerate() {
                if let Some(todo) = todos.iter_mut().find(|todo| &todo.id == id) {
                    todo.sort_order = (index as i64 + 1) * SORT_ORDER_STEP;
                }
            }
            Ok(())
        })
    }

    pub fn create_event(&self, input: EventInput) -> Result<AgendaEvent, AppError> {
        let EventInput {
            title,
            notes,
            all_day,
            start_at,
            end_at,
            start_date,
            end_date,
            color,
        } = input;
        let title = normalize_title(&title)?;
        let (start_at, end_at) = normalize_event_range(start_at, end_at);
        let (start_date, end_date) = normalize_event_days(all_day, start_date, end_date)?;
        let now = Utc::now();

        self.mutate_events(move |events| {
            let event = AgendaEvent {
                id: Uuid::new_v4().to_string(),
                title,
                notes: notes.trim().to_string(),
                all_day,
                start_at,
                end_at,
                start_date,
                end_date,
                color: normalize_color(color),
                created_at: now,
                updated_at: now,
            };
            events.push(event.clone());
            Ok(event)
        })
    }

    pub fn update_event(&self, id: &str, input: EventInput) -> Result<AgendaEvent, AppError> {
        let EventInput {
            title,
            notes,
            all_day,
            start_at,
            end_at,
            start_date,
            end_date,
            color,
        } = input;
        let title = normalize_title(&title)?;
        let (start_at, end_at) = normalize_event_range(start_at, end_at);
        let (start_date, end_date) = normalize_event_days(all_day, start_date, end_date)?;
        let id = id.to_string();

        self.mutate_events(move |events| {
            let event = events
                .iter_mut()
                .find(|event| event.id == id)
                .ok_or_else(|| not_found("日程", &id))?;

            event.title = title;
            event.notes = notes.trim().to_string();
            event.all_day = all_day;
            event.start_at = start_at;
            event.end_at = end_at;
            event.start_date = start_date;
            event.end_date = end_date;
            event.color = normalize_color(color);
            event.updated_at = Utc::now();
            Ok(event.clone())
        })
    }

    pub fn delete_event(&self, id: &str) -> Result<(), AppError> {
        let id = id.to_string();

        self.mutate_events(move |events| {
            let before = events.len();
            events.retain(|event| event.id != id);
            if events.len() == before {
                return Err(not_found("日程", &id));
            }
            Ok(())
        })
    }

    pub fn create_course(&self, input: CourseInput) -> Result<Course, AppError> {
        let CourseInput {
            name,
            weekday,
            start_period,
            end_period,
            location,
            teacher,
            weeks,
            color,
            note,
        } = normalize_course(input)?;
        let now = Utc::now();

        self.mutate_courses(move |courses| {
            if courses.len() >= MAX_COURSES {
                return Err(app_error("agendaCourseLimit", "课程数量已达上限"));
            }
            let course = Course {
                id: Uuid::new_v4().to_string(),
                name,
                weekday,
                start_period,
                end_period,
                location,
                teacher,
                weeks,
                color,
                note,
                created_at: now,
                updated_at: now,
            };
            courses.push(course.clone());
            Ok(course)
        })
    }

    pub fn update_course(&self, id: &str, input: CourseInput) -> Result<Course, AppError> {
        let CourseInput {
            name,
            weekday,
            start_period,
            end_period,
            location,
            teacher,
            weeks,
            color,
            note,
        } = normalize_course(input)?;
        let id = id.to_string();

        self.mutate_courses(move |courses| {
            let course = courses
                .iter_mut()
                .find(|course| course.id == id)
                .ok_or_else(|| not_found("课程", &id))?;

            course.name = name;
            course.weekday = weekday;
            course.start_period = start_period;
            course.end_period = end_period;
            course.location = location;
            course.teacher = teacher;
            course.weeks = weeks;
            course.color = color;
            course.note = note;
            course.updated_at = Utc::now();
            Ok(course.clone())
        })
    }

    pub fn delete_course(&self, id: &str) -> Result<(), AppError> {
        let id = id.to_string();

        self.mutate_courses(move |courses| {
            let before = courses.len();
            courses.retain(|course| course.id != id);
            if courses.len() == before {
                return Err(not_found("课程", &id));
            }
            Ok(())
        })
    }

    pub fn import_courses(&self, inputs: Vec<CourseInput>) -> Result<Vec<Course>, AppError> {
        if inputs.is_empty() {
            return Err(app_error("agendaImportEmpty", "没有可导入的课程"));
        }
        if inputs.len() > MAX_COURSES {
            return Err(app_error("agendaCourseLimit", "单次导入的课程过多"));
        }

        let mut normalized = Vec::with_capacity(inputs.len());
        for input in inputs {
            normalized.push(normalize_course(input)?);
        }
        let now = Utc::now();

        self.mutate_courses(move |courses| {
            let mut created = Vec::new();
            for input in normalized {
                if courses.len() >= MAX_COURSES {
                    break;
                }
                let duplicated = courses.iter().any(|course| {
                    course.name == input.name
                        && course.weekday == input.weekday
                        && course.start_period == input.start_period
                        && course.end_period == input.end_period
                });
                if duplicated {
                    continue;
                }
                let course = Course {
                    id: Uuid::new_v4().to_string(),
                    name: input.name,
                    weekday: input.weekday,
                    start_period: input.start_period,
                    end_period: input.end_period,
                    location: input.location,
                    teacher: input.teacher,
                    weeks: input.weeks,
                    color: input.color,
                    note: input.note,
                    created_at: now,
                    updated_at: now,
                };
                courses.push(course.clone());
                created.push(course);
            }
            Ok(created)
        })
    }

    /// 清空本学期课程，并同时清空调课例外，避免留下指向不存在课程的孤儿记录。
    pub fn clear_courses(&self) -> Result<usize, AppError> {
        let mut file = self.load_json::<CourseFile>(&self.courses_path(), "courses")?;
        let removed = file.courses.len();
        file.courses.clear();
        file.schema_version = SCHEMA_VERSION;
        self.save_json(&self.courses_path(), &file)?;

        let mut overrides = self
            .load_json::<CourseOverrideFile>(&self.course_overrides_path(), "course-overrides")?;
        if !overrides.overrides.is_empty() {
            overrides.overrides.clear();
            overrides.schema_version = SCHEMA_VERSION;
            self.save_json(&self.course_overrides_path(), &overrides)?;
        }
        Ok(removed)
    }

    /// 只清空对方课程，保留昵称、关系与颜色。
    pub fn clear_partner_courses(&self) -> Result<usize, AppError> {
        let mut file = self.load_json::<PartnerFile>(&self.partner_path(), "partner")?;
        let removed = file.courses.len();
        file.courses.clear();
        file.schema_version = SCHEMA_VERSION;
        self.save_json(&self.partner_path(), &file)?;
        Ok(removed)
    }

    pub fn create_daily_task(&self, input: DailyTaskInput) -> Result<DailyTask, AppError> {
        let DailyTaskInput {
            title,
            color,
            active,
        } = normalize_daily(input)?;
        let now = Utc::now();

        self.mutate_daily(move |file| {
            if file.tasks.len() >= MAX_DAILY_TASKS {
                return Err(app_error("agendaDailyLimit", "每日必做数量已达上限"));
            }
            let sort_order = file
                .tasks
                .iter()
                .map(|task| task.sort_order)
                .max()
                .unwrap_or(0)
                + SORT_ORDER_STEP;
            let task = DailyTask {
                id: Uuid::new_v4().to_string(),
                title,
                color,
                active,
                sort_order,
                created_at: now,
                updated_at: now,
            };
            file.tasks.push(task.clone());
            Ok(task)
        })
    }

    pub fn update_daily_task(
        &self,
        id: &str,
        input: DailyTaskInput,
    ) -> Result<DailyTask, AppError> {
        let DailyTaskInput {
            title,
            color,
            active,
        } = normalize_daily(input)?;
        let id = id.to_string();

        self.mutate_daily(move |file| {
            let task = file
                .tasks
                .iter_mut()
                .find(|task| task.id == id)
                .ok_or_else(|| not_found("每日必做", &id))?;

            task.title = title;
            task.color = color;
            task.active = active;
            task.updated_at = Utc::now();
            Ok(task.clone())
        })
    }

    pub fn delete_daily_task(&self, id: &str) -> Result<(), AppError> {
        let id = id.to_string();

        self.mutate_daily(move |file| {
            let before = file.tasks.len();
            file.tasks.retain(|task| task.id != id);
            if file.tasks.len() == before {
                return Err(not_found("每日必做", &id));
            }
            for ids in file.checks.values_mut() {
                ids.retain(|item| item != &id);
            }
            file.checks.retain(|_, ids| !ids.is_empty());
            Ok(())
        })
    }

    pub fn toggle_daily_task(
        &self,
        task_id: &str,
        date: &str,
        done: bool,
    ) -> Result<Vec<String>, AppError> {
        let date = date.trim().to_string();
        NaiveDate::parse_from_str(&date, "%Y-%m-%d")
            .map_err(|_| app_error("agendaInvalidDate", "日期格式无效"))?;
        let task_id = task_id.to_string();

        self.mutate_daily(move |file| {
            if !file.tasks.iter().any(|task| task.id == task_id) {
                return Err(not_found("每日必做", &task_id));
            }

            let mut ids = file.checks.remove(&date).unwrap_or_default();
            ids.retain(|item| item != &task_id);
            if done {
                ids.push(task_id.clone());
            }
            ids.sort();
            ids.dedup();
            if !ids.is_empty() {
                file.checks.insert(date.clone(), ids.clone());
            }
            Ok(ids)
        })
    }

    fn normalize_partner_profile(profile: PartnerProfile) -> PartnerProfile {
        let relation = match profile.relation.trim() {
            "sibling" => "sibling",
            "classmate" => "classmate",
            "friend" => "friend",
            "other" => "other",
            _ => "partner",
        };
        PartnerProfile {
            name: profile.name.trim().chars().take(20).collect(),
            relation: relation.to_string(),
            color: profile
                .color
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty()),
        }
    }

    pub fn save_partner_profile(
        &self,
        profile: PartnerProfile,
    ) -> Result<PartnerProfile, AppError> {
        let profile = Self::normalize_partner_profile(profile);
        let mut file = self.load_json::<PartnerFile>(&self.partner_path(), "partner")?;
        file.profile = profile.clone();
        file.schema_version = SCHEMA_VERSION;
        self.save_json(&self.partner_path(), &file)?;
        Ok(profile)
    }

    pub fn import_partner_courses(
        &self,
        inputs: Vec<CourseInput>,
    ) -> Result<Vec<Course>, AppError> {
        if inputs.is_empty() {
            return Err(app_error("agendaImportEmpty", "没有可导入的课程"));
        }
        if inputs.len() > MAX_COURSES {
            return Err(app_error("agendaCourseLimit", "单次导入的课程过多"));
        }
        let mut normalized = Vec::with_capacity(inputs.len());
        for input in inputs {
            normalized.push(normalize_course(input)?);
        }
        let now = Utc::now();
        let mut file = self.load_json::<PartnerFile>(&self.partner_path(), "partner")?;
        let mut created = Vec::new();
        for input in normalized {
            if file.courses.len() >= MAX_COURSES {
                break;
            }
            let duplicated = file.courses.iter().any(|course| {
                course.name == input.name
                    && course.weekday == input.weekday
                    && course.start_period == input.start_period
                    && course.end_period == input.end_period
            });
            if duplicated {
                continue;
            }
            let course = Course {
                id: Uuid::new_v4().to_string(),
                name: input.name,
                weekday: input.weekday,
                start_period: input.start_period,
                end_period: input.end_period,
                location: input.location,
                teacher: input.teacher,
                weeks: input.weeks,
                color: input.color,
                note: input.note,
                created_at: now,
                updated_at: now,
            };
            file.courses.push(course.clone());
            created.push(course);
        }
        file.schema_version = SCHEMA_VERSION;
        self.save_json(&self.partner_path(), &file)?;
        Ok(created)
    }

    pub fn delete_partner_course(&self, id: &str) -> Result<(), AppError> {
        let mut file = self.load_json::<PartnerFile>(&self.partner_path(), "partner")?;
        let before = file.courses.len();
        file.courses.retain(|course| course.id != id);
        if file.courses.len() == before {
            return Err(not_found("课程", id));
        }
        self.save_json(&self.partner_path(), &file)
    }

    pub fn course_overrides(&self) -> Result<Vec<CourseOverride>, AppError> {
        Ok(self
            .load_json::<CourseOverrideFile>(&self.course_overrides_path(), "course-overrides")?
            .overrides)
    }

    pub fn create_course_override(
        &self,
        input: CourseOverrideInput,
    ) -> Result<CourseOverride, AppError> {
        let date = normalize_day(Some(input.date))?
            .ok_or_else(|| app_error("agendaInvalidDay", "请选择调课日期"))?;
        let action = match input.action.trim() {
            "cancel" => "cancel",
            "move" => "move",
            _ => return Err(app_error("agendaInvalidOverride", "只支持停课或调课")),
        }
        .to_string();
        let course_id = normalize_course_id(Some(input.course_id))
            .ok_or_else(|| app_error("agendaInvalidCourse", "请选择课程"))?;
        let courses = self
            .load_json::<CourseFile>(&self.courses_path(), "courses")?
            .courses;
        if !courses.iter().any(|course| course.id == course_id) {
            return Err(not_found("课程", &course_id));
        }

        let (start_period, end_period) = if action == "move" {
            let start = input.start_period.unwrap_or(0);
            let end = input.end_period.unwrap_or(start);
            if start < 1 || start > 12 || end < start || end > 12 {
                return Err(app_error("agendaInvalidPeriod", "节次需在 1–12 之间"));
            }
            (Some(start), Some(end))
        } else {
            (None, None)
        };
        let location = input
            .location
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        let now = Utc::now();
        let mut file = self
            .load_json::<CourseOverrideFile>(&self.course_overrides_path(), "course-overrides")?;
        // 同一课程同一天只保留一条例外，避免重复排课
        file.overrides
            .retain(|item| !(item.course_id == course_id && item.date == date));
        let entry = CourseOverride {
            id: Uuid::new_v4().to_string(),
            course_id,
            date,
            action,
            start_period,
            end_period,
            location,
            note: input.note.trim().chars().take(200).collect(),
            created_at: now,
        };
        file.overrides.push(entry.clone());
        file.schema_version = SCHEMA_VERSION;
        self.save_json(&self.course_overrides_path(), &file)?;
        Ok(entry)
    }

    pub fn delete_course_override(&self, id: &str) -> Result<(), AppError> {
        let mut file = self
            .load_json::<CourseOverrideFile>(&self.course_overrides_path(), "course-overrides")?;
        let before = file.overrides.len();
        file.overrides.retain(|item| item.id != id);
        if file.overrides.len() == before {
            return Err(not_found("调课记录", id));
        }
        self.save_json(&self.course_overrides_path(), &file)
    }

    pub fn save_timetable_settings(
        &self,
        settings: TimetableSettings,
    ) -> Result<TimetableSettings, AppError> {
        let settings = normalize_timetable_settings(settings)?;
        let file = TimetableSettingsFile {
            schema_version: SCHEMA_VERSION,
            settings: settings.clone(),
        };
        self.save_json(&self.timetable_settings_path(), &file)?;
        Ok(settings)
    }
}

fn normalize_event_range(
    start: DateTime<Utc>,
    end: DateTime<Utc>,
) -> (DateTime<Utc>, DateTime<Utc>) {
    if end <= start {
        (start, start + Duration::minutes(30))
    } else {
        (start, end)
    }
}

fn normalize_event_days(
    all_day: bool,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<(Option<String>, Option<String>), AppError> {
    if !all_day {
        return Ok((normalize_day(start_date)?, normalize_day(end_date)?));
    }

    let start = normalize_day(start_date)?
        .ok_or_else(|| app_error("agendaInvalidDate", "全天日程缺少开始日期"))?;
    let end = normalize_day(end_date)?.unwrap_or_else(|| start.clone());
    if end < start {
        return Ok((Some(start.clone()), Some(start)));
    }
    Ok((Some(start), Some(end)))
}

fn quarantine(path: &Path, label: &str) -> Result<PathBuf, AppError> {
    let stamp = Utc::now().timestamp();
    let backup = path.with_file_name(format!("{label}.corrupt-{stamp}.json"));
    fs::rename(path, &backup).map_err(|error| {
        let mut app_error = app_error(
            "agendaStoreCorrupt",
            format!("{label} 数据损坏且无法备份：{error}"),
        );
        app_error
            .details
            .insert("path".into(), path.to_string_lossy().to_string());
        app_error
    })?;
    Ok(backup)
}

#[derive(Debug)]
pub struct AgendaState {
    inner: Mutex<AgendaStore>,
}

impl AgendaState {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            inner: Mutex::new(AgendaStore::new(&data_dir)),
        }
    }

    pub fn rebind(&self, data_dir: &Path) {
        let mut guard = self
            .inner
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        *guard = AgendaStore::new(data_dir);
    }

    pub fn with<T>(
        &self,
        run: impl FnOnce(&AgendaStore) -> Result<T, AppError>,
    ) -> Result<T, AppError> {
        let guard = self
            .inner
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        run(&guard)
    }
}

fn emit_changed(app: &AppHandle, kind: &str, ids: Vec<String>) {
    let _ = app.emit(
        "agenda-changed",
        AgendaChanged {
            kind: kind.to_string(),
            ids,
        },
    );
}

#[tauri::command]
pub fn agenda_snapshot(state: tauri::State<'_, AgendaState>) -> Result<AgendaSnapshot, AppError> {
    state.with(|store| store.snapshot())
}

#[tauri::command]
pub fn agenda_todo_create(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    request: TodoInput,
) -> Result<Todo, AppError> {
    let todo = state.with(|store| store.create_todo(request))?;
    emit_changed(&app, "todo", vec![todo.id.clone()]);
    Ok(todo)
}

#[tauri::command]
pub fn agenda_todo_update(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    id: String,
    request: TodoInput,
) -> Result<Todo, AppError> {
    let todo = state.with(|store| store.update_todo(&id, request))?;
    emit_changed(&app, "todo", vec![todo.id.clone()]);
    Ok(todo)
}

#[tauri::command]
pub fn agenda_todo_toggle(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    id: String,
    done: bool,
) -> Result<Todo, AppError> {
    let todo = state.with(|store| store.toggle_todo(&id, done))?;
    emit_changed(&app, "todo", vec![todo.id.clone()]);
    Ok(todo)
}

#[tauri::command]
pub fn agenda_todo_delete(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    id: String,
) -> Result<(), AppError> {
    state.with(|store| store.delete_todo(&id))?;
    emit_changed(&app, "todo", vec![id]);
    Ok(())
}

#[tauri::command]
pub fn agenda_todo_reorder(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    ids: Vec<String>,
) -> Result<(), AppError> {
    state.with(|store| store.reorder_todos(&ids))?;
    emit_changed(&app, "todo", ids);
    Ok(())
}

#[tauri::command]
pub fn agenda_event_create(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    request: EventInput,
) -> Result<AgendaEvent, AppError> {
    let event = state.with(|store| store.create_event(request))?;
    emit_changed(&app, "event", vec![event.id.clone()]);
    Ok(event)
}

#[tauri::command]
pub fn agenda_event_update(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    id: String,
    request: EventInput,
) -> Result<AgendaEvent, AppError> {
    let event = state.with(|store| store.update_event(&id, request))?;
    emit_changed(&app, "event", vec![event.id.clone()]);
    Ok(event)
}

#[tauri::command]
pub fn agenda_event_delete(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    id: String,
) -> Result<(), AppError> {
    state.with(|store| store.delete_event(&id))?;
    emit_changed(&app, "event", vec![id]);
    Ok(())
}

#[tauri::command]
pub fn agenda_course_create(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    request: CourseInput,
) -> Result<Course, AppError> {
    let course = state.with(|store| store.create_course(request))?;
    emit_changed(&app, "course", vec![course.id.clone()]);
    Ok(course)
}

#[tauri::command]
pub fn agenda_course_update(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    id: String,
    request: CourseInput,
) -> Result<Course, AppError> {
    let course = state.with(|store| store.update_course(&id, request))?;
    emit_changed(&app, "course", vec![course.id.clone()]);
    Ok(course)
}

#[tauri::command]
pub fn agenda_course_delete(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    id: String,
) -> Result<(), AppError> {
    state.with(|store| store.delete_course(&id))?;
    emit_changed(&app, "course", vec![id]);
    Ok(())
}

#[tauri::command]
pub fn agenda_courses_import(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    courses: Vec<CourseInput>,
) -> Result<Vec<Course>, AppError> {
    let created = state.with(|store| store.import_courses(courses))?;
    emit_changed(
        &app,
        "course",
        created.iter().map(|course| course.id.clone()).collect(),
    );
    Ok(created)
}

#[tauri::command]
pub fn agenda_daily_create(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    request: DailyTaskInput,
) -> Result<DailyTask, AppError> {
    let task = state.with(|store| store.create_daily_task(request))?;
    emit_changed(&app, "daily", vec![task.id.clone()]);
    Ok(task)
}

#[tauri::command]
pub fn agenda_daily_update(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    id: String,
    request: DailyTaskInput,
) -> Result<DailyTask, AppError> {
    let task = state.with(|store| store.update_daily_task(&id, request))?;
    emit_changed(&app, "daily", vec![task.id.clone()]);
    Ok(task)
}

#[tauri::command]
pub fn agenda_daily_delete(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    id: String,
) -> Result<(), AppError> {
    state.with(|store| store.delete_daily_task(&id))?;
    emit_changed(&app, "daily", vec![id]);
    Ok(())
}

#[tauri::command]
pub fn agenda_daily_toggle(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    task_id: String,
    date: String,
    done: bool,
) -> Result<Vec<String>, AppError> {
    let ids = state.with(|store| store.toggle_daily_task(&task_id, &date, done))?;
    emit_changed(&app, "daily", vec![task_id]);
    Ok(ids)
}

#[tauri::command]
pub fn agenda_courses_clear(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
) -> Result<usize, AppError> {
    let removed = state.with(|store| store.clear_courses())?;
    emit_changed(&app, "courses", Vec::new());
    emit_changed(&app, "course-override", Vec::new());
    Ok(removed)
}

#[tauri::command]
pub fn agenda_partner_courses_clear(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
) -> Result<usize, AppError> {
    let removed = state.with(|store| store.clear_partner_courses())?;
    emit_changed(&app, "partner", Vec::new());
    Ok(removed)
}

#[tauri::command]
pub fn agenda_partner_profile_save(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    profile: PartnerProfile,
) -> Result<PartnerProfile, AppError> {
    let saved = state.with(|store| store.save_partner_profile(profile))?;
    emit_changed(&app, "partner", Vec::new());
    Ok(saved)
}

#[tauri::command]
pub fn agenda_partner_courses_import(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    courses: Vec<CourseInput>,
) -> Result<Vec<Course>, AppError> {
    let created = state.with(|store| store.import_partner_courses(courses))?;
    emit_changed(
        &app,
        "partner",
        created.iter().map(|course| course.id.clone()).collect(),
    );
    Ok(created)
}

#[tauri::command]
pub fn agenda_partner_course_delete(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    id: String,
) -> Result<(), AppError> {
    state.with(|store| store.delete_partner_course(&id))?;
    emit_changed(&app, "partner", vec![id]);
    Ok(())
}

#[tauri::command]
pub fn agenda_course_override_create(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    request: CourseOverrideInput,
) -> Result<CourseOverride, AppError> {
    let entry = state.with(|store| store.create_course_override(request))?;
    emit_changed(&app, "course-override", vec![entry.id.clone()]);
    Ok(entry)
}

#[tauri::command]
pub fn agenda_course_override_delete(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    id: String,
) -> Result<(), AppError> {
    state.with(|store| store.delete_course_override(&id))?;
    emit_changed(&app, "course-override", vec![id]);
    Ok(())
}

#[tauri::command]
pub fn agenda_timetable_settings_save(
    app: AppHandle,
    state: tauri::State<'_, AgendaState>,
    settings: TimetableSettings,
) -> Result<TimetableSettings, AppError> {
    let saved = state.with(|store| store.save_timetable_settings(settings))?;
    emit_changed(&app, "timetable-settings", Vec::new());
    Ok(saved)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn test_store(name: &str) -> AgendaStore {
        let dir = env::temp_dir().join(format!("deskmate-agenda-{name}-{}", Uuid::new_v4()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test dir");
        AgendaStore::new(&dir)
    }

    fn todo_input(title: &str) -> TodoInput {
        TodoInput {
            title: title.into(),
            notes: String::new(),
            due_date: None,
            due_at: None,
            priority: 0,
            tags: Vec::new(),
            course_id: None,
            platform: String::new(),
            kind: "task".into(),
            remind_minutes: None,
            estimate_minutes: None,
        }
    }

    #[test]
    fn creates_updates_and_deletes_todos() {
        let store = test_store("todo-crud");
        let created = store.create_todo(todo_input("写周报")).expect("create");
        assert!(!created.done);
        assert_eq!(store.snapshot().expect("snapshot").todos.len(), 1);

        let updated = store
            .update_todo(
                &created.id,
                TodoInput {
                    title: "写季度总结".into(),
                    notes: "带上数据".into(),
                    due_date: Some("2026-11-08".into()),
                    due_at: None,
                    priority: 2,
                    tags: vec!["工作".into(), "#工作".into(), "Q4".into()],
                    course_id: None,
                    platform: String::new(),
                    kind: "task".into(),
                    remind_minutes: Some(30),
                    estimate_minutes: Some(45),
                },
            )
            .expect("update");
        assert_eq!(updated.title, "写季度总结");
        assert_eq!(updated.tags, vec!["工作".to_string(), "Q4".to_string()]);
        assert_eq!(updated.remind_minutes, Some(30));
        assert_eq!(updated.estimate_minutes, Some(45));

        let toggled = store.toggle_todo(&created.id, true).expect("toggle");
        assert!(toggled.done);
        assert!(toggled.completed_at.is_some());

        store.delete_todo(&created.id).expect("delete");
        assert!(store.snapshot().expect("snapshot").todos.is_empty());
    }

    #[test]
    fn overwrites_corrupt_file_with_backup() {
        let store = test_store("corrupt");
        fs::create_dir_all(store.root.clone()).expect("create agenda dir");
        fs::write(store.todos_path(), b"{not json").expect("write corrupt file");

        let snapshot = store.snapshot().expect("snapshot survives corrupt file");
        assert!(snapshot.todos.is_empty());

        let entries = fs::read_dir(store.root.clone())
            .expect("read agenda dir")
            .flatten()
            .map(|entry| entry.file_name().to_string_lossy().to_string())
            .collect::<Vec<_>>();
        assert!(entries
            .iter()
            .any(|name| name.starts_with("todos.corrupt-")));
    }

    #[test]
    fn reorders_todos() {
        let store = test_store("reorder");
        let first = store.create_todo(todo_input("A")).expect("create A");
        let second = store.create_todo(todo_input("B")).expect("create B");

        store
            .reorder_todos(&[second.id.clone(), first.id.clone()])
            .expect("reorder");

        let todos = store.snapshot().expect("snapshot").todos;
        assert_eq!(todos[0].id, second.id);
        assert_eq!(todos[1].id, first.id);
    }

    #[test]
    fn normalizes_event_range_and_days() {
        let store = test_store("event");
        let start = Utc::now();
        let event = store
            .create_event(EventInput {
                title: "评审".into(),
                notes: String::new(),
                all_day: false,
                start_at: start,
                end_at: start,
                start_date: None,
                end_date: None,
                color: Some("#2D5A3D".into()),
            })
            .expect("create event");

        assert_eq!(event.end_at, event.start_at + Duration::minutes(30));
        assert_eq!(event.color.as_deref(), Some("#2d5a3d"));
    }

    fn course_input(name: &str, weekday: u8, start: u8, end: u8) -> CourseInput {
        CourseInput {
            name: name.into(),
            weekday,
            start_period: start,
            end_period: end,
            location: "教一101".into(),
            teacher: String::new(),
            weeks: "1-16周".into(),
            color: None,
            note: String::new(),
        }
    }

    #[test]
    fn creates_courses_and_rejects_invalid_periods() {
        let store = test_store("course-crud");
        let course = store
            .create_course(course_input("高等数学", 1, 1, 2))
            .expect("create course");
        assert_eq!(course.weekday, 1);
        assert_eq!(store.snapshot().expect("snapshot").courses.len(), 1);

        assert!(store
            .create_course(course_input("坏课程", 0, 1, 2))
            .is_err());
        assert!(store
            .create_course(course_input("坏课程", 1, 0, 2))
            .is_err());

        let clamped = store
            .create_course(course_input("单节", 3, 5, 2))
            .expect("end period clamps to start");
        assert_eq!(clamped.end_period, 5);
    }

    #[test]
    fn import_skips_duplicate_courses() {
        let store = test_store("course-import");
        let created = store
            .import_courses(vec![
                course_input("大学英语", 3, 3, 4),
                course_input("大学英语", 3, 3, 4),
                course_input("数据结构", 2, 5, 6),
            ])
            .expect("import");
        assert_eq!(created.len(), 2);
        assert_eq!(store.snapshot().expect("snapshot").courses.len(), 2);

        let again = store
            .import_courses(vec![course_input("大学英语", 3, 3, 4)])
            .expect("re-import");
        assert!(again.is_empty());
    }

    #[test]
    fn toggles_daily_tasks_and_cleans_up_checks() {
        let store = test_store("daily");
        let task = store
            .create_daily_task(DailyTaskInput {
                title: "背 30 个单词".into(),
                color: None,
                active: true,
            })
            .expect("create daily task");

        let ids = store
            .toggle_daily_task(&task.id, "2026-11-06", true)
            .expect("toggle on");
        assert_eq!(ids, vec![task.id.clone()]);

        let ids = store
            .toggle_daily_task(&task.id, "2026-11-06", false)
            .expect("toggle off");
        assert!(ids.is_empty());

        store
            .toggle_daily_task(&task.id, "2026-11-06", true)
            .expect("toggle on again");
        store.delete_daily_task(&task.id).expect("delete");

        let snapshot = store.snapshot().expect("snapshot");
        assert!(snapshot.daily_tasks.is_empty());
        assert!(!snapshot.daily_checks.contains_key("2026-11-06"));
    }

    #[test]
    fn saves_partner_profile_and_imports_courses() {
        let store = test_store("partner");
        let profile = store
            .save_partner_profile(PartnerProfile {
                name: " 小夏 ".into(),
                relation: "sibling".into(),
                color: Some("#7F77DD".into()),
            })
            .expect("save profile");
        assert_eq!(profile.name, "小夏");
        assert_eq!(profile.relation, "sibling");

        let created = store
            .import_partner_courses(vec![
                course_input("高等数学", 1, 1, 2),
                course_input("高等数学", 1, 1, 2),
                course_input("大学英语", 3, 3, 4),
            ])
            .expect("import");
        assert_eq!(created.len(), 2);
        assert_eq!(store.snapshot().expect("snapshot").partner_courses.len(), 2);

        store
            .delete_partner_course(&created[0].id)
            .expect("delete partner course");
        assert_eq!(store.snapshot().expect("snapshot").partner_courses.len(), 1);
    }

    #[test]
    fn clears_courses_and_partner_courses() {
        let store = test_store("clear-courses");
        store
            .import_courses(vec![
                course_input("高等数学", 1, 1, 2),
                course_input("大学英语", 3, 3, 4),
            ])
            .expect("import");
        assert_eq!(store.clear_courses().expect("clear"), 2);
        assert!(store.snapshot().expect("snapshot").courses.is_empty());

        store
            .import_partner_courses(vec![course_input("线性代数", 5, 6, 7)])
            .expect("partner import");
        let removed = store.clear_partner_courses().expect("clear partner");
        assert_eq!(removed, 1);
        let snapshot = store.snapshot().expect("snapshot");
        assert!(snapshot.partner_courses.is_empty());
        assert_eq!(snapshot.partner_profile.relation, "partner");
    }

    #[test]
    fn creates_and_deletes_course_overrides() {
        let store = test_store("course-overrides");
        let course = store
            .create_course(course_input("高等数学", 1, 1, 2))
            .expect("create course");

        let cancel = store
            .create_course_override(CourseOverrideInput {
                course_id: course.id.clone(),
                date: "2026-11-10".into(),
                action: "cancel".into(),
                start_period: None,
                end_period: None,
                location: None,
                note: "临时停课".into(),
            })
            .expect("cancel override");
        assert_eq!(cancel.action, "cancel");
        assert_eq!(store.course_overrides().expect("list").len(), 1);

        let moved = store
            .create_course_override(CourseOverrideInput {
                course_id: course.id.clone(),
                date: "2026-11-10".into(),
                action: "move".into(),
                start_period: Some(5),
                end_period: Some(6),
                location: Some("教三202".into()),
                note: String::new(),
            })
            .expect("move override");
        // 同课程同一天只保留一条
        assert_eq!(store.course_overrides().expect("list").len(), 1);
        assert_eq!(moved.start_period, Some(5));

        store.delete_course_override(&moved.id).expect("delete");
        assert!(store.course_overrides().expect("list").is_empty());
        assert!(store.delete_course_override(&moved.id).is_err());
    }

    #[test]
    fn rejects_invalid_course_override() {
        let store = test_store("course-overrides-invalid");
        let course = store
            .create_course(course_input("大学英语", 3, 3, 4))
            .expect("create course");
        let bad_period = store.create_course_override(CourseOverrideInput {
            course_id: course.id.clone(),
            date: "2026-11-10".into(),
            action: "move".into(),
            start_period: Some(13),
            end_period: Some(14),
            location: None,
            note: String::new(),
        });
        assert!(bad_period.is_err());
        let bad_action = store.create_course_override(CourseOverrideInput {
            course_id: course.id,
            date: "2026-11-10".into(),
            action: "swap".into(),
            start_period: None,
            end_period: None,
            location: None,
            note: String::new(),
        });
        assert!(bad_action.is_err());
    }

    #[test]
    fn saves_timetable_settings_and_rejects_bad_times() {
        let store = test_store("timetable-settings");
        let mut settings = TimetableSettings::default();
        settings.semester_start = Some("2026-09-14".into());
        settings.period_times[0].start = "08:10".into();

        let saved = store
            .save_timetable_settings(settings)
            .expect("save timetable settings");
        assert_eq!(saved.semester_start.as_deref(), Some("2026-09-14"));
        assert_eq!(saved.period_times[0].start, "08:10");
        assert_eq!(saved.period_times.len(), 12);
        assert_eq!(
            store
                .snapshot()
                .expect("snapshot")
                .timetable_settings
                .period_times[0]
                .start,
            "08:10"
        );

        let mut invalid_time = TimetableSettings::default();
        invalid_time.period_times[0].start = "25:00".into();
        assert!(store.save_timetable_settings(invalid_time).is_err());

        let mut invalid_date = TimetableSettings::default();
        invalid_date.semester_start = Some("2026-13-01".into());
        assert!(store.save_timetable_settings(invalid_date).is_err());
    }

    #[test]
    fn normalizes_course_link_fields_on_todos() {
        let store = test_store("todo-course");
        let todo = store
            .create_todo(TodoInput {
                kind: "assignment".into(),
                course_id: Some("  course-1  ".into()),
                platform: "  学习通  ".into(),
                ..todo_input("第三章习题")
            })
            .expect("create linked todo");

        assert_eq!(todo.kind, "assignment");
        assert_eq!(todo.course_id.as_deref(), Some("course-1"));
        assert_eq!(todo.platform, "学习通");
    }
}
