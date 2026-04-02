use serde::Serialize;
use sysinfo::System;

// ── Serialisable types sent to the frontend ───────────────────────────────────

/// Per-process snapshot.  `rename_all = "camelCase"` makes serde produce the
/// exact field names the TypeScript `ProcessInfo` interface expects.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    /// Node id in the graph — format "n{pid}".
    pub id: String,
    /// Display name (e.g. "powershell.exe").
    pub process_name: String,
    /// Formatted string shown in the node badge — "PID 1234".
    pub pid: String,
    /// Raw numeric PID (used for edge construction on the frontend).
    pub pid_num: u32,
    /// Parent PID if the parent is also present in our filtered set; otherwise null.
    pub parent_pid: Option<u32>,
    /// "safe" | "warning" | "critical"
    pub threat_level: String,
    /// "terminal" | "globe" | "server" — drives the Lucide icon selection.
    pub icon_type: String,
    pub exe_path: String,
    pub cpu_percent: f32,
    pub mem_mb: f64,
    pub cmdline: String,
    pub threat_score: u8,
    // ── Phase 3 extended fields ───────────────────────────────────────────────
    /// OS username that owns the process (e.g. "SYSTEM", "VICTIM\\user").
    pub user: String,
    /// Unix timestamp (seconds) when the process started.
    pub started_at: u64,
    /// Number of threads.  Linux only via sysinfo tasks(); 0 on Windows for now.
    pub thread_count: u32,
}

/// Payload of the `process_update` Tauri event emitted by the background worker.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessUpdateEvent {
    /// Filtered, scored snapshot ready for graph rendering.
    pub processes: Vec<ProcessInfo>,
    /// PIDs that appeared since the last sweep.
    pub new_pids: Vec<u32>,
    /// PIDs that vanished since the last sweep.
    pub exited_pids: Vec<u32>,
    /// Unix millisecond timestamp of this snapshot.
    pub timestamp: u64,
}

// ── Threat scoring ────────────────────────────────────────────────────────────

/// Heuristic rule-based scorer.  Returns 0–100; thresholds: ≥50 = critical, ≥15 = warning.
fn score_process(name: &str, cmdline: &str, exe_path: &str) -> u8 {
    let mut score: u8 = 0;
    let name_lc = name.to_lowercase();
    let cmd_lc = cmdline.to_lowercase();
    let exe_lc = exe_path.to_lowercase();

    // ── PowerShell evasion flags ─────────────────────────────────────────────
    if cmd_lc.contains("-enc") || cmd_lc.contains("-encodedcommand") {
        score = score.saturating_add(40);
    }
    if cmd_lc.contains("-windowstyle hidden") || cmd_lc.contains("-w hidden") {
        score = score.saturating_add(25);
    }
    if cmd_lc.contains("-noprofile") || cmd_lc.contains("-nop ") {
        score = score.saturating_add(10);
    }

    // ── Living-off-the-Land Binaries (LOLBins) ───────────────────────────────
    const LOLBINS: &[&str] = &[
        "certutil.exe",
        "mshta.exe",
        "wscript.exe",
        "cscript.exe",
        "regsvr32.exe",
        "rundll32.exe",
        "bitsadmin.exe",
        "msiexec.exe",
    ];
    if LOLBINS.iter().any(|&b| name_lc == b) {
        score = score.saturating_add(20);
    }

    // ── Suspicious execution paths ───────────────────────────────────────────
    if exe_lc.contains("\\temp\\")
        || exe_lc.contains("\\tmp\\")
        || exe_lc.contains("\\appdata\\local\\temp")
        || exe_lc.contains("\\appdata\\roaming\\")
    {
        score = score.saturating_add(35);
    }
    if exe_lc.contains("\\downloads\\") {
        score = score.saturating_add(20);
    }

    // ── Known malicious / dual-use tool names ────────────────────────────────
    if matches!(name_lc.as_str(), "nc.exe" | "ncat.exe" | "netcat.exe") {
        score = score.saturating_add(60);
    }
    if name_lc.contains("mimikatz") || name_lc.contains("mimi") {
        score = score.saturating_add(100);
    }

    score
}

fn threat_level_str(score: u8) -> &'static str {
    if score >= 50 {
        "critical"
    } else if score >= 15 {
        "warning"
    } else {
        "safe"
    }
}

fn icon_type_str(name: &str) -> &'static str {
    let n = name.to_lowercase();
    if n.contains("powershell")
        || n == "cmd.exe"
        || n.contains("bash")
        || n == "sh.exe"
        || n.starts_with("python")
        || n == "nc.exe"
        || n == "ncat.exe"
    {
        "terminal"
    } else if n.contains("chrome")
        || n.contains("firefox")
        || n.contains("msedge")
        || n == "iexplore.exe"
        || n == "curl.exe"
        || n == "wget.exe"
    {
        "globe"
    } else {
        "server"
    }
}

// ── Core snapshot logic (shared by command + background worker) ──────────────

pub fn snapshot_processes() -> (Vec<ProcessInfo>, u64) {
    let mut sys = System::new_all();
    sys.refresh_all();

    // Build user lookup table once — avoid O(n²) iteration per process.
    let users = sysinfo::Users::new_with_refreshed_list();

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let all_pids: std::collections::HashSet<u32> =
        sys.processes().keys().map(|p| p.as_u32()).collect();

    let raw: Vec<ProcessInfo> = sys
        .processes()
        .values()
        .map(|proc| {
            let name = proc.name().to_string_lossy().to_string();
            let cmdline = proc
                .cmd()
                .iter()
                .map(|a| a.to_string_lossy().into_owned())
                .collect::<Vec<_>>()
                .join(" ");
            let exe_path = proc
                .exe()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            let pid_num = proc.pid().as_u32();

            let parent_pid = proc
                .parent()
                .map(|p| p.as_u32())
                .filter(|p| all_pids.contains(p));

            let score = score_process(&name, &cmdline, &exe_path);

            // ── Phase 3: user, started_at, thread_count ───────────────────────
            let user: String = proc
                .user_id()
                .and_then(|uid| users.iter().find(|u| u.id() == uid))
                .map(|u| u.name().to_string())
                .unwrap_or_else(|| "—".to_string());

            let started_at = proc.start_time(); // Unix seconds

            // tasks() returns thread info on Linux; None on Windows/macOS for now
            let thread_count = proc
                .tasks()
                .map(|t| t.len() as u32)
                .unwrap_or(0);

            ProcessInfo {
                id: format!("n{pid_num}"),
                process_name: name.clone(),
                pid: format!("PID {pid_num}"),
                pid_num,
                parent_pid,
                threat_level: threat_level_str(score).to_string(),
                icon_type: icon_type_str(&name).to_string(),
                exe_path,
                cpu_percent: proc.cpu_usage(),
                mem_mb: proc.memory() as f64 / 1_048_576.0,
                cmdline,
                threat_score: score,
                user,
                started_at,
                thread_count,
            }
        })
        .collect();

    // ── Filter to graph-relevant subset ──────────────────────────────────────

    let flagged: Vec<u32> = raw
        .iter()
        .filter(|p| p.threat_level != "safe")
        .map(|p| p.pid_num)
        .collect();

    let pid_to_parent: std::collections::HashMap<u32, Option<u32>> =
        raw.iter().map(|p| (p.pid_num, p.parent_pid)).collect();

    let mut included: std::collections::HashSet<u32> = flagged.iter().copied().collect();
    for &pid in &flagged {
        let mut cur = pid;
        for _ in 0..8 {
            match pid_to_parent.get(&cur).and_then(|&p| p) {
                Some(parent) => {
                    included.insert(parent);
                    cur = parent;
                }
                None => break,
            }
        }
    }

    if included.len() < 10 {
        let mut by_cpu: Vec<&ProcessInfo> = raw.iter().collect();
        by_cpu.sort_by(|a, b| {
            b.cpu_percent
                .partial_cmp(&a.cpu_percent)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        for proc in by_cpu.into_iter().take(20) {
            if included.len() >= 20 {
                break;
            }
            included.insert(proc.pid_num);
        }
    }

    let mut result: Vec<ProcessInfo> = raw
        .into_iter()
        .filter(|p| included.contains(&p.pid_num))
        .collect();
    result.truncate(40);

    (result, ts)
}

// ── Tauri command ─────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_active_processes() -> Result<Vec<ProcessInfo>, String> {
    let (processes, _) = snapshot_processes();
    Ok(processes)
}
