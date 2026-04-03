import { useState, useEffect } from "react"
import { ipc, events, type SystemMetrics } from "@/lib/ipc"
import { isTauriRuntime } from "@/hooks/use-process-graph"

/**
 * Returns live system metrics.
 *
 * Strategy:
 *  1. Fires `get_system_metrics` once on mount for an immediate reading.
 *  2. Switches to the `system_update` push event from the background worker
 *     (which carries real disk I/O rates).  No polling needed after that.
 *  3. Falls back to polling when not running inside Tauri (browser dev mode).
 */
export function useSystemMetrics(fallbackIntervalMs = 2000): SystemMetrics | null {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)

  useEffect(() => {
    if (!isTauriRuntime()) {
      // Browser fallback: poll the mock via invoke
      ipc.getSystemMetrics().then(setMetrics).catch(console.error)
      const id = setInterval(
        () => ipc.getSystemMetrics().then(setMetrics).catch(console.error),
        fallbackIntervalMs
      )
      return () => clearInterval(id)
    }

    let unlisten: (() => void) | undefined

    // Immediate one-shot to show something before the first worker event
    ipc.getSystemMetrics().then(setMetrics).catch(console.error)

    // Subscribe to push events — updates every 2 s with real disk I/O
    events
      .onSystemUpdate(payload => setMetrics(payload))
      .then(fn => { unlisten = fn })
      .catch(err => console.error("[NexusEDR] onSystemUpdate subscribe FAILED:", err))

    return () => { unlisten?.() }
  }, [fallbackIntervalMs])

  return metrics
}
