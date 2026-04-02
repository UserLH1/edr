export function HudQueryBar() {
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
          defaultValue='process.name == "powershell.exe" && net.status == "ESTABLISHED"'
          spellCheck={false}
          aria-label="Threat hunt query"
          className="flex-1 bg-transparent font-mono text-[11px] text-cyan-300 placeholder:text-zinc-600 focus:outline-none min-w-0"
        />

        {/* Execute button */}
        <button
          type="button"
          className="shrink-0 rounded border border-cyan-700/40 bg-cyan-900/30 px-2 py-0.5 font-mono text-[10px] text-cyan-400 hover:bg-cyan-800/40 hover:border-cyan-500/60 transition-colors"
        >
          RUN
        </button>
      </div>

      {/* Counter row */}
      <div className="flex items-center gap-3 px-1">
        <span className="font-mono text-[10px] text-zinc-500 tracking-wider">
          <span className="text-zinc-400">Nodes:</span> 124
        </span>
        <span className="text-zinc-700 text-[10px]">|</span>
        <span className="font-mono text-[10px] text-zinc-500 tracking-wider">
          <span className="text-zinc-400">Edges:</span> 412
        </span>
        <span className="text-zinc-700 text-[10px]">|</span>
        <span className="font-mono text-[10px] text-zinc-500 tracking-wider">
          <span className="text-yellow-500/80">3 suspicious</span>
        </span>
        <span className="text-zinc-700 text-[10px]">|</span>
        <span className="font-mono text-[10px] text-zinc-500 tracking-wider">
          <span className="text-red-500/80">1 malicious</span>
        </span>
      </div>
    </div>
  )
}
