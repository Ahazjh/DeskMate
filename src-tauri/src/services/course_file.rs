use crate::services::agenda::CourseInput;
use crate::services::notes::AppError;
use calamine::{open_workbook_auto, Data, Range, Reader};
use serde::Serialize;
use std::path::Path;

const MAX_FILE_BYTES: u64 = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS: [&str; 2] = ["xls", "xlsx"];

fn app_error(code: &str, message: impl Into<String>) -> AppError {
    AppError {
        code: code.to_string(),
        message: message.into(),
        details: Default::default(),
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseFileImport {
    pub courses: Vec<CourseInput>,
    /// 无法解析的单元格原文，交给前端提示用户手工补录
    pub warnings: Vec<String>,
    pub sheet: String,
}

fn weekday_of(text: &str) -> Option<u8> {
    let value = text
        .trim()
        .replace(['\u{3000}', ' '], "")
        .replace('曜', "")
        .to_lowercase();
    let value = value
        .trim_start_matches("星期")
        .trim_start_matches('周')
        .trim_start_matches("礼拜");
    match value {
        "一" | "1" | "mon" | "monday" => Some(1),
        "二" | "2" | "tue" | "tuesday" => Some(2),
        "三" | "3" | "wed" | "wednesday" => Some(3),
        "四" | "4" | "thu" | "thursday" => Some(4),
        "五" | "5" | "fri" | "friday" => Some(5),
        "六" | "6" | "sat" | "saturday" => Some(6),
        "日" | "天" | "7" | "sun" | "sunday" => Some(7),
        _ => None,
    }
}

fn cell_text(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        Data::String(value) => value.trim().to_string(),
        other => other.to_string().trim().to_string(),
    }
}

fn parse_periods(text: &str) -> Option<(u8, u8)> {
    let end = text.find('节')?;
    let prefix = &text[..end];
    let start = prefix
        .rfind(|character: char| {
            !(character.is_ascii_digit()
                || character == '-'
                || character == '~'
                || character == '—'
                || character == ' '
                || character == '('
                || character == '（')
        })
        .map(|index| index + 1)
        .unwrap_or(0);
    let segment = prefix[start..]
        .trim_matches(|character| character == '(' || character == '（' || character == ' ');
    let numbers: Vec<u8> = segment
        .split(['-', '~', '—'])
        .filter_map(|part| part.trim().parse::<u8>().ok())
        .collect();
    match numbers.as_slice() {
        [from, to] if *from >= 1 && *to >= *from && *to <= 12 => Some((*from, *to)),
        [single] if *single >= 1 && *single <= 12 => Some((*single, *single)),
        _ => None,
    }
}

fn strip_period_suffix(name: &str) -> String {
    name.trim()
        .trim_end_matches(|character| character == '节')
        .trim_end()
        .trim_end_matches(|character: char| {
            character.is_ascii_digit() || character == '-' || character == '~'
        })
        .trim_end()
        .trim_end_matches(|character| character == '(' || character == '（')
        .trim()
        .to_string()
}

fn weeks_without_period(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut result = String::new();
    let mut index = 0;
    while index < chars.len() {
        if chars[index] == '(' || chars[index] == '（' {
            if let Some(offset) = chars[index..]
                .iter()
                .position(|character| *character == ')' || *character == '）')
            {
                let close = index + offset;
                let inner: String = chars[index + 1..close].iter().collect();
                // 只丢弃「(1-2节)」这种节次括号，保留「(单)/(双)」
                if !inner.contains('节') {
                    result.extend(&chars[index..=close]);
                }
                index = close + 1;
                continue;
            }
        }
        result.push(chars[index]);
        index += 1;
    }
    result.trim().to_string()
}

/// 把 `1-3周(单),4-8周`、`第3周` 等写法转成现有匹配器能理解的 `1,3,4-8周`。
pub fn normalize_weeks(raw: &str) -> String {
    let text = raw
        .replace(['，', '、'], ",")
        .replace(' ', "")
        .replace('（', "(")
        .replace('）', ")");
    let mut parts: Vec<String> = Vec::new();

    for segment in text.split(',').filter(|item| !item.is_empty()) {
        let single = segment.contains("(单)");
        let double = segment.contains("(双)");
        let cleaned = segment
            .replace("(单)", "")
            .replace("(双)", "")
            .replace('周', "")
            .trim_start_matches('第')
            .to_string();

        if let Some((from, to)) = cleaned.split_once('-') {
            if let (Ok(from), Ok(to)) = (from.parse::<i32>(), to.parse::<i32>()) {
                if single || double {
                    for week in from..=to {
                        if (single && week % 2 == 1) || (double && week % 2 == 0) {
                            parts.push(week.to_string());
                        }
                    }
                } else {
                    parts.push(format!("{from}-{to}"));
                }
                continue;
            }
        }
        if let Ok(week) = cleaned.parse::<i32>() {
            parts.push(week.to_string());
        }
    }

    if parts.is_empty() {
        String::new()
    } else {
        format!("{}周", parts.join(","))
    }
}

fn parse_course_line(line: &str, weekday: u8) -> Option<CourseInput> {
    let parts: Vec<&str> = line.split('/').map(str::trim).collect();
    if parts.is_empty() || parts[0].is_empty() {
        return None;
    }

    let period_text = parts.get(1).copied().unwrap_or("");
    let (start_period, end_period) =
        parse_periods(period_text).or_else(|| parse_periods(parts[0]))?;

    let name = strip_period_suffix(parts[0]);
    if name.is_empty() || name.len() > 80 {
        return None;
    }

    let weeks = normalize_weeks(&weeks_without_period(period_text));
    let location = parts.get(3).map(|value| value.trim()).unwrap_or("");
    let teacher = parts.get(4).map(|value| value.trim()).unwrap_or("");
    let campus = parts.get(2).map(|value| value.trim()).unwrap_or("");

    Some(CourseInput {
        name,
        weekday,
        start_period,
        end_period,
        location: location.to_string(),
        teacher: teacher.to_string(),
        weeks,
        color: None,
        note: if campus.is_empty() {
            String::new()
        } else {
            format!("校区：{campus}")
        },
    })
}

fn merge_weeks(existing: &str, incoming: &str) -> String {
    if existing.is_empty() {
        return incoming.to_string();
    }
    if incoming.is_empty() || existing == incoming {
        return existing.to_string();
    }
    let mut parts: Vec<String> = existing
        .trim_end_matches('周')
        .split(',')
        .map(str::to_string)
        .collect();
    for part in incoming.trim_end_matches('周').split(',') {
        if !part.is_empty() && !parts.iter().any(|item| item == part) {
            parts.push(part.to_string());
        }
    }
    format!("{}周", parts.join(","))
}

fn merge_course(courses: &mut Vec<CourseInput>, course: CourseInput) {
    if let Some(existing) = courses.iter_mut().find(|item| {
        item.name == course.name
            && item.weekday == course.weekday
            && item.start_period == course.start_period
            && item.end_period == course.end_period
    }) {
        existing.weeks = merge_weeks(&existing.weeks, &course.weeks);
        if existing.location.is_empty() {
            existing.location = course.location.clone();
        } else if !course.location.is_empty() && existing.location != course.location {
            let extra = format!("{} {}", course.weeks, course.location);
            existing.note = if existing.note.is_empty() {
                format!("地点变动：{extra}")
            } else {
                format!("{}；地点变动：{extra}", existing.note)
            };
        }
        if existing.teacher.is_empty() {
            existing.teacher = course.teacher.clone();
        }
        return;
    }
    courses.push(course);
}

fn parse_grid(sheet: &str, range: &Range<Data>) -> Option<CourseFileImport> {
    let rows: Vec<Vec<String>> = range
        .rows()
        .map(|row| row.iter().map(cell_text).collect())
        .collect();

    let header = rows
        .iter()
        .position(|row| row.iter().filter(|cell| weekday_of(cell).is_some()).count() >= 5)?;

    let columns: Vec<(usize, u8)> = rows[header]
        .iter()
        .enumerate()
        .filter_map(|(index, cell)| weekday_of(cell).map(|weekday| (index, weekday)))
        .collect();
    if columns.len() < 5 {
        return None;
    }

    let mut courses: Vec<CourseInput> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();

    for row in &rows[header + 1..] {
        for (column, weekday) in &columns {
            let text = row.get(*column).map(String::as_str).unwrap_or("");
            if text.is_empty() {
                continue;
            }
            for line in text
                .split(['\n', '\r'])
                .map(str::trim)
                .filter(|line| !line.is_empty())
            {
                if line.starts_with("注") {
                    continue;
                }
                match parse_course_line(line, *weekday) {
                    Some(course) => merge_course(&mut courses, course),
                    None => {
                        if warnings.len() < 20 {
                            warnings.push(line.chars().take(80).collect());
                        }
                    }
                }
            }
        }
    }

    if courses.is_empty() {
        return None;
    }

    courses.sort_by(|left, right| {
        left.weekday
            .cmp(&right.weekday)
            .then(left.start_period.cmp(&right.start_period))
            .then(left.name.cmp(&right.name))
    });

    Some(CourseFileImport {
        courses,
        warnings,
        sheet: sheet.to_string(),
    })
}

pub fn parse_course_file(path: &str) -> Result<CourseFileImport, AppError> {
    let path_ref = Path::new(path);
    let extension = path_ref
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !ALLOWED_EXTENSIONS.contains(&extension.as_str()) {
        return Err(app_error("courseFileType", "只支持 .xls / .xlsx 课表文件"));
    }
    let metadata = std::fs::metadata(path_ref)
        .map_err(|error| app_error("courseFileMissing", format!("无法读取课表文件：{error}")))?;
    if metadata.len() == 0 {
        return Err(app_error("courseFileEmpty", "课表文件是空的"));
    }
    if metadata.len() > MAX_FILE_BYTES {
        return Err(app_error("courseFileTooLarge", "课表文件超过 10 MB"));
    }

    let mut workbook = open_workbook_auto(path_ref)
        .map_err(|error| app_error("courseFileParse", format!("无法打开表格：{error}")))?;

    for sheet in workbook.sheet_names().to_vec() {
        let range = match workbook.worksheet_range(&sheet) {
            Ok(range) => range,
            Err(_) => continue,
        };
        if let Some(result) = parse_grid(&sheet, &range) {
            return Ok(result);
        }
    }

    Err(app_error(
        "courseFileNoTimetable",
        "没有找到含「星期一…星期日」表头的课程表",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_typical_week_expressions() {
        assert_eq!(normalize_weeks("1-16周"), "1-16周");
        assert_eq!(normalize_weeks("第3周"), "3周");
        assert_eq!(normalize_weeks("1-3周(单),4-8周"), "1,3,4-8周");
        assert_eq!(normalize_weeks("1-4周(双)"), "2,4周");
        assert_eq!(normalize_weeks(""), "");
    }

    #[test]
    fn parses_the_exported_timetable_cell_format() {
        let course = parse_course_line(
            "概率论与数理统计A/(1-2节)1-16周/屏峰校区/广B213/夏治南/副教授/概率论-0008/必修课/考试",
            3,
        )
        .expect("course");
        assert_eq!(course.name, "概率论与数理统计A");
        assert_eq!(course.weekday, 3);
        assert_eq!(course.start_period, 1);
        assert_eq!(course.end_period, 2);
        assert_eq!(course.location, "广B213");
        assert_eq!(course.teacher, "夏治南");
        assert_eq!(course.weeks, "1-16周");
        assert!(course.note.contains("屏峰校区"));
    }

    #[test]
    fn parses_single_period_and_odd_week_ranges() {
        let course = parse_course_line(
            "电路原理 B/(6-7节)1-3周(单),4-16周/屏峰校区/广B512/周叶剑/副教授",
            5,
        )
        .expect("course");
        assert_eq!(course.start_period, 6);
        assert_eq!(course.end_period, 7);
        assert_eq!(course.weeks, "1,3,4-16周");
    }

    #[test]
    fn merges_duplicate_courses_with_different_weeks() {
        let mut courses = Vec::new();
        merge_course(
            &mut courses,
            parse_course_line("电路原理 B/(8-9节)第1周/屏峰校区/广A406/周叶剑", 4).unwrap(),
        );
        merge_course(
            &mut courses,
            parse_course_line("电路原理 B/(8-9节)2-16周/屏峰校区/广B512/周叶剑", 4).unwrap(),
        );
        assert_eq!(courses.len(), 1);
        assert_eq!(courses[0].weeks, "1,2-16周");
        assert!(courses[0].note.contains("广B512"));
    }

    #[test]
    fn parses_bundled_test_timetables() {
        let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
        let own = manifest.join("../testdata/课表-测试-本人.xlsx");
        let partner = manifest.join("../testdata/课表-测试-对方.xlsx");
        if !own.exists() || !partner.exists() {
            return;
        }

        let own_result = parse_course_file(own.to_str().expect("path")).expect("parse own");
        assert!(
            own_result.courses.len() >= 15,
            "own courses: {}",
            own_result.courses.len()
        );
        assert!(
            own_result.warnings.is_empty(),
            "warnings: {:?}",
            own_result.warnings
        );
        assert!(own_result
            .courses
            .iter()
            .any(|course| course.weeks == "1,3,4-8周"));
        assert!(own_result
            .courses
            .iter()
            .any(|course| course.note.contains("广B512")));
        assert!(own_result
            .courses
            .iter()
            .any(|course| course.weekday == 1 && course.start_period == 10));

        let partner_result =
            parse_course_file(partner.to_str().expect("path")).expect("parse partner");
        assert_eq!(partner_result.courses.len(), 6);
        assert!(partner_result.warnings.is_empty());
    }

    #[test]
    fn rejects_lines_without_periods() {
        assert!(parse_course_line("只是备注", 1).is_none());
    }
}
