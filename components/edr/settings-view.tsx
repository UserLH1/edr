import { useState } from "react"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

type SettingsSection = "agent" | "detection" | "database" | "alerts" | "api"

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

  // Agent settings
  const [agentEnabled, setAgentEnabled] = useState(true)
  const [autoUpdate, setAutoUpdate] = useState(true)
  const [telemetry, setTelemetry] = useState(true)
  const [kernelMode, setKernelMode] = useState(false)
  const [heartbeat, setHeartbeat] = useState("30")

  // Detection settings
  const [mlDetection, setMlDetection] = useState(true)
  const [behavioural, setBehavioural] = useState(true)
  const [yara, setYara] = useState(true)
  const [networkCapture, setNetworkCapture] = useState(true)
  const [sandboxDetonation, setSandboxDetonation] = useState(false)
  const [sensitivity, setSensitivity] = useState<"low" | "medium" | "high">("medium")

  // DB settings
  const [dbPath, setDbPath] = useState("C:\\ProgramData\\NEXUS\\edr.db")
  const [retentionDays, setRetentionDays] = useState("90")
  const [autoVacuum, setAutoVacuum] = useState(true)

  // Alerts
  const [emailAlerts, setEmailAlerts] = useState(false)
  const [slackWebhook, setSlackWebhook] = useState("")
  const [criticalOnly, setCriticalOnly] = useState(false)

  // API
  const [vtApiKey, setVtApiKey] = useState("••••••••••••••••••••••••••••••••••••••••••••••••••••••••")

  const sections: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
    { id: "agent",     label: "Agent",      icon: Activity },
    { id: "detection", label: "Detection",  icon: Shield },
    { id: "database",  label: "Database",   icon: Database },
    { id: "alerts",    label: "Alerts",     icon: Bell },
    { id: "api",       label: "API Keys",   icon: Key },
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
        {sections.map((s) => {
          const isActive = activeSection === s.id
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
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
                <s.icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-cyan-400" : "text-zinc-600")} />
                {s.label}
              </div>
              {isActive && <ChevronRight className="w-3 h-3 text-cyan-600" />}
            </button>
          )
        })}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5 flex flex-col gap-4">
        {activeSection === "agent" && (
          <>
            <SectionCard title="Agent Control" icon={Activity}>
              <Toggle enabled={agentEnabled} onChange={setAgentEnabled} label="Agent Enabled" description="Enable or disable the EDR agent on this endpoint." />
              <Toggle enabled={autoUpdate} onChange={setAutoUpdate} label="Auto-Update Agent" description="Automatically install new agent versions when available." />
              <Toggle enabled={telemetry} onChange={setTelemetry} label="Telemetry Collection" description="Send anonymised usage metrics to improve detection quality." />
              <Toggle enabled={kernelMode} onChange={setKernelMode} label="Kernel-Mode Driver" description="Enable kernel driver for deeper visibility (requires reboot)." />
            </SectionCard>
            <SectionCard title="Polling" icon={Activity}>
              <div className="py-2 flex items-center gap-3">
                <label className="text-xs font-mono text-zinc-400 w-40 shrink-0">Heartbeat interval (s)</label>
                <Input
                  value={heartbeat}
                  onChange={(e) => setHeartbeat(e.target.value)}
                  className="h-7 w-20 text-[11px] font-mono bg-zinc-900/80 border-zinc-700/50 text-zinc-300"
                />
              </div>
            </SectionCard>
          </>
        )}

        {activeSection === "detection" && (
          <>
            <SectionCard title="Detection Engines" icon={Shield}>
              <Toggle enabled={mlDetection} onChange={setMlDetection} label="ML-Based Detection" description="Use on-device machine learning models for anomaly detection." />
              <Toggle enabled={behavioural} onChange={setBehavioural} label="Behavioural Analysis" description="Monitor process chains and syscall patterns at runtime." />
              <Toggle enabled={yara} onChange={setYara} label="YARA Rule Scanning" description="Scan memory and files against loaded YARA rule sets." />
              <Toggle enabled={networkCapture} onChange={setNetworkCapture} label="Network Packet Capture" description="Capture and analyse egress/ingress traffic in real time." />
              <Toggle enabled={sandboxDetonation} onChange={setSandboxDetonation} label="Sandbox Detonation" description="Automatically detonate suspicious samples in an isolated VM." />
            </SectionCard>
            <SectionCard title="Sensitivity" icon={Shield}>
              <div className="py-2 flex items-center gap-2">
                {(["low", "medium", "high"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSensitivity(s)}
                    className={cn(
                      "px-3 py-1 text-[10px] font-mono font-semibold rounded border uppercase tracking-wider transition-colors",
                      sensitivity === s
                        ? s === "high"   ? "bg-red-950/50 border-red-700/60 text-red-400"
                        : s === "medium" ? "bg-yellow-950/50 border-yellow-700/60 text-yellow-400"
                                         : "bg-emerald-950/50 border-emerald-700/60 text-emerald-400"
                        : "bg-zinc-800/40 border-zinc-700/50 text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {s}
                  </button>
                ))}
                <span className="ml-3 text-[10px] font-mono text-zinc-600">
                  {sensitivity === "high" ? "More alerts, higher false-positive rate." : sensitivity === "low" ? "Fewer alerts, may miss low-confidence threats." : "Balanced detection threshold (recommended)."}
                </span>
              </div>
            </SectionCard>
          </>
        )}

        {activeSection === "database" && (
          <SectionCard title="Local Database" icon={Database}>
            <div className="py-2 space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-xs font-mono text-zinc-400 w-36 shrink-0">DB Path</label>
                <Input
                  value={dbPath}
                  onChange={(e) => setDbPath(e.target.value)}
                  className="h-7 flex-1 text-[11px] font-mono bg-zinc-900/80 border-zinc-700/50 text-zinc-300"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-mono text-zinc-400 w-36 shrink-0">Retention (days)</label>
                <Input
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(e.target.value)}
                  className="h-7 w-20 text-[11px] font-mono bg-zinc-900/80 border-zinc-700/50 text-zinc-300"
                />
              </div>
            </div>
            <Toggle enabled={autoVacuum} onChange={setAutoVacuum} label="Auto-Vacuum" description="Periodically compact the SQLite database file." />
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-800/30">
              <span className="text-[10px] font-mono text-zinc-600">Size: 142.8 MB</span>
              <span className="text-[10px] font-mono text-zinc-600 mx-1">·</span>
              <span className="text-[10px] font-mono text-zinc-600">Records: 1,204,443</span>
              <Badge className="ml-auto text-[9px] font-mono px-1.5 py-0 border bg-emerald-950/40 text-emerald-400 border-emerald-800/60 h-4 rounded-sm">Connected</Badge>
            </div>
          </SectionCard>
        )}

        {activeSection === "alerts" && (
          <SectionCard title="Alerting" icon={Bell}>
            <Toggle enabled={emailAlerts} onChange={setEmailAlerts} label="Email Alerts" description="Send alert notifications to a configured email address." />
            <Toggle enabled={criticalOnly} onChange={setCriticalOnly} label="Critical Only" description="Only send alerts for critical-severity detections." />
            <div className="py-2 flex items-center gap-3 border-b border-zinc-800/30">
              <label className="text-xs font-mono text-zinc-400 w-36 shrink-0">Slack Webhook URL</label>
              <Input
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                placeholder="https://hooks.slack.com/..."
                className="h-7 flex-1 text-[11px] font-mono bg-zinc-900/80 border-zinc-700/50 text-zinc-300 placeholder:text-zinc-700"
              />
            </div>
          </SectionCard>
        )}

        {activeSection === "api" && (
          <SectionCard title="API Keys" icon={Key}>
            <div className="py-2 space-y-3">
              {[
                { label: "VirusTotal API Key",    value: vtApiKey,  set: setVtApiKey,  icon: Globe },
                { label: "URLhaus Token",          value: "••••••••••••••••••••••••", set: () => {},  icon: Globe },
                { label: "Hybrid Analysis Key",   value: "Not configured", set: () => {}, icon: Globe },
              ].map((entry) => (
                <div key={entry.label} className="flex items-center gap-3 border-b border-zinc-800/30 pb-2 last:border-0 last:pb-0">
                  <entry.icon className="w-3 h-3 text-zinc-600 shrink-0" />
                  <label className="text-xs font-mono text-zinc-400 w-44 shrink-0">{entry.label}</label>
                  <Input
                    value={entry.value}
                    onChange={(e) => entry.set(e.target.value)}
                    type={entry.value.startsWith("•") ? "password" : "text"}
                    className="h-7 flex-1 text-[11px] font-mono bg-zinc-900/80 border-zinc-700/50 text-zinc-300"
                  />
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-auto pt-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-cyan-700/50 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-950/50 transition-colors text-[10px] font-mono font-semibold">
            <Save className="w-3 h-3" />
            Save Changes
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-700/50 bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/40 transition-colors text-[10px] font-mono">
            <RotateCcw className="w-3 h-3" />
            Reset Defaults
          </button>
        </div>
      </div>
    </div>
  )
}
