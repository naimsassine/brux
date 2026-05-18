"use client"

import type { ItemType, TabType, DateRange } from "../lib/filters"

interface Props {
  activeTab: TabType
  onTab: (tab: TabType) => void
  typeColors: Record<ItemType, string>
  trafficColor: string
  dateRange: DateRange
  onDateRange: (range: DateRange) => void
  showMetro: boolean
  onToggleMetro: () => void
  showBusNetwork: boolean
  onToggleBusNetwork: () => void
  showRailNetwork: boolean
  onToggleRailNetwork: () => void
  showPoliticalSites: boolean
  onTogglePoliticalSites: () => void
}

const ITEM_TAB_LABELS: Record<ItemType, string> = {
  news: "News",
  event: "Events",
  roadwork: "Road Works",
}

const DATE_LABELS: Record<DateRange, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  all: "All",
}

export default function FilterBar({ activeTab, onTab, typeColors, trafficColor, dateRange, onDateRange, showMetro, onToggleMetro, showBusNetwork, onToggleBusNetwork, showRailNetwork, onToggleRailNetwork, showPoliticalSites, onTogglePoliticalSites }: Props) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100 flex-wrap">
      {(Object.keys(ITEM_TAB_LABELS) as ItemType[]).map((tab) => {
        const active = activeTab === tab
        return (
          <button
            key={tab}
            onClick={() => onTab(tab)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all"
            style={{
              borderColor: typeColors[tab],
              backgroundColor: active ? typeColors[tab] : "white",
              color: active ? "white" : typeColors[tab],
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: active ? "white" : typeColors[tab] }}
            />
            {ITEM_TAB_LABELS[tab]}
          </button>
        )
      })}

      {/* Live traffic tab */}
      {(() => {
        const active = activeTab === "traffic"
        return (
          <button
            onClick={() => onTab("traffic")}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all"
            style={{
              borderColor: trafficColor,
              backgroundColor: active ? trafficColor : "white",
              color: active ? "white" : trafficColor,
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
              style={{ backgroundColor: active ? "white" : trafficColor }}
            />
            Live Traffic
          </button>
        )
      })()}

      <div className="w-px h-5 bg-gray-200 mx-1" />

      <button
        onClick={onToggleMetro}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all"
        style={{
          borderColor: "#1a56a0",
          backgroundColor: showMetro ? "#1a56a0" : "white",
          color: showMetro ? "white" : "#1a56a0",
        }}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: showMetro ? "white" : "#1a56a0" }}
        />
        Metro
      </button>

      <button
        onClick={onToggleRailNetwork}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all"
        style={{
          borderColor: "#7c3aed",
          backgroundColor: showRailNetwork ? "#7c3aed" : "white",
          color: showRailNetwork ? "white" : "#7c3aed",
        }}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: showRailNetwork ? "white" : "#7c3aed" }}
        />
        Tram
      </button>

      <button
        onClick={onToggleBusNetwork}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all"
        style={{
          borderColor: "#16a34a",
          backgroundColor: showBusNetwork ? "#16a34a" : "white",
          color: showBusNetwork ? "white" : "#16a34a",
        }}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: showBusNetwork ? "white" : "#16a34a" }}
        />
        Bus
      </button>

      <button
        onClick={onTogglePoliticalSites}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all"
        style={{
          borderColor: "#1e3a5f",
          backgroundColor: showPoliticalSites ? "#1e3a5f" : "white",
          color: showPoliticalSites ? "white" : "#1e3a5f",
        }}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: showPoliticalSites ? "white" : "#1e3a5f" }}
        />
        Political Sites
      </button>

      <div className="w-px h-5 bg-gray-200 mx-1" />

      {(Object.keys(DATE_LABELS) as DateRange[]).map((range) => (
        <button
          key={range}
          onClick={() => onDateRange(range)}
          className="px-3 py-1 rounded-full text-sm font-medium border transition-all"
          style={{
            borderColor: dateRange === range ? "#6b7280" : "#e5e7eb",
            backgroundColor: dateRange === range ? "#6b7280" : "white",
            color: dateRange === range ? "white" : "#6b7280",
          }}
        >
          {DATE_LABELS[range]}
        </button>
      ))}
    </div>
  )
}
