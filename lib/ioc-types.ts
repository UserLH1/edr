export type IocType = "IP" | "DOMAIN" | "HASH" | "URL" | "EMAIL"
export type Severity = "critical" | "high" | "medium" | "low"

export interface IocEntry {
  id: string
  indicator: string
  type: IocType
  severity: Severity
  confidence: number
  source: string
  firstSeen: string
  lastSeen: string
  hits: number
  tags: string[]
  description: string
}

// ── Built-in IOC baseline (loaded when no saved DB exists) ────────────────────
export const DEFAULT_IOCS: IocEntry[] = [
  { id: "ioc-001", indicator: "192.168.1.99",            type: "IP",     severity: "critical", confidence: 98, source: "Threat Intel Feed",  firstSeen: "2025-03-28 03:14:22", lastSeen: "2025-04-01 07:42:01", hits: 14, tags: ["C2", "Cobalt Strike", "APT29"],         description: "Known Cobalt Strike C2 server linked to APT29 activity." },
  { id: "ioc-002", indicator: "malware-drop.xyz",        type: "DOMAIN", severity: "critical", confidence: 95, source: "URLhaus",            firstSeen: "2025-03-30 11:01:44", lastSeen: "2025-04-01 05:55:10", hits: 7,  tags: ["dropper", "malware", "phishing"],       description: "Malware dropper domain serving stage-2 payload via HTTP." },
  { id: "ioc-003", indicator: "4a8a08f09d37b73795649038408b5f33", type: "HASH", severity: "high", confidence: 91, source: "VirusTotal", firstSeen: "2025-02-14 09:22:18", lastSeen: "2025-03-29 22:11:55", hits: 3, tags: ["mimikatz", "credential-dump"],          description: "MD5 of known Mimikatz variant used for credential harvesting." },
  { id: "ioc-004", indicator: "http://update-srv.net/payload.ps1", type: "URL", severity: "high", confidence: 87, source: "Hybrid Analysis", firstSeen: "2025-03-15 17:45:30", lastSeen: "2025-03-31 14:20:09", hits: 2, tags: ["powershell", "dropper", "LOLbins"],   description: "PowerShell script URL used in living-off-the-land attack chain." },
  { id: "ioc-005", indicator: "attacker@proton-secure.io", type: "EMAIL", severity: "medium", confidence: 72, source: "PhishTank",       firstSeen: "2025-03-01 08:10:44", lastSeen: "2025-03-28 12:30:00", hits: 5,  tags: ["phishing", "spear-phishing"],           description: "Sender address linked to targeted spear-phishing campaigns." },
  { id: "ioc-006", indicator: "10.0.0.254",              type: "IP",     severity: "medium",   confidence: 63, source: "Internal SIEM",     firstSeen: "2025-03-29 00:00:00", lastSeen: "2025-04-01 01:11:11", hits: 9,  tags: ["lateral-movement", "SMB"],              description: "Internal IP showing anomalous SMB lateral movement behaviour." },
  { id: "ioc-007", indicator: "cdn-assets-deliver.com",  type: "DOMAIN", severity: "low",      confidence: 45, source: "OpenPhish",         firstSeen: "2025-03-10 20:55:33", lastSeen: "2025-03-25 08:22:17", hits: 1,  tags: ["suspicious", "typosquat"],              description: "Potential typosquat domain mimicking a legitimate CDN provider." },
  { id: "ioc-008", indicator: "nc.exe",                  type: "HASH",   severity: "critical", confidence: 99, source: "Internal Rules",    firstSeen: "2024-01-01 00:00:00", lastSeen: "2025-04-01 00:00:00", hits: 0,  tags: ["netcat", "reverse-shell", "C2"],        description: "Netcat binary — commonly used as a reverse shell / C2 relay." },
  { id: "ioc-009", indicator: "mimikatz",                type: "HASH",   severity: "critical", confidence: 100, source: "Internal Rules",   firstSeen: "2024-01-01 00:00:00", lastSeen: "2025-04-01 00:00:00", hits: 0, tags: ["mimikatz", "credential-dump", "APT"],   description: "Mimikatz — credential harvesting / pass-the-hash tool." },
  { id: "ioc-010", indicator: "mshta.exe",               type: "HASH",   severity: "high",     confidence: 80, source: "LOLBAS Project",    firstSeen: "2024-01-01 00:00:00", lastSeen: "2025-04-01 00:00:00", hits: 0,  tags: ["LOLBin", "mshta", "dropper"],           description: "mshta.exe used as a living-off-the-land binary for payload execution." },
]
