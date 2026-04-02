const LEGEND = [
  { color: "bg-red-500",    label: "High Risk"  },
  { color: "bg-cyan-400",   label: "Local"      },
  { color: "bg-purple-500", label: "External"   },
]

// Mini-map mock nodes: simplified blobs representing graph topology
const MINI_NODES = [
  { cx: "30%", cy: "28%", r: 4,  color: "#22d3ee" },
  { cx: "55%", cy: "42%", r: 5,  color: "#ef4444" },
  { cx: "38%", cy: "60%", r: 3,  color: "#eab308" },
  { cx: "68%", cy: "30%", r: 4,  color: "#ef4444" },
  { cx: "64%", cy: "62%", r: 3,  color: "#eab308" },
]

const MINI_EDGES = [
  { x1: "30%", y1: "28%", x2: "55%", y2: "42%" },
  { x1: "55%", y1: "42%", x2: "38%", y2: "60%" },
  { x1: "55%", y1: "42%", x2: "68%", y2: "30%" },
  { x1: "68%", y1: "30%", x2: "64%", y2: "62%" },
]

export function MiniMap() {
  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5" style={{ width: 180 }}>
      {/* Legend */}
      <div
        className="flex flex-col gap-1 rounded border border-zinc-800/70 bg-zinc-900/70 backdrop-blur-md px-2.5 py-2"
        role="note"
        aria-label="Graph legend"
      >
        <span className="font-mono text-[9px] text-zinc-600 tracking-widest uppercase mb-0.5">
          Legend
        </span>
        {LEGEND.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color}`} aria-hidden="true" />
            <span className="font-mono text-[10px] text-zinc-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Mini-map */}
      <div
        className="rounded border border-zinc-800/70 bg-zinc-950/80 backdrop-blur-md overflow-hidden"
        style={{ height: 120 }}
        aria-label="Graph minimap overview"
        role="img"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-800/60">
          <span className="font-mono text-[9px] text-zinc-600 tracking-widest uppercase">
            Minimap
          </span>
          <span className="font-mono text-[9px] text-zinc-700">1:8</span>
        </div>

        {/* Graph overview */}
        <div className="relative w-full" style={{ height: 96 }}>
          {/* Grid bg */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "12px 12px",
            }}
            aria-hidden="true"
          />

          <svg
            className="absolute inset-0 w-full h-full"
            aria-hidden="true"
          >
            {MINI_EDGES.map((e, i) => (
              <line
                key={i}
                x1={e.x1} y1={e.y1}
                x2={e.x2} y2={e.y2}
                stroke="rgba(100,100,120,0.4)"
                strokeWidth="0.75"
              />
            ))}
            {MINI_NODES.map((n, i) => (
              <circle
                key={i}
                cx={n.cx} cy={n.cy} r={n.r}
                fill={n.color}
                fillOpacity={0.7}
              />
            ))}
          </svg>

          {/* Viewport rect */}
          <div
            className="absolute border border-cyan-500/40 rounded-sm pointer-events-none"
            style={{ top: "20%", left: "15%", width: "55%", height: "55%" }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  )
}
