import { useState, useEffect, useMemo } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ShieldOff,
  Wifi,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
} from "recharts"
import { useNetworkConnections } from "@/hooks/use-network-connections"

// ── Port label dictionary ────────────────────────────────────────────────────
const PORT_LABELS: Record<number, string> = {
  21: "21 (FTP)", 22: "22 (SSH)", 23: "23 (Telnet)",
  25: "25 (SMTP)", 53: "53 (DNS)", 80: "80 (HTTP)",
  110: "110 (POP3)", 143: "143 (IMAP)", 443: "443 (HTTPS)",
  445: "445 (SMB)", 3306: "3306 (MySQL)", 3389: "3389 (RDP)",
  5432: "5432 (Postgres)", 5985: "5985 (WinRM)", 6379: "6379 (Redis)",
  8080: "8080 (HTTP-alt)", 8443: "8443 (HTTPS-alt)",
}
const SUSPICIOUS_PORTS = new Set([
  1337, 4444, 4445, 6666, 6667, 9999, 31337, 8888, 1234,
])

function portLabel(port: number): string {
  return PORT_LABELS[port] ?? String(port)
}

function isPublicIp(addr: string): boolean {
  const ip = addr.split(":")[0]
  if (!ip || ip === "0.0.0.0" || ip === "::" || ip === "127.0.0.1") return false
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("172.")) return false
  return true
}

function remotePort(addr: string): number {
  const parts = addr.split(":")
  return parseInt(parts[parts.length - 1] ?? "0") || 0
}

// ── Metric card ─────────────────────────────────────────────────────────────
function MetricCard({
  title,
  value,
  sub,
  subColor,
  icon,
}: {
  title: string
  value: string | number
  sub: string
  subColor?: string
  icon?: React.ReactNode
}) {
  return (
    <Card className="bg-zinc-900/50 border-zinc-800 rounded-lg">
      <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-start justify-between">
        <CardTitle className="text-[10px] font-mono font-semibold tracking-widest text-zinc-500 uppercase">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className={`text-3xl font-mono font-bold leading-none mb-1 ${subColor ?? "text-zinc-100"}`}>
          {value}
        </p>
        <p className="text-[11px] font-mono text-zinc-500">{sub}</p>
      </CardContent>
    </Card>
  )
}

// ── Custom chart tooltips ────────────────────────────────────────────────────
function ConnTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[10px] font-mono text-zinc-300">
      <p>{label}</p>
      <p className="text-cyan-400">{payload[0].value} connections</p>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export function SubnetDashboard() {
  const { connections, loading, lastUpdated } = useNetworkConnections(5000)

  // Rolling history of ESTABLISHED connection counts — one point per poll tick
  const [connHistory, setConnHistory] = useState<{ t: string; count: number }[]>([])
  useEffect(() => {
    if (loading) return
    const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    const count = connections.filter(c => c.state === "ESTABLISHED").length
    setConnHistory(prev => [...prev, { t, count }].slice(-20))
  }, [connections, loading])

  // ── Derived metrics ────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const established = connections.filter(c => c.state === "ESTABLISHED")
    const listening   = connections.filter(c => c.state === "LISTEN")

    // Unique remote IPs (assets)
    const assetMap = new Map<string, { ip: string; ports: Set<string>; flagged: boolean }>()
    for (const conn of established) {
      if (!conn.remoteAddr || conn.remoteAddr.startsWith("0.0.0.0") || conn.remoteAddr.startsWith("::")) continue
      const ip = conn.remoteAddr.includes(":") ? conn.remoteAddr.split(":")[0] : conn.remoteAddr
      if (!ip || ip === "127.0.0.1") continue
      const existing = assetMap.get(ip) ?? { ip, ports: new Set<string>(), flagged: false }
      const port = remotePort(conn.remoteAddr)
      existing.ports.add(portLabel(port))
      if (SUSPICIOUS_PORTS.has(port)) existing.flagged = true
      assetMap.set(ip, existing)
    }

    // Top remote ports by connection count
    const portCountMap = new Map<string, { port: string; devices: number; danger: boolean }>()
    for (const conn of established) {
      const port = remotePort(conn.remoteAddr)
      if (port === 0) continue
      const label = portLabel(port)
      const existing = portCountMap.get(label) ?? { port: label, devices: 0, danger: SUSPICIOUS_PORTS.has(port) }
      portCountMap.set(label, { ...existing, devices: existing.devices + 1 })
    }
    const topPorts = [...portCountMap.values()]
      .sort((a, b) => b.devices - a.devices)
      .slice(0, 8)

    const assets = [...assetMap.values()]
    const flaggedAssets = assets.filter(a => a.flagged)
    const exposedServices = new Set(listening.map(c => c.localAddr.split(":").pop())).size

    return { established, listening, assets, flaggedAssets, topPorts, exposedServices }
  }, [connections])

  const lastScanLabel = lastUpdated > 0
    ? `${Math.round((Date.now() - lastUpdated) / 1000)}s ago`
    : "—"

  return (
    <main
      className="flex-1 overflow-y-auto bg-zinc-950 p-6"
      aria-label="Subnet Recon Analytics Dashboard"
    >
      {/* Page heading */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-mono font-bold text-zinc-200 tracking-widest uppercase">
            Subnet Recon Analytics
          </h1>
          <p className="text-[11px] font-mono text-zinc-600 mt-0.5">
            {loading
              ? "Scanning…"
              : `${connections.length} sockets · Last scan: ${lastScanLabel}`}
          </p>
        </div>
        {loading && (
          <RefreshCw className="w-3.5 h-3.5 text-zinc-600 animate-spin" aria-label="Refreshing" />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {/* ── Row 1: Metric cards ─────────────────────────────── */}
        <MetricCard
          title="Established Connections"
          value={metrics.established.length}
          sub={`${metrics.listening.length} ports listening`}
        />
        <MetricCard
          title="Flagged Connections"
          value={metrics.flaggedAssets.length}
          subColor={metrics.flaggedAssets.length > 0 ? "text-red-400" : undefined}
          sub={metrics.flaggedAssets.length > 0 ? "Suspicious ports detected" : "No suspicious activity"}
          icon={<AlertTriangle className="w-4 h-4 text-red-500 shrink-0" aria-hidden="true" />}
        />
        <MetricCard
          title="Exposed Local Services"
          value={metrics.exposedServices}
          sub="Unique listening ports"
          icon={<ShieldOff className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />}
        />
        <MetricCard
          title="Unique Remote Hosts"
          value={metrics.assets.length}
          sub="Active remote endpoints"
          subColor={metrics.assets.length > 0 ? "text-cyan-300" : undefined}
          icon={<Wifi className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />}
        />

        {/* ── Row 2: Connection history area chart ─────────────── */}
        <Card className="md:col-span-2 bg-zinc-900/50 border-zinc-800 rounded-lg">
          <CardHeader className="pt-4 px-4 pb-2">
            <CardTitle className="text-[10px] font-mono font-semibold tracking-widest text-zinc-500 uppercase">
              Active Connections Over Time
            </CardTitle>
            <p className="text-[10px] font-mono text-zinc-600">
              Established sockets · 5-second resolution
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="h-44">
              {connHistory.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[10px] font-mono text-zinc-600">
                  {loading ? "Collecting data…" : "No data yet"}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={connHistory} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <defs>
                      <linearGradient id="connFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="t"
                      tick={{ fontSize: 9, fill: "#52525b", fontFamily: "monospace" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 9, fill: "#52525b", fontFamily: "monospace" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ConnTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      fill="url(#connFill)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Row 2: Top remote ports bar chart ────────────────── */}
        <Card className="md:col-span-2 bg-zinc-900/50 border-zinc-800 rounded-lg">
          <CardHeader className="pt-4 px-4 pb-2">
            <CardTitle className="text-[10px] font-mono font-semibold tracking-widest text-zinc-500 uppercase">
              Top Remote Ports
            </CardTitle>
            <p className="text-[10px] font-mono text-zinc-600">Established connection count by port</p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="h-44">
              {metrics.topPorts.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[10px] font-mono text-zinc-600">
                  {loading ? "Collecting data…" : "No established connections"}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.topPorts}
                    layout="vertical"
                    margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
                    barSize={12}
                  >
                    <CartesianGrid stroke="#27272a" strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 9, fill: "#52525b", fontFamily: "monospace" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="port"
                      width={100}
                      tick={{ fontSize: 9, fill: "#71717a", fontFamily: "monospace" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <div className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[10px] font-mono text-zinc-300">
                            <p>{label}</p>
                            <p className="text-cyan-400">{payload[0].value} connections</p>
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="devices" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                      {metrics.topPorts.map((entry) => (
                        <Cell
                          key={entry.port}
                          fill={entry.danger ? "#f97316" : "#22d3ee"}
                          opacity={entry.danger ? 1 : 0.75}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Row 3: Discovered remote hosts table ────────────── */}
        <Card className="md:col-span-4 bg-zinc-900/50 border-zinc-800 rounded-lg">
          <CardHeader className="pt-4 px-4 pb-2">
            <CardTitle className="text-[10px] font-mono font-semibold tracking-widest text-zinc-500 uppercase">
              Active Remote Endpoints
            </CardTitle>
            <p className="text-[10px] font-mono text-zinc-600">
              {metrics.assets.length} unique hosts from established connections
            </p>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {metrics.assets.length === 0 ? (
              <p className="text-[11px] font-mono text-zinc-600 px-4 py-3">
                {loading ? "Scanning network connections…" : "No active remote connections detected."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    {["IP Address", "Remote Ports", "Status", "Actions"].map((h) => (
                      <TableHead
                        key={h}
                        className="text-[9px] font-mono font-semibold tracking-widest text-zinc-600 uppercase px-4 py-2"
                      >
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.assets.map((row) => (
                    <TableRow
                      key={row.ip}
                      className="border-zinc-800/50 hover:bg-zinc-800/20 transition-colors"
                    >
                      <TableCell className="text-xs font-mono text-cyan-400 px-4 py-2.5">
                        {row.ip}
                        {isPublicIp(row.ip + ":0") && (
                          <span className="ml-2 text-[9px] text-zinc-500">PUBLIC</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-zinc-500 px-4 py-2.5">
                        {[...row.ports].join(", ")}
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        {row.flagged ? (
                          <Badge className="text-[9px] font-mono tracking-wider bg-red-950/50 text-red-400 border-red-800/60 hover:bg-red-950/50">
                            SUSPICIOUS
                          </Badge>
                        ) : (
                          <Badge className="text-[9px] font-mono tracking-wider bg-emerald-950/50 text-emerald-400 border-emerald-800/60 hover:bg-emerald-950/50 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-2.5 h-2.5" aria-hidden="true" />
                            SAFE
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800"
                              aria-label={`Actions for ${row.ip}`}
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-zinc-900 border-zinc-700 text-xs font-mono"
                          >
                            <DropdownMenuItem className="text-zinc-300 hover:text-cyan-300 focus:text-cyan-300 focus:bg-zinc-800 cursor-pointer">
                              Run Deep Scan
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-zinc-300 hover:text-red-300 focus:text-red-300 focus:bg-zinc-800 cursor-pointer">
                              Isolate IP
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      </div>
    </main>
  )
}
