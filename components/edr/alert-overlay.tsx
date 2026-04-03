import { useEffect } from "react"
import { X, AlertTriangle, Skull, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { useThreatAlerts, type ThreatAlert } from "@/hooks/use-threat-alerts"

const AUTO_DISMISS_MS = 12_000

function AlertCard({ alert, onDismiss }: { alert: ThreatAlert; onDismiss: () => void }) {
  const isCrit = alert.process.threatLevel === "critical"

  // Auto-dismiss after AUTO_DISMISS_MS
  useEffect(() => {
    const id = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(id)
  }, [onDismiss])

  const time = new Date(alert.timestamp).toLocaleTimeString("en-US", { hour12: false })

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-xl shadow-2xl",
        "animate-in slide-in-from-right-4 fade-in duration-300",
        isCrit
          ? "bg-red-950/80 border-red-700/60 shadow-red-950/40"
          : "bg-yellow-950/80 border-yellow-700/60 shadow-yellow-950/30"
      )}
      style={{ minWidth: 320, maxWidth: 380 }}
      role="alert"
    >
      {/* Pulse border for critical */}
      {isCrit && (
        <span
          className="absolute inset-0 rounded-lg border border-red-500/40 animate-ping pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Icon */}
      <div className={cn(
        "shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center",
        isCrit ? "bg-red-900/60" : "bg-yellow-900/60"
      )}>
        {isCrit
          ? <Skull size={16} className="text-red-400" />
          : <AlertTriangle size={16} className="text-yellow-400" />
        }
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn(
            "text-[10px] font-mono font-bold tracking-widest uppercase",
            isCrit ? "text-red-400" : "text-yellow-400"
          )}>
            {isCrit ? "CRITICAL THREAT" : "SUSPICIOUS PROCESS"}
          </span>
          <span className="text-[9px] font-mono text-zinc-600 ml-auto">{time}</span>
        </div>
        <p className="font-mono text-sm font-semibold text-zinc-100 truncate">
          {alert.process.processName}
        </p>
        <p className="font-mono text-[10px] text-zinc-500 truncate mt-0.5">
          Score: {alert.process.threatScore}/100 · PID {alert.process.pidNum}
        </p>
        {alert.process.cmdline && (
          <p className="font-mono text-[9px] text-zinc-600 truncate mt-0.5">
            {alert.process.cmdline.slice(0, 60)}{alert.process.cmdline.length > 60 ? "…" : ""}
          </p>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors mt-0.5"
        aria-label="Dismiss alert"
      >
        <X size={13} />
      </button>
    </div>
  )
}

/**
 * Floating alert stack rendered at the top-right of the screen.
 * Mount once at the App root — it manages its own subscription internally.
 */
export function AlertOverlay() {
  const { alerts, dismiss, dismissAll } = useThreatAlerts()

  if (alerts.length === 0) return null

  return (
    <div
      className="fixed top-14 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      aria-live="assertive"
      aria-label="Threat alerts"
    >
      {/* Clear all button — only pointer-events-auto so it doesn't block the canvas */}
      {alerts.length > 1 && (
        <div className="flex justify-end pointer-events-auto">
          <button
            onClick={dismissAll}
            className="text-[9px] font-mono text-zinc-600 hover:text-zinc-400 px-2 py-0.5 rounded border border-zinc-800/50 bg-zinc-950/80 transition-colors"
          >
            dismiss all ({alerts.length})
          </button>
        </div>
      )}
      {alerts.map(alert => (
        <div key={alert.id} className="pointer-events-auto">
          <AlertCard alert={alert} onDismiss={() => dismiss(alert.id)} />
        </div>
      ))}
    </div>
  )
}
