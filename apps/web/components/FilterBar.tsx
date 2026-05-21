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

const ITEM_TABS: { key: ItemType; label: string }[] = [
  { key: "news",     label: "NEWS"      },
  { key: "event",    label: "EVENTS"    },
  { key: "roadwork", label: "ROADWORKS" },
]

const DATE_OPTS: { key: DateRange; label: string }[] = [
  { key: "today", label: "TODAY" },
  { key: "week",  label: "7D"    },
  { key: "month", label: "30D"   },
  { key: "all",   label: "ALL"   },
]

const LAYERS: {
  key: "metro" | "rail" | "bus" | "political"
  label: string
  color: string
  show: (p: Props) => boolean
  toggle: (p: Props) => void
}[] = [
  { key: "metro",    label: "METRO",    color: "#1a56a0", show: p => p.showMetro,         toggle: p => p.onToggleMetro()         },
  { key: "rail",     label: "TRAM",     color: "#7c3aed", show: p => p.showRailNetwork,   toggle: p => p.onToggleRailNetwork()   },
  { key: "bus",      label: "BUS",      color: "#16a34a", show: p => p.showBusNetwork,    toggle: p => p.onToggleBusNetwork()    },
  { key: "political",label: "POLITICS", color: "#b45309", show: p => p.showPoliticalSites,toggle: p => p.onTogglePoliticalSites()},
]

function Divider() {
  return <span className="text-[#1c2a3a] font-mono text-xs select-none mx-0.5">|</span>
}

export default function FilterBar(props: Props) {
  const { activeTab, onTab, typeColors, trafficColor, dateRange, onDateRange } = props

  return (
    <div className="flex items-center gap-1 px-4 h-9 bg-[#080c12] border-b border-[#1c2a3a] flex-shrink-0 overflow-x-auto">

      {/* Feed tabs */}
      {ITEM_TABS.map(({ key, label }) => {
        const active = activeTab === key
        const color  = typeColors[key]
        return (
          <button
            key={key}
            onClick={() => onTab(key)}
            className="flex items-center gap-1.5 px-2.5 h-6 font-mono text-[9px] tracking-[.15em] transition-all"
            style={{
              color:           active ? color : "#3d4f64",
              borderBottom:    active ? `1px solid ${color}` : "1px solid transparent",
              background:      active ? `${color}12` : "transparent",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: active ? color : "#3d4f64" }}
            />
            {label}
          </button>
        )
      })}

      {/* Traffic */}
      {(() => {
        const active = activeTab === "traffic"
        return (
          <button
            onClick={() => onTab("traffic")}
            className="flex items-center gap-1.5 px-2.5 h-6 font-mono text-[9px] tracking-[.15em] transition-all"
            style={{
              color:        active ? trafficColor : "#3d4f64",
              borderBottom: active ? `1px solid ${trafficColor}` : "1px solid transparent",
              background:   active ? `${trafficColor}12` : "transparent",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
              style={{ backgroundColor: active ? trafficColor : "#ef444466" }} />
            TRAFFIC
          </button>
        )
      })()}

      <Divider />

      {/* Layer toggles */}
      {LAYERS.map(({ key, label, color, show, toggle }) => {
        const on = show(props)
        return (
          <button
            key={key}
            onClick={() => toggle(props)}
            className="flex items-center gap-1.5 px-2.5 h-6 font-mono text-[9px] tracking-[.15em] transition-all"
            style={{
              color:        on ? color : "#3d4f64",
              borderBottom: on ? `1px solid ${color}` : "1px solid transparent",
              background:   on ? `${color}12` : "transparent",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: on ? color : "#3d4f64" }}
            />
            {label}
          </button>
        )
      })}

      <Divider />

      {/* Date range */}
      {DATE_OPTS.map(({ key, label }) => {
        const active = dateRange === key
        return (
          <button
            key={key}
            onClick={() => onDateRange(key)}
            className="px-2.5 h-6 font-mono text-[9px] tracking-[.15em] transition-all"
            style={{
              color:        active ? "#c9d1d9" : "#3d4f64",
              borderBottom: active ? "1px solid #6e7f96" : "1px solid transparent",
              background:   active ? "#ffffff08" : "transparent",
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
