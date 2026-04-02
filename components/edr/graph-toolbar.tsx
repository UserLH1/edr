import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Magnet,
  Camera,
} from "lucide-react"

const tools = [
  { icon: ZoomIn,    label: "Zoom In"        },
  { icon: ZoomOut,   label: "Zoom Out"       },
  { icon: Maximize2, label: "Fit to Screen"  },
  { icon: Magnet,    label: "Toggle Physics" },
  { icon: Camera,    label: "Take Snapshot"  },
]

export function GraphToolbar() {
  return (
    <div
      className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5"
      role="toolbar"
      aria-label="Graph manipulation tools"
    >
      {tools.map(({ icon: Icon, label }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          title={label}
          className="
            group relative w-8 h-8 flex items-center justify-center rounded
            border border-zinc-700/60 bg-zinc-900/60 backdrop-blur-md
            text-zinc-500 transition-all duration-150
            hover:border-cyan-600/60 hover:bg-cyan-950/60 hover:text-cyan-300
            hover:shadow-[0_0_10px_rgba(34,211,238,0.2)]
          "
        >
          <Icon size={14} strokeWidth={1.5} aria-hidden="true" />
          {/* Tooltip */}
          <span
            className="
              pointer-events-none absolute right-9 whitespace-nowrap
              rounded border border-zinc-700/60 bg-zinc-900/90 px-2 py-0.5
              font-mono text-[10px] text-zinc-300 opacity-0 transition-opacity
              group-hover:opacity-100
            "
            aria-hidden="true"
          >
            {label}
          </span>
        </button>
      ))}
    </div>
  )
}
