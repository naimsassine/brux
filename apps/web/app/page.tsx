"use client"

import { useState } from "react"
import Feed from "../components/Feed"
import MapView from "../components/MapView"
import FilterBar from "../components/FilterBar"
import { ITEM_TYPES, type ItemType, type DateRange } from "../lib/filters"

export type { ItemType, DateRange }

const TYPE_COLORS: Record<ItemType, string> = {
  news: "#f97316",
  event: "#8b5cf6",
  roadwork: "#eab308",
}

export default function Home() {
  const [activeTypes, setActiveTypes] = useState<Set<ItemType>>(new Set(ITEM_TYPES))
  const [selectedCommune, setSelectedCommune] = useState<number | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>("week")
  const [showMetro, setShowMetro] = useState(true)

  const toggleType = (type: ItemType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-4 px-4 py-3 bg-white border-b border-gray-200 z-10">
        <span className="font-bold text-lg tracking-tight">Brux</span>
        <span className="text-gray-400 text-sm">Brussels Civic Dashboard</span>
        {selectedCommune && (
          <button
            onClick={() => setSelectedCommune(null)}
            className="ml-auto text-sm text-gray-500 hover:text-gray-800"
          >
            ✕ Clear filter
          </button>
        )}
      </header>

      <FilterBar
        activeTypes={activeTypes}
        onToggle={toggleType}
        typeColors={TYPE_COLORS}
        dateRange={dateRange}
        onDateRange={setDateRange}
        showMetro={showMetro}
        onToggleMetro={() => setShowMetro((v) => !v)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Feed
          activeTypes={[...activeTypes]}
          communeId={selectedCommune}
          dateRange={dateRange}
          typeColors={TYPE_COLORS}
        />
        <MapView
          activeTypes={[...activeTypes]}
          selectedCommune={selectedCommune}
          onSelectCommune={setSelectedCommune}
          dateRange={dateRange}
          typeColors={TYPE_COLORS}
          showMetro={showMetro}
        />
      </div>
    </div>
  )
}
