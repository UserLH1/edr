import {
  AlertTriangle,
  CheckCircle2,
  ShieldOff,
  Wifi,
  MoreHorizontal,
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

// ── Static chart data (deterministic — no Math.random) ─────────────────────
const trafficData = [
  { t: "00:00", mbps: 12 }, { t: "02:00", mbps: 8 },
  { t: "04:00", mbps: 5 },  { t: "06:00", mbps: 14 },
  { t: "08:00", mbps: 38 }, { t: "10:00", mbps: 52 },
  { t: "12:00", mbps: 47 }, { t: "14:00", mbps: 61 },
  { t: "16:00", mbps: 88 }, { t: "18:00", mbps: 74 },
  { t: "20:00", mbps: 95 }, { t: "22:00", mbps: 43 },
  { t: "24:00", mbps: 29 },
]

const portData = [
  { port: "443 (HTTPS)", devices: 38, danger: false },
  { port: "80 (HTTP)",   devices: 22, danger: false },
  { port: "22 (SSH)",    devices: 5,  danger: false },
  { port: "445 (SMB)",   devices: 2,  danger: true  },
]

const assets = [
  {
    ip:    "192.168.1.1",
    mac:   "00:1A:2B:3C:4D",
    os:    "Linux 3.x (Router)",
    ports: "53, 80, 443",
    status: "SAFE" as const,
  },
  {
    ip:    "192.168.1.15",
    mac:   "AA:BB:CC:DD:EE",
    os:    "Windows 11",
    ports: "135, 139, 445",
    status: "VULNERABLE" as const,
  },
  {
    ip:    "192.168.1.42",
    mac:   "11:22:33:44:55",
    os:    "Apple iOS",
    ports: "62078",
    status: "SAFE" as const,
  },
]

// ── Metric card ─────────────────────────────────────────────────────────────
function MetricCard({
  title,
  value,
  sub,
  subColor,
  icon,
  sparkline,
}: {
  title: string
  value: string
  sub: string
  subColor?: string
  icon?: React.ReactNode
  sparkline?: boolean
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
        {sparkline && (
          <div className="mt-2 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData.slice(-6)} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="mbps"
                  stroke="#22d3ee"
                  strokeWidth={1.5}
                  fill="url(#sparkFill)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[10px] font-mono text-zinc-300">
      <p>{label}</p>
      <p className="text-cyan-400">{payload[0].value} Mbps</p>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export function SubnetDashboard() {
  return (
    <main
      className="flex-1 overflow-y-auto bg-zinc-950 p-6"
      aria-label="Subnet Recon Analytics Dashboard"
    >
      {/* Page heading */}
      <div className="mb-5">
        <h1 className="text-sm font-mono font-bold text-zinc-200 tracking-widest uppercase">
          Subnet Recon Analytics
        </h1>
        <p className="text-[11px] font-mono text-zinc-600 mt-0.5">
          Scope: 192.168.1.0/24 &bull; Last scan: 2 min ago
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {/* ── Row 1: Metric cards ─────────────────────────────── */}
        <MetricCard
          title="Total Live Assets"
          value="42"
          sub="+3 in last hour"
          sparkline
        />
        <MetricCard
          title="High Risk Devices"
          value="2"
          subColor="text-red-400"
          sub="Requires attention"
          icon={<AlertTriangle className="w-4 h-4 text-red-500 shrink-0" aria-hidden="true" />}
        />
        <MetricCard
          title="Exposed Services"
          value="128"
          sub="Open ports detected"
          icon={<ShieldOff className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />}
        />
        <MetricCard
          title="Rogue APs / Spoofing"
          value="0"
          sub="Network secure"
          subColor="text-emerald-400"
          icon={<Wifi className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />}
        />

        {/* ── Row 2: Area chart ────────────────────────────────── */}
        <Card className="md:col-span-2 bg-zinc-900/50 border-zinc-800 rounded-lg">
          <CardHeader className="pt-4 px-4 pb-2">
            <CardTitle className="text-[10px] font-mono font-semibold tracking-widest text-zinc-500 uppercase">
              Network Traffic Volume (Subnet)
            </CardTitle>
            <p className="text-[10px] font-mono text-zinc-600">Last 24 hours &bull; Mbps</p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="t"
                    tick={{ fontSize: 9, fill: "#52525b", fontFamily: "monospace" }}
                    tickLine={false}
                    axisLine={false}
                    interval={2}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#52525b", fontFamily: "monospace" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="mbps"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    fill="url(#trafficFill)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* ── Row 2: Bar chart ─────────────────────────────────── */}
        <Card className="md:col-span-2 bg-zinc-900/50 border-zinc-800 rounded-lg">
          <CardHeader className="pt-4 px-4 pb-2">
            <CardTitle className="text-[10px] font-mono font-semibold tracking-widest text-zinc-500 uppercase">
              Top Open Ports
            </CardTitle>
            <p className="text-[10px] font-mono text-zinc-600">Device count per service</p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={portData}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
                  barSize={12}
                >
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 9, fill: "#52525b", fontFamily: "monospace" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="port"
                    width={90}
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
                          <p className="text-cyan-400">{payload[0].value} devices</p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="devices" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                    {portData.map((entry) => (
                      <Cell
                        key={entry.port}
                        fill={entry.danger ? "#f97316" : "#22d3ee"}
                        opacity={entry.danger ? 1 : 0.75}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* ── Row 3: Asset table ───────────────────────────────── */}
        <Card className="md:col-span-4 bg-zinc-900/50 border-zinc-800 rounded-lg">
          <CardHeader className="pt-4 px-4 pb-2">
            <CardTitle className="text-[10px] font-mono font-semibold tracking-widest text-zinc-500 uppercase">
              Discovered Assets
            </CardTitle>
            <p className="text-[10px] font-mono text-zinc-600">
              {assets.length} hosts &bull; 192.168.1.0/24
            </p>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  {["IP Address", "MAC Address", "OS Guess", "Open Ports", "Status", "Actions"].map((h) => (
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
                {assets.map((row) => (
                  <TableRow
                    key={row.ip}
                    className="border-zinc-800/50 hover:bg-zinc-800/20 transition-colors"
                  >
                    <TableCell className="text-xs font-mono text-cyan-400 px-4 py-2.5">
                      {row.ip}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-zinc-400 px-4 py-2.5">
                      {row.mac}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-zinc-400 px-4 py-2.5">
                      {row.os}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-zinc-500 px-4 py-2.5">
                      {row.ports}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {row.status === "VULNERABLE" ? (
                        <Badge className="text-[9px] font-mono tracking-wider bg-red-950/50 text-red-400 border-red-800/60 hover:bg-red-950/50">
                          VULNERABLE
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
          </CardContent>
        </Card>

      </div>
    </main>
  )
}
