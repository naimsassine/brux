"use client"

import { useEffect, useState } from "react"
import type { ItemType } from "../app/page"

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
  activeTypes: ItemType[]
  communeId: number | null
  typeColors: Record<ItemType, string>
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function Feed({ activeTypes, communeId, typeColors }: Props) {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    activeTypes.forEach((t) => params.append("type", t))
    if (communeId) params.set("commune", String(communeId))

    fetch(`/api/items?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setFeedItems(data)
        setLoading(false)
      })
  }, [activeTypes.join(","), communeId])

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
        feedItems.map((item) => (
          <article
            key={item.id}
            className="bg-white border-b border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: typeColors[item.type as ItemType] ?? "#ccc" }}
              />
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                {item.communeName ?? "Brussels"}
              </span>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">{timeAgo(item.publishedAt)}</span>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">{item.sourceName}</span>
            </div>

            {item.sourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-sm text-gray-900 hover:underline leading-snug block mb-1"
              >
                {item.title}
              </a>
            ) : (
              <p className="font-medium text-sm text-gray-900 leading-snug mb-1">{item.title}</p>
            )}

            {item.summary && (
              <p className="text-xs text-gray-500 line-clamp-2">{item.summary}</p>
            )}
          </article>
        ))
      )}
    </div>
  )
}
