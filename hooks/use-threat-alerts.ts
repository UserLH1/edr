import { useState, useEffect, useRef } from "react"
import { events, type ProcessInfo } from "@/lib/ipc"
import { isTauriRuntime } from "@/hooks/use-process-graph"

export interface ThreatAlert {
  id: number
  process: ProcessInfo
  timestamp: number
}

const MAX_ALERTS = 8

/**
 * Watches the `process_update` stream and emits a `ThreatAlert` entry
 * whenever a new process with `threatLevel === "critical"` or `"warning"` spawns.
 *
 * Returns `[alerts, dismiss]` — call `dismiss(id)` to remove one alert,
 * or `dismissAll()` to clear the stack.
 */
export function useThreatAlerts(): {
  alerts: ThreatAlert[]
  dismiss: (id: number) => void
  dismissAll: () => void
} {
  const [alerts, setAlerts] = useState<ThreatAlert[]>([])
  const counterRef = useRef(0)

  useEffect(() => {
    if (!isTauriRuntime()) return

    let unlisten: (() => void) | undefined

    events
      .onProcessUpdate(payload => {
        const newThreats = payload.newPids
          .map(pid => payload.processes.find(p => p.pidNum === pid))
          .filter((p): p is ProcessInfo =>
            p?.threatLevel === "critical" || p?.threatLevel === "warning"
          )

        if (newThreats.length === 0) return

        setAlerts(prev => [
          ...newThreats.map(p => ({
            id: counterRef.current++,
            process: p,
            timestamp: payload.timestamp,
          })),
          ...prev,
        ].slice(0, MAX_ALERTS))
      })
      .then(fn => { unlisten = fn })
      .catch(err => console.error("[NexusEDR] useThreatAlerts subscribe FAILED:", err))

    return () => { unlisten?.() }
  }, [])

  const dismiss = (id: number) =>
    setAlerts(prev => prev.filter(a => a.id !== id))

  const dismissAll = () => setAlerts([])

  return { alerts, dismiss, dismissAll }
}
