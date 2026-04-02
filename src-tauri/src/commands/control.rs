/// Process control commands: kill and suspend.
///
/// Kill uses Win32 TerminateProcess on Windows, SIGKILL on Unix.
/// Suspend enumerates all threads via ToolHelp32 and calls SuspendThread on
/// each one (Windows), or sends SIGSTOP on Unix.

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
            return Err(format!(
                "OpenProcess failed for PID {pid} — access denied or process not found"
            ));
        }
        let ok = TerminateProcess(handle, 1);
        CloseHandle(handle);
        if ok == 0 {
            Err(format!("TerminateProcess failed for PID {pid}"))
        } else {
            Ok(())
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn kill_impl(pid: u32) -> Result<(), String> {
    use std::process::Command;
    let status = Command::new("kill")
        .args(["-9", &pid.to_string()])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("kill -9 {pid} failed with status {status}"))
    }
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
                // Reset dwSize before each iteration (required by the API)
                entry.dwSize = std::mem::size_of::<THREADENTRY32>() as u32;
                if Thread32Next(snap, &mut entry) == 0 {
                    break;
                }
            }
        }

        CloseHandle(snap);

        if suspended == 0 {
            Err(format!("No threads found / accessible for PID {pid}"))
        } else {
            Ok(())
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn suspend_impl(pid: u32) -> Result<(), String> {
    use std::process::Command;
    let status = Command::new("kill")
        .args(["-STOP", &pid.to_string()])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("SIGSTOP for PID {pid} failed with status {status}"))
    }
}
