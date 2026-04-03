import { useState, useEffect } from "react"
import { ipc, type ConnectionInfo } from "@/lib/ipc"
import { isTauriRuntime } from "@/hooks/use-process-graph"

interface UseNetworkConnectionsResult {
  connections: ConnectionInfo[]
  loading: boolean
  /** Unix ms timestamp of the last successful fetch */
  lastUpdated: number
}

/**
 * Polls `get_network_connections` every `intervalMs` milliseconds.
 * Returns the full OS socket table; the view filters / groups as needed.
 */
export function useNetworkConnections(intervalMs = 5000): UseNetworkConnectionsResult {
  const [connections, setConnections] = useState<ConnectionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(0)

  useEffect(() => {
    if (!isTauriRuntime()) {
      setLoading(false)
      return
    }

    let mounted = true

    async function fetch() {
      try {
        const conns = await ipc.getNetworkConnections()
        if (!mounted) return
        setConnections(conns)
        setLastUpdated(Date.now())
      } catch (err) {
        console.error("[NexusEDR] useNetworkConnections FAILED:", err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetch()
    const id = setInterval(fetch, intervalMs)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [intervalMs])

  return { connections, loading, lastUpdated }
}
