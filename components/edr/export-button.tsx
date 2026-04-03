import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeCell(value: unknown): string {
  const s =
    value === null || value === undefined
      ? ""
      : Array.isArray(value)
      ? value.join("|")
      : String(value)
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const lines = rows.map(row => headers.map(h => escapeCell(row[h])).join(","))
  return [headers.join(","), ...lines].join("\n")
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ExportButtonProps {
  /** Data rows to export. Nested arrays are flattened to pipe-separated values in CSV. */
  data: Record<string, unknown>[]
  /** Base filename without extension (timestamp appended automatically). */
  filename: string
  label?: string
  className?: string
}

export function ExportButton({ data, filename, label = "Export", className }: ExportButtonProps) {
  const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")
  const base = `${filename}_${ts}`

  function handleJson() {
    triggerDownload(JSON.stringify(data, null, 2), `${base}.json`, "application/json")
  }

  function handleCsv() {
    triggerDownload(toCsv(data), `${base}.csv`, "text/csv;charset=utf-8;")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 px-2.5 gap-1.5 text-[10px] font-mono border-zinc-700/50 bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/40",
            className
          )}
          aria-label={`Export ${label}`}
        >
          <Download className="w-3 h-3" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-zinc-900 border-zinc-700 text-xs font-mono min-w-[120px]"
      >
        <DropdownMenuItem
          onClick={handleJson}
          className="text-zinc-300 hover:text-cyan-300 focus:text-cyan-300 focus:bg-zinc-800 cursor-pointer"
        >
          Export JSON
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleCsv}
          className="text-zinc-300 hover:text-cyan-300 focus:text-cyan-300 focus:bg-zinc-800 cursor-pointer"
        >
          Export CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
