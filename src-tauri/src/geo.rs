/*!
 * GeoIP + Reverse-DNS enrichment state for NexusEDR (Phase 6).
 *
 * On startup, `GeoIpState::new(data_dir)` tries to open the following optional
 * database files from the app's AppData folder:
 *
 *   Country lookup (tries both — first one found wins):
 *     GeoLite2-City.mmdb     ← superset; use this if you have it
 *     GeoLite2-Country.mmdb  ← lighter alternative
 *
 *   ASN lookup:
 *     GeoLite2-ASN.mmdb
 *
 * Download the free GeoLite2 databases from MaxMind (free account required):
 *   https://www.maxmind.com/en/geolite2/signup
 *
 * Place the .mmdb files in:
 *   %APPDATA%\com.nexusedr.app\
 *
 * If a file is missing, the corresponding lookups silently return "".
 * The terminal will print which files were found / missing at startup.
 *
 * Reverse-DNS results are cached in `dns_cache` (populated asynchronously
 * by `commands::network` via `tokio::task::spawn_blocking`).
 */

use maxminddb::geoip2;
use std::collections::HashMap;
use std::net::IpAddr;
use std::path::Path;
use std::sync::RwLock;

// ── State ─────────────────────────────────────────────────────────────────────

pub struct GeoIpState {
    /// Loaded from GeoLite2-City.mmdb *or* GeoLite2-Country.mmdb (first found).
    country: Option<maxminddb::Reader<Vec<u8>>>,
    /// Loaded from GeoLite2-ASN.mmdb.
    asn:     Option<maxminddb::Reader<Vec<u8>>>,
    /// Reverse-DNS cache: IP string → resolved hostname (or "" on failure/timeout).
    pub dns_cache: RwLock<HashMap<String, String>>,
}

impl GeoIpState {
    /// Initialise readers from `data_dir`.  Missing files are silently skipped
    /// but logged to stderr so the operator can diagnose missing databases.
    pub fn new(data_dir: &Path) -> Self {
        let country = Self::load_country_db(data_dir);
        let asn     = Self::load_db(data_dir, "GeoLite2-ASN.mmdb");

        Self {
            country,
            asn,
            dns_cache: RwLock::new(HashMap::new()),
        }
    }

    // ── Loader helpers ────────────────────────────────────────────────────────

    /// Tries to load `GeoLite2-City.mmdb` first; falls back to
    /// `GeoLite2-Country.mmdb`.  Logs the result to stderr.
    fn load_country_db(data_dir: &Path) -> Option<maxminddb::Reader<Vec<u8>>> {
        for name in &["GeoLite2-City.mmdb", "GeoLite2-Country.mmdb"] {
            match Self::load_db(data_dir, name) {
                Some(r) => {
                    eprintln!("[GeoIP] Loaded {} (country lookups active)", name);
                    return Some(r);
                }
                None => {
                    eprintln!(
                        "[GeoIP] {} NOT FOUND at {:?}",
                        name,
                        data_dir.join(name)
                    );
                }
            }
        }
        eprintln!("[GeoIP] No country database found — countryCode will be empty.");
        None
    }

    /// Generic single-file loader.  Returns `None` if the file is missing or
    /// the bytes cannot be parsed as a valid MaxMind database.
    fn load_db(data_dir: &Path, name: &str) -> Option<maxminddb::Reader<Vec<u8>>> {
        let path  = data_dir.join(name);
        let bytes = std::fs::read(&path).ok()?;
        let reader = maxminddb::Reader::from_source(bytes).ok()?;
        if name == "GeoLite2-ASN.mmdb" {
            eprintln!("[GeoIP] Loaded {} (ASN lookups active)", name);
        }
        Some(reader)
    }

    // ── Public status ─────────────────────────────────────────────────────────

    /// Returns true if at least the country database was loaded.
    pub fn has_geo(&self) -> bool {
        self.country.is_some()
    }

    // ── Lookup helpers ────────────────────────────────────────────────────────

    /// ISO-3166-1 alpha-2 country code, e.g. "US", "RO".
    /// Works with both GeoLite2-City.mmdb and GeoLite2-Country.mmdb.
    /// Returns "" if the database is not loaded or the IP has no record.
    pub fn country_code(&self, ip: &IpAddr) -> String {
        let reader = match &self.country {
            Some(r) => r,
            None    => return String::new(),
        };

        // geoip2::City is a superset of Country and deserialises cleanly
        // against both City.mmdb and Country.mmdb — extra City fields simply
        // come back as None from a Country database.
        if let Ok(rec) = reader.lookup::<geoip2::City>(*ip) {
            let code = rec.country
                .and_then(|c| c.iso_code)
                .map(|s| s.to_ascii_uppercase())
                .unwrap_or_default();
            if !code.is_empty() {
                return code;
            }
        }

        // Explicit Country struct as final fallback (e.g. if City deserialization
        // fails for some unexpected reason).
        reader
            .lookup::<geoip2::Country>(*ip)
            .ok()
            .and_then(|rec| rec.country)
            .and_then(|c| c.iso_code)
            .map(|s| s.to_ascii_uppercase())
            .unwrap_or_default()
    }

    /// Autonomous system organisation name, e.g. "GOOGLE", "AMAZON-02".
    /// Returns "" if the ASN database is not loaded or the IP has no record.
    pub fn asn_org(&self, ip: &IpAddr) -> String {
        let reader = match &self.asn {
            Some(r) => r,
            None    => return String::new(),
        };
        reader
            .lookup::<geoip2::Asn>(*ip)
            .ok()
            .and_then(|rec| rec.autonomous_system_organization)
            .map(|s| s.to_string())
            .unwrap_or_default()
    }

    // ── DNS cache ─────────────────────────────────────────────────────────────

    /// Returns `Some(domain)` if the IP has been resolved (including `Some("")`
    /// on failure/timeout).  Returns `None` if the IP has never been queried.
    pub fn cached_dns(&self, ip: &str) -> Option<String> {
        self.dns_cache.read().ok()?.get(ip).cloned()
    }

    /// Store a resolved hostname.  Empty string signals "lookup failed or timed-out".
    pub fn store_dns(&self, ip: String, hostname: String) {
        if let Ok(mut cache) = self.dns_cache.write() {
            cache.insert(ip, hostname);
        }
    }
}
