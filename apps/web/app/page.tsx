"use client"

import { useState } from "react"
import Feed from "../components/Feed"
import MapView from "../components/MapView"
import FilterBar from "../components/FilterBar"
import Webcam from "../components/Webcam"
import { type ItemType, type TabType, type DateRange } from "../lib/filters"

export type { ItemType, TabType, DateRange }

const TYPE_COLORS: Record<ItemType, string> = {
  news: "#f97316",
  event: "#8b5cf6",
  roadwork: "#eab308",
}

const TRAFFIC_COLOR = "#dc2626"

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("news")
  const [selectedCommune, setSelectedCommune] = useState<number | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>("month")
  const [showMetro, setShowMetro] = useState(true)
  const [showBusNetwork, setShowBusNetwork] = useState(false)
  const [showRailNetwork, setShowRailNetwork] = useState(false)
  const [showPoliticalSites, setShowPoliticalSites] = useState(true)
  const [showWebcam, setShowWebcam] = useState(false)

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-4 px-4 py-3 bg-white border-b border-gray-200 z-10">
        <span className="font-bold text-lg tracking-tight">Brux</span>
        <span className="text-gray-400 text-sm">The pulse of Brussels</span>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setShowWebcam(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200 text-gray-600 hover:border-red-400 hover:text-red-600 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Grand Place Live
          </button>

          {selectedCommune && (
            <button
              onClick={() => setSelectedCommune(null)}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              ✕ Clear filter
            </button>
          )}
        </div>
      </header>

      <FilterBar
        activeTab={activeTab}
        onTab={setActiveTab}
        typeColors={TYPE_COLORS}
        trafficColor={TRAFFIC_COLOR}
        dateRange={dateRange}
        onDateRange={setDateRange}
        showMetro={showMetro}
        onToggleMetro={() => setShowMetro((v) => !v)}
        showBusNetwork={showBusNetwork}
        onToggleBusNetwork={() => setShowBusNetwork((v) => !v)}
        showRailNetwork={showRailNetwork}
        onToggleRailNetwork={() => setShowRailNetwork((v) => !v)}
        showPoliticalSites={showPoliticalSites}
        onTogglePoliticalSites={() => setShowPoliticalSites((v) => !v)}
      />

      {showWebcam && <Webcam onClose={() => setShowWebcam(false)} />}

      <div className="flex flex-1 overflow-hidden">
        <Feed
          type={activeTab}
          communeId={selectedCommune}
          dateRange={dateRange}
          typeColors={TYPE_COLORS}
          trafficColor={TRAFFIC_COLOR}
        />
        <MapView
          selectedCommune={selectedCommune}
          onSelectCommune={setSelectedCommune}
          typeColors={TYPE_COLORS}
          trafficColor={TRAFFIC_COLOR}
          showMetro={showMetro}
          showBusNetwork={showBusNetwork}
          showRailNetwork={showRailNetwork}
          showPoliticalSites={showPoliticalSites}
          activeTab={activeTab}
          dateRange={dateRange}
        />
      </div>
    </div>
  )
}
