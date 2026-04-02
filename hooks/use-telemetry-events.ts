import { useState, useEffect, useRef } from "react"
import { events, type ProcessUpdateEvent, type ProcessInfo } from "@/lib/ipc"
import { isTauriRuntime } from "@/hooks/use-process-graph"

export interface TelemetryEvent {
  /** Unique monotonic ID — used as React key */
  id: number
  /** Formatted HH:MM:SS from the backend timestamp */
  time: string
  event: "PROC_CREATE" | "PROC_EXIT"
  pid: string
  process: string
  /** "N/A" for process lifecycle events; IP:port for network events (Phase 4) */
  destination: string
  action: string
  rowClass: string
  actionClass: string
  timestamp: number
}

const MAX_EVENTS = 200

function formatTime(tsMs: number): string {
  const d = new Date(tsMs)
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  const ss = String(d.getSeconds()).padStart(2, "0")
  return `${hh}:${mm}:${ss}`
}

function eventFromCreate(proc: ProcessInfo, time: string, ts: number, id: number): TelemetryEvent {
  const isCrit = proc.threatLevel === "critical"
  const isWarn = proc.threatLevel === "warning"
  return {
    id,
    time,
    event: "PROC_CREATE",
    pid: String(proc.pidNum),
    process: proc.processName,
    destination: "N/A",
    action: isCrit ? "[ALERT]" : isWarn ? "[WARN]" : "[ALLOWED]",
    rowClass: isCrit
      ? "bg-red-950/20"
      : isWarn
      ? "bg-yellow-950/20"
      : "",
    actionClass: isCrit
      ? "text-red-400 font-bold"
      : isWarn
      ? "text-yellow-400"
      : "text-green-500",
    timestamp: ts,
  }
}

function eventFromExit(pid: number, time: string, ts: number, id: number): TelemetryEvent {
  return {
    id,
    time,
    event: "PROC_EXIT",
    pid: String(pid),
    process: "—",
    destination: "N/A",
    action: "[EXITED]",
    rowClass: "",
    actionClass: "text-zinc-500",
    timestamp: ts,
  }
}

/**
 * Accumulates PROC_CREATE / PROC_EXIT events from the Rust background worker's
 * `process_update` event stream.  Returns the most recent MAX_EVENTS entries,
 * newest first.
 */
export function useTelemetryEvents(): TelemetryEvent[] {
  const [eventLog, setEventLog] = useState<TelemetryEvent[]>([])
  const counterRef = useRef(0)

  useEffect(() => {
    if (!isTauriRuntime()) return

    let unlisten: (() => void) | undefined

    events
      .onProcessUpdate((payload: ProcessUpdateEvent) => {
        const time = formatTime(payload.timestamp)
        const newEntries: TelemetryEvent[] = []

        // New processes
        for (const pid of payload.newPids) {
          const proc = payload.processes.find(p => p.pidNum === pid)
          if (!proc) continue
          newEntries.push(eventFromCreate(proc, time, payload.timestamp, counterRef.current++))
        }

        // Exited processes
        for (const pid of payload.exitedPids) {
          newEntries.push(eventFromExit(pid, time, payload.timestamp, counterRef.current++))
        }

        if (newEntries.length > 0) {
          setEventLog(prev =>
            // Newest first; cap at MAX_EVENTS
            [...newEntries.reverse(), ...prev].slice(0, MAX_EVENTS)
          )
        }
      })
      .then(fn => { unlisten = fn })
      .catch(err => console.error("[NexusEDR] useTelemetryEvents subscribe FAILED:", err))

    return () => { unlisten?.() }
  }, [])

  return eventLog
}
