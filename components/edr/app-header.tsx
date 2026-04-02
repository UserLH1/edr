import { Search, ShieldAlert, Cpu, MemoryStick, HardDrive } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useSystemMetrics } from "@/hooks/use-system-metrics"

export function AppHeader() {
  const metrics = useSystemMetrics(2000)

  // Format helpers — show "—" while the first Rust response is in flight
  const cpu  = metrics ? `${metrics.cpuPercent.toFixed(1)}%` : "—"
  const ram  = metrics ? `${metrics.ramUsedGb.toFixed(1)}GB` : "—"
  // I/O rate wired properly in Phase 2 (background worker); show placeholder until then
  const io   = metrics ? `${(metrics.diskReadMbS + metrics.diskWriteMbS).toFixed(1)}MB/s` : "—"

  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm shrink-0 z-50">
      {/* Left: Logo */}
      <div className="flex items-center gap-2 min-w-[200px]">
        <span className="font-mono text-sm font-bold tracking-widest text-cyan-400 select-none">
          NEXUS<span className="text-zinc-600">::</span>EDR
        </span>
        <span
          className="pulse-dot inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"
          aria-label="System online"
        />
      </div>

      {/* Center: Command Palette */}
      <div className="flex-1 max-w-2xl mx-6">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search processes, IPs, or run BPF queries..."
            className="w-full h-8 pl-9 pr-16 bg-zinc-900/60 border border-zinc-700/50 rounded text-xs font-mono text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-700/60 focus:ring-1 focus:ring-cyan-700/30 transition-all"
            aria-label="Command palette search"
          />
          <kbd className="absolute right-2.5 flex items-center gap-0.5 text-[10px] font-mono text-zinc-600 select-none pointer-events-none">
            <span className="text-zinc-500">⌘</span>
            <span>K</span>
          </kbd>
        </div>
      </div>

      {/* Right: Telemetry + Panic */}
      <div className="flex items-center gap-2 min-w-[200px] justify-end">
        {/* Live telemetry badges — data sourced from Rust via useSystemMetrics */}
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className="font-mono text-[10px] h-5 px-1.5 border-zinc-700/60 bg-zinc-900/50 text-zinc-400 gap-1"
            aria-label={`CPU usage: ${cpu}`}
          >
            <Cpu className="w-2.5 h-2.5 text-cyan-500/70" />
            CPU: {cpu}
          </Badge>
          <Badge
            variant="outline"
            className="font-mono text-[10px] h-5 px-1.5 border-zinc-700/60 bg-zinc-900/50 text-zinc-400 gap-1"
            aria-label={`RAM used: ${ram}`}
          >
            <MemoryStick className="w-2.5 h-2.5 text-cyan-500/70" />
            RAM: {ram}
          </Badge>
          <Badge
            variant="outline"
            className="font-mono text-[10px] h-5 px-1.5 border-zinc-700/60 bg-zinc-900/50 text-zinc-400 gap-1"
            aria-label={`Disk I/O: ${io}`}
          >
            <HardDrive className="w-2.5 h-2.5 text-cyan-500/70" />
            I/O: {io}
          </Badge>
        </div>

        {/* Panic Button — isolate_host command wired in Phase 4 */}
        <Button
          variant="destructive"
          size="sm"
          className="h-7 px-2.5 text-[10px] font-mono font-bold tracking-widest bg-red-700 hover:bg-red-600 text-white border border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.3)] gap-1.5 uppercase"
          aria-label="Emergency: Isolate host"
        >
          <ShieldAlert className="w-3 h-3" />
          PANIC: ISOLATE HOST
        </Button>
      </div>
    </header>
  )
}
