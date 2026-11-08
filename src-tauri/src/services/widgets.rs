use crate::desktop::WindowBounds;
use crate::json_io::write_json_atomic;
use crate::services::notes::{default_store, AppError};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, fs, path::PathBuf};

/// 桌面日程 / 待办小窗的位置与尺寸，随数据目录一起迁移。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WidgetFile {
    #[serde(default)]
    bounds: BTreeMap<String, WindowBounds>,
}

fn widgets_path() -> Result<PathBuf, AppError> {
    Ok(default_store()?
        .data_dir()
        .join("agenda")
        .join("widgets.json"))
}

fn read_file(path: &PathBuf) -> WidgetFile {
    if !path.exists() {
        return WidgetFile::default();
    }
    match fs::read(path).and_then(|bytes| serde_json::from_slice(&bytes).map_err(Into::into)) {
        Ok(file) => file,
        Err(error) => {
            eprintln!("widgets.json is corrupt ({error}); starting with defaults");
            WidgetFile::default()
        }
    }
}

pub fn load_bounds(kind: &str) -> Result<Option<WindowBounds>, AppError> {
    let path = widgets_path()?;
    Ok(read_file(&path).bounds.get(kind).copied())
}

pub fn save_bounds(kind: &str, bounds: WindowBounds) -> Result<(), AppError> {
    let path = widgets_path()?;
    let mut file = read_file(&path);
    file.bounds.insert(kind.to_string(), bounds);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    write_json_atomic(&path, &file)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn widget_file_round_trips_bounds() {
        let bounds = WindowBounds {
            x: 120,
            y: 80,
            width: 420,
            height: 500,
        };
        let mut file = WidgetFile::default();
        file.bounds.insert("schedule".to_string(), bounds);
        let json = serde_json::to_string(&file).expect("serialize");
        let restored: WidgetFile = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(restored.bounds.get("schedule"), Some(&bounds));
    }
}
