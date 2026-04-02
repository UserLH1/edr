/**
 * lib/mock-graph-data.ts — static fallback graph shown while:
 *   a) running in plain Vite dev mode (outside Tauri), OR
 *   b) waiting for the first `get_active_processes` response on mount.
 *
 * These were the original hardcoded nodes from graph-nodes.tsx.
 * Extracted here so graph-nodes.tsx has no hardcoded data at all.
 */
import type { NodeDef, EdgeDef } from "./graph-types"

export const INITIAL_NODES: NodeDef[] = [
  { id: "n1", processName: "explorer.exe",   pid: "PID 1042", threatLevel: "safe",     iconType: "server",   x: 260, y: 60  },
  { id: "n2", processName: "cmd.exe",         pid: "PID 4012", threatLevel: "warning",  iconType: "terminal", x: 240, y: 200 },
  { id: "n3", processName: "powershell.exe",  pid: "PID 8192", threatLevel: "critical", iconType: "terminal", x: 80,  y: 350 },
  { id: "n4", processName: "lsass.exe",       pid: "PID 672",  threatLevel: "critical", iconType: "server",   x: 400, y: 350 },
  { id: "n5", processName: "185.10.x.x:4444", pid: "N/A",      threatLevel: "critical", iconType: "globe",    x: 240, y: 500 },
]

export const INITIAL_EDGES: EdgeDef[] = [
  { id: "e1", source: "n1", target: "n2", animated: true,  color: "rgba(34,211,238,0.65)" },
  { id: "e2", source: "n2", target: "n3", animated: false, color: "rgba(250,204,21,0.55)",  dashed: true },
  { id: "e3", source: "n2", target: "n4", animated: false, color: "rgba(250,204,21,0.45)",  dashed: true },
  { id: "e4", source: "n3", target: "n5", animated: true,  color: "rgba(239,68,68,0.80)" },
  { id: "e5", source: "n4", target: "n5", animated: true,  color: "rgba(239,68,68,0.65)" },
]
