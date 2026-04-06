use std::collections::HashSet;
use std::net::IpAddr;

use netstat2::{get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo};
use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::geo::GeoIpState;

// ── Enriched socket entry ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionInfo {
    pub pid: u32,
    /// "TCP" | "UDP"
    pub proto: String,
    /// "addr:port"
    pub local_addr: String,
    /// "addr:port" for TCP, "—" for UDP
    pub remote_addr: String,
    /// TCP state (e.g. "ESTABLISHED", "LISTEN") or "LISTEN" for UDP
    pub state: String,

    // ── Phase 6: enrichment fields ────────────────────────────────────────────
    /// ISO-3166-1 alpha-2 code ("US", "RO", "DE", …) or "" if unavailable.
    pub country_code: String,
    /// Reverse-DNS hostname (populated asynchronously; "" until resolved).
    pub domain_name: String,
    /// Autonomous system name ("AMAZON-02", "GOOGLE", …) or "".
    pub asn_org: String,
}

// ── Main command ──────────────────────────────────────────────────────────────

/// Returns all socket entries from the OS socket table.
/// GeoIP fields are populated synchronously from local .mmdb databases.
/// Reverse-DNS fields are populated from a cache that fills in the background;
/// first call for a new IP returns "" — subsequent calls return the hostname.
#[tauri::command]
pub async fn get_network_connections(app: AppHandle) -> Result<Vec<ConnectionInfo>, String> {
    let geo = app.state::<GeoIpState>();

    let af     = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
    let proto  = ProtocolFlags::TCP | ProtocolFlags::UDP;
    let sockets = get_sockets_info(af, proto).map_err(|e| e.to_string())?;

    let mut result: Vec<ConnectionInfo> = Vec::with_capacity(sockets.len());
    // IPs that are not yet in the DNS cache — will be queued for background lookup.
    let mut pending_dns: HashSet<String> = HashSet::new();

    for si in sockets {
        let pid = match si.associated_pids.first() {
            Some(&p) => p,
            None => continue,
        };

        let conn = match si.protocol_socket_info {
            ProtocolSocketInfo::Tcp(tcp) => {
                let remote_ip = tcp.remote_addr.to_string();
                let (country_code, asn_org, domain_name) =
                    enrich_ip(&remote_ip, &geo, &mut pending_dns);

                ConnectionInfo {
                    pid,
                    proto: "TCP".into(),
                    local_addr:  format!("{}:{}", tcp.local_addr, tcp.local_port),
                    remote_addr: format!("{}:{}", tcp.remote_addr, tcp.remote_port),
                    state: format!("{:?}", tcp.state).to_uppercase(),
                    country_code,
                    domain_name,
                    asn_org,
                }
            }
            ProtocolSocketInfo::Udp(udp) => ConnectionInfo {
                pid,
                proto: "UDP".into(),
                local_addr:  format!("{}:{}", udp.local_addr, udp.local_port),
                remote_addr: "—".into(),
                state: "LISTEN".into(),
                country_code: String::new(),
                domain_name:  String::new(),
                asn_org:      String::new(),
            },
        };

        result.push(conn);
    }

    // Spawn background DNS resolution for any IPs not yet cached.
    for ip in pending_dns {
        spawn_dns_lookup(app.clone(), ip);
    }

    Ok(result)
}

// ── Enrichment helpers ────────────────────────────────────────────────────────

/// Populate (country_code, asn_org, domain_name) for a remote IP string.
/// Private / unroutable addresses get empty strings — no point in looking them up.
fn enrich_ip(
    ip_str: &str,
    geo: &GeoIpState,
    pending_dns: &mut HashSet<String>,
) -> (String, String, String) {
    if is_unroutable(ip_str) {
        return (String::new(), String::new(), String::new());
    }

    let ip: IpAddr = match ip_str.parse() {
        Ok(i)  => i,
        Err(_) => return (String::new(), String::new(), String::new()),
    };

    let country_code = geo.country_code(&ip);
    let asn_org      = geo.asn_org(&ip);

    let domain_name = match geo.cached_dns(ip_str) {
        Some(d) => d,            // cached (may be "")
        None => {
            pending_dns.insert(ip_str.to_string());
            String::new()         // will be filled on the next poll
        }
    };

    (country_code, asn_org, domain_name)
}

/// Returns true for IPs that are not worth doing GeoIP / DNS on.
fn is_unroutable(s: &str) -> bool {
    matches!(s, "0.0.0.0" | "::" | "—" | "" | "::1")
        || s.starts_with("127.")
        || s.starts_with("192.168.")
        || s.starts_with("10.")
        || s.starts_with("172.")
        || s.starts_with("169.254.")
        || s.starts_with("fe80::")
}

/// Spawn a background task that performs a reverse-DNS lookup (max 3 s) and
/// stores the result in the GeoIpState DNS cache.
fn spawn_dns_lookup(app: AppHandle, ip_str: String) {
    tokio::spawn(async move {
        let ip: IpAddr = match ip_str.parse() {
            Ok(i)  => i,
            Err(_) => return,
        };

        let result = tokio::time::timeout(
            std::time::Duration::from_secs(3),
            tokio::task::spawn_blocking(move || dns_lookup::lookup_addr(&ip)),
        )
        .await;

        let hostname = match result {
            // timeout::Ok(spawn_blocking::Ok(lookup::Ok(hostname)))
            Ok(Ok(Ok(h))) => h.trim_end_matches('.').to_string(),
            _             => String::new(),
        };

        app.state::<GeoIpState>().store_dns(ip_str, hostname);
    });
}
