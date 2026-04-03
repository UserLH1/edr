use std::collections::HashSet;
use std::time::Duration;
use sysinfo::{System, Users};
use tauri::{AppHandle, Emitter};

use crate::commands::processes::{snapshot_with, ProcessUpdateEvent};
use crate::commands::system::SystemUpdateEvent;

/// Background worker — spawned once at startup.
///
/// Maintains a single persistent `System` instance so sysinfo can compute
/// accurate per-process CPU% and disk I/O deltas across consecutive refreshes.
///
/// Every 2 seconds it emits two events to the frontend:
///   • `process_update`  — scored process snapshot with diff (new/exited PIDs)
///   • `system_update`   — CPU%, RAM, real disk I/O rates
pub async fn start(app: AppHandle) {
    // ── Persistent sysinfo state ──────────────────────────────────────────
    let mut sys = System::new_all();
    sys.refresh_all();

    let mut users = Users::new_with_refreshed_list();

    // Previous PID set for computing process diffs
    let mut prev_pids: HashSet<u32> = HashSet::new();

    // Cumulative disk I/O totals across all processes (for delta computation)
    let mut prev_disk_read: u64 = 0;
    let mut prev_disk_write: u64 = 0;

    // Tick counter — used to schedule infrequent refreshes (e.g. user list)
    let mut tick: u64 = 0;

    let mut interval = tokio::time::interval(Duration::from_secs(2));

    loop {
        interval.tick().await;
        tick += 1;

        // ── Refresh system state ──────────────────────────────────────────
        sys.refresh_all();

        // Refresh user list every 30 ticks (~1 minute) — user changes are rare
        if tick % 30 == 0 {
            users = Users::new_with_refreshed_list();
        }

        // ── Process snapshot + diff ───────────────────────────────────────
        let (processes, timestamp) = snapshot_with(&sys, &users);

        let current_pids: HashSet<u32> = processes.iter().map(|p| p.pid_num).collect();
        let new_pids: Vec<u32> = current_pids.difference(&prev_pids).copied().collect();
        let exited_pids: Vec<u32> = prev_pids.difference(&current_pids).copied().collect();

        let _ = app.emit("process_update", &ProcessUpdateEvent {
            processes,
            new_pids,
            exited_pids,
            timestamp,
        });

        prev_pids = current_pids;

        // ── System metrics ────────────────────────────────────────────────
        let cpu_percent  = sys.global_cpu_usage();
        let ram_used_gb  = sys.used_memory()  as f64 / 1_073_741_824.0;
        let ram_total_gb = sys.total_memory() as f64 / 1_073_741_824.0;

        // Aggregate per-process disk I/O totals, then diff against previous tick
        // to produce a per-2s rate.  `total_read_bytes` counts from process start,
        // so the delta is bytes read in the last 2 seconds across all tracked processes.
        let disk_read: u64 = sys.processes().values()
            .map(|p| p.disk_usage().total_read_bytes)
            .sum();
        let disk_write: u64 = sys.processes().values()
            .map(|p| p.disk_usage().total_written_bytes)
            .sum();

        // Skip the first tick to avoid a spurious spike (no prior baseline)
        let (read_mb_s, write_mb_s) = if tick > 1 {
            (
                disk_read.saturating_sub(prev_disk_read)  as f64 / 1_048_576.0 / 2.0,
                disk_write.saturating_sub(prev_disk_write) as f64 / 1_048_576.0 / 2.0,
            )
        } else {
            (0.0, 0.0)
        };

        prev_disk_read  = disk_read;
        prev_disk_write = disk_write;

        let _ = app.emit("system_update", &SystemUpdateEvent {
            cpu_percent,
            ram_used_gb,
            ram_total_gb,
            disk_read_mb_s:  read_mb_s,
            disk_write_mb_s: write_mb_s,
            timestamp,
        });
    }
}
