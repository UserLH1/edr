import { useState, useMemo, useRef } from "react"
import {
  ShieldCheck, Search, ExternalLink, Copy, CheckCheck,
  Radio, Plus, Trash2, Upload, Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useProcessGraph } from "@/hooks/use-process-graph"
import { useNetworkConnections } from "@/hooks/use-network-connections"
import { useIocStore } from "@/hooks/use-ioc-store"
import { ExportButton } from "@/components/edr/export-button"
import { type IocEntry, type IocType, type Severity } from "@/lib/ioc-types"

// ── Live IOC matching ─────────────────────────────────────────────────────────

function computeLiveHits(
  iocs: IocEntry[],
  processes: ReturnType<typeof useProcessGraph>["processes"],
  connections: ReturnType<typeof useNetworkConnections>["connections"]
): Map<string, number> {
  const hits = new Map<string, number>()

  for (const ioc of iocs) {
    let count = 0

    if (ioc.type === "IP") {
      count = connections.filter(c =>
        c.remoteAddr.startsWith(ioc.indicator + ":") || c.remoteAddr === ioc.indicator
      ).length
      if (count === 0) {
        count = processes.filter(p => p.exePath.toLowerCase().includes(ioc.indicator)).length
      }
    }

    if (ioc.type === "HASH") {
      count = processes.filter(p =>
        p.processName.toLowerCase().includes(ioc.indicator.toLowerCase()) ||
        p.exePath.toLowerCase().includes(ioc.indicator.toLowerCase())
      ).length
    }

    if (ioc.type === "DOMAIN" || ioc.type === "URL") {
      count = processes.filter(p =>
        p.cmdline.toLowerCase().includes(ioc.indicator.toLowerCase())
      ).length
    }

    if (count > 0) hits.set(ioc.id, count)
  }

  return hits
}

// ── UI helpers ────────────────────────────────────────────────────────────────

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
    <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-cyan-400 text-zinc-600" aria-label="Copy">
      {copied ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  )
}

// ── Add IOC dialog ─────────────────────────────────────────────────────────────

interface AddIocDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (entry: IocEntry) => void
}

const EMPTY_FORM = {
  indicator: "", type: "IP" as IocType, severity: "medium" as Severity,
  confidence: "80", source: "", tags: "", description: "",
}

function AddIocDialog({ open, onClose, onAdd }: AddIocDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM)

  function set<K extends keyof typeof EMPTY_FORM>(k: K, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function handleSubmit() {
    if (!form.indicator.trim()) return
    const now = new Date().toISOString().replace("T", " ").slice(0, 19)
    onAdd({
      id:         `ioc-${Date.now()}`,
      indicator:  form.indicator.trim(),
      type:       form.type,
      severity:   form.severity,
      confidence: Math.min(100, Math.max(0, parseInt(form.confidence) || 80)),
      source:     form.source.trim() || "Manual",
      firstSeen:  now,
      lastSeen:   now,
      hits:       0,
      tags:       form.tags.split(",").map(t => t.trim()).filter(Boolean),
      description: form.description.trim(),
    })
    setForm(EMPTY_FORM)
    onClose()
  }

  const inputCls = "h-7 text-[11px] font-mono bg-zinc-900/80 border-zinc-700/50 text-zinc-300 placeholder:text-zinc-600 focus-visible:ring-cyan-500/30 focus-visible:border-cyan-700/50"
  const selectCls = "h-7 w-full rounded-md border border-zinc-700/50 bg-zinc-900/80 px-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-cyan-700/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
  const labelCls  = "text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1 block"

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-cyan-400 flex items-center gap-2 text-sm">
            <ShieldCheck className="w-4 h-4" />
            Add IOC Indicator
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          {/* Indicator */}
          <div className="col-span-2">
            <label className={labelCls}>Indicator *</label>
            <Input value={form.indicator} onChange={e => set("indicator", e.target.value)}
              placeholder="IP, domain, hash, URL, or email address"
              className={inputCls} autoFocus />
          </div>

          {/* Type */}
          <div>
            <label className={labelCls}>Type</label>
            <select value={form.type} onChange={e => set("type", e.target.value as IocType)} className={selectCls}>
              {(["IP", "DOMAIN", "HASH", "URL", "EMAIL"] as IocType[]).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className={labelCls}>Severity</label>
            <select value={form.severity} onChange={e => set("severity", e.target.value as Severity)} className={selectCls}>
              {(["critical", "high", "medium", "low"] as Severity[]).map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Confidence */}
          <div>
            <label className={labelCls}>Confidence (0–100)</label>
            <Input value={form.confidence} onChange={e => set("confidence", e.target.value)}
              type="number" min={0} max={100} className={inputCls} />
          </div>

          {/* Source */}
          <div>
            <label className={labelCls}>Source</label>
            <Input value={form.source} onChange={e => set("source", e.target.value)}
              placeholder="VirusTotal, Internal, …" className={inputCls} />
          </div>

          {/* Tags */}
          <div className="col-span-2">
            <label className={labelCls}>Tags (comma-separated)</label>
            <Input value={form.tags} onChange={e => set("tags", e.target.value)}
              placeholder="C2, dropper, lateral-movement" className={inputCls} />
          </div>

          {/* Description */}
          <div className="col-span-2">
            <label className={labelCls}>Description</label>
            <textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              rows={2}
              placeholder="Brief description of the threat…"
              className="w-full rounded-md border border-zinc-700/50 bg-zinc-900/80 px-2 py-1.5 text-[11px] font-mono text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-700/50 focus:ring-1 focus:ring-cyan-500/30 resize-none transition-all"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm"
            className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 font-mono"
            onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm"
            className="bg-cyan-700 hover:bg-cyan-600 text-white font-mono"
            onClick={handleSubmit}
            disabled={!form.indicator.trim()}>
            <Plus className="w-3 h-3 mr-1.5" />
            Add Indicator
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function IocMatchesView() {
  const [query, setQuery] = useState("")
  const [selectedType, setSelectedType] = useState<IocType | "ALL">("ALL")
  const [liveOnly, setLiveOnly] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const { processes } = useProcessGraph()
  const { connections } = useNetworkConnections(5000)
  const { iocs, addIoc, removeIoc, importIocs, saveStatus } = useIocStore()

  const liveHits = useMemo(
    () => computeLiveHits(iocs, processes, connections),
    [iocs, processes, connections]
  )

  const filtered = useMemo(() => {
    let rows = iocs

    if (liveOnly) rows = rows.filter(i => liveHits.has(i.id))
    if (selectedType !== "ALL") rows = rows.filter(i => i.type === selectedType)
    if (query) {
      const q = query.toLowerCase()
      rows = rows.filter(i =>
        i.indicator.toLowerCase().includes(q) ||
        i.tags.some(t => t.toLowerCase().includes(q)) ||
        i.description.toLowerCase().includes(q)
      )
    }

    // Sort: live hits first, then by severity
    return [...rows].sort((a, b) => {
      const aLive = liveHits.has(a.id) ? 1 : 0
      const bLive = liveHits.has(b.id) ? 1 : 0
      if (bLive !== aLive) return bLive - aLive
      const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
      return order[a.severity] - order[b.severity]
    })
  }, [iocs, liveHits, liveOnly, selectedType, query])

  // ── Export shape ─────────────────────────────────────────────────────────────
  const exportData = filtered.map(i => ({
    id: i.id,
    indicator: i.indicator,
    type: i.type,
    severity: i.severity,
    confidence: i.confidence,
    source: i.source,
    firstSeen: i.firstSeen,
    lastSeen: i.lastSeen,
    historicalHits: i.hits,
    liveHits: liveHits.get(i.id) ?? 0,
    tags: i.tags.join("|"),
    description: i.description,
  }))

  // ── File import ───────────────────────────────────────────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const data = JSON.parse(evt.target?.result as string)
        if (Array.isArray(data)) importIocs(data as IocEntry[])
      } catch {
        // invalid JSON — silently ignore
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const types: (IocType | "ALL")[] = ["ALL", "IP", "DOMAIN", "HASH", "URL", "EMAIL"]
  const liveMatchCount = liveHits.size

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-zinc-950 bg-grid-pattern">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/50 bg-zinc-900/60 backdrop-blur-sm shrink-0 flex-wrap gap-y-2">
        <ShieldCheck className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
        <span className="font-mono text-xs font-semibold text-zinc-300 tracking-widest uppercase">IoC Matches</span>

        {liveMatchCount > 0 && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-950/50 border border-red-700/40">
            <Radio className="w-2.5 h-2.5 text-red-400 animate-pulse" />
            <span className="text-[9px] font-mono font-bold text-red-400 tracking-widest">
              {liveMatchCount} LIVE MATCH{liveMatchCount > 1 ? "ES" : ""}
            </span>
          </span>
        )}

        {/* Live-only toggle */}
        <button
          onClick={() => setLiveOnly(v => !v)}
          className={cn(
            "px-2 py-0.5 text-[10px] font-mono rounded border transition-colors",
            liveOnly
              ? "bg-red-950/40 border-red-700/50 text-red-400"
              : "bg-zinc-900/60 border-zinc-700/40 text-zinc-500 hover:text-zinc-300"
          )}
        >
          Live only
        </button>

        <div className="relative ml-auto w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search indicators, tags…"
            className="h-7 pl-7 text-[11px] font-mono bg-zinc-900/80 border-zinc-700/50 text-zinc-300 placeholder:text-zinc-600 focus-visible:ring-cyan-500/30 focus-visible:border-cyan-700/50"
          />
        </div>

        <div className="flex items-center gap-1">
          {types.map(t => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={cn(
                "px-2 py-0.5 text-[9px] font-mono font-semibold rounded uppercase tracking-wider border transition-colors",
                selectedType === t
                  ? "bg-cyan-950/50 border-cyan-700/60 text-cyan-300"
                  : "border-zinc-700/50 bg-zinc-800/40 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/40"
              )}
            >{t}</button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <ExportButton data={exportData} filename="ioc_matches" label="Export" />

          {/* Import from JSON file */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileSelect}
            aria-label="Import IOC JSON file"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 gap-1.5 text-[10px] font-mono border-zinc-700/50 bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/40"
            onClick={() => fileInputRef.current?.click()}
            title="Import indicators from JSON file"
          >
            <Upload className="w-3 h-3" />
            Import
          </Button>

          {/* Add IOC */}
          <Button
            size="sm"
            className="h-7 px-2.5 gap-1.5 text-[10px] font-mono bg-cyan-900/50 border border-cyan-700/50 text-cyan-300 hover:bg-cyan-800/60"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="w-3 h-3" />
            Add IOC
          </Button>

          {/* Save status indicator */}
          {saveStatus === "saving" && <Loader2 className="w-3 h-3 text-zinc-500 animate-spin" />}
          {saveStatus === "saved"  && <span className="text-[9px] font-mono text-emerald-500">Saved</span>}
          {saveStatus === "error"  && <span className="text-[9px] font-mono text-red-500">Save failed</span>}
        </div>
      </div>

      {/* ── Summary strip ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 px-4 py-2 border-b border-zinc-800/30 bg-zinc-900/30 shrink-0">
        {(["critical", "high", "medium", "low"] as Severity[]).map(s => {
          const count = iocs.filter(i => i.severity === s).length
          return (
            <div key={s} className="flex items-center gap-1.5">
              <span className={cn("w-1.5 h-1.5 rounded-full",
                s === "critical" ? "bg-red-500" : s === "high" ? "bg-orange-500" : s === "medium" ? "bg-yellow-500" : "bg-zinc-500")} />
              <span className="text-[10px] font-mono text-zinc-500 capitalize">{s}</span>
              <span className="text-[10px] font-mono text-zinc-300 font-bold">{count}</span>
            </div>
          )
        })}
        <span className="ml-auto text-[10px] font-mono text-zinc-600">
          {filtered.length} of {iocs.length} indicators
        </span>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-zinc-900/90 backdrop-blur-sm">
            <tr className="border-b border-zinc-800/60">
              {["Severity", "Type", "Indicator", "Confidence", "Hits", "Live", "Source", "Last Seen", "Tags", ""].map((h, i) => (
                <th key={i} className="px-3 py-1.5 text-[9px] font-mono font-semibold text-zinc-600 uppercase tracking-wider whitespace-nowrap select-none">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-zinc-600 text-xs font-mono">
                  {iocs.length === 0 ? "No IOC indicators loaded." : "No indicators match the current filters."}
                </td>
              </tr>
            )}
            {filtered.map(ioc => {
              const live = liveHits.get(ioc.id) ?? 0
              return (
                <tr
                  key={ioc.id}
                  className={cn(
                    "group border-b border-zinc-800/30 hover:bg-zinc-800/25 transition-colors border-l-2",
                    typeRowAccent[ioc.severity],
                    live > 0 ? "bg-red-950/10" : ""
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
                          className={cn("h-full rounded-full",
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
                  <td className="px-3 py-2">
                    {live > 0 ? (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-red-400 font-bold">
                        <Radio className="w-2.5 h-2.5 animate-pulse" />
                        {live}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-700">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[10px] font-mono text-zinc-500">{ioc.source}</td>
                  <td className="px-3 py-2 text-[10px] font-mono text-zinc-500 whitespace-nowrap">{ioc.lastSeen}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {ioc.tags.map(tag => (
                        <span key={tag} className="text-[9px] font-mono px-1 py-0 bg-zinc-800/60 text-zinc-500 border border-zinc-700/40 rounded">{tag}</span>
                      ))}
                    </div>
                  </td>
                  {/* Delete */}
                  <td className="px-3 py-2">
                    <button
                      onClick={() => removeIoc(ioc.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-zinc-600 hover:text-red-400"
                      aria-label={`Remove ${ioc.indicator}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-t border-zinc-800/50 bg-zinc-900/40 shrink-0">
        <span className="text-[10px] font-mono text-zinc-600">
          {iocs.length} indicators · hover row to delete
        </span>
        {liveMatchCount > 0 && (
          <span className="ml-auto text-[10px] font-mono text-red-500 font-semibold animate-pulse">
            ⚠ {liveMatchCount} active match{liveMatchCount > 1 ? "es" : ""} detected
          </span>
        )}
      </div>

      {/* ── Add IOC dialog ──────────────────────────────────────────────────── */}
      <AddIocDialog open={showAdd} onClose={() => setShowAdd(false)} onAdd={addIoc} />
    </div>
  )
}
