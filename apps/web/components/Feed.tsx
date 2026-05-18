"use client"

import { useEffect, useRef, useState } from "react"
import type { ItemType, TabType, DateRange } from "../lib/filters"
import { getDateBounds } from "../lib/filters"
import type { TrafficAlert } from "../app/api/traffic/route"

type AlertTier = "critical" | "warning" | "info"

interface AlertMeta {
  tier: AlertTier
  label: string
  dot: string
  border: string
  bg: string
  hoverBg: string
  tagColor: string
  titleColor: string
}

const TIER_STYLES: Record<AlertTier, AlertMeta> = {
  critical: {
    tier: "critical",
    label: "Critical alert",
    dot: "#dc2626",
    border: "border-l-4 border-l-red-600 border-red-100",
    bg: "bg-red-50",
    hoverBg: "hover:bg-red-100",
    tagColor: "text-red-600 font-semibold",
    titleColor: "text-red-900",
  },
  warning: {
    tier: "warning",
    label: "Warning",
    dot: "#d97706",
    border: "border-l-4 border-l-amber-500 border-amber-100",
    bg: "bg-amber-50",
    hoverBg: "hover:bg-amber-100",
    tagColor: "text-amber-600 font-semibold",
    titleColor: "text-amber-900",
  },
  info: {
    tier: "info",
    label: "Disruption alert",
    dot: "#2563eb",
    border: "border-l-4 border-l-blue-500 border-blue-100",
    bg: "bg-blue-50",
    hoverBg: "hover:bg-blue-100",
    tagColor: "text-blue-600 font-semibold",
    titleColor: "text-blue-900",
  },
}

interface FeedItem {
  id: string
  type: string
  title: string
  summary: string | null
  sourceUrl: string | null
  sourceName: string
  communeName: string | null
  publishedAt: string
}

interface Props {
  type: TabType
  communeId: number | null
  dateRange: DateRange
  typeColors: Record<ItemType, string>
  trafficColor: string
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  const diffAbs = Math.abs(diff)
  const mins = Math.floor(diffAbs / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)

  if (diff > 0) {
    if (days === 0) return "today"
    if (days === 1) return "tomorrow"
    if (days < 7) return `in ${days}d`
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  }
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

// ── Traffic feed ──────────────────────────────────────────────────────────────

function TrafficFeed({ trafficColor }: { trafficColor: string }) {
  const [alerts, setAlerts] = useState<TrafficAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch2 = () => {
    fetch("/api/traffic")
      .then((r) => r.json())
      .then((data: TrafficAlert[]) => {
        setAlerts(data)
        setLoading(false)
        setLastUpdated(new Date())
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetch2()
    intervalRef.current = setInterval(fetch2, 120_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  if (loading) {
    return (
      <div className="w-[480px] flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-gray-400">
        Loading traffic…
      </div>
    )
  }

  return (
    <div className="w-[480px] flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-gray-50">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full animate-pulse flex-shrink-0"
          style={{ backgroundColor: trafficColor }}
        />
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: trafficColor }}>
          Live Traffic Info
        </span>
        {lastUpdated && (
          <span className="text-xs text-gray-400 ml-auto">
            Updated {formatDate(lastUpdated.toISOString())}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="p-8 text-center text-gray-400">No active traffic alerts</div>
      ) : (
        alerts.map((alert) => (
          <article
            key={alert.id}
            className="border-b border-gray-100 bg-white hover:bg-red-50 px-4 py-3 transition-colors border-l-4 border-l-red-400"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: trafficColor }}
              />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: trafficColor }}>
                {alert.location ?? "Brussels"}
              </span>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">{formatDate(alert.createdAt)}</span>
              {alert.lat && (
                <>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">📍 on map</span>
                </>
              )}
            </div>
            <p className="text-sm text-gray-900 leading-snug">{alert.content}</p>
          </article>
        ))
      )}
    </div>
  )
}

// ── Standard item feed ────────────────────────────────────────────────────────

export default function Feed({ type, communeId, dateRange, typeColors, trafficColor }: Props) {
  if (type === "traffic") {
    return <TrafficFeed trafficColor={trafficColor} />
  }

  return <ItemFeed type={type} communeId={communeId} dateRange={dateRange} typeColors={typeColors} />
}

function ItemFeed({
  type,
  communeId,
  dateRange,
  typeColors,
}: {
  type: ItemType
  communeId: number | null
  dateRange: DateRange
  typeColors: Record<ItemType, string>
}) {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [alertTiers, setAlertTiers] = useState<Map<string, AlertTier>>(new Map())
  const [loading, setLoading] = useState(true)

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
    if (dateTo) params.set("dateTo", dateTo)

    fetch(`/api/items?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setFeedItems(data)
        setLoading(false)
      })
  }, [type, communeId, dateRange])

  if (loading) {
    return (
      <div className="w-[480px] flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-gray-400">
        Loading...
      </div>
    )
  }

  const tierOrder: Record<AlertTier, number> = { critical: 0, warning: 1, info: 2 }

  return (
    <div className="w-[480px] flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-gray-50">
      {feedItems.length === 0 ? (
        <div className="p-8 text-center text-gray-400">No items found</div>
      ) : (
        [...feedItems]
          .sort((a, b) => {
            const aTier = alertTiers.get(a.id)
            const bTier = alertTiers.get(b.id)
            const aOrder = aTier !== undefined ? tierOrder[aTier] : 10
            const bOrder = bTier !== undefined ? tierOrder[bTier] : 10
            return aOrder - bOrder
          })
          .map((item) => {
            const tier = alertTiers.get(item.id)
            const style = tier ? TIER_STYLES[tier] : null

            return (
              <article
                key={item.id}
                className={`border-b px-4 py-3 transition-colors ${
                  style
                    ? `${style.bg} ${style.border} ${style.hoverBg}`
                    : "bg-white border-gray-100 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: style ? style.dot : (typeColors[item.type as ItemType] ?? "#ccc") }}
                  />
                  <span className={`text-xs uppercase tracking-wide ${style ? style.tagColor : "text-gray-400"}`}>
                    {style ? style.label : (item.communeName ?? "Brussels")}
                  </span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">{formatDate(item.publishedAt)}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">{item.sourceName}</span>
                </div>

                {item.sourceUrl ? (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`font-medium text-sm hover:underline leading-snug block mb-1 ${style ? style.titleColor : "text-gray-900"}`}
                  >
                    {item.title}
                  </a>
                ) : (
                  <p className={`font-medium text-sm leading-snug mb-1 ${style ? style.titleColor : "text-gray-900"}`}>{item.title}</p>
                )}

                {item.summary && (
                  <p className="text-xs text-gray-500 line-clamp-2">{item.summary}</p>
                )}
              </article>
            )
          })
      )}
    </div>
  )
}
