import { useState, useEffect, useCallback } from "react"
import { ipc } from "@/lib/ipc"
import { DEFAULT_IOCS, type IocEntry } from "@/lib/ioc-types"

type SaveStatus = "idle" | "saving" | "saved" | "error"

interface UseIocStoreResult {
  iocs: IocEntry[]
  addIoc: (entry: IocEntry) => void
  removeIoc: (id: string) => void
  /** Merge imported entries, deduplicating by indicator (case-insensitive). */
  importIocs: (entries: IocEntry[]) => void
  saveStatus: SaveStatus
}

export function useIocStore(): UseIocStoreResult {
  const [iocs, setIocs] = useState<IocEntry[]>(DEFAULT_IOCS)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")

  // Load persisted DB on mount; fall back to built-in defaults if empty
  useEffect(() => {
    ipc.loadIocDb()
      .then(json => {
        if (!json) return
        try {
          const parsed = JSON.parse(json) as IocEntry[]
          if (Array.isArray(parsed) && parsed.length > 0) setIocs(parsed)
        } catch {
          // corrupt JSON — keep defaults
        }
      })
      .catch(err => console.error("[NexusEDR] loadIocDb:", err))
  }, [])

  const persist = useCallback((next: IocEntry[]) => {
    setSaveStatus("saving")
    ipc.saveIocDb(JSON.stringify(next))
      .then(() => {
        setSaveStatus("saved")
        setTimeout(() => setSaveStatus("idle"), 2000)
      })
      .catch(err => {
        console.error("[NexusEDR] saveIocDb:", err)
        setSaveStatus("error")
      })
  }, [])

  const addIoc = useCallback((entry: IocEntry) => {
    setIocs(prev => {
      const next = [...prev, entry]
      persist(next)
      return next
    })
  }, [persist])

  const removeIoc = useCallback((id: string) => {
    setIocs(prev => {
      const next = prev.filter(i => i.id !== id)
      persist(next)
      return next
    })
  }, [persist])

  const importIocs = useCallback((entries: IocEntry[]) => {
    setIocs(prev => {
      const existing = new Set(prev.map(i => i.indicator.toLowerCase()))
      const newEntries = entries.filter(e => !existing.has(e.indicator.toLowerCase()))
      if (newEntries.length === 0) return prev
      const next = [...prev, ...newEntries]
      persist(next)
      return next
    })
  }, [persist])

  return { iocs, addIoc, removeIoc, importIocs, saveStatus }
}
