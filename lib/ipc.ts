/**
 * lib/ipc.ts — single IPC boundary for all Tauri invoke/listen calls.
 */
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

// ── Runtime detection ─────────────────────────────────────────────────────────
export const IS_TAURI =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SystemMetrics {
  cpuPercent: number
  ramUsedGb: number
  ramTotalGb: number
  diskReadMbS: number
  diskWriteMbS: number
}

/** Payload of the `system_update` push event (emitted every 2 s by the worker). */
export interface SystemUpdateEvent extends SystemMetrics {
  timestamp: number
}

export interface ProcessInfo {
  id: string
  processName: string
  pid: string
  pidNum: number
  parentPid: number | null
  threatLevel: "safe" | "warning" | "critical"
  iconType: "terminal" | "globe" | "server"
  exePath: string
  cpuPercent: number
  memMb: number
  cmdline: string
  threatScore: number
  user: string
  startedAt: number
  threadCount: number
}

export interface ProcessUpdateEvent {
  processes: ProcessInfo[]
  newPids: number[]
  exitedPids: number[]
  timestamp: number
}

export interface ConnectionInfo {
  pid: number
  proto: "TCP" | "UDP"
  localAddr: string
  remoteAddr: string
  state: string
  // Phase 6: enrichment fields (empty strings if GeoLite2 db not present or IP is private)
  countryCode: string   // "US", "RO", "DE", … or ""
  domainName: string    // reverse-DNS hostname, populated asynchronously
  asnOrg: string        // autonomous system name, e.g. "GOOGLE", "AMAZON-02"
}

export interface DbStats {
  path: string
  sizeMb: number
  connected: boolean
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_METRICS: SystemMetrics = {
  cpuPercent: 8, ramUsedGb: 3.1, ramTotalGb: 16,
  diskReadMbS: 0, diskWriteMbS: 0,
}

// ── Commands ──────────────────────────────────────────────────────────────────

export const ipc = {
  getSystemMetrics: (): Promise<SystemMetrics> =>
    IS_TAURI ? invoke<SystemMetrics>("get_system_metrics") : Promise.resolve(MOCK_METRICS),

  getActiveProcesses: (): Promise<ProcessInfo[]> =>
    IS_TAURI ? invoke<ProcessInfo[]>("get_active_processes") : Promise.resolve([]),

  getNetworkConnections: (): Promise<ConnectionInfo[]> =>
    IS_TAURI ? invoke<ConnectionInfo[]>("get_network_connections") : Promise.resolve([]),

  killProcess: (pid: number): Promise<void> =>
    IS_TAURI ? invoke<void>("kill_process", { pid }) : Promise.resolve(),

  suspendThread: (pid: number): Promise<void> =>
    IS_TAURI ? invoke<void>("suspend_thread", { pid }) : Promise.resolve(),

  /** Compute SHA-256 of a file at the given path. Returns 64-char hex string. */
  hashFile: (path: string): Promise<string> =>
    IS_TAURI ? invoke<string>("hash_file", { path }) : Promise.resolve(""),

  /**
   * Block all inbound/outbound traffic via OS firewall.
   * Requires administrator / root privileges.
   */
  isolateHost: (): Promise<void> =>
    IS_TAURI ? invoke<void>("isolate_host") : Promise.resolve(),

  /** Restore default firewall policy (block inbound, allow outbound). */
  unIsolateHost: (): Promise<void> =>
    IS_TAURI ? invoke<void>("un_isolate_host") : Promise.resolve(),

  /** Block all inbound/outbound traffic to/from a specific remote IP. Requires admin. */
  blockRemoteIp: (ip: string): Promise<void> =>
    IS_TAURI ? invoke<void>("block_remote_ip", { ip }) : Promise.resolve(),

  /** Remove the firewall block rule for a specific remote IP. */
  unblockRemoteIp: (ip: string): Promise<void> =>
    IS_TAURI ? invoke<void>("unblock_remote_ip", { ip }) : Promise.resolve(),

  /** Load persisted settings JSON from AppData. Returns empty string if not yet saved. */
  loadSettings: (): Promise<string> =>
    IS_TAURI ? invoke<string>("load_settings") : Promise.resolve(""),

  /** Persist settings JSON to AppData/NexusEDR/settings.json. */
  saveSettings: (json: string): Promise<void> =>
    IS_TAURI ? invoke<void>("save_settings", { json }) : Promise.resolve(),

  /** Return size / connectivity of the local EDR database file. */
  getDbStats: (): Promise<DbStats> =>
    IS_TAURI
      ? invoke<DbStats>("get_db_stats")
      : Promise.resolve({ path: "—", sizeMb: 0, connected: false }),

  /** Load persisted IOC database JSON from AppData. Returns empty string if not yet saved. */
  loadIocDb: (): Promise<string> =>
    IS_TAURI ? invoke<string>("load_ioc_db") : Promise.resolve(""),

  /** Persist IOC database JSON to AppData/NexusEDR/ioc_db.json. */
  saveIocDb: (json: string): Promise<void> =>
    IS_TAURI ? invoke<void>("save_ioc_db", { json }) : Promise.resolve(),
}

// ── Events (push from Rust worker) ───────────────────────────────────────────

export const events = {
  onProcessUpdate: (cb: (payload: ProcessUpdateEvent) => void) =>
    listen<ProcessUpdateEvent>("process_update", e => cb(e.payload)),

  /** Live CPU/RAM/disk I/O pushed every 2 s from the background worker. */
  onSystemUpdate: (cb: (payload: SystemUpdateEvent) => void) =>
    listen<SystemUpdateEvent>("system_update", e => cb(e.payload)),
}
