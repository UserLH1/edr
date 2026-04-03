import { useState, useEffect, useCallback } from "react"
import { X, ChevronRight, Skull, PauseCircle, Loader2, AlertTriangle, Copy, CheckCheck } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ipc, type ProcessInfo, type ConnectionInfo } from "@/lib/ipc"
import { isTauriRuntime } from "@/hooks/use-process-graph"

// ── ATT&CK tactic mapping ─────────────────────────────────────────────────────

function getMitreTactics(proc: ProcessInfo): string[] {
  const tactics: string[] = []
  const cmd  = proc.cmdline.toLowerCase()
  const name = proc.processName.toLowerCase()
  const exe  = proc.exePath.toLowerCase()

  if (cmd.includes("-enc") || cmd.includes("-encodedcommand"))   tactics.push("[T1059.001] Encoded PowerShell")
  if (cmd.includes("-windowstyle hidden") || cmd.includes("-w hidden")) tactics.push("[T1564.003] Hidden Window")
  if (cmd.includes("-noprofile") || cmd.includes("-nop "))        tactics.push("[T1059.001] PowerShell NoProfile")
  if (["certutil.exe","mshta.exe","wscript.exe","cscript.exe",
       "regsvr32.exe","rundll32.exe","bitsadmin.exe","msiexec.exe"].includes(name))
    tactics.push("[T1218] Signed Binary Proxy Execution")
  if (exe.includes("\\temp\\") || exe.includes("\\appdata\\"))   tactics.push("[T1036.005] Masquerading / Temp Path")
  if (name === "nc.exe" || name === "ncat.exe" || name === "netcat.exe") tactics.push("[T1059.004] Netcat / Reverse Shell")
  if (name.includes("mimikatz") || name.includes("mimi"))        tactics.push("[T1003] OS Credential Dumping")
  if (cmd.includes("downloadstring") || cmd.includes("webclient") || cmd.includes("curl")) tactics.push("[T1105] Ingress Tool Transfer")
  if (cmd.includes("invoke-expression") || cmd.includes("iex ")) tactics.push("[T1059.001] PowerShell IEX")

  return tactics
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatStarted(unixSecs: number): string {
  if (unixSecs === 0) return "—"
  return new Date(unixSecs * 1000).toLocaleString("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  })
}

function threatBadgeStyle(level: string): React.CSSProperties {
  if (level === "critical") return { background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.5)", color: "rgb(248,113,113)", boxShadow: "0 0 10px rgba(239,68,68,0.2)" }
  if (level === "warning")  return { background: "rgba(250,204,21,0.12)",  border: "1px solid rgba(250,204,21,0.4)",  color: "rgb(250,204,21)" }
  return { background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.35)", color: "rgb(74,222,128)" }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button onClick={copy} className="ml-1 text-zinc-600 hover:text-cyan-400 transition-colors" aria-label="Copy">
      {copied ? <CheckCheck size={10} className="text-emerald-400" /> : <Copy size={10} />}
    </button>
  )
}

function MetaRow({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <>
      <dt className="text-zinc-500 truncate">{label}</dt>
      <dd className={`font-mono truncate ${valueClass ?? "text-zinc-100"}`}>{value}</dd>
    </>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase mb-2">{children}</p>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProcessInspectorProps {
  process: ProcessInfo | null
  processes: ProcessInfo[]
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProcessInspector({ process: proc, processes, onClose }: ProcessInspectorProps) {
  const [connections,    setConnections]    = useState<ConnectionInfo[]>([])
  const [connsLoading,   setConnsLoading]   = useState(false)
  const [sha256,         setSha256]         = useState<string | null>(null)
  const [hashLoading,    setHashLoading]    = useState(false)
  const [killPending,    setKillPending]    = useState(false)
  const [suspendPending, setSuspendPending] = useState(false)
  const [actionError,    setActionError]    = useState<string | null>(null)

  // Fetch network connections when process changes
  useEffect(() => {
    if (!proc || !isTauriRuntime()) { setConnections([]); return }
    setConnsLoading(true)
    ipc.getNetworkConnections()
      .then(all => setConnections(all.filter(c => c.pid === proc.pidNum)))
      .catch(err => console.error("[NexusEDR] getNetworkConnections:", err))
      .finally(() => setConnsLoading(false))
  }, [proc?.pidNum])

  // Compute SHA-256 when exe path changes
  useEffect(() => {
    if (!proc?.exePath || !isTauriRuntime()) { setSha256(null); return }
    setSha256(null)
    setHashLoading(true)
    ipc.hashFile(proc.exePath)
      .then(hash => setSha256(hash))
      .catch(() => setSha256("error"))
      .finally(() => setHashLoading(false))
  }, [proc?.exePath])

  const handleKill = useCallback(async () => {
    if (!proc) return
    setKillPending(true); setActionError(null)
    try { await ipc.killProcess(proc.pidNum); onClose() }
    catch (err: unknown) { setActionError(err instanceof Error ? err.message : String(err)) }
    finally { setKillPending(false) }
  }, [proc, onClose])

  const handleSuspend = useCallback(async () => {
    if (!proc) return
    setSuspendPending(true); setActionError(null)
    try { await ipc.suspendThread(proc.pidNum) }
    catch (err: unknown) { setActionError(err instanceof Error ? err.message : String(err)) }
    finally { setSuspendPending(false) }
  }, [proc])

  function buildLineage(): ProcessInfo[] {
    if (!proc) return []
    const byPid = new Map(processes.map(p => [p.pidNum, p]))
    const chain: ProcessInfo[] = []
    let cur: ProcessInfo | undefined = proc
    for (let i = 0; i < 10 && cur; i++) {
      chain.unshift(cur)
      cur = cur.parentPid != null ? byPid.get(cur.parentPid) : undefined
    }
    return chain
  }

  const tactics = proc ? getMitreTactics(proc) : []
  const lineage  = buildLineage()

  return (
    <aside
      className="w-[380px] shrink-0 flex flex-col border-l border-zinc-800/50 bg-zinc-950/90 backdrop-blur-xl h-full"
      aria-label="Process inspector panel"
    >
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-0">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="px-4 pt-4 pb-3 border-b border-zinc-800/60">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[11px] text-zinc-500">
                {proc ? `Process ID: ${proc.pidNum}` : "No process selected"}
              </span>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors rounded p-0.5 hover:bg-zinc-800" aria-label="Close">
                <X size={14} />
              </button>
            </div>

            {proc ? (
              <>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="font-mono text-base font-semibold text-zinc-100 tracking-tight">{proc.processName}</span>
                  <span
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold tracking-widest"
                    style={threatBadgeStyle(proc.threatLevel)}
                  >
                    {proc.threatScore}/100 {proc.threatLevel.toUpperCase()}
                  </span>
                </div>

                {actionError && (
                  <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded bg-red-950/40 border border-red-800/50 text-red-400 text-[11px] font-mono">
                    <AlertTriangle size={11} className="shrink-0" /> {actionError}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs font-bold tracking-wide bg-red-600/90 hover:bg-red-600 text-white border border-red-500/60"
                    style={{ boxShadow: "0 0 14px rgba(239,68,68,0.3)" }}
                    onClick={handleKill}
                    disabled={killPending || suspendPending}
                  >
                    {killPending ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Skull size={12} className="mr-1.5" />}
                    KILL PROCESS
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="w-full h-8 text-xs tracking-wide border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                    onClick={handleSuspend}
                    disabled={killPending || suspendPending}
                  >
                    {suspendPending ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <PauseCircle size={12} className="mr-1.5" />}
                    Suspend Threads
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-zinc-600 font-mono">Click a node in the graph to inspect it.</p>
            )}
          </div>

          {/* ── Tabs ────────────────────────────────────────────────────── */}
          {proc && (
            <Tabs defaultValue="overview" className="flex-1 gap-0">
              <TabsList className="flex w-full rounded-none border-b border-zinc-800/60 bg-transparent h-8 gap-0 px-4 justify-start">
                {["overview", "network", "execution"].map((tab) => (
                  <TabsTrigger
                    key={tab} value={tab}
                    className="h-8 px-3 text-xs font-mono rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-500 data-[state=active]:text-cyan-400 data-[state=active]:bg-transparent data-[state=inactive]:text-zinc-500 bg-transparent"
                  >
                    {tab === "execution" ? "Lineage" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Overview */}
              <TabsContent value="overview" className="mt-0 p-4 flex flex-col gap-5">
                <div>
                  <SectionHeader>Process Metadata</SectionHeader>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs font-mono">
                    <MetaRow label="Path" value={proc.exePath || "—"} />
                    <MetaRow label="User" value={proc.user}
                      valueClass={proc.user.toLowerCase().includes("system") ? "text-red-400" : "text-zinc-100"} />
                    <MetaRow label="SHA-256" value={
                      hashLoading
                        ? <span className="text-zinc-600 flex items-center gap-1"><Loader2 size={9} className="animate-spin" />Computing…</span>
                        : sha256
                        ? <span className="flex items-center">{sha256.slice(0, 16)}…<CopyButton text={sha256} /></span>
                        : "—"
                    } />
                    <MetaRow label="Started"    value={formatStarted(proc.startedAt)} />
                    <MetaRow label="Parent PID" value={proc.parentPid != null ? String(proc.parentPid) : "—"} />
                    <MetaRow label="CPU"        value={`${proc.cpuPercent.toFixed(1)}%`} />
                    <MetaRow label="Memory"     value={`${proc.memMb.toFixed(1)} MB`}
                      valueClass={proc.memMb > 200 ? "text-orange-400" : "text-zinc-100"} />
                    {proc.threadCount > 0 && (
                      <MetaRow label="Threads" value={String(proc.threadCount)} />
                    )}
                  </dl>
                </div>

                {tactics.length > 0 && (
                  <>
                    <div className="border-t border-zinc-800/60" />
                    <div>
                      <SectionHeader>ATT&amp;CK Tactics</SectionHeader>
                      <div className="flex flex-wrap gap-1.5">
                        {tactics.map((tag) => (
                          <Badge key={tag} className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                            style={{ background: "rgba(220,38,38,0.1)", borderColor: "rgba(220,38,38,0.35)", color: "rgb(252,165,165)" }}>
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {proc.cmdline && (
                  <>
                    <div className="border-t border-zinc-800/60" />
                    <div>
                      <SectionHeader>Command Line</SectionHeader>
                      <pre className="font-mono text-[11px] text-yellow-300/90 bg-zinc-900/50 border border-yellow-800/30 rounded p-2.5 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                        {proc.cmdline}
                      </pre>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Network */}
              <TabsContent value="network" className="mt-0 p-4">
                <SectionHeader>Active Connections ({connections.length})</SectionHeader>
                {connsLoading ? (
                  <div className="flex items-center gap-2 text-zinc-500 text-xs font-mono py-4">
                    <Loader2 size={12} className="animate-spin" /> Loading…
                  </div>
                ) : connections.length === 0 ? (
                  <p className="text-zinc-600 text-xs font-mono py-4 text-center">No connections for PID {proc.pidNum}.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {connections.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded bg-zinc-900/60 border border-zinc-800/50 font-mono text-[11px]">
                        <span className="text-cyan-500 w-8 shrink-0">{c.proto}</span>
                        <span className="text-zinc-400 flex-1 truncate">{c.localAddr}</span>
                        <ChevronRight size={10} className="text-zinc-600 shrink-0" />
                        <span className="text-zinc-200 flex-1 truncate">{c.remoteAddr}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
                          style={{
                            background: c.state === "ESTABLISHED" ? "rgba(239,68,68,0.15)" : "rgba(234,179,8,0.1)",
                            color:      c.state === "ESTABLISHED" ? "rgb(248,113,113)"     : "rgb(250,204,21)",
                          }}>
                          {c.state}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Lineage */}
              <TabsContent value="execution" className="mt-0 p-4">
                <SectionHeader>Process Lineage</SectionHeader>
                <div className="flex flex-col gap-1 font-mono text-[11px]">
                  {lineage.map((p, idx) => {
                    const isCurrent = p.pidNum === proc.pidNum
                    const indent = "  ".repeat(idx)
                    const prefix = idx === 0 ? "" : "└── "
                    const color  = p.threatLevel === "critical" ? "text-red-400"
                      : p.threatLevel === "warning" ? "text-yellow-400" : "text-zinc-300"
                    return (
                      <div key={p.pidNum} className="flex items-baseline gap-1">
                        <span className="text-zinc-600 whitespace-pre">{indent + prefix}</span>
                        <span className={color}>{p.processName}</span>
                        <span className="text-zinc-600">({p.pidNum})</span>
                        {isCurrent && <span className="text-cyan-500 text-[9px] ml-1">◄ CURRENT</span>}
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 border-t border-zinc-800/60 pt-4">
                  <SectionHeader>Executable Path</SectionHeader>
                  <pre className="font-mono text-[11px] text-zinc-300 bg-zinc-900/50 border border-zinc-800/50 rounded p-2.5 whitespace-pre-wrap break-all">
                    {proc.exePath || "—"}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
