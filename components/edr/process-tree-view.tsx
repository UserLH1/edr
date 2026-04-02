import { useState, useMemo } from "react"
import {
  ChevronRight,
  ChevronDown,
  Terminal,
  Globe,
  Server,
  Cpu,
  Search,
  Filter,
  GitBranch,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useProcessGraph } from "@/hooks/use-process-graph"
import type { ProcessInfo } from "@/lib/ipc"

// ── Types ─────────────────────────────────────────────────────────────────────

type ThreatLevel = "clean" | "suspicious" | "malicious"

interface TreeNode {
  pid: number
  name: string
  user: string
  cpu: string
  mem: string
  threat: ThreatLevel
  cmdline: string
  icon: React.ElementType
  children: TreeNode[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toThreat(level: string): ThreatLevel {
  if (level === "critical") return "malicious"
  if (level === "warning") return "suspicious"
  return "clean"
}

function iconFor(iconType: string): React.ElementType {
  if (iconType === "terminal") return Terminal
  if (iconType === "globe") return Globe
  return Server
}

/**
 * Converts a flat ProcessInfo[] (from the Rust backend) into a list of root
 * TreeNodes with nested children, sorted critical → warning → safe at every level.
 */
function buildTree(processes: ProcessInfo[]): TreeNode[] {
  if (processes.length === 0) return []

  const pids = new Set(processes.map(p => p.pidNum))
  const nodeMap = new Map<number, TreeNode>()

  for (const p of processes) {
    nodeMap.set(p.pidNum, {
      pid: p.pidNum,
      name: p.processName,
      user: p.user || "—",
      cpu: `${p.cpuPercent.toFixed(1)}%`,
      mem: `${p.memMb.toFixed(1)} MB`,
      threat: toThreat(p.threatLevel),
      cmdline: p.cmdline || p.exePath,
      icon: iconFor(p.iconType),
      children: [],
    })
  }

  const roots: TreeNode[] = []
  for (const p of processes) {
    const node = nodeMap.get(p.pidNum)!
    if (p.parentPid != null && pids.has(p.parentPid)) {
      nodeMap.get(p.parentPid)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort children at every level: malicious first, then suspicious, then clean
  const threatOrder: Record<ThreatLevel, number> = { malicious: 0, suspicious: 1, clean: 2 }
  function sortTree(nodes: TreeNode[]): void {
    nodes.sort((a, b) => threatOrder[a.threat] - threatOrder[b.threat])
    nodes.forEach(n => sortTree(n.children))
  }
  sortTree(roots)

  return roots
}

// ── Styles ────────────────────────────────────────────────────────────────────

const threatStyles: Record<ThreatLevel, { badge: string; row: string; dot: string }> = {
  clean:      { badge: "bg-zinc-800 text-zinc-400 border-zinc-700",          row: "",                                              dot: "bg-zinc-600"  },
  suspicious: { badge: "bg-yellow-950/40 text-yellow-400 border-yellow-800", row: "bg-yellow-950/10",                              dot: "bg-yellow-400" },
  malicious:  { badge: "bg-red-950/40 text-red-400 border-red-800",          row: "bg-red-950/15 border-l-2 border-l-red-600",     dot: "bg-red-500"   },
}

// ── ProcessRow ────────────────────────────────────────────────────────────────

function ProcessRow({ node, depth, query }: { node: TreeNode; depth: number; query: string }) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children.length > 0
  const styles = threatStyles[node.threat]
  const Icon = node.icon

  const matchesQuery =
    !query ||
    node.name.toLowerCase().includes(query.toLowerCase()) ||
    node.cmdline.toLowerCase().includes(query.toLowerCase()) ||
    String(node.pid).includes(query) ||
    node.user.toLowerCase().includes(query.toLowerCase())

  // Always render malicious / suspicious rows even when query doesn't match,
  // so the tree structure stays intact and threats are never hidden.
  const alwaysVisible = node.threat !== "clean"
  if (!matchesQuery && !alwaysVisible && !hasChildren) return null

  return (
    <>
      <tr
        className={cn(
          "group border-b border-zinc-800/40 transition-colors cursor-pointer hover:bg-zinc-800/30",
          styles.row,
          !matchesQuery && "opacity-40"
        )}
        onClick={() => hasChildren && setOpen((o) => !o)}
      >
        {/* Expand / name */}
        <td className="py-1.5 pl-2 pr-1 whitespace-nowrap">
          <div
            className="flex items-center gap-1 font-mono text-xs"
            style={{ paddingLeft: `${depth * 16}px` }}
          >
            {hasChildren ? (
              open
                ? <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />
                : <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
            ) : (
              <span className="w-3 shrink-0" />
            )}
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", styles.dot)} />
            <Icon className="w-3 h-3 text-zinc-500 shrink-0" />
            <span
              className={cn(
                "font-semibold",
                node.threat === "malicious"
                  ? "text-red-400"
                  : node.threat === "suspicious"
                  ? "text-yellow-400"
                  : "text-zinc-200"
              )}
            >
              {node.name}
            </span>
          </div>
        </td>
        <td className="py-1.5 px-2 text-[10px] font-mono text-zinc-500">{node.pid}</td>
        <td className="py-1.5 px-2 text-[10px] font-mono text-zinc-500 hidden md:table-cell truncate max-w-[100px]">
          {node.user}
        </td>
        <td className="py-1.5 px-2 text-[10px] font-mono text-zinc-500 hidden lg:table-cell">{node.cpu}</td>
        <td className="py-1.5 px-2 text-[10px] font-mono text-zinc-500 hidden lg:table-cell">{node.mem}</td>
        <td className="py-1.5 px-2">
          {node.threat !== "clean" && (
            <Badge
              className={cn(
                "text-[9px] font-mono px-1.5 py-0 border rounded-sm uppercase tracking-wider h-4",
                styles.badge
              )}
            >
              {node.threat}
            </Badge>
          )}
        </td>
        <td className="py-1.5 px-2 text-[10px] font-mono text-zinc-600 max-w-xs truncate hidden xl:table-cell">
          {node.cmdline}
        </td>
      </tr>
      {open && node.children.map((child) => (
        <ProcessRow key={child.pid} node={child} depth={depth + 1} query={query} />
      ))}
    </>
  )
}

// ── ProcessTreeView ───────────────────────────────────────────────────────────

export function ProcessTreeView() {
  const [query, setQuery] = useState("")
  const { processes, loading } = useProcessGraph()

  const roots = useMemo(() => buildTree(processes), [processes])

  const total      = processes.length
  const suspicious = processes.filter(p => p.threatLevel === "warning").length
  const malicious  = processes.filter(p => p.threatLevel === "critical").length

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-zinc-950 bg-grid-pattern">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/50 bg-zinc-900/60 backdrop-blur-sm shrink-0">
        <GitBranch className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
        <span className="font-mono text-xs font-semibold text-zinc-300 tracking-widest uppercase">
          Process Tree
        </span>
        {loading && (
          <RefreshCw className="w-3 h-3 text-zinc-600 animate-spin ml-1" />
        )}
        <div className="relative ml-auto w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, PID, user, cmdline…"
            className="h-7 pl-7 text-[11px] font-mono bg-zinc-900/80 border-zinc-700/50 text-zinc-300 placeholder:text-zinc-600 focus-visible:ring-cyan-500/30 focus-visible:border-cyan-700/50"
          />
        </div>
        <button className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-zinc-700/50 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors text-[10px] font-mono">
          <Filter className="w-3 h-3" />
          Filters
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-zinc-900/90 backdrop-blur-sm">
            <tr className="border-b border-zinc-800/60">
              {["Process", "PID", "User", "CPU", "Memory", "Threat", "Cmdline"].map((h) => (
                <th
                  key={h}
                  className="px-2 py-1.5 text-[9px] font-mono font-semibold text-zinc-600 uppercase tracking-wider whitespace-nowrap select-none"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roots.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-600 text-xs font-mono">
                  No process data — open the Tauri native window, not the browser.
                </td>
              </tr>
            )}
            {roots.map((root) => (
              <ProcessRow key={root.pid} node={root} depth={0} query={query} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer stats */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-t border-zinc-800/50 bg-zinc-900/40 shrink-0">
        <span className="text-[10px] font-mono text-zinc-600">{total} processes</span>
        {suspicious > 0 && (
          <span className="text-[10px] font-mono text-yellow-600">{suspicious} suspicious</span>
        )}
        {malicious > 0 && (
          <span className="text-[10px] font-mono text-red-500">{malicious} malicious</span>
        )}
        {suspicious === 0 && malicious === 0 && total > 0 && (
          <span className="text-[10px] font-mono text-green-700">all clean</span>
        )}
      </div>
    </div>
  )
}
