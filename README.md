# NexusEDR

> A modern, cross-platform **Endpoint Detection & Response** desktop application, built with Tauri, React and Rust.

NexusEDR gives you a real-time, visual view of what is happening on an endpoint: which processes are running, what they talk to on the network, where those connections go geographically, and whether any of it matches known indicators of compromise. It is designed for threat hunters, blue-teamers and curious power users who want an EDR-style tool that is transparent, fast and self-contained.

---

## Features

### Threat Hunting
- **Endpoint Map**: interactive process dependency graph with threat-based coloring.
- **Process Tree**: hierarchical parent/child process view.
- **Process Inspector**: detailed per-process metrics (CPU %, memory, threads, command line, executable path).
- **Threat Scoring**: heuristic scoring based on process name, command line and known suspicious patterns (e.g. obfuscated PowerShell flags like `-enc`, `-w hidden`, `-noprofile`).

### Network Recon
- **Network Connections**: enriched TCP/UDP socket table with GeoIP country/ASN and reverse-DNS resolution.
- **Network Topology**: graph visualization of active flows using XY Flow.
- **Subnet Scanner**: subnet discovery and host enumeration.

### Intelligence & Response
- **IoC Matches**: load a local IOC database (JSON) and match it against running processes and live network endpoints.
- **Host Isolation**: cut a host off from the network (firewall-level).
- **IP Block / Unblock**: add or remove firewall rules for a specific remote address.
- **Process Control**: kill or suspend a process using the native Win32 API for reliability.
- **File Hashing**: on-demand SHA-256 hashing (64 KB streaming) for executables.

### Telemetry
- Live CPU, RAM and disk I/O metrics, refreshed every 2 seconds with proper delta computation.
- Event-driven architecture: the Rust backend emits `process_update` and `system_update` events; the UI reacts without polling.

---

## Tech Stack

**Desktop shell**
- [Tauri 2.0](https://tauri.app/): Rust-backed, lightweight, native window

**Frontend**
- React 19 + Vite 6
- TypeScript 5.7
- TailwindCSS 4 + Radix UI primitives
- [XY Flow](https://reactflow.dev/) for graph views
- Recharts for metric charts
- React Hook Form + Zod
- Lucide icons, Sonner toasts

**Rust backend (`src-tauri`)**
- [`sysinfo`](https://crates.io/crates/sysinfo): processes, CPU, memory, disk
- [`netstat2`](https://crates.io/crates/netstat2): socket enumeration
- [`maxminddb`](https://crates.io/crates/maxminddb): GeoIP lookups (GeoLite2)
- [`dns-lookup`](https://crates.io/crates/dns-lookup): reverse DNS, cached asynchronously
- [`sha2`](https://crates.io/crates/sha2) + [`hex`](https://crates.io/crates/hex): file hashing
- [`windows-sys`](https://crates.io/crates/windows-sys): Win32 API for kill/suspend
- `tokio`, `serde`, `serde_json`

---

## Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  React UI (Vite + Tauri)    │ ◀────▶ │  Rust backend (Tauri commands)│
│  - Dashboard views          │ events │  - monitor/worker            │
│  - Graphs & charts          │        │  - process/network collectors │
│  - IOC matching UI          │        │  - GeoIP + DNS enrichment    │
└─────────────────────────────┘        │  - response actions (kill…)  │
                                       └──────────────────────────────┘
```

The backend runs a background worker that takes a snapshot of running processes and system metrics every **2 seconds** and emits events to the UI. Response actions (kill, suspend, isolate, block IP) are invoked as Tauri commands.

---

## Getting Started

### Prerequisites
- **Node.js** 18+
- **Rust** (stable) + Cargo
- Tauri 2 prerequisites for your OS; see the [Tauri docs](https://tauri.app/start/prerequisites/)
- Windows is the primary target; other platforms may work with reduced response-action coverage.

### Install & Run

```bash
git clone https://github.com/<your-user>/nexus-edr.git
cd nexus-edr
npm install

# Development (Tauri + Vite HMR)
npm run dev

# Production build
npm run build
```

Additional scripts:

| Script              | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `npm run dev:vite`  | Frontend only, on `http://localhost:5173` |
| `npm run build:vite`| Frontend production bundle                |
| `npm run preview`   | Preview the built frontend                |

### GeoIP databases (optional)

GeoIP enrichment is **optional**. To enable it, obtain the free [MaxMind GeoLite2](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data) databases (City / Country and ASN) and place the `.mmdb` files in the `db/` folder. On startup, the backend loads whatever is present; missing databases simply disable that layer of enrichment.

### IOC database

The IOC database is a plain JSON file stored under the OS app-data directory (e.g. `%APPDATA%\com.nexusedr.app\ioc_db.json` on Windows). It is loaded and saved automatically through the `load_ioc_db` / `save_ioc_db` Tauri commands.

---

## Project Layout

```
.
├── app/             # Route-level React views
├── components/      # Shared UI components
├── src/             # Frontend entry + feature modules
├── hooks/           # React hooks
├── lib/             # Frontend utilities
├── styles/          # Tailwind + globals
├── public/          # Icons and static assets
├── db/              # GeoLite2 databases (not committed)
└── src-tauri/       # Rust backend (commands, monitor, response)
```

---

## Roadmap

- Cross-platform parity for response actions (Linux/macOS)
- Persistent timeline / event log
- Export of findings (CSV, JSON, STIX)
- Richer IOC formats (hashes, YARA, Sigma)
- Pluggable detection rules

---

## Disclaimer

NexusEDR is a **research and educational** project. Run it only on systems you own or are explicitly authorized to monitor. Response actions such as killing processes, suspending threads and modifying firewall rules require administrator privileges and can affect the stability of the host; use them with care.

---

## License

TBD: add a license of your choice (MIT / Apache-2.0 are common for open-source tooling) before publishing.
