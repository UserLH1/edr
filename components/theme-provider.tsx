import * as React from 'react'

// NexusEDR always runs in dark mode — no runtime theme switching needed.
// This stub exists to satisfy any shadcn components that reference ThemeProvider.
interface ThemeProviderProps {
  children: React.ReactNode
  [key: string]: unknown
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return <>{children}</>
}
