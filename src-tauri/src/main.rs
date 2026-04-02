#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod monitor;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Phase 1 — system metrics
            commands::system::get_system_metrics,
            // Phase 2 — process graph
            commands::processes::get_active_processes,
            // Phase 3 — network, kill, suspend
            commands::network::get_network_connections,
            commands::control::kill_process,
            commands::control::suspend_thread,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                monitor::worker::start(handle).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running NexusEDR");
}
