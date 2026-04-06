import { useState, useEffect, useCallback } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
  BackgroundVariant,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import "flag-icons/css/flag-icons.min.css"
import {
  Network, Globe2, AlertTriangle, Shield,
  X, Flame, Ban, Loader2, CheckCircle2, WifiOff,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useNetworkConnections } from "@/hooks/use-network-connections"
import { useProcessGraph } from "@/hooks/use-process-graph"
import { ipc, type ConnectionInfo, type ProcessInfo } from "@/lib/ipc"

// ── Constants ─────────────────────────────────────────────────────────────────

const SUSPICIOUS_PORTS = new Set([
  1337, 4444, 4445, 4446, 6666, 6667, 9999, 31337, 8888, 5555, 7777, 2222,
])

const NODE_W = 164   // used to centre the node on its radial coordinate
const NODE_H =  72

// ── Pure helpers ──────────────────────────────────────────────────────────────

function remotePort(addr: string): number {
  return parseInt(addr.split(":").pop() ?? "0") || 0
}

function isPrivate(addr: string): boolean {
  const ip = addr.split(":")[0]
  return (
    !ip || ip === "0.0.0.0" || ip === "::" || ip === "127.0.0.1" ||
    ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("172.")
  )
}

// ── Flag component ────────────────────────────────────────────────────────────
// Uses flag-icons CSS library (background-image SVG) — works in Windows
// WebView2 where flag emoji regional indicators render as "US" letter pairs.

function Flag({ code }: { code: string }) {
  if (!code || code.length !== 2)
    return <Globe2 className="w-[18px] h-[14px] shrink-0 text-zinc-500" />
  return (
    <span
      className={`fi fi-${code.toLowerCase()} shrink-0`}
      style={{ width: 20, height: 15, borderRadius: 2,
               display: "inline-block",
               boxShadow: "0 0 0 1px rgba(255,255,255,0.08)" }}
    />
  )
}

// ── Aggregated endpoint ───────────────────────────────────────────────────────

export interface RemoteEndpoint {
  id:          string
  ip:          string
  domain:      string
  countryCode: string
  asnOrg:      string
  ports:       number[]
  connCount:   number
  established: number
  flagged:     boolean
  threatLevel: "safe" | "warning" | "critical" | "unknown"
  selected:    boolean
  [key: string]: unknown
}

function buildEndpoints(
  connections: ConnectionInfo[],
  procMap:     Map<number, ProcessInfo>,
  selectedId:  string | null,
): RemoteEndpoint[] {
  const map = new Map<string, RemoteEndpoint>()

  for (const conn of connections) {
    if (conn.proto === "UDP" || conn.state !== "ESTABLISHED") continue
    if (isPrivate(conn.remoteAddr)) continue

    const ip = conn.remoteAddr.includes(":")
      ? conn.remoteAddr.split(":")[0]
      : conn.remoteAddr
    if (!ip || ip === "—") continue

    const port   = remotePort(conn.remoteAddr)
    const proc   = procMap.get(conn.pid)
    const threat = (proc?.threatLevel ?? "unknown") as RemoteEndpoint["threatLevel"]
    const flagged = SUSPICIOUS_PORTS.has(port) || threat === "critical" || threat === "warning"
    const id      = `rh-${ip}`

    const ex = map.get(ip)
    if (ex) {
      ex.connCount++; ex.established++
      if (!ex.ports.includes(port)) ex.ports.push(port)
      if (flagged) ex.flagged = true
      if (threat === "critical") ex.threatLevel = "critical"
      else if (threat === "warning" && ex.threatLevel !== "critical") ex.threatLevel = "warning"
      if (!ex.domain      && conn.domainName)  ex.domain      = conn.domainName
      if (!ex.asnOrg      && conn.asnOrg)      ex.asnOrg      = conn.asnOrg
      if (!ex.countryCode && conn.countryCode) ex.countryCode = conn.countryCode
    } else {
      map.set(ip, {
        id, ip,
        domain: conn.domainName, countryCode: conn.countryCode, asnOrg: conn.asnOrg,
        ports: [port], connCount: 1, established: 1,
        flagged, threatLevel: threat,
        selected: id === selectedId,
      })
    }
  }

  const list = [...map.values()]
  for (const ep of list) ep.selected = ep.id === selectedId

  return list.sort((a, b) => {
    const o: Record<string, number> = { critical: 0, warning: 1, unknown: 2, safe: 3 }
    return (o[a.threatLevel] ?? 4) - (o[b.threatLevel] ?? 4)
  })
}

// ── Radial layout  (1 / 2 / 3 rings) ─────────────────────────────────────────

function radialPos(n: number): { x: number; y: number }[] {
  if (n === 0) return []
  const mkRing = (count: number, R: number, offset = 0) =>
    Array.from({ length: count }, (_, i) => {
      const a = (2 * Math.PI * i) / count - Math.PI / 2 + offset
      return { x: Math.round(Math.cos(a) * R), y: Math.round(Math.sin(a) * R) }
    })

  if (n <= 7)  return mkRing(n, 420)
  if (n <= 14) {
    const a = Math.ceil(n / 2), b = n - a
    return [...mkRing(a, 390), ...mkRing(b, 700, Math.PI / b)]
  }
  // 3 rings
  const r1 = Math.ceil(n / 3), r2 = Math.ceil((n - r1) / 2), r3 = n - r1 - r2
  return [
    ...mkRing(r1, 370),
    ...mkRing(r2, 660, Math.PI / r2),
    ...mkRing(r3, 950, 0),
  ]
}

// ── Graph builders ────────────────────────────────────────────────────────────

type LocalData = { established: number; total: number; [key: string]: unknown }

function buildGraph(
  endpoints: RemoteEndpoint[],
  totalConns: number,
  prevPositions: Map<string, { x: number; y: number }>,
): { nodes: Node[]; edges: Edge[] } {
  const pos = radialPos(endpoints.length)
  const totalEstab = endpoints.reduce((s, e) => s + e.established, 0)

  const centerNode: Node = {
    id: "local-host",
    type: "localHost",
    position: prevPositions.get("local-host") ?? { x: -62, y: -50 },
    data: { established: totalEstab, total: totalConns } satisfies LocalData,
    draggable: true,
  }

  const remoteNodes: Node[] = endpoints.map((ep, i) => ({
    id:   ep.id,
    type: "remoteHost",
    position: prevPositions.get(ep.id) ?? {
      x: pos[i].x - NODE_W / 2,
      y: pos[i].y - NODE_H / 2,
    },
    data:      ep,
    draggable: true,
  }))

  const edges: Edge[] = endpoints.map(ep => {
    const isCrit  = ep.threatLevel === "critical"
    const isWarn  = ep.threatLevel === "warning" || ep.flagged
    return {
      id:       `e-${ep.id}`,
      source:   "local-host",
      target:   ep.id,
      type:     "smoothstep",
      animated: isCrit,
      style: isCrit  ? { stroke: "#ef4444", strokeWidth: 2.5 }
           : isWarn  ? { stroke: "#f97316", strokeWidth: 1.5, strokeDasharray: "6 3" }
           : { stroke: "#22d3ee", strokeWidth: 1, opacity: 0.4 },
    }
  })

  return { nodes: [centerNode, ...remoteNodes], edges }
}

// ── Custom node: local host ───────────────────────────────────────────────────

function LocalHostNode({ data }: NodeProps<Node<LocalData>>) {
  return (
    <div className="relative select-none" style={{ width: 124, height: 100 }}>
      {/* outer glow ring */}
      <div className="absolute -inset-3 rounded-full bg-cyan-500/10 blur-xl pointer-events-none" />
      <div className="absolute -inset-1 rounded-2xl border border-cyan-500/30 pointer-events-none" />

      <div className="relative w-full h-full rounded-2xl border-2 border-cyan-500/80
                      bg-gradient-to-b from-cyan-950 to-zinc-950
                      shadow-[0_0_32px_rgba(34,211,238,0.4)]
                      flex flex-col items-center justify-center gap-0.5">
        <Handle type="source" position={Position.Top}    className="!opacity-0 !w-0 !h-0" />
        <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0" />
        <Handle type="source" position={Position.Left}   className="!opacity-0 !w-0 !h-0" />
        <Handle type="source" position={Position.Right}  className="!opacity-0 !w-0 !h-0" />

        <Network className="w-6 h-6 text-cyan-400" />
        <span className="font-mono text-[9px] font-bold text-cyan-300 tracking-[0.18em] uppercase mt-0.5">
          This Host
        </span>
        <span className="font-mono text-[13px] font-black text-cyan-300 tabular-nums leading-none">
          {data.established}
        </span>
        <span className="font-mono text-[8px] text-cyan-700">active conns</span>
      </div>
    </div>
  )
}

// ── Custom node: remote host ──────────────────────────────────────────────────

function RemoteHostNode({ data }: NodeProps<Node<RemoteEndpoint>>) {
  const isCrit    = data.threatLevel === "critical"
  const isWarn    = data.threatLevel === "warning"
  const isFlagged = (data.flagged as boolean) && !isCrit && !isWarn
  const isEnriched = !!(data.domain || data.countryCode || data.asnOrg)
  const isSelected = data.selected as boolean

  const raw   = (data.domain || data.ip) as string
  const label = raw.length > 22 ? raw.slice(0, 20) + "…" : raw

  return (
    <div className="relative select-none cursor-pointer" style={{ width: NODE_W }}>

      {/* sonar ping — critical */}
      {isCrit && (
        <div className="absolute -inset-2 rounded-2xl border-2 border-red-500/40
                        animate-ping pointer-events-none" />
      )}

      {/* selection ring */}
      {isSelected && (
        <div className="absolute -inset-[5px] rounded-2xl border-2 border-white/60
                        shadow-[0_0_16px_rgba(255,255,255,0.25)] pointer-events-none" />
      )}

      {/* ambient glow blob */}
      <div className={cn(
        "absolute inset-0 rounded-2xl blur-xl opacity-[0.22] scale-110 pointer-events-none",
        isCrit         ? "bg-red-500"
        : isWarn || isFlagged ? "bg-orange-500"
        : isEnriched   ? "bg-emerald-500"
        : "bg-zinc-500"
      )} />

      {/* card */}
      <div className={cn(
        "relative rounded-2xl border-[1.5px] px-3 pt-2.5 pb-2",
        isCrit
          ? "border-red-500/90   bg-gradient-to-b from-red-950/95    to-zinc-950/95"
          : isWarn || isFlagged
          ? "border-orange-500/80 bg-gradient-to-b from-orange-950/90 to-zinc-950/95"
          : isEnriched
          ? "border-emerald-700/55 bg-zinc-950/95"
          : "border-zinc-700/40   bg-zinc-950/95"
      )}>
        <Handle type="target" position={Position.Top}    className="!opacity-0 !w-0 !h-0" />
        <Handle type="target" position={Position.Bottom} className="!opacity-0 !w-0 !h-0" />
        <Handle type="target" position={Position.Left}   className="!opacity-0 !w-0 !h-0" />
        <Handle type="target" position={Position.Right}  className="!opacity-0 !w-0 !h-0" />

        {/* row 1 — flag + label + threat icon */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Flag code={data.countryCode as string} />
          <span className={cn(
            "font-mono text-[10px] font-bold truncate flex-1 leading-snug",
            isCrit         ? "text-red-200"
            : isWarn || isFlagged ? "text-orange-200"
            : "text-zinc-100"
          )} title={raw}>
            {label}
          </span>
          {(isCrit || isWarn) && (
            <AlertTriangle className={cn(
              "w-3 h-3 shrink-0",
              isCrit ? "text-red-400" : "text-orange-400"
            )} />
          )}
        </div>

        {/* row 2 — ASN / raw IP */}
        <div className="font-mono text-[8px] text-zinc-500 truncate mt-0.5 leading-snug">
          {(data.asnOrg as string) || (data.domain ? (data.ip as string) : "")}
        </div>

        {/* row 3 — ports + count */}
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          {(data.ports as number[]).slice(0, 4).map(p => (
            <span key={p} className={cn(
              "text-[7px] font-mono px-[5px] py-px rounded border leading-tight",
              SUSPICIOUS_PORTS.has(p)
                ? "bg-red-950/80 border-red-700/60 text-red-400"
                : "bg-zinc-800/80 border-zinc-700/50 text-zinc-500"
            )}>:{p}</span>
          ))}
          {(data.ports as number[]).length > 4 && (
            <span className="text-[7px] font-mono text-zinc-600">
              +{(data.ports as number[]).length - 4}
            </span>
          )}
          <span className="ml-auto font-mono text-[7px] text-zinc-600 tabular-nums shrink-0">
            {data.connCount as number}×
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Node types registry ───────────────────────────────────────────────────────

const NODE_TYPES: NodeTypes = {
  localHost:  LocalHostNode  as NodeTypes["string"],
  remoteHost: RemoteHostNode as NodeTypes["string"],
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  ep, connections, procMap, blockedIps, onClose, onKill, onBlock,
}: {
  ep:          RemoteEndpoint
  connections: ConnectionInfo[]
  procMap:     Map<number, ProcessInfo>
  blockedIps:  Set<string>
  onClose:     () => void
  onKill:      (pid: number) => Promise<void>
  onBlock:     (ip: string)  => Promise<void>
}) {
  const [killingPids, setKillingPids] = useState<Set<number>>(new Set())
  const [killedPids,  setKilledPids]  = useState<Set<number>>(new Set())
  const [blockBusy,   setBlockBusy]   = useState(false)
  const [blockErr,    setBlockErr]    = useState<string | null>(null)

  const isBlocked = blockedIps.has(ep.ip as string)
  const isCrit    = ep.threatLevel === "critical"
  const isWarn    = ep.threatLevel === "warning"

  const conns = connections.filter(c => c.remoteAddr.split(":")[0] === ep.ip)

  async function kill(pid: number) {
    setKillingPids(p => new Set([...p, pid]))
    try   { await onKill(pid); setKilledPids(p => new Set([...p, pid])) }
    finally { setKillingPids(p => { const s = new Set(p); s.delete(pid); return s }) }
  }

  async function toggleBlock() {
    setBlockBusy(true); setBlockErr(null)
    try   { await onBlock(ep.ip as string) }
    catch (e) { setBlockErr(String(e)) }
    finally { setBlockBusy(false) }
  }

  return (
    <div className="w-[260px] shrink-0 flex flex-col border-l border-zinc-800/60 bg-zinc-950 overflow-hidden">

      {/* header */}
      <div className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 border-b border-zinc-800/60",
        isCrit ? "bg-red-950/40" : isWarn ? "bg-orange-950/35" : "bg-zinc-900/50"
      )}>
        <Flag code={ep.countryCode as string} />
        <div className="flex-1 min-w-0">
          <p className={cn(
            "font-mono text-[11px] font-bold truncate",
            isCrit ? "text-red-200" : isWarn ? "text-orange-200" : "text-zinc-100"
          )} title={(ep.domain || ep.ip) as string}>
            {ep.domain || ep.ip}
          </p>
          <p className="font-mono text-[8px] text-zinc-500 truncate">
            {ep.domain ? (ep.ip as string) : (ep.asnOrg as string) || "—"}
          </p>
        </div>
        <button onClick={onClose}
          className="p-1 rounded hover:bg-zinc-700/60 text-zinc-500 hover:text-zinc-200 transition-colors shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* metadata */}
      <div className="px-3 py-2 border-b border-zinc-800/50 space-y-0.5">
        {([
          ["Country", ep.countryCode],
          ["ASN",     ep.asnOrg],
          ["Ports",   (ep.ports as number[]).map(p => `:${p}`).join(" ")],
          ["Status",  isBlocked ? "BLOCKED" : isCrit ? "CRITICAL" : isWarn ? "WARNING" : "NORMAL"],
        ] as [string, unknown][]).filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <span className="text-[9px] font-mono text-zinc-600 shrink-0">{k}</span>
            <span className={cn(
              "text-[9px] font-mono truncate text-right",
              k === "Status"
                ? isBlocked ? "font-bold text-red-400"
                  : isCrit  ? "font-bold text-red-400"
                  : isWarn  ? "font-bold text-orange-400"
                  : "font-bold text-emerald-500"
                : "text-zinc-400"
            )}>{String(v)}</span>
          </div>
        ))}
      </div>

      {/* connections */}
      <div className="flex-1 overflow-y-auto">
        <p className="px-3 pt-2.5 pb-1 text-[9px] font-mono font-semibold text-zinc-600 uppercase tracking-wider">
          Connections ({conns.length})
        </p>

        {conns.length === 0 && (
          <p className="px-3 py-4 text-center text-[10px] font-mono text-zinc-600">
            No active connections
          </p>
        )}

        {conns.map((c, i) => {
          const proc    = procMap.get(c.pid)
          const name    = proc?.processName ?? `PID ${c.pid}`
          const killing = killingPids.has(c.pid)
          const killed  = killedPids.has(c.pid)
          const c2port  = SUSPICIOUS_PORTS.has(remotePort(c.remoteAddr))
          return (
            <div key={i} className={cn(
              "mx-2.5 mb-2 p-2 rounded-xl border",
              c2port ? "border-red-800/50 bg-red-950/20" : "border-zinc-800/50 bg-zinc-900/25"
            )}>
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className={cn("text-[8px] font-mono font-bold",
                  c.proto === "TCP" ? "text-cyan-500" : "text-violet-400")}>
                  {c.proto}
                </span>
                <span className="text-[9px] font-mono text-zinc-400 truncate">{c.remoteAddr}</span>
                {c2port && (
                  <span className="text-[7px] font-mono px-1 rounded bg-red-950/80
                                   border border-red-700/50 text-red-400">C2</span>
                )}
              </div>
              <div className="flex items-center gap-1 mb-1.5">
                <Flame className="w-2.5 h-2.5 text-zinc-600 shrink-0" />
                <span className="text-[10px] font-mono text-zinc-300 truncate">{name}</span>
                <span className="text-[8px] font-mono text-zinc-600 shrink-0">({c.pid})</span>
              </div>
              {killed
                ? <div className="flex items-center gap-1 text-[9px] font-mono text-emerald-500">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Killed
                  </div>
                : <button onClick={() => kill(c.pid)} disabled={killing}
                    className="flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded
                               border border-red-800/50 bg-red-950/30 text-red-400
                               hover:bg-red-900/50 disabled:opacity-40 transition-colors">
                    {killing
                      ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Killing…</>
                      : <><X className="w-2.5 h-2.5" /> Kill Process</>}
                  </button>
              }
            </div>
          )
        })}
      </div>

      {/* firewall actions */}
      <div className="px-3 py-3 border-t border-zinc-800/60 space-y-1.5">
        <p className="text-[9px] font-mono font-semibold text-zinc-600 uppercase tracking-wider">
          Firewall
        </p>
        {blockErr && (
          <p className="text-[9px] font-mono text-red-400 bg-red-950/30 border border-red-800/40
                        rounded px-2 py-1 break-all">{blockErr}</p>
        )}
        <button onClick={toggleBlock} disabled={blockBusy}
          className={cn(
            "w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-mono",
            "font-semibold rounded-xl border transition-colors disabled:opacity-50",
            isBlocked
              ? "border-emerald-700/60 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-900/40"
              : "border-orange-700/60 bg-orange-950/30 text-orange-400 hover:bg-orange-900/40"
          )}>
          {blockBusy
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Processing…</>
            : isBlocked
            ? <><WifiOff className="w-3 h-3" /> Unblock {ep.ip}</>
            : <><Ban className="w-3 h-3" /> Block {ep.ip}</>}
        </button>
        <p className="text-[8px] font-mono text-zinc-700 text-center">Requires Administrator</p>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function NetworkGraphView() {
  const { connections, loading } = useNetworkConnections(5000)
  const { processes }            = useProcessGraph()

  // ── React Flow state — the correct way to use @xyflow/react
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [blockedIps, setBlockedIps] = useState<Set<string>>(new Set())

  const procMap = useCallback(
    () => new Map(processes.map(p => [p.pidNum, p])),
    [processes]
  )()

  // Recompute endpoints whenever live data or selection changes
  const endpoints = buildEndpoints(connections, procMap, selectedId)

  // ── Sync graph — preserve user-dragged positions
  useEffect(() => {
    setNodes(prev => {
      const pos = new Map(prev.map(n => [n.id, n.position]))
      return buildGraph(endpoints, connections.length, pos).nodes
    })
    setEdges(buildGraph(endpoints, connections.length, new Map()).edges)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, processes, selectedId])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedId(prev =>
      node.type === "remoteHost" ? (prev === node.id ? null : node.id) : null
    )
  }, [])

  const onPaneClick = useCallback(() => setSelectedId(null), [])

  const selectedEp = endpoints.find(e => e.id === selectedId) ?? null

  async function handleKill(pid: number) { await ipc.killProcess(pid) }

  async function handleBlock(ip: string) {
    if (blockedIps.has(ip)) {
      await ipc.unblockRemoteIp(ip)
      setBlockedIps(p => { const s = new Set(p); s.delete(ip); return s })
    } else {
      await ipc.blockRemoteIp(ip)
      setBlockedIps(p => new Set([...p, ip]))
    }
  }

  const critCount = endpoints.filter(e => e.threatLevel === "critical").length
  const flagCount = endpoints.filter(e => e.flagged).length

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-zinc-950">

      {/* header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/50
                      bg-zinc-900/60 backdrop-blur-sm shrink-0 flex-wrap">
        <Network className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
        <span className="font-mono text-xs font-semibold text-zinc-300 tracking-widest uppercase">
          Network Topology
        </span>
        {critCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded
                           bg-red-950/50 border border-red-700/40 text-[9px] font-mono font-bold text-red-400">
            <AlertTriangle className="w-2.5 h-2.5" /> {critCount} critical
          </span>
        )}
        {flagCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded
                           bg-orange-950/40 border border-orange-700/30 text-[9px] font-mono text-orange-400">
            <AlertTriangle className="w-2.5 h-2.5" /> {flagCount} flagged
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-zinc-600">
          {loading
            ? "Scanning…"
            : `${endpoints.length} remote hosts · ${connections.filter(c => c.state === "ESTABLISHED").length} established`}
        </span>
        <div className="flex items-center gap-3 pl-3 border-l border-zinc-800/60">
          {[["#22d3ee","Established"],["#f97316","Flagged"],["#ef4444","Critical"]].map(([c,l]) => (
            <div key={l} className="flex items-center gap-1">
              <div className="w-4 h-0.5 rounded" style={{ backgroundColor: c }} />
              <span className="font-mono text-[9px] text-zinc-500">{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* body */}
      <div className="flex flex-1 overflow-hidden">

        {/* empty state */}
        {!loading && endpoints.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <Shield className="w-10 h-10 text-zinc-700" />
            <p className="font-mono text-sm text-zinc-600">No active external connections</p>
            <p className="font-mono text-xs text-zinc-700">
              {connections.length === 0
                ? "Open the Tauri native window — not the browser tab."
                : "All established connections are on private addresses."}
            </p>
          </div>
        )}

        {/* React Flow canvas — w-full h-full required for proper sizing */}
        {(loading || endpoints.length > 0) && (
          <div className="flex-1 w-full h-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange as OnNodesChange}
              onEdgesChange={onEdgesChange as OnEdgesChange}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={NODE_TYPES}
              fitView
              fitViewOptions={{ padding: 0.14 }}
              minZoom={0.05}
              maxZoom={3}
              proOptions={{ hideAttribution: true }}
              className="bg-zinc-950"
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={30}
                size={1.2}
                color="#3f3f46"
              />
              <Controls
                showInteractive={false}
                className="[&>button]:!bg-zinc-900 [&>button]:!border-zinc-700/60
                           [&>button]:!text-zinc-400 [&>button:hover]:!bg-zinc-800
                           [&>button]:!shadow-none !border-zinc-700/50 !bg-zinc-900/80 !rounded-xl"
              />
              <MiniMap
                nodeColor={n => {
                  if (n.type === "localHost") return "#164e63"
                  const ep = n.data as RemoteEndpoint
                  if (ep.threatLevel === "critical")              return "#991b1b"
                  if (ep.threatLevel === "warning" || ep.flagged) return "#9a3412"
                  if (ep.domain || ep.countryCode)                return "#14532d"
                  return "#27272a"
                }}
                maskColor="rgba(9,9,11,0.82)"
                style={{ background: "rgba(24,24,27,0.9)", borderRadius: 8, border: "1px solid rgba(63,63,70,0.5)" }}
              />
            </ReactFlow>
          </div>
        )}

        {/* detail panel */}
        {selectedEp && (
          <DetailPanel
            ep={selectedEp}
            connections={connections}
            procMap={procMap}
            blockedIps={blockedIps}
            onClose={() => setSelectedId(null)}
            onKill={handleKill}
            onBlock={handleBlock}
          />
        )}
      </div>
    </div>
  )
}
