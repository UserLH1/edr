/**
 * lib/graph-types.ts — shared graph rendering types.
 *
 * Defined once here and imported by:
 *   - lib/layout.ts      (produces NodeDef[] / EdgeDef[])
 *   - lib/mock-graph-data.ts (static fallback data)
 *   - hooks/use-process-graph.ts (state type)
 *   - components/edr/graph-nodes.tsx (rendering)
 *
 * Keeping these here prevents circular imports and makes it trivial to add
 * extra fields (e.g. `selected`, `highlighted`) without touching every file.
 */

export type ThreatLevel = "safe" | "warning" | "critical"

export interface NodeDef {
  id: string
  processName: string
  /** Formatted label, e.g. "PID 1042" or "N/A" for network nodes. */
  pid: string
  threatLevel: ThreatLevel
  iconType: "terminal" | "globe" | "server"
  /** Canvas X position in pixels (computed by lib/layout.ts). */
  x: number
  /** Canvas Y position in pixels (computed by lib/layout.ts). */
  y: number
}

export interface EdgeDef {
  id: string
  source: string
  target: string
  animated: boolean
  color: string
  dashed?: boolean
}
