"use client"

import { useState } from "react"
import { AppHeader } from "@/components/edr/app-header"
import { Sidebar, type ViewId } from "@/components/edr/sidebar"
import { MainCanvas } from "@/components/edr/main-canvas"
import { SubnetDashboard } from "@/components/edr/subnet-dashboard"
import { ProcessTreeView } from "@/components/edr/process-tree-view"
import { IocMatchesView } from "@/components/edr/ioc-matches-view"
import { SettingsView } from "@/components/edr/settings-view"

export default function Page() {
  const [activeView, setActiveView] = useState<ViewId>("endpoint-map")

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-zinc-950 text-zinc-100">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeView={activeView} onNavigate={setActiveView} />
        {activeView === "subnet-scanner" ? (
          <SubnetDashboard />
        ) : activeView === "process-tree" ? (
          <ProcessTreeView />
        ) : activeView === "ioc-matches" ? (
          <IocMatchesView />
        ) : activeView === "settings" ? (
          <SettingsView />
        ) : (
          <MainCanvas />
        )}
      </div>
    </div>
  )
}
