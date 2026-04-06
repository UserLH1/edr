// lib.rs — Tauri v2 library entry point.
// Required for the cdylib / staticlib crate types used by mobile targets.
// Must declare the same module tree as main.rs.

mod commands;
mod monitor;
pub mod geo;