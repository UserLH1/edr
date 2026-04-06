#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod geo;
mod monitor;

use tauri::Manager;

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
            // Phase 4 — SHA-256 hashing, host isolation
            commands::hashing::hash_file,
            commands::control::isolate_host,
            commands::control::un_isolate_host,
            commands::control::block_remote_ip,
            commands::control::unblock_remote_ip,
            // Phase 5 — settings persistence + DB stats
            commands::settings::load_settings,
            commands::settings::save_settings,
            commands::settings::get_db_stats,
            // Phase 5 — IOC database persistence
            commands::ioc::load_ioc_db,
            commands::ioc::save_ioc_db,
        ])
        .setup(|app| {
            // ── Phase 6: GeoIP state ──────────────────────────────────────────
            // Initialise GeoLite2 readers from AppData.  Missing .mmdb files are
            // silently ignored — enrichment fields will be empty strings.
            let data_dir = app.path().app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));
            app.manage(geo::GeoIpState::new(&data_dir));

            // ── Background worker (process + system metrics) ──────────────────
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                monitor::worker::start(handle).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running NexusEDR");
}
