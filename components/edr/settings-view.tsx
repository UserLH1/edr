import { useState, useEffect, useCallback } from "react"
import {
  Settings2,
  Shield,
  Database,
  Bell,
  Key,
  Globe,
  Activity,
  Save,
  RotateCcw,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ipc, type DbStats } from "@/lib/ipc"

type SettingsSection = "agent" | "detection" | "database" | "alerts" | "api"

// ── Canonical default values ─────────────────────────────────────────────────
const DEFAULTS = {
  agentEnabled:       true,
  autoUpdate:         true,
  telemetry:          true,
  kernelMode:         false,
  heartbeat:          "30",
  mlDetection:        true,
  behavioural:        true,
  yara:               true,
  networkCapture:     true,
  sandboxDetonation:  false,
  sensitivity:        "medium" as "low" | "medium" | "high",
  dbPath:             "C:\\ProgramData\\NEXUS\\edr.db",
  retentionDays:      "90",
  autoVacuum:         true,
  emailAlerts:        false,
  slackWebhook:       "",
  criticalOnly:       false,
  vtApiKey:           "",
  urlhausToken:       "",
  hybridKey:          "",
}

type SettingsState = typeof DEFAULTS

interface ToggleProps {
  enabled: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}

function Toggle({ enabled, onChange, label, description }: ToggleProps) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-zinc-800/30 last:border-0">
      <div>
        <p className="text-xs font-mono text-zinc-300">{label}</p>
        {description && <p className="text-[10px] font-mono text-zinc-600 mt-0.5">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={cn(
          "relative w-8 h-4 rounded-full transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50",
          enabled ? "bg-cyan-600" : "bg-zinc-700"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform",
            enabled ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  )
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="border border-zinc-800/50 rounded-lg bg-zinc-900/40 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-zinc-800/40 bg-zinc-900/60">
        <Icon className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
        <span className="text-xs font-mono font-semibold text-zinc-300 uppercase tracking-wider">{title}</span>
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  )
}

export function SettingsView() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("agent")
  const [s, setS] = useState<SettingsState>(DEFAULTS)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dbStats, setDbStats] = useState<DbStats | null>(null)

  // ── Load persisted settings + DB stats on mount ──────────────────────────
  useEffect(() => {
    ipc.loadSettings()
      .then(json => {
        if (!json) return
        try {
          const parsed = JSON.parse(json) as Partial<SettingsState>
          setS(prev => ({ ...prev, ...parsed }))
        } catch {
          // corrupt JSON — keep defaults
        }
      })
      .catch(err => console.error("[NexusEDR] loadSettings:", err))

    ipc.getDbStats()
      .then(setDbStats)
      .catch(err => console.error("[NexusEDR] getDbStats:", err))
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const set = useCallback(<K extends keyof SettingsState>(key: K, val: SettingsState[K]) => {
    setS(prev => ({ ...prev, [key]: val }))
  }, [])

  async function handleSave() {
    setSaveStatus("saving")
    setSaveError(null)
    try {
      await ipc.saveSettings(JSON.stringify(s))
      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 2500)
    } catch (err) {
      setSaveStatus("error")
      setSaveError(err instanceof Error ? err.message : String(err))
    }
  }

  function handleReset() {
    setS(DEFAULTS)
    setSaveStatus("idle")
    setSaveError(null)
  }

  const sections: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
    { id: "agent",     label: "Agent",     icon: Activity },
    { id: "detection", label: "Detection", icon: Shield },
    { id: "database",  label: "Database",  icon: Database },
    { id: "alerts",    label: "Alerts",    icon: Bell },
    { id: "api",       label: "API Keys",  icon: Key },
  ]

  return (
    <div className="flex flex-1 overflow-hidden bg-zinc-950 bg-grid-pattern">
      {/* Sidebar nav */}
      <nav className="w-44 shrink-0 border-r border-zinc-800/50 bg-zinc-900/40 flex flex-col pt-3" aria-label="Settings sections">
        <div className="px-3 pb-2 mb-1">
          <div className="flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5 text-cyan-500" />
            <span className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-widest">Settings</span>
          </div>
        </div>
        {sections.map((sec) => {
          const isActive = activeSection === sec.id
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={cn(
                "flex items-center justify-between px-3 py-2 text-xs font-mono transition-colors relative group",
                isActive
                  ? "text-cyan-300 bg-cyan-950/30"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-cyan-400 rounded-full shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
              )}
              <div className="flex items-center gap-2">
                <sec.icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-cyan-400" : "text-zinc-600")} />
                {sec.label}
              </div>
              {isActive && <ChevronRight className="w-3 h-3 text-cyan-600" />}
            </button>
          )
        })}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5 flex flex-col gap-4">

        {/* ── Agent ──────────────────────────────────────────────── */}
        {activeSection === "agent" && (
          <>
            <SectionCard title="Agent Control" icon={Activity}>
              <Toggle enabled={s.agentEnabled}  onChange={v => set("agentEnabled", v)}  label="Agent Enabled"         description="Enable or disable the EDR agent on this endpoint." />
              <Toggle enabled={s.autoUpdate}     onChange={v => set("autoUpdate", v)}    label="Auto-Update Agent"     description="Automatically install new agent versions when available." />
              <Toggle enabled={s.telemetry}      onChange={v => set("telemetry", v)}     label="Telemetry Collection"  description="Send anonymised usage metrics to improve detection quality." />
              <Toggle enabled={s.kernelMode}     onChange={v => set("kernelMode", v)}    label="Kernel-Mode Driver"    description="Enable kernel driver for deeper visibility (requires reboot)." />
            </SectionCard>
            <SectionCard title="Polling" icon={Activity}>
              <div className="py-2 flex items-center gap-3">
                <label className="text-xs font-mono text-zinc-400 w-40 shrink-0">Heartbeat interval (s)</label>
                <Input
                  value={s.heartbeat}
                  onChange={e => set("heartbeat", e.target.value)}
                  className="h-7 w-20 text-[11px] font-mono bg-zinc-900/80 border-zinc-700/50 text-zinc-300"
                />
              </div>
            </SectionCard>
          </>
        )}

        {/* ── Detection ──────────────────────────────────────────── */}
        {activeSection === "detection" && (
          <>
            <SectionCard title="Detection Engines" icon={Shield}>
              <Toggle enabled={s.mlDetection}       onChange={v => set("mlDetection", v)}       label="ML-Based Detection"        description="Use on-device machine learning models for anomaly detection." />
              <Toggle enabled={s.behavioural}       onChange={v => set("behavioural", v)}       label="Behavioural Analysis"      description="Monitor process chains and syscall patterns at runtime." />
              <Toggle enabled={s.yara}              onChange={v => set("yara", v)}              label="YARA Rule Scanning"        description="Scan memory and files against loaded YARA rule sets." />
              <Toggle enabled={s.networkCapture}    onChange={v => set("networkCapture", v)}    label="Network Packet Capture"    description="Capture and analyse egress/ingress traffic in real time." />
              <Toggle enabled={s.sandboxDetonation} onChange={v => set("sandboxDetonation", v)} label="Sandbox Detonation"        description="Automatically detonate suspicious samples in an isolated VM." />
            </SectionCard>
            <SectionCard title="Sensitivity" icon={Shield}>
              <div className="py-2 flex items-center gap-2">
                {(["low", "medium", "high"] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => set("sensitivity", level)}
                    className={cn(
                      "px-3 py-1 text-[10px] font-mono font-semibold rounded border uppercase tracking-wider transition-colors",
                      s.sensitivity === level
                        ? level === "high"   ? "bg-red-950/50 border-red-700/60 text-red-400"
                        : level === "medium" ? "bg-yellow-950/50 border-yellow-700/60 text-yellow-400"
                                             : "bg-emerald-950/50 border-emerald-700/60 text-emerald-400"
                        : "bg-zinc-800/40 border-zinc-700/50 text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {level}
                  </button>
                ))}
                <span className="ml-3 text-[10px] font-mono text-zinc-600">
                  {s.sensitivity === "high"
                    ? "More alerts, higher false-positive rate."
                    : s.sensitivity === "low"
                    ? "Fewer alerts, may miss low-confidence threats."
                    : "Balanced detection threshold (recommended)."}
                </span>
              </div>
            </SectionCard>
          </>
        )}

        {/* ── Database ───────────────────────────────────────────── */}
        {activeSection === "database" && (
          <SectionCard title="Local Database" icon={Database}>
            <div className="py-2 space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-xs font-mono text-zinc-400 w-36 shrink-0">DB Path</label>
                <Input
                  value={s.dbPath}
                  onChange={e => set("dbPath", e.target.value)}
                  className="h-7 flex-1 text-[11px] font-mono bg-zinc-900/80 border-zinc-700/50 text-zinc-300"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-mono text-zinc-400 w-36 shrink-0">Retention (days)</label>
                <Input
                  value={s.retentionDays}
                  onChange={e => set("retentionDays", e.target.value)}
                  className="h-7 w-20 text-[11px] font-mono bg-zinc-900/80 border-zinc-700/50 text-zinc-300"
                />
              </div>
            </div>
            <Toggle enabled={s.autoVacuum} onChange={v => set("autoVacuum", v)} label="Auto-Vacuum" description="Periodically compact the SQLite database file." />
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-800/30">
              {dbStats ? (
                <>
                  <span className="text-[10px] font-mono text-zinc-600">
                    Size: {dbStats.sizeMb > 0 ? `${dbStats.sizeMb.toFixed(1)} MB` : "No DB file"}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-600 mx-1">·</span>
                  <span className="text-[10px] font-mono text-zinc-600 truncate max-w-[240px]" title={dbStats.path}>
                    {dbStats.path}
                  </span>
                  <Badge className={cn(
                    "ml-auto text-[9px] font-mono px-1.5 py-0 border h-4 rounded-sm",
                    dbStats.connected
                      ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/60"
                      : "bg-zinc-800/40 text-zinc-500 border-zinc-700/60"
                  )}>
                    {dbStats.connected ? "Connected" : "No DB"}
                  </Badge>
                </>
              ) : (
                <span className="text-[10px] font-mono text-zinc-600">Loading stats…</span>
              )}
            </div>
          </SectionCard>
        )}

        {/* ── Alerts ─────────────────────────────────────────────── */}
        {activeSection === "alerts" && (
          <SectionCard title="Alerting" icon={Bell}>
            <Toggle enabled={s.emailAlerts}  onChange={v => set("emailAlerts", v)}  label="Email Alerts"   description="Send alert notifications to a configured email address." />
            <Toggle enabled={s.criticalOnly} onChange={v => set("criticalOnly", v)} label="Critical Only"   description="Only send alerts for critical-severity detections." />
            <div className="py-2 flex items-center gap-3 border-b border-zinc-800/30">
              <label className="text-xs font-mono text-zinc-400 w-36 shrink-0">Slack Webhook URL</label>
              <Input
                value={s.slackWebhook}
                onChange={e => set("slackWebhook", e.target.value)}
                placeholder="https://hooks.slack.com/…"
                className="h-7 flex-1 text-[11px] font-mono bg-zinc-900/80 border-zinc-700/50 text-zinc-300 placeholder:text-zinc-700"
              />
            </div>
          </SectionCard>
        )}

        {/* ── API Keys ───────────────────────────────────────────── */}
        {activeSection === "api" && (
          <SectionCard title="API Keys" icon={Key}>
            <div className="py-2 space-y-3">
              {([
                { label: "VirusTotal API Key",  key: "vtApiKey"      as const },
                { label: "URLhaus Token",        key: "urlhausToken"  as const },
                { label: "Hybrid Analysis Key",  key: "hybridKey"     as const },
              ] as const).map((entry) => (
                <div key={entry.label} className="flex items-center gap-3 border-b border-zinc-800/30 pb-2 last:border-0 last:pb-0">
                  <Globe className="w-3 h-3 text-zinc-600 shrink-0" />
                  <label className="text-xs font-mono text-zinc-400 w-44 shrink-0">{entry.label}</label>
                  <Input
                    value={s[entry.key]}
                    onChange={e => set(entry.key, e.target.value)}
                    type="password"
                    placeholder="Not configured"
                    className="h-7 flex-1 text-[11px] font-mono bg-zinc-900/80 border-zinc-700/50 text-zinc-300 placeholder:text-zinc-600"
                  />
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ── Action buttons ─────────────────────────────────────── */}
        <div className="flex items-center gap-2 mt-auto pt-2">
          <button
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-cyan-700/50 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-950/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-[10px] font-mono font-semibold"
          >
            {saveStatus === "saving" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : saveStatus === "saved" ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved!" : "Save Changes"}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-700/50 bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/40 transition-colors text-[10px] font-mono"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Defaults
          </button>
          {saveStatus === "error" && saveError && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-red-400 ml-2">
              <AlertTriangle className="w-3 h-3" />
              {saveError}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
