use serde::Serialize;
use sysinfo::System;

// ── Serialisable types sent to the frontend ───────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub id: String,
    pub process_name: String,
    pub pid: String,
    pub pid_num: u32,
    pub parent_pid: Option<u32>,
    pub threat_level: String,
    pub icon_type: String,
    pub exe_path: String,
    pub cpu_percent: f32,
    pub mem_mb: f64,
    pub cmdline: String,
    pub threat_score: u8,
    pub user: String,
    pub started_at: u64,
    pub thread_count: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessUpdateEvent {
    pub processes: Vec<ProcessInfo>,
    pub new_pids: Vec<u32>,
    pub exited_pids: Vec<u32>,
    pub timestamp: u64,
}

// ── Threat scoring ────────────────────────────────────────────────────────────

fn score_process(name: &str, cmdline: &str, exe_path: &str) -> u8 {
    let mut score: u8 = 0;
    let name_lc = name.to_lowercase();
    let cmd_lc = cmdline.to_lowercase();
    let exe_lc = exe_path.to_lowercase();

    if cmd_lc.contains("-enc") || cmd_lc.contains("-encodedcommand") {
        score = score.saturating_add(40);
    }
    if cmd_lc.contains("-windowstyle hidden") || cmd_lc.contains("-w hidden") {
        score = score.saturating_add(25);
    }
    if cmd_lc.contains("-noprofile") || cmd_lc.contains("-nop ") {
        score = score.saturating_add(10);
    }

    const LOLBINS: &[&str] = &[
        "certutil.exe", "mshta.exe", "wscript.exe", "cscript.exe",
        "regsvr32.exe", "rundll32.exe", "bitsadmin.exe", "msiexec.exe",
    ];
    if LOLBINS.iter().any(|&b| name_lc == b) {
        score = score.saturating_add(20);
    }

    if exe_lc.contains("\\temp\\") || exe_lc.contains("\\tmp\\")
        || exe_lc.contains("\\appdata\\local\\temp")
        || exe_lc.contains("\\appdata\\roaming\\")
    {
        score = score.saturating_add(35);
    }
    if exe_lc.contains("\\downloads\\") {
        score = score.saturating_add(20);
    }

    if matches!(name_lc.as_str(), "nc.exe" | "ncat.exe" | "netcat.exe") {
        score = score.saturating_add(60);
    }
    if name_lc.contains("mimikatz") || name_lc.contains("mimi") {
        score = score.saturating_add(100);
    }

    score
}

fn threat_level_str(score: u8) -> &'static str {
    if score >= 50 { "critical" } else if score >= 15 { "warning" } else { "safe" }
}

fn icon_type_str(name: &str) -> &'static str {
    let n = name.to_lowercase();
    if n.contains("powershell") || n == "cmd.exe" || n.contains("bash")
        || n == "sh.exe" || n.starts_with("python") || n == "nc.exe" || n == "ncat.exe"
    {
        "terminal"
    } else if n.contains("chrome") || n.contains("firefox") || n.contains("msedge")
        || n == "iexplore.exe" || n == "curl.exe" || n == "wget.exe"
    {
        "globe"
    } else {
        "server"
    }
}

// ── Core snapshot helpers ─────────────────────────────────────────────────────

/// Converts a fully-refreshed `System` snapshot into a filtered `ProcessInfo` vec.
/// Called by both the background worker (persistent System) and the one-shot command.
pub fn snapshot_with(sys: &System, users: &sysinfo::Users) -> (Vec<ProcessInfo>, u64) {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let all_pids: std::collections::HashSet<u32> =
        sys.processes().keys().map(|p| p.as_u32()).collect();

    let raw: Vec<ProcessInfo> = sys.processes().values().map(|proc| {
        let name = proc.name().to_string_lossy().to_string();
        let cmdline = proc.cmd().iter()
            .map(|a| a.to_string_lossy().into_owned())
            .collect::<Vec<_>>().join(" ");
        let exe_path = proc.exe()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let pid_num = proc.pid().as_u32();

        let parent_pid = proc.parent()
            .map(|p| p.as_u32())
            .filter(|p| all_pids.contains(p));

        let score = score_process(&name, &cmdline, &exe_path);

        let user: String = proc.user_id()
            .and_then(|uid| users.iter().find(|u| u.id() == uid))
            .map(|u| u.name().to_string())
            .unwrap_or_else(|| "—".to_string());

        let started_at = proc.start_time();
        let thread_count = proc.tasks().map(|t| t.len() as u32).unwrap_or(0);

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
    }).collect();

    // ── Filter to graph-relevant subset (flagged + ancestors + top CPU) ───────
    let flagged: Vec<u32> = raw.iter()
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
                Some(parent) => { included.insert(parent); cur = parent; }
                None => break,
            }
        }
    }

    if included.len() < 10 {
        let mut by_cpu: Vec<&ProcessInfo> = raw.iter().collect();
        by_cpu.sort_by(|a, b| b.cpu_percent.partial_cmp(&a.cpu_percent).unwrap_or(std::cmp::Ordering::Equal));
        for proc in by_cpu.into_iter().take(20) {
            if included.len() >= 20 { break; }
            included.insert(proc.pid_num);
        }
    }

    let mut result: Vec<ProcessInfo> = raw.into_iter()
        .filter(|p| included.contains(&p.pid_num))
        .collect();
    result.truncate(40);

    (result, ts)
}

/// One-shot version used by the `get_active_processes` Tauri command.
pub fn snapshot_processes() -> (Vec<ProcessInfo>, u64) {
    let mut sys = System::new_all();
    sys.refresh_all();
    let users = sysinfo::Users::new_with_refreshed_list();
    snapshot_with(&sys, &users)
}

// ── Tauri command ─────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_active_processes() -> Result<Vec<ProcessInfo>, String> {
    let (processes, _) = snapshot_processes();
    Ok(processes)
}
