import { useState } from "react"
import type { ProcessInfo } from "@/lib/ipc"

interface HudQueryBarProps {
  nodeCount: number
  edgeCount: number
  processes: ProcessInfo[]
  onQueryChange: (query: string) => void
}

export function HudQueryBar({ nodeCount, edgeCount, processes, onQueryChange }: HudQueryBarProps) {
  const [draft, setDraft] = useState("")

  const suspicious = processes.filter(p => p.threatLevel === "warning").length
  const malicious  = processes.filter(p => p.threatLevel === "critical").length

  function runQuery() {
    onQueryChange(draft.trim())
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      runQuery()
    } else if (e.key === "Escape") {
      setDraft("")
      onQueryChange("")
    }
  }

  return (
    <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
      {/* Query input */}
      <div
        className="flex items-center gap-2 rounded border border-cyan-800/40 bg-zinc-900/70 backdrop-blur-md px-3 py-2"
        style={{ width: 480 }}
      >
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="pulse-dot inline-block w-1.5 h-1.5 rounded-full bg-green-400" aria-hidden="true" />
          <span className="font-mono text-[10px] text-green-400 tracking-widest uppercase">Live</span>
        </div>

        {/* Divider */}
        <div className="w-px h-3 bg-zinc-700 shrink-0" aria-hidden="true" />

        {/* Editable query */}
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='process.name == "powershell.exe" or threat == "critical"'
          spellCheck={false}
          aria-label="Threat hunt query — press Enter to run, Escape to clear"
          className="flex-1 bg-transparent font-mono text-[11px] text-cyan-300 placeholder:text-zinc-600 focus:outline-none min-w-0"
        />

        {/* Execute button */}
        <button
          type="button"
          onClick={runQuery}
          className="shrink-0 rounded border border-cyan-700/40 bg-cyan-900/30 px-2 py-0.5 font-mono text-[10px] text-cyan-400 hover:bg-cyan-800/40 hover:border-cyan-500/60 transition-colors"
        >
          RUN
        </button>
      </div>

      {/* Counter row */}
      <div className="flex items-center gap-3 px-1">
        <span className="font-mono text-[10px] text-zinc-500 tracking-wider">
          <span className="text-zinc-400">Nodes:</span> {nodeCount}
        </span>
        <span className="text-zinc-700 text-[10px]">|</span>
        <span className="font-mono text-[10px] text-zinc-500 tracking-wider">
          <span className="text-zinc-400">Edges:</span> {edgeCount}
        </span>
        <span className="text-zinc-700 text-[10px]">|</span>
        <span className="font-mono text-[10px] text-zinc-500 tracking-wider">
          <span className={suspicious > 0 ? "text-yellow-500/80" : "text-zinc-600"}>
            {suspicious} suspicious
          </span>
        </span>
        <span className="text-zinc-700 text-[10px]">|</span>
        <span className="font-mono text-[10px] text-zinc-500 tracking-wider">
          <span className={malicious > 0 ? "text-red-500/80" : "text-zinc-600"}>
            {malicious} malicious
          </span>
        </span>
      </div>
    </div>
  )
}
