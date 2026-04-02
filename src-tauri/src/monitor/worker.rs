use std::collections::HashSet;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::commands::processes::{snapshot_processes, ProcessUpdateEvent};

/// Spawned once at startup in `main.rs` via `tauri::async_runtime::spawn`.
/// Runs a perpetual loop that:
///   1. Sweeps all live processes every 2 seconds via `sysinfo`.
///   2. Diffs against the previous snapshot to detect spawned / exited PIDs.
///   3. Emits a `process_update` event the React frontend listens to.
///
/// This is a push model — the frontend never polls; Rust drives the updates.
/// Phase 3 will replace the per-tick `System::new()` with a shared
/// `Arc<Mutex<System>>` so the command handler and worker share one instance.
pub async fn start(app: AppHandle) {
    let mut prev_pids: HashSet<u32> = HashSet::new();

    // tokio::time::interval fires immediately on the first tick, so the
    // frontend receives data before the user has a chance to notice the delay.
    let mut interval = tokio::time::interval(Duration::from_secs(2));

    loop {
        interval.tick().await;

        let (processes, timestamp) = snapshot_processes();

        // Compute diff against the previously known set.
        let current_pids: HashSet<u32> = processes.iter().map(|p| p.pid_num).collect();
        let new_pids: Vec<u32> = current_pids.difference(&prev_pids).copied().collect();
        let exited_pids: Vec<u32> = prev_pids.difference(&current_pids).copied().collect();

        let event = ProcessUpdateEvent {
            processes,
            new_pids,
            exited_pids,
            timestamp,
        };

        // app.emit() is non-blocking — it serialises `event` to JSON and
        // queues it for the webview's JS event loop.
        // We intentionally ignore the error: if the window is closed or the
        // frontend hasn't registered the listener yet, we just move on.
        let _ = app.emit("process_update", &event);

        prev_pids = current_pids;
    }
}
