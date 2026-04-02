/**
 * lib/layout.ts — converts a flat list of ProcessInfo records into positioned
 * NodeDef[] and EdgeDef[] ready for graph-nodes.tsx to render.
 *
 * Algorithm: depth-first tree layout driven by parent_pid relationships.
 *   • Leaf nodes are stacked vertically (y advances by NODE_H + NODE_GAP).
 *   • Internal nodes are vertically centred over their children.
 *   • Depth determines the X position (column = depth × LEVEL_GAP).
 *   • Nodes that have no parent in the filtered set are treated as roots.
 *   • Disconnected nodes (impossible in theory, defensive anyway) are appended
 *     at the bottom of column 0.
 *
 * Threat colouring rules for edges:
 *   critical child → red animated edge
 *   warning  child → yellow dashed edge
 *   safe     child → cyan edge (no animation)
 */
import type { ProcessInfo } from "./ipc"
import type { NodeDef, EdgeDef } from "./graph-types"

// ── Layout constants (must match NODE_W / NODE_H in graph-nodes.tsx) ─────────
const NODE_H    = 52   // height of a node card
const LEVEL_GAP = 260  // horizontal distance between parent and child columns
const NODE_GAP  = 74   // vertical gap between sibling nodes

export function computeGraphLayout(processes: ProcessInfo[]): {
  nodes: NodeDef[]
  edges: EdgeDef[]
} {
  if (processes.length === 0) return { nodes: [], edges: [] }

  const ids = new Set(processes.map(p => p.pidNum))

  // Build parent → [children] map.
  // A process is treated as a root if its parentPid is null or not in our set.
  const childrenOf = new Map<number | null, ProcessInfo[]>()
  for (const p of processes) {
    const key = p.parentPid != null && ids.has(p.parentPid) ? p.parentPid : null
    const arr = childrenOf.get(key) ?? []
    arr.push(p)
    childrenOf.set(key, arr)
  }

  // DFS layout: leaves get the next y slot; parents centre over their subtree.
  const positioned = new Map<number, { x: number; y: number }>()
  let leafY = 40 // top padding

  function placeSubtree(parentPid: number | null, depth: number): void {
    const kids = (childrenOf.get(parentPid) ?? []).sort((a, b) => {
      // Critical nodes float to the top so they're visually prominent.
      const order = { critical: 0, warning: 1, safe: 2 } as const
      return (
        order[a.threatLevel as keyof typeof order] -
        order[b.threatLevel as keyof typeof order]
      )
    })

    for (const child of kids) {
      const grandchildren = childrenOf.get(child.pidNum) ?? []

      if (grandchildren.length === 0) {
        // Leaf — assign the next available y slot.
        positioned.set(child.pidNum, { x: depth * LEVEL_GAP + 40, y: leafY })
        leafY += NODE_H + NODE_GAP
      } else {
        // Recurse into children first, then centre this node over the result.
        placeSubtree(child.pidNum, depth + 1)

        const childYs = grandchildren
          .map(c => positioned.get(c.pidNum)?.y ?? leafY)
          .filter(y => y !== undefined)

        const midY =
          childYs.length > 0
            ? (Math.min(...childYs) + Math.max(...childYs)) / 2
            : leafY

        positioned.set(child.pidNum, { x: depth * LEVEL_GAP + 40, y: midY })
      }
    }
  }

  placeSubtree(null, 0)

  // Defensive: any process that fell through (e.g. circular parent reference)
  // gets stacked at the bottom.
  for (const p of processes) {
    if (!positioned.has(p.pidNum)) {
      positioned.set(p.pidNum, { x: 40, y: leafY })
      leafY += NODE_H + NODE_GAP
    }
  }

  // ── Build NodeDef array ───────────────────────────────────────────────────
  const nodes: NodeDef[] = processes.map(p => {
    const pos = positioned.get(p.pidNum)!
    return {
      id: p.id,
      processName: p.processName,
      pid: p.pid,
      threatLevel: p.threatLevel as NodeDef["threatLevel"],
      iconType: p.iconType as NodeDef["iconType"],
      x: pos.x,
      y: pos.y,
    }
  })

  // ── Build EdgeDef array from parent-child relationships ───────────────────
  const edges: EdgeDef[] = []
  for (const p of processes) {
    if (p.parentPid == null || !ids.has(p.parentPid)) continue

    const isCritical = p.threatLevel === "critical"
    const isWarning  = p.threatLevel === "warning"

    edges.push({
      id:       `e-${p.parentPid}-${p.pidNum}`,
      source:   `n${p.parentPid}`,
      target:   p.id,
      animated: isCritical,
      color:    isCritical
        ? "rgba(239,68,68,0.80)"
        : isWarning
        ? "rgba(250,204,21,0.55)"
        : "rgba(34,211,238,0.65)",
      dashed: isWarning || undefined,
    })
  }

  return { nodes, edges }
}
