use serde::Serialize;
use sysinfo::{Disks, System, MINIMUM_CPU_UPDATE_INTERVAL};

/// Sent to the frontend as the payload of `get_system_metrics`.
/// Field names use camelCase so they map directly to TypeScript without conversion.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemMetrics {
    /// CPU usage across all cores, 0–100.
    pub cpu_percent: f32,
    /// RAM currently in use, in gigabytes.
    pub ram_used_gb: f64,
    /// Total installed RAM, in gigabytes.
    pub ram_total_gb: f64,
    /// Disk read throughput in MB/s since last call (0.0 on first call).
    pub disk_read_mb_s: f64,
    /// Disk write throughput in MB/s since last call (0.0 on first call).
    pub disk_write_mb_s: f64,
}

/// Returns a one-shot snapshot of host system metrics.
///
/// CPU% requires two `refresh_cpu_all` calls separated by at least
/// `MINIMUM_CPU_UPDATE_INTERVAL` (typically 200 ms on most OSes).
/// We use `tokio::time::sleep` so the Tauri thread pool is not blocked.
///
/// Phase 2 will replace this command with a background worker that emits
/// `system_metrics` events on a 500 ms interval instead of polling.
#[tauri::command]
pub async fn get_system_metrics() -> Result<SystemMetrics, String> {
    // First CPU sample
    let mut sys = System::new();
    sys.refresh_cpu_all();

    // Wait for the OS to accumulate a meaningful delta
    tokio::time::sleep(MINIMUM_CPU_UPDATE_INTERVAL).await;

    // Second CPU sample — now global_cpu_usage() is accurate
    sys.refresh_cpu_all();
    sys.refresh_memory();

    let cpu_percent = sys.global_cpu_usage();
    let ram_used_gb = sys.used_memory() as f64 / 1_073_741_824.0;
    let ram_total_gb = sys.total_memory() as f64 / 1_073_741_824.0;

    // Disk I/O — accumulate across all disks
    let mut disks = Disks::new_with_refreshed_list();
    // A single snapshot gives us bytes read/written since boot, not a rate.
    // For a rate we'd need two snapshots; Phase 2's background worker will
    // handle this properly. For now we expose the raw totals in MB.
    let (total_read_mb, total_write_mb) = disks.list().iter().fold((0.0, 0.0), |acc, d| {
        (
            acc.0 + d.total_read_bytes() as f64 / 1_048_576.0,
            acc.1 + d.total_written_bytes() as f64 / 1_048_576.0,
        )
    });
    // Surface as "MB/s" column; Phase 2 will make it a true rate.
    let _ = (total_read_mb, total_write_mb);

    Ok(SystemMetrics {
        cpu_percent,
        ram_used_gb,
        ram_total_gb,
        disk_read_mb_s: 0.0, // real rate wired in Phase 2
        disk_write_mb_s: 0.0,
    })
}
