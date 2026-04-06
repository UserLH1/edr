import { useState, useMemo } from "react"
import {
  Wifi,
  Search,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Globe,
  Shield,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { useNetworkConnections } from "@/hooks/use-network-connections"
import { useProcessGraph } from "@/hooks/use-process-graph"
import { ExportButton } from "@/components/edr/export-button"
import type { ConnectionInfo, ProcessInfo } from "@/lib/ipc"

// ── Known suspicious remote ports (common C2 / reverse-shell defaults) ────────
const SUSPICIOUS_PORTS = new Set([
  4444, 4445, 4446, 1234, 1337, 31337, 6666, 6667,
  9999, 5555, 8888, 2222, 7777,
])

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return ""
  return String.fromCodePoint(
    code.charCodeAt(0) + 0x1f1e6 - 65,
    code.charCodeAt(1) + 0x1f1e6 - 65,
  )
}

function remotePort(addr: string): number {
  return parseInt(addr.split(":").pop() ?? "0") || 0
}

function isPrivateIP(addr: string): boolean {
  const ip = addr.split(":")[0]
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.") ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "0.0.0.0" ||
    ip === "::"
  )
}

// ── Enriched row type (ConnectionInfo + resolved process data) ─────────────────

interface EnrichedConn extends ConnectionInfo {
  processName: string
  threatLevel: "safe" | "warning" | "critical" | "unknown"
  threatScore: number
  /** True if the remote port or process independently flags this socket */
  flagged: boolean
}

function enrich(conn: ConnectionInfo, procMap: Map<number, ProcessInfo>): EnrichedConn {
  const proc = procMap.get(conn.pid)
  const threatLevel = (proc?.threatLevel ?? "unknown") as EnrichedConn["threatLevel"]
  const port = remotePort(conn.remoteAddr)
  const suspiciousPort = SUSPICIOUS_PORTS.has(port)
  const publicRemote = conn.proto === "TCP" && conn.state === "ESTABLISHED" && !isPrivateIP(conn.remoteAddr)

  // Escalate flag if the owning process is bad OR the remote port is suspicious
  const flagged =
    threatLevel === "critical" ||
    threatLevel === "warning" ||
    suspiciousPort ||
    (publicRemote && (proc?.processName ?? "").toLowerCase().includes("powershell")) ||
    (publicRemote && (proc?.processName ?? "").toLowerCase().includes("cmd"))

  return {
    ...conn,
    processName: proc?.processName ?? `PID ${conn.pid}`,
    threatLevel,
    threatScore: proc?.threatScore ?? 0,
    flagged,
  }
}

// ── Sorting ────────────────────────────────────────────────────────────────────

type SortKey = "state" | "proto" | "localAddr" | "remoteAddr" | "processName" | "threat"
type SortDir = "asc" | "desc"

function sortRows(rows: EnrichedConn[], key: SortKey, dir: SortDir): EnrichedConn[] {
  const sign = dir === "asc" ? 1 : -1
  const threatOrder: Record<string, number> = { critical: 0, warning: 1, unknown: 2, safe: 3 }
  return [...rows].sort((a, b) => {
    let cmp = 0
    if (key === "threat") {
      cmp = (threatOrder[a.threatLevel] ?? 4) - (threatOrder[b.threatLevel] ?? 4)
    } else if (key === "state") {
      // ESTABLISHED first, then LISTEN, then others
      const stateOrder = (s: string) =>
        s === "ESTABLISHED" ? 0 : s === "LISTEN" ? 1 : 2
      cmp = stateOrder(a.state) - stateOrder(b.state)
    } else {
      cmp = a[key].localeCompare(b[key])
    }
    return cmp * sign
  })
}

// ── State badge ────────────────────────────────────────────────────────────────

function StateBadge({ state }: { state: string }) {
  const isEstab = state === "ESTABLISHED"
  const isListen = state === "LISTEN"
  return (
    <span
      className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0"
      style={{
        background: isEstab
          ? "rgba(239,68,68,0.15)"
          : isListen
          ? "rgba(234,179,8,0.10)"
          : "rgba(113,113,122,0.15)",
        color: isEstab
          ? "rgb(248,113,113)"
          : isListen
          ? "rgb(250,204,21)"
          : "rgb(161,161,170)",
      }}
    >
      {state}
    </span>
  )
}

// ── Sort header cell ───────────────────────────────────────────────────────────

function SortTh({
  label,
  sortKey,
  current,
  dir,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
  className?: string
}) {
  const active = current === sortKey
  return (
    <th
      className={cn(
        "px-3 py-1.5 text-[9px] font-mono font-semibold uppercase tracking-wider select-none cursor-pointer whitespace-nowrap",
        active ? "text-cyan-400" : "text-zinc-600 hover:text-zinc-400",
        className
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (
          dir === "asc" ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />
        ) : (
          <ChevronsUpDown className="w-2.5 h-2.5 opacity-30" />
        )}
      </span>
    </th>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

type ProtoFilter = "ALL" | "TCP" | "UDP"
type StateFilter = "ALL" | "ESTABLISHED" | "LISTEN"

export function NetworkConnectionsView() {
  const { connections, loading, lastUpdated } = useNetworkConnections(5000)
  const { processes } = useProcessGraph()

  const [query, setQuery] = useState("")
  const [protoFilter, setProtoFilter] = useState<ProtoFilter>("ALL")
  const [stateFilter, setStateFilter] = useState<StateFilter>("ALL")
  const [sortKey, setSortKey] = useState<SortKey>("threat")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false)

  // Build PID → ProcessInfo map
  const procMap = useMemo(
    () => new Map(processes.map(p => [p.pidNum, p])),
    [processes]
  )

  // Enrich all connections
  const enriched = useMemo(
    () => connections.map(c => enrich(c, procMap)),
    [connections, procMap]
  )

  // Apply filters
  const filtered = useMemo(() => {
    let rows = enriched

    if (protoFilter !== "ALL") rows = rows.filter(r => r.proto === protoFilter)
    if (stateFilter !== "ALL") rows = rows.filter(r => r.state === stateFilter)
    if (showFlaggedOnly) rows = rows.filter(r => r.flagged)

    if (query) {
      const q = query.toLowerCase()
      rows = rows.filter(
        r =>
          r.localAddr.includes(q) ||
          r.remoteAddr.includes(q) ||
          r.processName.toLowerCase().includes(q) ||
          String(r.pid).includes(q) ||
          r.state.toLowerCase().includes(q) ||
          r.domainName.toLowerCase().includes(q) ||
          r.asnOrg.toLowerCase().includes(q) ||
          r.countryCode.toLowerCase().includes(q)
      )
    }

    return sortRows(rows, sortKey, sortDir)
  }, [enriched, protoFilter, stateFilter, showFlaggedOnly, query, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const totalEstab   = enriched.filter(r => r.state === "ESTABLISHED").length
  const totalListen  = enriched.filter(r => r.state === "LISTEN").length
  const totalFlagged = enriched.filter(r => r.flagged).length

  const clockStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-US", { hour12: false })
    : "—"

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-zinc-950 bg-grid-pattern">

      {/* ── Header bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/50 bg-zinc-900/60 backdrop-blur-sm shrink-0 flex-wrap gap-y-2">
        <Wifi className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
        <span className="font-mono text-xs font-semibold text-zinc-300 tracking-widest uppercase">
          Network Connections
        </span>
        {loading && <RefreshCw className="w-3 h-3 text-zinc-600 animate-spin" />}

        {/* Protocol filter */}
        <div className="flex gap-0.5 ml-2">
          {(["ALL", "TCP", "UDP"] as ProtoFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setProtoFilter(f)}
              className={cn(
                "px-2 py-0.5 text-[10px] font-mono rounded border transition-colors",
                protoFilter === f
                  ? "bg-cyan-950/60 border-cyan-700/50 text-cyan-400"
                  : "bg-zinc-900/60 border-zinc-700/40 text-zinc-500 hover:text-zinc-300"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* State filter */}
        <div className="flex gap-0.5">
          {(["ALL", "ESTABLISHED", "LISTEN"] as StateFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setStateFilter(f)}
              className={cn(
                "px-2 py-0.5 text-[10px] font-mono rounded border transition-colors",
                stateFilter === f
                  ? "bg-cyan-950/60 border-cyan-700/50 text-cyan-400"
                  : "bg-zinc-900/60 border-zinc-700/40 text-zinc-500 hover:text-zinc-300"
              )}
            >
              {f === "ALL" ? "ALL STATES" : f}
            </button>
          ))}
        </div>

        {/* Flagged-only toggle */}
        <button
          onClick={() => setShowFlaggedOnly(v => !v)}
          className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono rounded border transition-colors",
            showFlaggedOnly
              ? "bg-red-950/40 border-red-700/50 text-red-400"
              : "bg-zinc-900/60 border-zinc-700/40 text-zinc-500 hover:text-zinc-300"
          )}
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          Flagged only
        </button>

        {/* Search */}
        <div className="relative ml-auto w-60">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter by addr, process, PID…"
            className="h-7 pl-7 text-[11px] font-mono bg-zinc-900/80 border-zinc-700/50 text-zinc-300 placeholder:text-zinc-600 focus-visible:ring-cyan-500/30 focus-visible:border-cyan-700/50"
          />
        </div>

        <ExportButton
          data={filtered.map(r => ({
            proto: r.proto, localAddr: r.localAddr, remoteAddr: r.remoteAddr,
            domain: r.domainName || "", country: r.countryCode || "", asn: r.asnOrg || "",
            state: r.state, pid: r.pid, process: r.processName,
            threat: r.threatLevel, threatScore: r.threatScore, flagged: r.flagged,
          }))}
          filename="network_connections"
          label="Export"
        />

        {/* Last-updated clock */}
        <span className="font-mono text-[10px] text-zinc-600 shrink-0">
          {clockStr}
        </span>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm">
            <tr className="border-b border-zinc-800/60">
              <SortTh label="Proto"   sortKey="proto"       current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="Local"   sortKey="localAddr"   current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="Remote"  sortKey="remoteAddr"  current={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="px-3 py-1.5 text-[9px] font-mono font-semibold uppercase tracking-wider text-zinc-600 whitespace-nowrap">
                Host / ASN
              </th>
              <SortTh label="State"   sortKey="state"       current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="Process" sortKey="processName" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="Threat"  sortKey="threat"      current={sortKey} dir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-zinc-600 text-xs font-mono">
                  {connections.length === 0
                    ? "No data — open the Tauri native window, not the browser tab."
                    : "No connections match the current filters."}
                </td>
              </tr>
            )}
            {filtered.map((row, i) => {
              const isCrit    = row.threatLevel === "critical"
              const isWarn    = row.threatLevel === "warning"
              const portFlag  = SUSPICIOUS_PORTS.has(remotePort(row.remoteAddr))
              const publicConn = row.state === "ESTABLISHED" && !isPrivateIP(row.remoteAddr)

              return (
                <tr
                  key={i}
                  className={cn(
                    "border-b border-zinc-800/40 hover:bg-zinc-800/20 transition-colors",
                    isCrit ? "bg-red-950/15 border-l-2 border-l-red-600/70" :
                    isWarn ? "bg-yellow-950/10" :
                    portFlag ? "bg-orange-950/10" : ""
                  )}
                >
                  {/* Protocol */}
                  <td className="px-3 py-1.5 font-mono text-[11px]">
                    <span
                      className={cn(
                        "font-bold",
                        row.proto === "TCP" ? "text-cyan-500" : "text-violet-400"
                      )}
                    >
                      {row.proto}
                    </span>
                  </td>

                  {/* Local addr */}
                  <td className="px-3 py-1.5 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                    {row.localAddr}
                  </td>

                  {/* Remote addr — highlight suspicious / public */}
                  <td className="px-3 py-1.5 font-mono text-[11px] whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      {publicConn && (
                        <Globe className="w-2.5 h-2.5 text-zinc-600 shrink-0" />
                      )}
                      <span
                        className={cn(
                          portFlag
                            ? "text-red-400 font-semibold"
                            : publicConn
                            ? "text-orange-300/90"
                            : "text-zinc-400"
                        )}
                      >
                        {row.remoteAddr}
                      </span>
                      {portFlag && (
                        <span className="text-[8px] px-1 py-0.5 rounded bg-red-950/50 border border-red-800/50 text-red-400 font-mono">
                          C2 PORT
                        </span>
                      )}
                    </span>
                  </td>

                  {/* Host / ASN (GeoIP enrichment) */}
                  <td className="px-3 py-1.5 font-mono text-[11px] max-w-[180px]">
                    {row.countryCode || row.domainName || row.asnOrg ? (
                      <div className="flex flex-col gap-0.5">
                        {(row.countryCode || row.domainName) && (
                          <span className="flex items-center gap-1 text-zinc-300 truncate">
                            {row.countryCode && (
                              <span className="text-[14px] leading-none shrink-0">
                                {countryFlag(row.countryCode)}
                              </span>
                            )}
                            <span className="truncate text-[10px] text-zinc-400">
                              {row.domainName || row.remoteAddr.split(":")[0]}
                            </span>
                          </span>
                        )}
                        {row.asnOrg && (
                          <span className="text-[9px] text-zinc-600 truncate">
                            {row.asnOrg}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-700">—</span>
                    )}
                  </td>

                  {/* State */}
                  <td className="px-3 py-1.5">
                    <StateBadge state={row.state} />
                  </td>

                  {/* Process name + PID */}
                  <td className="px-3 py-1.5 font-mono text-[11px] whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {isCrit && <AlertTriangle className="w-2.5 h-2.5 text-red-500 shrink-0" />}
                      {isWarn && <AlertTriangle className="w-2.5 h-2.5 text-yellow-400 shrink-0" />}
                      {!isCrit && !isWarn && <Shield className="w-2.5 h-2.5 text-zinc-700 shrink-0" />}
                      <span
                        className={cn(
                          "font-semibold",
                          isCrit ? "text-red-400" :
                          isWarn ? "text-yellow-400" :
                          "text-zinc-200"
                        )}
                      >
                        {row.processName}
                      </span>
                      <span className="text-zinc-600 text-[10px]">({row.pid})</span>
                    </div>
                  </td>

                  {/* Threat score */}
                  <td className="px-3 py-1.5 font-mono text-[10px]">
                    {row.threatLevel === "unknown" ? (
                      <span className="text-zinc-700">—</span>
                    ) : (
                      <span
                        className={cn(
                          isCrit ? "text-red-400" :
                          isWarn ? "text-yellow-400" :
                          portFlag ? "text-orange-400" :
                          "text-green-700"
                        )}
                      >
                        {row.threatScore}/100
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer stats ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-t border-zinc-800/50 bg-zinc-900/40 shrink-0 flex-wrap">
        <span className="text-[10px] font-mono text-zinc-600">
          {filtered.length} / {enriched.length} connections
        </span>
        <span className="text-[10px] font-mono text-zinc-500">
          {totalEstab} established
        </span>
        <span className="text-[10px] font-mono text-zinc-600">
          {totalListen} listening
        </span>
        {totalFlagged > 0 && (
          <span className="text-[10px] font-mono text-red-500 font-semibold">
            ⚠ {totalFlagged} flagged
          </span>
        )}
        <span className="ml-auto text-[10px] font-mono text-zinc-700">
          refresh 5s
        </span>
      </div>
    </div>
  )
}
