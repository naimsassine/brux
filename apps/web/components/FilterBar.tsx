"use client"

import type { ItemType, DateRange } from "../lib/filters"

interface Props {
  activeTypes: Set<ItemType>
  onToggle: (type: ItemType) => void
  typeColors: Record<ItemType, string>
  dateRange: DateRange
  onDateRange: (range: DateRange) => void
  showMetro: boolean
  onToggleMetro: () => void
}

const TYPE_LABELS: Record<ItemType, string> = {
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

export default function FilterBar({ activeTypes, onToggle, typeColors, dateRange, onDateRange, showMetro, onToggleMetro }: Props) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100 flex-wrap">
      {(Object.keys(TYPE_LABELS) as ItemType[]).map((type) => {
        const active = activeTypes.has(type)
        return (
          <button
            key={type}
            onClick={() => onToggle(type)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all"
            style={{
              borderColor: typeColors[type],
              backgroundColor: active ? typeColors[type] : "white",
              color: active ? "white" : typeColors[type],
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: active ? "white" : typeColors[type] }}
            />
            {TYPE_LABELS[type]}
          </button>
        )
      })}

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
