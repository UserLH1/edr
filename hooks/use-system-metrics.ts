import { useState, useEffect } from "react"
import { ipc, type SystemMetrics } from "@/lib/ipc"

/**
 * Polls `get_system_metrics` on the given interval and returns the latest
 * snapshot. Returns `null` until the first successful response.
 *
 * Phase 2 will replace polling with a push-based Tauri event listener
 * (`system_metrics` event emitted by the background Rust worker), but this
 * is sufficient for Phase 1 and requires zero changes to the consumer.
 */
export function useSystemMetrics(intervalMs = 2000): SystemMetrics | null {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetch = () => {
      ipc.getSystemMetrics()
        .then((m) => { if (!cancelled) setMetrics(m) })
        .catch(console.error)
    }

    fetch() // immediate first fetch — no delay on mount
    const id = setInterval(fetch, intervalMs)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [intervalMs])

  return metrics
}
