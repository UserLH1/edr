import { useState, useMemo } from "react"
import {
  Play,
  Pause,
  Rewind,
  FastForward,
} from "lucide-react"
import { Slider } from "@/components/ui/slider"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTelemetryEvents } from "@/hooks/use-telemetry-events"

// ── Fallback mock rows (shown in browser / before first Tauri event) ──────────
const MOCK_ROWS = [
  {
    id: -1, time: "—", event: "PROC_CREATE" as const, pid: "—",
    process: "waiting for Tauri…", destination: "N/A",
    action: "[PENDING]", rowClass: "", actionClass: "text-zinc-600",
    timestamp: 0,
  },
]

export function TelemetryPanel() {
  const [playing, setPlaying] = useState(true)
  const [sliderValue, setSliderValue] = useState([100])

  const liveEvents = useTelemetryEvents()

  // Switch to live events as soon as the first one arrives; until then show mock
  const rows = liveEvents.length > 0 ? liveEvents : MOCK_ROWS

  // Build heatmap from event density over last 60 ticks (one tick = one event bucket)
  const BARS_COUNT = 60
  const heatmap = useMemo(() => {
    if (liveEvents.length === 0) {
      // Static baseline until events arrive
      return Array.from({ length: BARS_COUNT }, (_, i) => ({
        height: 10 + Math.round(Math.sin(i / 3) * 8 + Math.cos(i / 7) * 6),
        color: "bg-zinc-700/60",
      }))
    }
    // Bucket events by timestamp into BARS_COUNT slots covering the last 2 minutes
    const now = Date.now()
    const windowMs = 120_000
    const bucketMs = windowMs / BARS_COUNT
    const counts = new Array<number>(BARS_COUNT).fill(0)
    for (const ev of liveEvents) {
      const age = now - ev.timestamp
      if (age < 0 || age >= windowMs) continue
      const idx = BARS_COUNT - 1 - Math.floor(age / bucketMs)
      if (idx >= 0 && idx < BARS_COUNT) counts[idx]++
    }
    const maxCount = Math.max(1, ...counts)
    return counts.map((c) => {
      const pct = Math.round((c / maxCount) * 90) + 5
      const color =
        c === 0
          ? "bg-zinc-700/60"
          : c / maxCount > 0.6
          ? "bg-red-500"
          : c / maxCount > 0.25
          ? "bg-yellow-500/70"
          : "bg-green-600/70"
      return { height: pct, color }
    })
  }, [liveEvents])

  // Digital clock: most recent event time, or live wall clock
  const clockStr = useMemo(() => {
    const ts = liveEvents[0]?.timestamp ?? Date.now()
    const d = new Date(ts)
    return d.toLocaleTimeString("en-US", { hour12: false })
  }, [liveEvents])

  return (
    <div
      className="h-[280px] border-t border-zinc-800/50 bg-zinc-950/95 backdrop-blur-md flex flex-col shrink-0"
      aria-label="Network DVR and telemetry terminal"
    >
      {/* ── DVR Timeline ────────────────────────────────────────────────────── */}
      <div className="h-[80px] border-b border-zinc-800/50 flex items-center gap-3 px-4 shrink-0">

        {/* Transport controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="p-1.5 rounded text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800/60 transition-colors"
            aria-label="Rewind"
          >
            <Rewind className="h-4 w-4" />
          </button>
          <button
            className="p-1.5 rounded text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800/60 transition-colors"
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            className="p-1.5 rounded text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800/60 transition-colors"
            aria-label="Fast forward"
          >
            <FastForward className="h-4 w-4" />
          </button>

          {/* LIVE badge */}
          <span className="ml-1 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/60 border border-red-700/40">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-400" />
            </span>
            <span className="text-[9px] font-mono font-bold text-red-400 tracking-widest">LIVE</span>
          </span>
        </div>

        {/* Heatmap + slider */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <div className="flex items-end gap-px h-[28px]" aria-hidden="true">
            {heatmap.map((bar, i) => (
              <div
                key={i}
                className={`flex-1 rounded-sm transition-all duration-500 ${bar.color}`}
                style={{ height: `${bar.height}%` }}
              />
            ))}
          </div>
          <Slider
            value={sliderValue}
            onValueChange={setSliderValue}
            max={100}
            step={1}
            className="w-full [&_[data-slot=slider-track]]:bg-zinc-800 [&_[data-slot=slider-range]]:bg-cyan-700/70 [&_[data-slot=slider-thumb]]:bg-cyan-400 [&_[data-slot=slider-thumb]]:border-cyan-400 [&_[data-slot=slider-thumb]]:size-2.5"
            aria-label="Timeline scrubber"
          />
        </div>

        {/* Digital clock */}
        <div className="shrink-0 text-right">
          <span className="font-mono text-[11px] text-cyan-400/90 tracking-wide">
            {clockStr}
          </span>
          <span className="block font-mono text-[9px] text-zinc-500 tracking-widest">LOCAL</span>
        </div>
      </div>

      {/* ── Live Telemetry Terminal ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-zinc-950/95">
            <TableRow className="border-zinc-800/60 hover:bg-transparent">
              {["TIME", "EVENT", "PID", "PROCESS", "DESTINATION", "ACTION"].map((h) => (
                <TableHead
                  key={h}
                  className="text-[10px] uppercase text-zinc-500 tracking-widest font-mono py-1 h-auto px-3"
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className={`border-zinc-800/40 hover:bg-zinc-800/20 ${row.rowClass}`}
              >
                <TableCell className="font-mono text-xs text-zinc-300 py-0.5 px-3 whitespace-nowrap">
                  {row.time}
                </TableCell>
                <TableCell className="font-mono text-xs text-zinc-400 py-0.5 px-3 whitespace-nowrap">
                  {row.event}
                </TableCell>
                <TableCell className="font-mono text-xs text-zinc-400 py-0.5 px-3">
                  {row.pid}
                </TableCell>
                <TableCell className="font-mono text-xs text-zinc-300 py-0.5 px-3 whitespace-nowrap">
                  {row.process}
                </TableCell>
                <TableCell className="font-mono text-xs text-zinc-400 py-0.5 px-3 whitespace-nowrap">
                  {row.destination}
                </TableCell>
                <TableCell className={`font-mono text-xs py-0.5 px-3 whitespace-nowrap ${row.actionClass}`}>
                  {row.action}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
