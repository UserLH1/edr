import { useState, useMemo } from "react"
import { HudQueryBar } from "@/components/edr/hud-query-bar"
import { GraphNodes } from "@/components/edr/graph-nodes"
import { ProcessInspector } from "@/components/edr/process-inspector"
import { TelemetryPanel } from "@/components/edr/telemetry-panel"
import { useProcessGraph } from "@/hooks/use-process-graph"
import type { ProcessInfo } from "@/lib/ipc"

/**
 * Parse a simple hunt query and return the subset of matching process IDs.
 * Supported patterns:
 *   process.name == "X"       — exact process name match
 *   threat == "X"             — threat level (safe|warning|critical)
 *   threat.level == "X"       — alias of above
 *   pid == 1234               — numeric PID
 *   anything else             — substring search across name, exe, cmdline, pid
 */
function matchingIds(query: string, processes: ProcessInfo[]): Set<string> | null {
  const q = query.trim()
  if (!q) return null

  // process.name == "X"
  const nameExact = q.match(/^process\.name\s*==\s*"([^"]+)"$/i)
  if (nameExact) {
    const target = nameExact[1].toLowerCase()
    return new Set(processes.filter(p => p.processName.toLowerCase() === target).map(p => p.id))
  }

  // threat == "X" or threat.level == "X"
  const threatExact = q.match(/^threat(?:\.level)?\s*==\s*"([^"]+)"$/i)
  if (threatExact) {
    const level = threatExact[1].toLowerCase()
    return new Set(processes.filter(p => p.threatLevel === level).map(p => p.id))
  }

  // pid == N
  const pidExact = q.match(/^pid\s*==\s*(\d+)$/i)
  if (pidExact) {
    const target = parseInt(pidExact[1])
    return new Set(processes.filter(p => p.pidNum === target).map(p => p.id))
  }

  // Substring search
  const lower = q.toLowerCase()
  return new Set(
    processes
      .filter(p =>
        p.processName.toLowerCase().includes(lower) ||
        p.exePath.toLowerCase().includes(lower) ||
        p.cmdline.toLowerCase().includes(lower) ||
        p.pid.includes(lower)
      )
      .map(p => p.id)
  )
}

export function MainCanvas() {
  // Single source of truth for live graph data — shared with ProcessInspector
  const { nodes, edges, processes } = useProcessGraph()

  const [selectedProcess, setSelectedProcess] = useState<ProcessInfo | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [query, setQuery] = useState("")

  // Filter nodes by active query; null = show all
  const filteredNodes = useMemo(() => {
    const ids = matchingIds(query, processes)
    if (!ids) return nodes
    return nodes.filter(n => ids.has(n.id))
  }, [nodes, processes, query])

  function handleNodeClick(nodeId: string) {
    const proc = processes.find(p => p.id === nodeId) ?? null
    setSelectedProcess(proc)
    setInspectorOpen(true)
  }

  function handleCloseInspector() {
    setInspectorOpen(false)
    setSelectedProcess(null)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Canvas row: graph + optional inspector */}
      <div className="flex flex-1 overflow-hidden">

        {/* Main canvas */}
        <main
          className="flex-1 relative bg-zinc-950 overflow-hidden"
          aria-label="Threat hunting canvas"
        >
          {/* Corner bracket accents */}
          <div className="absolute top-0 left-0 w-16 h-16 border-t border-l border-cyan-800/20 pointer-events-none z-20" aria-hidden="true" />
          <div className="absolute top-0 right-0 w-16 h-16 border-t border-r border-cyan-800/20 pointer-events-none z-20" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 w-16 h-16 border-b border-l border-cyan-800/20 pointer-events-none z-20" aria-hidden="true" />
          <div className="absolute bottom-0 right-0 w-16 h-16 border-b border-r border-cyan-800/20 pointer-events-none z-20" aria-hidden="true" />

          {/* HUD query bar — live counts + functional filter */}
          <HudQueryBar
            nodeCount={filteredNodes.length}
            edgeCount={edges.length}
            processes={processes}
            onQueryChange={setQuery}
          />

          {/* Process graph — receives live (possibly filtered) nodes/edges */}
          <GraphNodes
            liveNodes={filteredNodes}
            liveEdges={edges}
            onNodeClick={handleNodeClick}
          />
        </main>

        {/* Process inspector — slides in when any node is clicked */}
        {inspectorOpen && (
          <ProcessInspector
            process={selectedProcess}
            processes={processes}
            onClose={handleCloseInspector}
          />
        )}
      </div>

      {/* DVR telemetry panel */}
      <TelemetryPanel />
    </div>
  )
}
