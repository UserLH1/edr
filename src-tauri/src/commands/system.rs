use serde::Serialize;
use sysinfo::{System, MINIMUM_CPU_UPDATE_INTERVAL};

/// One-shot CPU/RAM snapshot (used only until the first `system_update` event arrives).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemMetrics {
    pub cpu_percent: f32,
    pub ram_used_gb: f64,
    pub ram_total_gb: f64,
    pub disk_read_mb_s: f64,
    pub disk_write_mb_s: f64,
}

/// Payload of the `system_update` event emitted by the background worker every 2 s.
/// Includes real disk I/O rates derived from per-process delta tracking.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemUpdateEvent {
    pub cpu_percent: f32,
    pub ram_used_gb: f64,
    pub ram_total_gb: f64,
    /// Aggregate read throughput across all processes, MB/s.
    pub disk_read_mb_s: f64,
    /// Aggregate write throughput across all processes, MB/s.
    pub disk_write_mb_s: f64,
    pub timestamp: u64,
}

/// Initial one-shot command.  The AppHeader uses this until the first
/// `system_update` push event arrives from the background worker (~2 s).
#[tauri::command]
pub async fn get_system_metrics() -> Result<SystemMetrics, String> {
    let mut sys = System::new();
    sys.refresh_cpu_all();
    tokio::time::sleep(MINIMUM_CPU_UPDATE_INTERVAL).await;
    sys.refresh_cpu_all();
    sys.refresh_memory();

    Ok(SystemMetrics {
        cpu_percent: sys.global_cpu_usage(),
        ram_used_gb: sys.used_memory() as f64 / 1_073_741_824.0,
        ram_total_gb: sys.total_memory() as f64 / 1_073_741_824.0,
        disk_read_mb_s: 0.0,  // real rates come from system_update events
        disk_write_mb_s: 0.0,
    })
}
