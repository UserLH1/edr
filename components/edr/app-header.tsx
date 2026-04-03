import { useState } from "react"
import { Search, ShieldAlert, ShieldOff, Cpu, MemoryStick, HardDrive, Loader2, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useSystemMetrics } from "@/hooks/use-system-metrics"
import { ipc } from "@/lib/ipc"

export function AppHeader() {
  const metrics = useSystemMetrics(2000)

  const cpu = metrics ? `${metrics.cpuPercent.toFixed(1)}%` : "—"
  const ram = metrics ? `${metrics.ramUsedGb.toFixed(1)}GB` : "—"
  const io  = metrics
    ? `${(metrics.diskReadMbS + metrics.diskWriteMbS).toFixed(1)}MB/s`
    : "—"

  // ── PANIC / Isolate Host ───────────────────────────────────────────────────
  const [isolated,      setIsolated]      = useState(false)
  const [panicPending,  setPanicPending]  = useState(false)
  const [showConfirm,   setShowConfirm]   = useState(false)
  const [panicError,    setPanicError]    = useState<string | null>(null)

  async function confirmIsolate() {
    setShowConfirm(false)
    setPanicPending(true)
    setPanicError(null)
    try {
      await ipc.isolateHost()
      setIsolated(true)
    } catch (err: unknown) {
      setPanicError(err instanceof Error ? err.message : String(err))
    } finally {
      setPanicPending(false)
    }
  }

  async function handleUnIsolate() {
    setPanicPending(true)
    setPanicError(null)
    try {
      await ipc.unIsolateHost()
      setIsolated(false)
    } catch (err: unknown) {
      setPanicError(err instanceof Error ? err.message : String(err))
    } finally {
      setPanicPending(false)
    }
  }

  return (
    <>
      <header className="h-12 flex items-center justify-between px-4 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm shrink-0 z-50">
        {/* Left: Logo */}
        <div className="flex items-center gap-2 min-w-[200px]">
          <span className="font-mono text-sm font-bold tracking-widest text-cyan-400 select-none">
            NEXUS<span className="text-zinc-600">::</span>EDR
          </span>
          <span
            className={`pulse-dot inline-block w-1.5 h-1.5 rounded-full shrink-0 ${isolated ? "bg-red-500 animate-pulse" : "bg-emerald-400"}`}
            aria-label={isolated ? "Host isolated" : "System online"}
          />
          {isolated && (
            <span className="text-[9px] font-mono font-bold text-red-400 tracking-widest animate-pulse">
              ISOLATED
            </span>
          )}
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
              <span className="text-zinc-500">⌘</span><span>K</span>
            </kbd>
          </div>
        </div>

        {/* Right: Telemetry + PANIC */}
        <div className="flex items-center gap-2 min-w-[200px] justify-end">
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="font-mono text-[10px] h-5 px-1.5 border-zinc-700/60 bg-zinc-900/50 text-zinc-400 gap-1"
              aria-label={`CPU: ${cpu}`}
            >
              <Cpu className="w-2.5 h-2.5 text-cyan-500/70" />
              CPU: {cpu}
            </Badge>
            <Badge
              variant="outline"
              className="font-mono text-[10px] h-5 px-1.5 border-zinc-700/60 bg-zinc-900/50 text-zinc-400 gap-1"
              aria-label={`RAM: ${ram}`}
            >
              <MemoryStick className="w-2.5 h-2.5 text-cyan-500/70" />
              RAM: {ram}
            </Badge>
            <Badge
              variant="outline"
              className={`font-mono text-[10px] h-5 px-1.5 border-zinc-700/60 bg-zinc-900/50 gap-1 ${
                parseFloat(io) > 50 ? "text-orange-400" : "text-zinc-400"
              }`}
              aria-label={`Disk I/O: ${io}`}
            >
              <HardDrive className="w-2.5 h-2.5 text-cyan-500/70" />
              I/O: {io}
            </Badge>
          </div>

          {/* PANIC / UN-ISOLATE button */}
          {isolated ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[10px] font-mono font-bold tracking-widest text-red-400 border-red-700/60 bg-red-950/40 hover:bg-red-900/50 gap-1.5 uppercase animate-pulse"
              onClick={handleUnIsolate}
              disabled={panicPending}
              aria-label="Remove host isolation"
            >
              {panicPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldOff className="w-3 h-3" />}
              UN-ISOLATE
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 px-2.5 text-[10px] font-mono font-bold tracking-widest bg-red-700 hover:bg-red-600 text-white border border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.3)] gap-1.5 uppercase"
              onClick={() => setShowConfirm(true)}
              disabled={panicPending}
              aria-label="Emergency: Isolate host"
            >
              {panicPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldAlert className="w-3 h-3" />}
              PANIC: ISOLATE HOST
            </Button>
          )}
        </div>

        {/* Error toast inline */}
        {panicError && (
          <div className="absolute top-12 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded bg-red-950/90 border border-red-700/60 text-red-400 text-[11px] font-mono shadow-xl">
            <AlertTriangle size={11} />
            {panicError}
          </div>
        )}
      </header>

      {/* ── Isolate Confirmation Dialog ────────────────────────────────────── */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-zinc-950 border-red-800/60 text-zinc-100 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono text-red-400 flex items-center gap-2">
              <ShieldAlert size={16} />
              ISOLATE HOST?
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-sm font-mono leading-relaxed">
              This will <span className="text-red-400 font-semibold">block ALL inbound and outbound network traffic</span> via the OS firewall.
              <br /><br />
              The NexusEDR application will remain functional. You can un-isolate at any time using the button in the header.
              <br /><br />
              <span className="text-yellow-400">⚠ Requires Administrator / root privileges.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 font-mono"
              onClick={() => setShowConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="bg-red-700 hover:bg-red-600 font-mono font-bold tracking-wide"
              onClick={confirmIsolate}
            >
              <ShieldAlert size={12} className="mr-1.5" />
              CONFIRM ISOLATION
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
