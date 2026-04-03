use serde::Serialize;
use std::fs;
use tauri::Manager;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbStats {
    pub path: String,
    pub size_mb: f64,
    pub connected: bool,
}

fn app_data_dir(app: &tauri::AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
}

#[tauri::command]
pub fn load_settings(app: tauri::AppHandle) -> Result<String, String> {
    let path = app_data_dir(&app).join("settings.json");
    match fs::read_to_string(&path) {
        Ok(content) => Ok(content),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(format!("Failed to read settings: {e}")),
    }
}

#[tauri::command]
pub fn save_settings(app: tauri::AppHandle, json: String) -> Result<(), String> {
    let dir = app_data_dir(&app);
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create settings dir: {e}"))?;
    fs::write(dir.join("settings.json"), json)
        .map_err(|e| format!("Failed to write settings: {e}"))
}

#[tauri::command]
pub fn get_db_stats(app: tauri::AppHandle) -> DbStats {
    let path = app_data_dir(&app).join("edr.db");
    match fs::metadata(&path) {
        Ok(meta) => DbStats {
            path: path.to_string_lossy().to_string(),
            size_mb: meta.len() as f64 / 1_048_576.0,
            connected: true,
        },
        Err(_) => DbStats {
            path: path.to_string_lossy().to_string(),
            size_mb: 0.0,
            connected: false,
        },
    }
}
