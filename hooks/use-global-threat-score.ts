import { useMemo } from "react"
import { useProcessGraph } from "@/hooks/use-process-graph"

export interface GlobalThreatScore {
  score: number
  label: string
  /** Tailwind text color class */
  colorClass: string
  /** CSS hex color for inline styles */
  hex: string
  criticalCount: number
  warningCount: number
}

/**
 * Derives a global threat score (0–100) from the live process list.
 * Uses the maximum individual threat score among all visible processes
 * so that even a single critical process drives the score to the top.
 */
export function useGlobalThreatScore(): GlobalThreatScore {
  const { processes } = useProcessGraph()

  return useMemo(() => {
    const criticalCount = processes.filter(p => p.threatLevel === "critical").length
    const warningCount  = processes.filter(p => p.threatLevel === "warning").length

    if (processes.length === 0) {
      return { score: 0, label: "Safe", colorClass: "text-emerald-400", hex: "#34d399", criticalCount: 0, warningCount: 0 }
    }

    const maxScore = Math.max(...processes.map(p => p.threatScore))

    if (criticalCount > 0 || maxScore >= 50) {
      return { score: maxScore, label: "CRITICAL", colorClass: "text-red-400", hex: "#f87171", criticalCount, warningCount }
    }
    if (warningCount > 0 || maxScore >= 15) {
      return { score: maxScore, label: "WARNING",  colorClass: "text-yellow-400", hex: "#facc15", criticalCount, warningCount }
    }
    return { score: maxScore, label: "Safe", colorClass: "text-emerald-400", hex: "#34d399", criticalCount, warningCount }
  }, [processes])
}
