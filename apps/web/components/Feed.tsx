"use client"

import { useEffect, useState } from "react"
import type { ItemType, DateRange } from "../lib/filters"
import { getDateBounds } from "../lib/filters"

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
  type: ItemType
  communeId: number | null
  dateRange: DateRange
  typeColors: Record<ItemType, string>
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

export default function Feed({ type, communeId, dateRange, typeColors }: Props) {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [alertIds, setAlertIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  // Strike alerts only relevant for news tab
  useEffect(() => {
    if (type !== "news") { setAlertIds(new Set()); return }
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((data: FeedItem[]) => setAlertIds(new Set(data.map((a) => a.id))))
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

  return (
    <div className="w-[480px] flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-gray-50">
      {feedItems.length === 0 ? (
        <div className="p-8 text-center text-gray-400">No items found</div>
      ) : (
        [...feedItems]
          .sort((a, b) => {
            const aAlert = alertIds.has(a.id) ? 1 : 0
            const bAlert = alertIds.has(b.id) ? 1 : 0
            return bAlert - aAlert
          })
          .map((item) => {
            const isAlert = alertIds.has(item.id)
            return (
              <article
                key={item.id}
                className={`border-b px-4 py-3 transition-colors ${
                  isAlert
                    ? "bg-red-50 border-red-100 border-l-4 border-l-red-500 hover:bg-red-100"
                    : "bg-white border-gray-100 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isAlert ? "#ef4444" : (typeColors[item.type as ItemType] ?? "#ccc") }}
                  />
                  <span className={`text-xs uppercase tracking-wide ${isAlert ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                    {isAlert ? "Strike alert" : (item.communeName ?? "Brussels")}
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
                    className={`font-medium text-sm hover:underline leading-snug block mb-1 ${isAlert ? "text-red-900" : "text-gray-900"}`}
                  >
                    {item.title}
                  </a>
                ) : (
                  <p className={`font-medium text-sm leading-snug mb-1 ${isAlert ? "text-red-900" : "text-gray-900"}`}>{item.title}</p>
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
