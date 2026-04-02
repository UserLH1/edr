import { useRef, useState, useCallback, useEffect } from "react"
import { Terminal, Globe, Server } from "lucide-react"
import { cn } from "@/lib/utils"
import type { NodeDef, EdgeDef, ThreatLevel } from "@/lib/graph-types"

const THREAT: Record<ThreatLevel, { border: string; dot: string; label: string; text: string; glow: string }> = {
  safe:     { border: "border-l-green-500",  dot: "bg-green-500",  label: "text-green-400/80",  text: "SAFE",     glow: "" },
  warning:  { border: "border-l-yellow-400", dot: "bg-yellow-400", label: "text-yellow-400/80", text: "WARNING",  glow: "" },
  critical: { border: "border-l-red-500",    dot: "bg-red-500",    label: "text-red-400/80",    text: "CRITICAL", glow: "shadow-[0_0_14px_rgba(239,68,68,0.4)]" },
}

const NODE_W = 186
const NODE_H = 52

function nodeCenter(n: NodeDef) {
  return { cx: n.x + NODE_W / 2, cy: n.y + NODE_H / 2 }
}

function edgePoints(nodes: NodeDef[], edge: EdgeDef) {
  const src = nodes.find((n) => n.id === edge.source)
  const tgt = nodes.find((n) => n.id === edge.target)
  if (!src || !tgt) return null
  const s = nodeCenter(src)
  const t = nodeCenter(tgt)
  return { x1: s.cx, y1: s.cy + NODE_H / 2, x2: t.cx, y2: t.cy - NODE_H / 2 }
}

const SVG_W = 700
const SVG_H = 640

interface GraphNodesProps {
  /** Live positioned nodes from useProcessGraph (managed by MainCanvas) */
  liveNodes: NodeDef[]
  /** Live edges from useProcessGraph (managed by MainCanvas) */
  liveEdges: EdgeDef[]
  /** Called with the node's id string when a node is clicked */
  onNodeClick?: (nodeId: string) => void
}

export function GraphNodes({ liveNodes, liveEdges, onNodeClick }: GraphNodesProps) {
  // Local node/edge state preserves manual drag offsets between backend updates
  const [nodes, setNodes] = useState<NodeDef[]>(liveNodes)
  const [edges, setEdges] = useState<EdgeDef[]>(liveEdges)

  // Merge incoming positions with current drag offsets so repositioned nodes
  // don't snap back on the next 2-second worker tick
  useEffect(() => {
    setNodes(prev => {
      const dragMap = new Map(prev.map(n => [n.id, { x: n.x, y: n.y }]))
      return liveNodes.map(n => ({
        ...n,
        x: dragMap.get(n.id)?.x ?? n.x,
        y: dragMap.get(n.id)?.y ?? n.y,
      }))
    })
    setEdges(liveEdges)
  }, [liveNodes, liveEdges])

  const [transform, setTransform] = useState({ x: 40, y: 20, scale: 1 })
  const [tick, setTick] = useState(0)

  const panStart = useRef<{ mx: number; my: number; tx: number; ty: number } | null>(null)
  const dragging = useRef<{ id: string; ox: number; oy: number } | null>(null)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 100), 50)
    return () => clearInterval(id)
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    setTransform((t) => ({ ...t, scale: Math.min(2.5, Math.max(0.3, t.scale * factor)) }))
  }, [])

  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".flow-node")) return
    panStart.current = { mx: e.clientX, my: e.clientY, tx: transform.x, ty: transform.y }
  }, [transform.x, transform.y])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const pan = panStart.current
    if (pan !== null && dragging.current === null) {
      setTransform((t) => ({
        ...t,
        x: pan.tx + (e.clientX - pan.mx),
        y: pan.ty + (e.clientY - pan.my),
      }))
      return
    }
    const drag = dragging.current
    if (drag !== null) {
      const scale = transform.scale
      setNodes((prev) =>
        prev.map((n) =>
          n.id === drag.id
            ? { ...n, x: (e.clientX - drag.ox) / scale, y: (e.clientY - drag.oy) / scale }
            : n
        )
      )
    }
  }, [transform.scale])

  const onMouseUp = useCallback(() => {
    panStart.current = null
    dragging.current = null
  }, [])

  const startDrag = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const node = nodes.find((n) => n.id === id)
    if (!node) return
    dragging.current = {
      id,
      ox: e.clientX - node.x * transform.scale,
      oy: e.clientY - node.y * transform.scale,
    }
  }, [nodes, transform.scale])

  const zoom = useCallback((dir: 1 | -1) => {
    setTransform((t) => ({
      ...t,
      scale: Math.min(2.5, Math.max(0.3, t.scale * (dir > 0 ? 1.2 : 0.83))),
    }))
  }, [])

  const fitView = useCallback(() => setTransform({ x: 40, y: 20, scale: 1 }), [])

  return (
    <div
      className="absolute inset-0 z-10 overflow-hidden cursor-grab active:cursor-grabbing select-none"
      onWheel={onWheel}
      onMouseDown={onCanvasMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      aria-label="Threat graph — drag to pan, scroll to zoom"
    >
      {/* Transformed layer */}
      <div
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
          width: SVG_W,
          height: SVG_H,
          position: "absolute",
        }}
      >
        {/* SVG edges */}
        <svg
          width={SVG_W}
          height={SVG_H}
          className="absolute inset-0 pointer-events-none overflow-visible"
          aria-hidden="true"
        >
          <defs>
            {(["cyan", "yellow", "red"] as const).map((c) => {
              const fill =
                c === "cyan"
                  ? "rgba(34,211,238,0.85)"
                  : c === "yellow"
                  ? "rgba(250,204,21,0.75)"
                  : "rgba(239,68,68,0.9)"
              return (
                <marker key={c} id={`arr-${c}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                  <polygon points="0 0, 7 3.5, 0 7" fill={fill} />
                </marker>
              )
            })}
          </defs>

          {edges.map((edge) => {
            const pts = edgePoints(nodes, edge)
            if (!pts) return null
            const isRed    = edge.color.includes("239,68")
            const isYellow = edge.color.includes("250,204")
            const markerId = isRed ? "arr-red" : isYellow ? "arr-yellow" : "arr-cyan"
            const progress = tick / 100
            const ax = pts.x1 + (pts.x2 - pts.x1) * progress
            const ay = pts.y1 + (pts.y2 - pts.y1) * progress

            return (
              <g key={edge.id}>
                <line
                  x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
                  stroke={edge.color}
                  strokeWidth={isRed ? 2 : 1.5}
                  strokeDasharray={edge.dashed ? "8 5" : undefined}
                  markerEnd={`url(#${markerId})`}
                />
                {edge.animated && (
                  <circle cx={ax} cy={ay} r="3.5" fill={edge.color} opacity="0.95" />
                )}
              </g>
            )
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => {
          const styles = THREAT[node.threatLevel]
          const isCritical = node.threatLevel === "critical"
          const Icon =
            node.iconType === "terminal" ? Terminal : node.iconType === "globe" ? Globe : Server

          return (
            <div
              key={node.id}
              className={cn(
                "flow-node absolute flex items-center gap-2 px-3 py-2 rounded-md",
                "cursor-pointer border border-l-4 border-zinc-800",
                "backdrop-blur-md bg-zinc-950/95 shadow-lg shadow-black/60",
                "transition-shadow duration-150 hover:shadow-[0_0_18px_rgba(34,211,238,0.18)]",
                styles.border,
                styles.glow
              )}
              style={{ left: node.x, top: node.y, width: NODE_W }}
              onMouseDown={(e) => startDrag(e, node.id)}
              onClick={() => onNodeClick?.(node.id)}
              role="button"
              tabIndex={0}
              aria-label={`${node.processName} — ${node.threatLevel}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onNodeClick?.(node.id)
              }}
            >
              {isCritical && (
                <span
                  className="absolute inset-0 rounded-md border border-red-500/25 animate-ping pointer-events-none"
                  aria-hidden="true"
                />
              )}
              <Icon size={13} className={cn("shrink-0", isCritical ? "text-red-400" : "text-zinc-400")} aria-hidden="true" />
              <div className="flex flex-col gap-0.5 leading-none min-w-0">
                <span className="font-mono text-[12px] font-semibold text-zinc-100 tracking-wide truncate">
                  {node.processName}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={cn("font-mono text-[9px] tracking-widest", styles.label)}>
                    {styles.text}
                  </span>
                  {node.pid !== "N/A" && (
                    <span className="font-mono text-[9px] text-zinc-600">{node.pid}</span>
                  )}
                </div>
              </div>
              <span
                className={cn("ml-auto w-1.5 h-1.5 rounded-full shrink-0", styles.dot, isCritical && "animate-pulse")}
                aria-hidden="true"
              />
            </div>
          )
        })}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-0.5" aria-label="Zoom controls">
        {(
          [
            { label: "+", action: () => zoom(1),  title: "Zoom in"  },
            { label: "-", action: () => zoom(-1), title: "Zoom out" },
            { label: "F", action: fitView,        title: "Fit view" },
          ] as const
        ).map(({ label, action, title }) => (
          <button
            key={title}
            onClick={action}
            title={title}
            className="w-7 h-7 flex items-center justify-center font-mono text-sm bg-zinc-900/90 border border-zinc-700/60 rounded text-zinc-400 hover:text-cyan-400 hover:border-cyan-800/50 transition-colors"
            aria-label={title}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Minimap */}
      <div
        className="absolute top-4 right-4 z-20 w-36 h-24 rounded-lg bg-zinc-950/85 border border-zinc-800/60 overflow-hidden"
        aria-label="Graph minimap"
      >
        <svg width="100%" height="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} aria-hidden="true">
          {edges.map((edge) => {
            const pts = edgePoints(nodes, edge)
            if (!pts) return null
            return (
              <line key={edge.id} x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
                stroke={edge.color} strokeWidth="3" opacity="0.5" />
            )
          })}
          {nodes.map((node) => {
            const col =
              node.threatLevel === "critical" ? "#ef4444"
              : node.threatLevel === "warning" ? "#facc15"
              : "#22c55e"
            return (
              <rect key={node.id} x={node.x} y={node.y} width={NODE_W} height={NODE_H}
                rx="4" fill={col} opacity="0.25" stroke={col} strokeWidth="1.5" />
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div
        className="absolute bottom-4 left-4 z-20 flex flex-col gap-1 px-3 py-2 rounded-md bg-zinc-950/80 border border-zinc-800/60 backdrop-blur-md"
        aria-label="Legend"
      >
        <p className="font-mono text-[9px] tracking-[0.12em] text-zinc-600 uppercase mb-0.5">Legend</p>
        {(["safe", "warning", "critical"] as ThreatLevel[]).map((lvl) => (
          <div key={lvl} className="flex items-center gap-2">
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", THREAT[lvl].dot)} aria-hidden="true" />
            <span className={cn("font-mono text-[10px]", THREAT[lvl].label)}>{lvl}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
