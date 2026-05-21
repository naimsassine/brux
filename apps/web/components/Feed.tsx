"use client"

import { useEffect, useRef, useState } from "react"
import type { ItemType, TabType, DateRange } from "../lib/filters"
import { getDateBounds } from "../lib/filters"
import type { TrafficAlert } from "../app/api/traffic/route"

type AlertTier = "critical" | "warning" | "info"

const TIER_META: Record<AlertTier, { label: string; color: string; glow: string }> = {
  critical: { label: "CRITICAL", color: "#ef4444", glow: "#ef444433" },
  warning:  { label: "WARNING",  color: "#f59e0b", glow: "#f59e0b22" },
  info:     { label: "ALERT",    color: "#3b82f6", glow: "#3b82f622" },
}

interface FeedItem {
  id:          string
  type:        string
  title:       string
  summary:     string | null
  sourceUrl:   string | null
  sourceName:  string
  communeName: string | null
  publishedAt: string
}

interface Props {
  type:        TabType
  communeId:   number | null
  dateRange:   DateRange
  typeColors:  Record<ItemType, string>
  trafficColor: string
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now  = new Date()
  const diff = date.getTime() - now.getTime()
  const abs  = Math.abs(diff)
  const mins = Math.floor(abs / 60000)
  const hrs  = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)

  if (diff > 0) {
    if (days === 0) return "TODAY"
    if (days === 1) return "TOMORROW"
    if (days < 7)  return `IN ${days}D`
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toUpperCase()
  }
  if (mins < 60) return `${mins}M AGO`
  if (hrs  < 24) return `${hrs}H AGO`
  return `${days}D AGO`
}

// ── Traffic feed ──────────────────────────────────────────────────────────────

function TrafficFeed({ trafficColor }: { trafficColor: string }) {
  const [alerts, setAlerts]         = useState<TrafficAlert[]>([])
  const [loading, setLoading]       = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = () => {
    fetch("/api/traffic")
      .then((r) => r.json())
      .then((data: TrafficAlert[]) => { setAlerts(data); setLoading(false); setLastUpdated(new Date()) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, 120_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  return (
    <div className="w-full flex flex-col bg-[#080c12] h-full">
      <div className="flex items-center gap-2 px-4 h-9 border-b border-[#1c2a3a] bg-[#0d1117] flex-shrink-0">
        <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: trafficColor }} />
        <span className="font-mono text-[9px] tracking-[.2em] uppercase" style={{ color: trafficColor }}>
          Live Traffic
        </span>
        {lastUpdated && (
          <span className="ml-auto font-mono text-[9px] text-[#3d4f64]">
            UPD {formatDate(lastUpdated.toISOString())}
          </span>
        )}
      </div>

      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-20 font-mono text-[10px] text-[#3d4f64] tracking-widest">
            LOADING…
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex items-center justify-center h-20 font-mono text-[10px] text-[#3d4f64] tracking-widest">
            NO ACTIVE ALERTS
          </div>
        ) : alerts.map((alert) => (
          <article
            key={alert.id}
            className="border-b border-[#1c2a3a] px-4 py-3 hover:bg-[#131a24] transition-colors"
            style={{ borderLeft: `2px solid ${trafficColor}` }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-[9px] tracking-[.15em] uppercase" style={{ color: trafficColor }}>
                {alert.location ?? "Brussels"}
              </span>
              <span className="text-[#1c2a3a]">·</span>
              <span className="font-mono text-[9px] text-[#3d4f64]">{formatDate(alert.createdAt)}</span>
              {alert.lat && (
                <>
                  <span className="text-[#1c2a3a]">·</span>
                  <span className="font-mono text-[9px] text-[#3d4f64]">⊕ MAP</span>
                </>
              )}
            </div>
            <p className="text-xs text-[#c9d1d9] leading-relaxed">{alert.content}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

// ── Standard item feed ────────────────────────────────────────────────────────

export default function Feed({ type, communeId, dateRange, typeColors, trafficColor }: Props) {
  if (type === "traffic") return <TrafficFeed trafficColor={trafficColor} />
  return <ItemFeed type={type} communeId={communeId} dateRange={dateRange} typeColors={typeColors} />
}

function ItemFeed({
  type, communeId, dateRange, typeColors,
}: {
  type:       ItemType
  communeId:  number | null
  dateRange:  DateRange
  typeColors: Record<ItemType, string>
}) {
  const [feedItems, setFeedItems]   = useState<FeedItem[]>([])
  const [alertTiers, setAlertTiers] = useState<Map<string, AlertTier>>(new Map())
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    if (type !== "news") { setAlertTiers(new Map()); return }
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((data: { id: string; tier: AlertTier }[]) => {
        setAlertTiers(new Map(data.map((a) => [a.id, a.tier])))
      })
      .catch(() => {})
  }, [type])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.append("type", type)
    if (communeId) params.set("commune", String(communeId))
    const { dateFrom, dateTo } = getDateBounds(dateRange, [type])
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo)   params.set("dateTo", dateTo)

    fetch(`/api/items?${params}`)
      .then((r) => r.json())
      .then((data) => { setFeedItems(data); setLoading(false) })
  }, [type, communeId, dateRange])

  const color = typeColors[type]
  const tierOrder: Record<AlertTier, number> = { critical: 0, warning: 1, info: 2 }

  const sorted = [...feedItems].sort((a, b) => {
    const at = alertTiers.get(a.id), bt = alertTiers.get(b.id)
    return (at !== undefined ? tierOrder[at] : 10) - (bt !== undefined ? tierOrder[bt] : 10)
  })

  return (
    <div className="w-full flex flex-col bg-[#080c12] h-full">
      {/* Feed header */}
      <div className="flex items-center gap-2 px-4 h-9 border-b border-[#1c2a3a] bg-[#0d1117] flex-shrink-0">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="font-mono text-[9px] tracking-[.2em] uppercase" style={{ color }}>
          {type === "news" ? "Intel Feed" : type === "event" ? "Events" : "Roadworks"}
        </span>
        {!loading && (
          <span className="ml-auto font-mono text-[9px] text-[#3d4f64]">
            {sorted.length} ITEMS
          </span>
        )}
      </div>

      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-20 font-mono text-[10px] text-[#3d4f64] tracking-widest">
            LOADING…
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex items-center justify-center h-20 font-mono text-[10px] text-[#3d4f64] tracking-widest">
            NO DATA
          </div>
        ) : sorted.map((item) => {
          const tier      = alertTiers.get(item.id)
          const tierMeta  = tier ? TIER_META[tier] : null
          const itemColor = tierMeta ? tierMeta.color : (typeColors[item.type as ItemType] ?? color)

          return (
            <article
              key={item.id}
              className="border-b border-[#1c2a3a] px-4 py-3 transition-colors hover:bg-[#131a24]"
              style={{
                borderLeft:  `2px solid ${itemColor}`,
                background:  tierMeta ? `${tierMeta.glow}` : undefined,
              }}
            >
              {/* Meta row */}
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                {tierMeta && (
                  <span
                    className="font-mono text-[9px] tracking-[.15em] px-1.5 py-0.5"
                    style={{ color: tierMeta.color, background: `${tierMeta.color}22`, border: `1px solid ${tierMeta.color}44` }}
                  >
                    {tierMeta.label}
                  </span>
                )}
                <span className="font-mono text-[9px] tracking-[.12em] uppercase" style={{ color: itemColor }}>
                  {item.sourceName}
                </span>
                <span className="text-[#1c2a3a] font-mono text-[9px]">·</span>
                <span className="font-mono text-[9px] text-[#3d4f64]">
                  {formatDate(item.publishedAt)}
                </span>
                {item.communeName && (
                  <>
                    <span className="text-[#1c2a3a] font-mono text-[9px]">·</span>
                    <span className="font-mono text-[9px] text-[#6e7f96] uppercase">
                      {item.communeName}
                    </span>
                  </>
                )}
              </div>

              {/* Title */}
              {item.sourceUrl ? (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[13px] text-[#c9d1d9] leading-snug hover:text-white transition-colors mb-1"
                >
                  {item.title}
                </a>
              ) : (
                <p className="text-[13px] text-[#c9d1d9] leading-snug mb-1">{item.title}</p>
              )}

              {/* Summary */}
              {item.summary && (
                <p className="text-[11px] text-[#6e7f96] line-clamp-2 leading-relaxed">{item.summary}</p>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
