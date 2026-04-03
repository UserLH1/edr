import {
  Network,
  GitBranch,
  ScanLine,
  ShieldCheck,
  Settings2,
  Activity,
  Database,
  Wifi,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useGlobalThreatScore } from "@/hooks/use-global-threat-score"

export type ViewId =
  | "endpoint-map"
  | "subnet-scanner"
  | "network-connections"
  | "process-tree"
  | "ioc-matches"
  | "settings"

type NavItem = {
  icon: React.ElementType
  label: string
  viewId?: ViewId
}

const threatHunting: NavItem[] = [
  { icon: Network,   label: "Endpoint Map", viewId: "endpoint-map" },
  { icon: GitBranch, label: "Process Tree", viewId: "process-tree" },
]

const networkRecon: NavItem[] = [
  { icon: Wifi,     label: "Net Connections", viewId: "network-connections" },
  { icon: ScanLine, label: "Subnet Scanner",  viewId: "subnet-scanner"      },
]

const intelligence: NavItem[] = [
  { icon: ShieldCheck, label: "IoC Matches", viewId: "ioc-matches" },
  { icon: Settings2,   label: "Settings",    viewId: "settings"    },
]

function NavSection({
  title,
  items,
  activeView,
  onNavigate,
}: {
  title: string
  items: NavItem[]
  activeView: ViewId
  onNavigate: (id: ViewId) => void
}) {
  return (
    <div className="mb-1">
      <p className="px-3 pt-3 pb-1 text-[9px] font-mono font-semibold tracking-[0.15em] text-zinc-600 uppercase select-none">
        {title}
      </p>
      {items.map((item) => {
        const isActive = !!item.viewId && item.viewId === activeView
        return (
          <button
            key={item.label}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-mono transition-colors relative group",
              isActive
                ? "text-cyan-300 bg-cyan-950/30"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"
            )}
            aria-current={isActive ? "page" : undefined}
            onClick={() => item.viewId && onNavigate(item.viewId)}
          >
            {isActive && (
              <span className="absolute left-0 top-0.5 bottom-0.5 w-0.5 bg-cyan-400 rounded-full shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
            )}
            <item.icon
              className={cn(
                "w-3.5 h-3.5 shrink-0",
                isActive ? "text-cyan-400" : "text-zinc-600 group-hover:text-zinc-400"
              )}
            />
            <span className="leading-none">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Agent Status Tray with live threat score ───────────────────────────────────

function AgentStatusTray() {
  const threat = useGlobalThreatScore()

  const barColor =
    threat.label === "CRITICAL" ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]"
    : threat.label === "WARNING"  ? "bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.4)]"
    : "bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.5)]"

  return (
    <div className="border-t border-zinc-800/50 p-3 bg-zinc-950/40">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-3 h-3 text-emerald-400 shrink-0" />
        <span className="text-[10px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">
          Agent Status
        </span>
      </div>

      {/* Global Threat Score — live from useProcessGraph */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono text-zinc-500">Global Threat Score</span>
          <span className={`text-[10px] font-mono font-semibold ${threat.colorClass}`}>
            {threat.score}/100
          </span>
        </div>
        <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.max(2, threat.score)}%` }}
            role="progressbar"
            aria-valuenow={threat.score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Global threat score: ${threat.score} out of 100`}
          />
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className={`text-[9px] font-mono ${threat.colorClass}`}>
            ({threat.label})
          </span>
          {(threat.criticalCount > 0 || threat.warningCount > 0) && (
            <span className="text-[9px] font-mono text-zinc-600">
              {threat.criticalCount > 0 && <span className="text-red-500">{threat.criticalCount}✕crit </span>}
              {threat.warningCount > 0  && <span className="text-yellow-600">{threat.warningCount}✕warn</span>}
            </span>
          )}
        </div>
      </div>

      {/* DB Status */}
      <div className="flex items-center gap-1.5">
        <Database className="w-2.5 h-2.5 text-zinc-600 shrink-0" />
        <span className="text-[9px] font-mono text-zinc-600">DB: Local SQLite connected</span>
      </div>
    </div>
  )
}

export function Sidebar({
  activeView,
  onNavigate,
}: {
  activeView: ViewId
  onNavigate: (id: ViewId) => void
}) {
  return (
    <aside
      className="w-60 flex flex-col border-r border-zinc-800/50 bg-zinc-900/30 backdrop-blur-sm shrink-0 overflow-hidden"
      aria-label="Main navigation"
    >
      <nav className="flex-1 py-1 overflow-y-auto">
        <NavSection title="Threat Hunting" items={threatHunting} activeView={activeView} onNavigate={onNavigate} />
        <NavSection title="Network Recon"  items={networkRecon}  activeView={activeView} onNavigate={onNavigate} />
        <NavSection title="Intelligence"   items={intelligence}  activeView={activeView} onNavigate={onNavigate} />
      </nav>
      <AgentStatusTray />
    </aside>
  )
}
