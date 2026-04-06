import { useState } from "react"
import { AppHeader } from "@/components/edr/app-header"
import { Sidebar, type ViewId } from "@/components/edr/sidebar"
import { MainCanvas } from "@/components/edr/main-canvas"
import { SubnetDashboard } from "@/components/edr/subnet-dashboard"
import { NetworkConnectionsView } from "@/components/edr/network-connections-view"
import { ProcessTreeView } from "@/components/edr/process-tree-view"
import { IocMatchesView } from "@/components/edr/ioc-matches-view"
import { SettingsView } from "@/components/edr/settings-view"
import { NetworkGraphView } from "@/components/edr/network-graph-view"
import { AlertOverlay } from "@/components/edr/alert-overlay"

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>("endpoint-map")

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-zinc-950 text-zinc-100">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeView={activeView} onNavigate={setActiveView} />
        {activeView === "network-connections" ? (
          <NetworkConnectionsView />
        ) : activeView === "network-graph" ? (
          <NetworkGraphView />
        ) : activeView === "subnet-scanner" ? (
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
      {/* Floating threat alert stack — always mounted, manages its own subscription */}
      <AlertOverlay />
    </div>
  )
}
