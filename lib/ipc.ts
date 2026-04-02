/**
 * lib/ipc.ts — typed wrappers around @tauri-apps/api.
 *
 * This is the ONLY file that calls `invoke` or `listen` directly.
 * All other code goes through this module so the full IPC surface is in one
 * place and easy to mock during Vite-only development.
 */
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

// ── Runtime detection ─────────────────────────────────────────────────────────
export const IS_TAURI =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)

// ── Types matching Rust structs (serde rename_all = "camelCase") ──────────────

export interface SystemMetrics {
  cpuPercent: number
  ramUsedGb: number
  ramTotalGb: number
  diskReadMbS: number
  diskWriteMbS: number
}

/**
 * Per-process record sent from Rust.
 * Field names mirror the Rust `ProcessInfo` struct with `#[serde(rename_all = "camelCase")]`.
 */
export interface ProcessInfo {
  /** Graph node id — "n{pid}" */
  id: string
  processName: string
  /** Formatted label — "PID 1234" */
  pid: string
  /** Raw numeric PID — used for edge construction and inspector lookup. */
  pidNum: number
  /** Parent PID if it's in the current filtered set; null otherwise. */
  parentPid: number | null
  threatLevel: "safe" | "warning" | "critical"
  iconType: "terminal" | "globe" | "server"
  exePath: string
  cpuPercent: number
  memMb: number
  cmdline: string
  threatScore: number
  // ── Phase 3 extended fields ───────────────────────────────────────────────
  /** OS username (e.g. "SYSTEM", "DOMAIN\\user") */
  user: string
  /** Unix timestamp (seconds) when the process started */
  startedAt: number
  /** Thread count; 0 on Windows until Phase 4 */
  threadCount: number
}

/** Payload of the `process_update` event emitted by the Rust background worker. */
export interface ProcessUpdateEvent {
  processes: ProcessInfo[]
  newPids: number[]
  exitedPids: number[]
  timestamp: number
}

/** One socket entry from the OS socket table (Phase 3 network tab). */
export interface ConnectionInfo {
  pid: number
  proto: "TCP" | "UDP"
  localAddr: string
  remoteAddr: string
  /** TCP state in ALLCAPS (e.g. "ESTABLISHED", "LISTEN"), or "LISTEN" for UDP */
  state: string
}

// ── Mock fallback data (used when IS_TAURI === false) ─────────────────────────

const MOCK_METRICS: SystemMetrics = {
  cpuPercent: 8,
  ramUsedGb: 3.1,
  ramTotalGb: 16,
  diskReadMbS: 0,
  diskWriteMbS: 0,
}

// ── Commands (request / response) ────────────────────────────────────────────

export const ipc = {
  /** One-shot CPU / RAM snapshot. */
  getSystemMetrics: (): Promise<SystemMetrics> => {
    if (!IS_TAURI) return Promise.resolve(MOCK_METRICS)
    return invoke<SystemMetrics>("get_system_metrics")
  },

  /**
   * One-shot process snapshot used to hydrate the graph on mount.
   * Returns [] when running outside of Tauri (graph uses INITIAL_NODES mock).
   */
  getActiveProcesses: (): Promise<ProcessInfo[]> => {
    if (!IS_TAURI) return Promise.resolve([])
    return invoke<ProcessInfo[]>("get_active_processes")
  },

  /**
   * Returns the full OS socket table.
   * Frontend filters by `pid` to show per-process connections.
   */
  getNetworkConnections: (): Promise<ConnectionInfo[]> => {
    if (!IS_TAURI) return Promise.resolve([])
    return invoke<ConnectionInfo[]>("get_network_connections")
  },

  /**
   * Terminates the process with the given PID.
   * Uses TerminateProcess on Windows, SIGKILL on Unix.
   */
  killProcess: (pid: number): Promise<void> => {
    if (!IS_TAURI) return Promise.resolve()
    return invoke<void>("kill_process", { pid })
  },

  /**
   * Suspends all threads of the process with the given PID.
   * Windows: SuspendThread per thread via ToolHelp32.
   * Unix: SIGSTOP.
   */
  suspendThread: (pid: number): Promise<void> => {
    if (!IS_TAURI) return Promise.resolve()
    return invoke<void>("suspend_thread", { pid })
  },
}

// ── Events (push from Rust background worker) ────────────────────────────────

export const events = {
  /**
   * Subscribe to the `process_update` event stream.
   * Returns a Promise that resolves to an unlisten function.
   */
  onProcessUpdate: (cb: (payload: ProcessUpdateEvent) => void) =>
    listen<ProcessUpdateEvent>("process_update", e => cb(e.payload)),
}
