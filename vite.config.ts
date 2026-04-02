import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      // Mirrors the @/* alias from tsconfig so all existing imports work unchanged.
      "@": path.resolve(__dirname, "."),
    },
  },

  // Tauri dev server requirements: fixed port, no HMR overlay blocking the webview.
  server: {
    port: 5173,
    strictPort: true,
    // Required so Tauri's file protocol doesn't block the HMR websocket.
    hmr: {
      protocol: "ws",
      host: "localhost",
    },
  },

  // Vite env prefix for Tauri — exposes VITE_* and TAURI_* vars to the frontend.
  envPrefix: ["VITE_", "TAURI_"],

  build: {
    outDir: "dist",
    // Tauri on Windows targets ES2021+; don't go lower or you lose async/await sugar.
    target: ["es2021", "chrome100", "safari13"],
    // Inline small assets to avoid extra network requests in the webview.
    assetsInlineLimit: 4096,
    // Sourcemaps only in dev builds (controlled by Tauri's debug flag).
    sourcemap: !!process.env.TAURI_DEBUG,
  },
})
