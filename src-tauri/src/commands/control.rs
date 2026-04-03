use std::process::Command;

// ── Kill ─────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn kill_process(pid: u32) -> Result<(), String> {
    kill_impl(pid)
}

#[cfg(target_os = "windows")]
fn kill_impl(pid: u32) -> Result<(), String> {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, TerminateProcess, PROCESS_TERMINATE,
    };
    unsafe {
        let handle = OpenProcess(PROCESS_TERMINATE, 0, pid);
        if handle == 0 {
            return Err(format!("OpenProcess failed for PID {pid}: access denied or not found"));
        }
        let ok = TerminateProcess(handle, 1);
        CloseHandle(handle);
        if ok == 0 { Err(format!("TerminateProcess failed for PID {pid}")) } else { Ok(()) }
    }
}

#[cfg(not(target_os = "windows"))]
fn kill_impl(pid: u32) -> Result<(), String> {
    let s = Command::new("kill").args(["-9", &pid.to_string()]).status().map_err(|e| e.to_string())?;
    if s.success() { Ok(()) } else { Err(format!("kill -9 {pid} failed")) }
}

// ── Suspend ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn suspend_thread(pid: u32) -> Result<(), String> {
    suspend_impl(pid)
}

#[cfg(target_os = "windows")]
fn suspend_impl(pid: u32) -> Result<(), String> {
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Thread32First, Thread32Next, THREADENTRY32, TH32CS_SNAPTHREAD,
    };
    use windows_sys::Win32::System::Threading::{OpenThread, SuspendThread, THREAD_SUSPEND_RESUME};
    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0);
        if snap == INVALID_HANDLE_VALUE {
            return Err("CreateToolhelp32Snapshot failed".to_string());
        }
        let mut entry: THREADENTRY32 = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<THREADENTRY32>() as u32;
        let mut suspended = 0u32;
        if Thread32First(snap, &mut entry) != 0 {
            loop {
                if entry.th32OwnerProcessID == pid {
                    let h = OpenThread(THREAD_SUSPEND_RESUME, 0, entry.th32ThreadID);
                    if h != 0 && h != INVALID_HANDLE_VALUE {
                        SuspendThread(h);
                        CloseHandle(h);
                        suspended += 1;
                    }
                }
                entry.dwSize = std::mem::size_of::<THREADENTRY32>() as u32;
                if Thread32Next(snap, &mut entry) == 0 { break; }
            }
        }
        CloseHandle(snap);
        if suspended == 0 { Err(format!("No threads found for PID {pid}")) } else { Ok(()) }
    }
}

#[cfg(not(target_os = "windows"))]
fn suspend_impl(pid: u32) -> Result<(), String> {
    let s = Command::new("kill").args(["-STOP", &pid.to_string()]).status().map_err(|e| e.to_string())?;
    if s.success() { Ok(()) } else { Err(format!("SIGSTOP {pid} failed")) }
}

// ── Host isolation (PANIC button) ─────────────────────────────────────────────

/// Blocks all inbound and outbound network traffic via the OS firewall.
/// Requires administrator / root privileges.
/// The Tauri app itself continues to function (IPC uses local named pipes / sockets).
#[tauri::command]
pub fn isolate_host() -> Result<(), String> {
    isolate_impl()
}

/// Restores the default firewall policy (block inbound, allow outbound).
#[tauri::command]
pub fn un_isolate_host() -> Result<(), String> {
    un_isolate_impl()
}

#[cfg(target_os = "windows")]
fn isolate_impl() -> Result<(), String> {
    // Block ALL inbound + outbound on all profiles (domain, private, public)
    let s = Command::new("netsh")
        .args(["advfirewall", "set", "allprofiles", "firewallpolicy", "blockinbound,blockoutbound"])
        .status()
        .map_err(|e| e.to_string())?;
    if s.success() { Ok(()) } else { Err("netsh isolate failed — run as Administrator".to_string()) }
}

#[cfg(target_os = "windows")]
fn un_isolate_impl() -> Result<(), String> {
    // Restore Windows default: block unsolicited inbound, allow outbound
    let s = Command::new("netsh")
        .args(["advfirewall", "set", "allprofiles", "firewallpolicy", "blockinbound,allowoutbound"])
        .status()
        .map_err(|e| e.to_string())?;
    if s.success() { Ok(()) } else { Err("netsh un-isolate failed — run as Administrator".to_string()) }
}

#[cfg(not(target_os = "windows"))]
fn isolate_impl() -> Result<(), String> {
    // Drop all traffic on Linux/macOS via iptables / pfctl
    for args in [
        vec!["-P", "INPUT",   "DROP"],
        vec!["-P", "OUTPUT",  "DROP"],
        vec!["-P", "FORWARD", "DROP"],
    ] {
        Command::new("iptables").args(&args).status().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn un_isolate_impl() -> Result<(), String> {
    for args in [
        vec!["-P", "INPUT",   "ACCEPT"],
        vec!["-P", "OUTPUT",  "ACCEPT"],
        vec!["-P", "FORWARD", "ACCEPT"],
    ] {
        Command::new("iptables").args(&args).status().map_err(|e| e.to_string())?;
    }
    Ok(())
}
