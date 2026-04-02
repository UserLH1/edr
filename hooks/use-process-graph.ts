import { useState, useEffect } from "react"
import { ipc, events, type ProcessUpdateEvent, type ProcessInfo } from "@/lib/ipc"
import { computeGraphLayout } from "@/lib/layout"
import { INITIAL_NODES, INITIAL_EDGES } from "@/lib/mock-graph-data"
import type { NodeDef, EdgeDef } from "@/lib/graph-types"

interface ProcessGraphState {
  nodes: NodeDef[]
  edges: EdgeDef[]
  /** Raw ProcessInfo[] from the last backend snapshot — used by ProcessInspector
   *  and ProcessTreeView to display real metadata. */
  processes: ProcessInfo[]
  loading: boolean
}

/**
 * Detects Tauri at call-time inside useEffect rather than at module load time.
 * Exported so other hooks (useTelemetryEvents, etc.) can share the same check.
 */
export function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  )
}

export function useProcessGraph(): ProcessGraphState {
  const [nodes, setNodes] = useState<NodeDef[]>(INITIAL_NODES)
  const [edges, setEdges] = useState<EdgeDef[]>(INITIAL_EDGES)
  const [processes, setProcesses] = useState<ProcessInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const inTauri = isTauriRuntime()

    console.log("[NexusEDR] isTauriRuntime():", inTauri)
    console.log("[NexusEDR] __TAURI_INTERNALS__:", "__TAURI_INTERNALS__" in window)
    console.log("[NexusEDR] __TAURI__:", "__TAURI__" in window)

    if (!inTauri) {
      console.warn("[NexusEDR] Not running inside Tauri webview — showing mock data.")
      setLoading(false)
      return
    }

    let mounted = true
    let unlisten: (() => void) | undefined

    // ── Step 1: one-shot command to hydrate graph before first worker event ───
    console.log("[NexusEDR] Calling get_active_processes…")
    ipc
      .getActiveProcesses()
      .then(procs => {
        console.log(`[NexusEDR] get_active_processes → ${procs.length} processes`)
        if (!mounted) return
        const layout = computeGraphLayout(procs)
        if (layout.nodes.length > 0) {
          setNodes(layout.nodes)
          setEdges(layout.edges)
          setProcesses(procs)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error("[NexusEDR] get_active_processes FAILED:", err)
        setLoading(false)
      })

    // ── Step 2: subscribe to background worker push events ───────────────────
    events
      .onProcessUpdate((payload: ProcessUpdateEvent) => {
        if (!mounted) return
        console.log(
          `[NexusEDR] process_update → ${payload.processes.length} procs ` +
          `(+${payload.newPids.length} / -${payload.exitedPids.length})`
        )
        const layout = computeGraphLayout(payload.processes)
        if (layout.nodes.length > 0) {
          setNodes(layout.nodes)
          setEdges(layout.edges)
          setProcesses(payload.processes)
        }
      })
      .then(fn => { unlisten = fn })
      .catch(err => console.error("[NexusEDR] onProcessUpdate subscribe FAILED:", err))

    return () => {
      mounted = false
      unlisten?.()
    }
  }, [])

  return { nodes, edges, processes, loading }
}
