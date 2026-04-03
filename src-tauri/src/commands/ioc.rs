use std::fs;
use tauri::Manager;

fn ioc_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("ioc_db.json")
}

#[tauri::command]
pub fn load_ioc_db(app: tauri::AppHandle) -> Result<String, String> {
    let path = ioc_path(&app);
    match fs::read_to_string(&path) {
        Ok(content) => Ok(content),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(format!("Failed to read IOC database: {e}")),
    }
}

#[tauri::command]
pub fn save_ioc_db(app: tauri::AppHandle, json: String) -> Result<(), String> {
    let path = ioc_path(&app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Cannot create IOC dir: {e}"))?;
    }
    fs::write(&path, json).map_err(|e| format!("Failed to write IOC database: {e}"))
}
