import { useState } from "react"
import { HudQueryBar } from "@/components/edr/hud-query-bar"
import { GraphNodes } from "@/components/edr/graph-nodes"
import { ProcessInspector } from "@/components/edr/process-inspector"
import { TelemetryPanel } from "@/components/edr/telemetry-panel"
import { useProcessGraph } from "@/hooks/use-process-graph"
import type { ProcessInfo } from "@/lib/ipc"

export function MainCanvas() {
  // Single source of truth for live graph data — shared with ProcessInspector
  const { nodes, edges, processes } = useProcessGraph()

  const [selectedProcess, setSelectedProcess] = useState<ProcessInfo | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)

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

          {/* HUD query bar */}
          <HudQueryBar />

          {/* Process graph — receives live nodes/edges and reports node clicks */}
          <GraphNodes
            liveNodes={nodes}
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
