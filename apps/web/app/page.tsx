"use client"

import { useState, useEffect } from "react"
import Feed from "../components/Feed"
import MapView from "../components/MapView"
import FilterBar from "../components/FilterBar"
import Webcam from "../components/Webcam"
import PersistentWebcams from "../components/PersistentWebcams"
import WeatherWidget from "../components/WeatherWidget"
import { type ItemType, type TabType, type DateRange } from "../lib/filters"

export type { ItemType, TabType, DateRange }

const TYPE_COLORS: Record<ItemType, string> = {
  news:     "#f97316",
  event:    "#8b5cf6",
  roadwork: "#eab308",
}

const TRAFFIC_COLOR = "#ef4444"

function LiveClock() {
  const [time, setTime] = useState("")
  const [date, setDate] = useState("")

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString("en-GB", { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit", second: "2-digit" }))
      setDate(now.toLocaleDateString("en-GB", { timeZone: "Europe/Brussels", day: "2-digit", month: "short", year: "numeric" }).toUpperCase())
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="font-mono text-[11px] text-[#3d4f64] tabular-nums tracking-wide select-none">
      {date}&nbsp;&nbsp;{time}&nbsp;<span className="text-[#3d4f64]">CET</span>
    </span>
  )
}

export default function Home() {
  const [activeTab, setActiveTab]               = useState<TabType>("news")
  const [selectedCommune, setSelectedCommune]   = useState<number | null>(null)
  const [dateRange, setDateRange]               = useState<DateRange>("month")
  const [showMetro, setShowMetro]               = useState(true)
  const [showBusNetwork, setShowBusNetwork]     = useState(false)
  const [showRailNetwork, setShowRailNetwork]   = useState(false)
  const [showPoliticalSites, setShowPoliticalSites] = useState(true)
  const [webcamCam, setWebcamCam]               = useState<string | null>(null)
  const [mobileView, setMobileView]             = useState<"feed" | "map">("feed")

  return (
    <div className="flex flex-col h-[100dvh] bg-[#080c12]">

      {/* ── Top bar ── */}
      <header className="flex items-center gap-4 px-4 h-10 bg-[#080c12] border-b border-[#1c2a3a] z-10 flex-shrink-0">

        {/* Brand */}
        <div className="flex items-center gap-2.5 mr-1">
          <span className="font-mono font-bold text-sm tracking-[.25em] text-white uppercase select-none">
            BRUX
          </span>
          <div className="w-px h-3.5 bg-[#1c2a3a]" />
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
            <span className="font-mono text-[9px] tracking-[.2em] text-[#3fb950] uppercase">LIVE</span>
          </div>
        </div>

        <span className="hidden sm:block"><LiveClock /></span>

        <div className="ml-auto flex items-center gap-2">
          {selectedCommune && (
            <button
              onClick={() => setSelectedCommune(null)}
              className="px-2.5 h-7 font-mono text-[9px] tracking-[.15em] uppercase border border-[#243044] bg-[#0d1117] text-[#6e7f96] hover:text-white hover:border-[#3d4f64] transition-all"
            >
              ✕ CLEAR
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

      {webcamCam && <Webcam initialCam={webcamCam} onClose={() => setWebcamCam(null)} />}

      <div className="flex flex-1 overflow-hidden">
        {/* Feed — full width on mobile, fixed 400px on desktop */}
        <div className={`
          ${mobileView === "map" ? "hidden md:flex" : "flex"}
          w-full md:w-[400px] flex-shrink-0 flex-col border-r border-[#1c2a3a] overflow-hidden
        `}>
          <Feed
            type={activeTab}
            communeId={selectedCommune}
            dateRange={dateRange}
            typeColors={TYPE_COLORS}
            trafficColor={TRAFFIC_COLOR}
          />
        </div>

        {/* Map — full width on mobile, fills remaining space on desktop */}
        <div className={`${mobileView === "feed" ? "hidden md:flex" : "flex"} flex-1`}>
          <MapView
            selectedCommune={selectedCommune}
            onSelectCommune={(id) => {
              setSelectedCommune(id)
              setMobileView("feed")
            }}
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

        {/* Floating right column — webcams + weather (desktop only) */}
        <div className="hidden md:flex fixed right-4 z-20 flex-col gap-2" style={{ top: 88 }}>
          <PersistentWebcams onExpand={(cam) => setWebcamCam(cam)} />
          <WeatherWidget />
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <div className="md:hidden flex flex-shrink-0 border-t border-[#1c2a3a] bg-[#080c12]">
        <button
          onClick={() => setMobileView("feed")}
          className="flex-1 py-3 flex flex-col items-center gap-1 transition-colors"
          style={{ color: mobileView === "feed" ? "#c9d1d9" : "#3d4f64" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="0" y="0" width="7" height="4" rx="1"/>
            <rect x="0" y="6" width="7" height="4" rx="1"/>
            <rect x="0" y="12" width="7" height="4" rx="1"/>
            <rect x="9" y="0" width="7" height="4" rx="1"/>
            <rect x="9" y="6" width="7" height="4" rx="1"/>
            <rect x="9" y="12" width="7" height="4" rx="1"/>
          </svg>
          <span className="font-mono text-[9px] tracking-[.15em]">FEED</span>
        </button>
        <button
          onClick={() => setMobileView("map")}
          className="flex-1 py-3 flex flex-col items-center gap-1 transition-colors"
          style={{ color: mobileView === "map" ? "#c9d1d9" : "#3d4f64" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M0 3.5l5-2 6 2 5-2v11l-5 2-6-2-5 2V3.5z" opacity=".4"/>
            <path d="M5 1.5v11M11 3.5v11"/>
          </svg>
          <span className="font-mono text-[9px] tracking-[.15em]">MAP</span>
        </button>
      </div>
    </div>
  )
}
