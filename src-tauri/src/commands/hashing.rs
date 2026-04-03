use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Read;

/// Computes the SHA-256 hash of a file at the given path.
/// Reads in 64 KB chunks so large executables don't bloat the heap.
/// Returns a lowercase hex-encoded 64-character string.
#[tauri::command]
pub fn hash_file(path: String) -> Result<String, String> {
    let mut file = File::open(&path)
        .map_err(|e| format!("Cannot open '{}': {}", path, e))?;

    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65_536]; // 64 KB read buffer

    loop {
        let n = file.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }

    Ok(hex::encode(hasher.finalize()))
}
