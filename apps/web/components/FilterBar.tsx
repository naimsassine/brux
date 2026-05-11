"use client"

import type { ItemType } from "../app/page"

interface Props {
  activeTypes: Set<ItemType>
  onToggle: (type: ItemType) => void
  typeColors: Record<ItemType, string>
}

const LABELS: Record<ItemType, string> = {
  news: "News",
  event: "Events",
  roadwork: "Road Works",
}

export default function FilterBar({ activeTypes, onToggle, typeColors }: Props) {
  return (
    <div className="flex gap-2 px-4 py-2 bg-white border-b border-gray-100">
      {(Object.keys(LABELS) as ItemType[]).map((type) => {
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
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: active ? "white" : typeColors[type] }}
            />
            {LABELS[type]}
          </button>
        )
      })}
    </div>
  )
}
