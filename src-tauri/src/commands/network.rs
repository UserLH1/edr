use netstat2::{get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo};
use serde::Serialize;

/// One network socket entry sent to the frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionInfo {
    /// PID that owns this socket.
    pub pid: u32,
    /// "TCP" or "UDP"
    pub proto: String,
    /// "addr:port" string
    pub local_addr: String,
    /// "addr:port" for TCP, "—" for UDP
    pub remote_addr: String,
    /// TCP state in ALLCAPS (e.g. "ESTABLISHED", "LISTEN") or "LISTEN" for UDP
    pub state: String,
}

/// Returns all socket entries from the OS socket table, across IPv4 and IPv6.
/// The frontend filters by `pid` to show per-process connections.
#[tauri::command]
pub fn get_network_connections() -> Result<Vec<ConnectionInfo>, String> {
    let af = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
    let proto = ProtocolFlags::TCP | ProtocolFlags::UDP;

    let sockets = get_sockets_info(af, proto).map_err(|e| e.to_string())?;

    let mut result: Vec<ConnectionInfo> = Vec::with_capacity(sockets.len());

    for si in sockets {
        // Skip entries with no associated PID (e.g. kernel sockets)
        let pid = match si.associated_pids.first() {
            Some(&p) => p,
            None => continue,
        };

        let conn = match si.protocol_socket_info {
            ProtocolSocketInfo::Tcp(tcp) => ConnectionInfo {
                pid,
                proto: "TCP".to_string(),
                local_addr: format!("{}:{}", tcp.local_addr, tcp.local_port),
                remote_addr: format!("{}:{}", tcp.remote_addr, tcp.remote_port),
                // TcpState Debug repr: "Established" → to_uppercase → "ESTABLISHED"
                state: format!("{:?}", tcp.state).to_uppercase(),
            },
            ProtocolSocketInfo::Udp(udp) => ConnectionInfo {
                pid,
                proto: "UDP".to_string(),
                local_addr: format!("{}:{}", udp.local_addr, udp.local_port),
                remote_addr: "—".to_string(),
                state: "LISTEN".to_string(),
            },
        };

        result.push(conn);
    }

    Ok(result)
}
