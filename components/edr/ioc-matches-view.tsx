import { useState } from "react"
import { ShieldCheck, Search, ExternalLink, Copy, CheckCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

type IocType = "IP" | "DOMAIN" | "HASH" | "URL" | "EMAIL"
type Severity = "critical" | "high" | "medium" | "low"

interface IocEntry {
  id: string
  indicator: string
  type: IocType
  severity: Severity
  confidence: number
  source: string
  firstSeen: string
  lastSeen: string
  hits: number
  tags: string[]
  description: string
}

const IOC_DATA: IocEntry[] = [
  {
    id: "ioc-001",
    indicator: "192.168.1.99",
    type: "IP",
    severity: "critical",
    confidence: 98,
    source: "Threat Intel Feed",
    firstSeen: "2025-03-28 03:14:22",
    lastSeen: "2025-04-01 07:42:01",
    hits: 14,
    tags: ["C2", "Cobalt Strike", "APT29"],
    description: "Known Cobalt Strike C2 server linked to APT29 activity.",
  },
  {
    id: "ioc-002",
    indicator: "malware-drop.xyz",
    type: "DOMAIN",
    severity: "critical",
    confidence: 95,
    source: "URLhaus",
    firstSeen: "2025-03-30 11:01:44",
    lastSeen: "2025-04-01 05:55:10",
    hits: 7,
    tags: ["dropper", "malware", "phishing"],
    description: "Malware dropper domain serving stage-2 payload via HTTP.",
  },
  {
    id: "ioc-003",
    indicator: "4a8a08f09d37b73795649038408b5f33",
    type: "HASH",
    severity: "high",
    confidence: 91,
    source: "VirusTotal",
    firstSeen: "2025-02-14 09:22:18",
    lastSeen: "2025-03-29 22:11:55",
    hits: 3,
    tags: ["mimikatz", "credential-dump"],
    description: "MD5 hash of known Mimikatz variant used for credential harvesting.",
  },
  {
    id: "ioc-004",
    indicator: "http://update-srv.net/payload.ps1",
    type: "URL",
    severity: "high",
    confidence: 87,
    source: "Hybrid Analysis",
    firstSeen: "2025-03-15 17:45:30",
    lastSeen: "2025-03-31 14:20:09",
    hits: 2,
    tags: ["powershell", "dropper", "LOLbins"],
    description: "PowerShell script URL used in living-off-the-land attack chain.",
  },
  {
    id: "ioc-005",
    indicator: "attacker@proton-secure.io",
    type: "EMAIL",
    severity: "medium",
    confidence: 72,
    source: "PhishTank",
    firstSeen: "2025-03-01 08:10:44",
    lastSeen: "2025-03-28 12:30:00",
    hits: 5,
    tags: ["phishing", "spear-phishing"],
    description: "Sender address linked to targeted spear-phishing campaigns.",
  },
  {
    id: "ioc-006",
    indicator: "10.0.0.254",
    type: "IP",
    severity: "medium",
    confidence: 63,
    source: "Internal SIEM",
    firstSeen: "2025-03-29 00:00:00",
    lastSeen: "2025-04-01 01:11:11",
    hits: 9,
    tags: ["lateral-movement", "SMB"],
    description: "Internal IP showing anomalous SMB lateral movement behaviour.",
  },
  {
    id: "ioc-007",
    indicator: "cdn-assets-deliver.com",
    type: "DOMAIN",
    severity: "low",
    confidence: 45,
    source: "OpenPhish",
    firstSeen: "2025-03-10 20:55:33",
    lastSeen: "2025-03-25 08:22:17",
    hits: 1,
    tags: ["suspicious", "typosquat"],
    description: "Potential typosquat domain mimicking a legitimate CDN provider.",
  },
]

const severityStyles: Record<Severity, string> = {
  critical: "bg-red-950/50 text-red-400 border-red-800/60",
  high:     "bg-orange-950/50 text-orange-400 border-orange-800/60",
  medium:   "bg-yellow-950/50 text-yellow-400 border-yellow-800/60",
  low:      "bg-zinc-800/60 text-zinc-400 border-zinc-700/60",
}

const typeColors: Record<IocType, string> = {
  IP:     "text-cyan-400",
  DOMAIN: "text-violet-400",
  HASH:   "text-emerald-400",
  URL:    "text-yellow-400",
  EMAIL:  "text-pink-400",
}

const typeRowAccent: Record<Severity, string> = {
  critical: "border-l-red-600",
  high:     "border-l-orange-600",
  medium:   "border-l-yellow-600",
  low:      "border-l-zinc-700",
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-cyan-400 text-zinc-600"
      aria-label="Copy indicator"
    >
      {copied ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  )
}

export function IocMatchesView() {
  const [query, setQuery] = useState("")
  const [selectedType, setSelectedType] = useState<IocType | "ALL">("ALL")

  const filtered = IOC_DATA.filter((ioc) => {
    const matchesQuery =
      !query ||
      ioc.indicator.toLowerCase().includes(query.toLowerCase()) ||
      ioc.tags.some((t) => t.toLowerCase().includes(query.toLowerCase())) ||
      ioc.description.toLowerCase().includes(query.toLowerCase())
    const matchesType = selectedType === "ALL" || ioc.type === selectedType
    return matchesQuery && matchesType
  })

  const types: (IocType | "ALL")[] = ["ALL", "IP", "DOMAIN", "HASH", "URL", "EMAIL"]

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-zinc-950 bg-grid-pattern">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/50 bg-zinc-900/60 backdrop-blur-sm shrink-0">
        <ShieldCheck className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
        <span className="font-mono text-xs font-semibold text-zinc-300 tracking-widest uppercase">
          IoC Matches
        </span>
        <div className="relative ml-auto w-60">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search indicators, tags..."
            className="h-7 pl-7 text-[11px] font-mono bg-zinc-900/80 border-zinc-700/50 text-zinc-300 placeholder:text-zinc-600 focus-visible:ring-cyan-500/30 focus-visible:border-cyan-700/50"
          />
        </div>
        {/* Type filters */}
        <div className="flex items-center gap-1">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={cn(
                "px-2 py-0.5 text-[9px] font-mono font-semibold rounded uppercase tracking-wider border transition-colors",
                selectedType === t
                  ? "bg-cyan-950/50 border-cyan-700/60 text-cyan-300"
                  : "border-zinc-700/50 bg-zinc-800/40 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/40"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex items-center gap-6 px-4 py-2 border-b border-zinc-800/30 bg-zinc-900/30 shrink-0">
        {(["critical", "high", "medium", "low"] as Severity[]).map((s) => {
          const count = IOC_DATA.filter((i) => i.severity === s).length
          return (
            <div key={s} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  s === "critical" ? "bg-red-500" :
                  s === "high"     ? "bg-orange-500" :
                  s === "medium"   ? "bg-yellow-500" : "bg-zinc-500"
                )}
              />
              <span className="text-[10px] font-mono text-zinc-500 capitalize">{s}</span>
              <span className="text-[10px] font-mono text-zinc-300 font-bold">{count}</span>
            </div>
          )
        })}
        <span className="ml-auto text-[10px] font-mono text-zinc-600">
          {filtered.length} of {IOC_DATA.length} indicators
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-zinc-900/90 backdrop-blur-sm">
            <tr className="border-b border-zinc-800/60">
              {["Severity", "Type", "Indicator", "Confidence", "Hits", "Source", "Last Seen", "Tags"].map((h) => (
                <th
                  key={h}
                  className="px-3 py-1.5 text-[9px] font-mono font-semibold text-zinc-600 uppercase tracking-wider whitespace-nowrap select-none"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((ioc) => (
              <tr
                key={ioc.id}
                className={cn(
                  "group border-b border-zinc-800/30 hover:bg-zinc-800/25 transition-colors border-l-2",
                  typeRowAccent[ioc.severity]
                )}
              >
                <td className="px-3 py-2">
                  <Badge className={cn("text-[9px] font-mono px-1.5 py-0 border uppercase tracking-wider h-4 rounded-sm", severityStyles[ioc.severity])}>
                    {ioc.severity}
                  </Badge>
                </td>
                <td className={cn("px-3 py-2 text-[10px] font-mono font-bold", typeColors[ioc.type])}>
                  {ioc.type}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono text-zinc-200 truncate max-w-[200px]">{ioc.indicator}</span>
                    <CopyButton text={ioc.indicator} />
                    <ExternalLink className="w-2.5 h-2.5 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-cyan-400" />
                  </div>
                  <p className="text-[9px] font-mono text-zinc-600 mt-0.5 truncate max-w-[200px]">{ioc.description}</p>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1 w-16 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          ioc.confidence >= 90 ? "bg-red-500" :
                          ioc.confidence >= 70 ? "bg-orange-500" :
                          ioc.confidence >= 50 ? "bg-yellow-500" : "bg-zinc-500"
                        )}
                        style={{ width: `${ioc.confidence}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400">{ioc.confidence}%</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-[10px] font-mono text-zinc-300 font-semibold">{ioc.hits}</td>
                <td className="px-3 py-2 text-[10px] font-mono text-zinc-500">{ioc.source}</td>
                <td className="px-3 py-2 text-[10px] font-mono text-zinc-500 whitespace-nowrap">{ioc.lastSeen}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {ioc.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] font-mono px-1 py-0 bg-zinc-800/60 text-zinc-500 border border-zinc-700/40 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-t border-zinc-800/50 bg-zinc-900/40 shrink-0">
        <span className="text-[10px] font-mono text-zinc-600">Last sync: 2025-04-01 07:42 UTC</span>
        <span className="text-[10px] font-mono text-zinc-600 ml-auto">Sources: VirusTotal · URLhaus · PhishTank · Hybrid Analysis</span>
      </div>
    </div>
  )
}
