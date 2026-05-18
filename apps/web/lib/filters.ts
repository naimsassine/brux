export const ITEM_TYPES = ["news", "event", "roadwork"] as const
export type ItemType = (typeof ITEM_TYPES)[number]
export type TabType = ItemType | "traffic"
export type DateRange = "today" | "week" | "month" | "all"

// Date bounds only apply when events are shown — news/roadworks are always shown by recency
export function getDateBounds(range: DateRange, activeTypes: ItemType[]): { dateFrom?: string; dateTo?: string } {
  if (range === "all" || !activeTypes.includes("event")) return {}
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  if (range === "today") end.setDate(end.getDate() + 1)
  else if (range === "week") end.setDate(end.getDate() + 7)
  else if (range === "month") end.setDate(end.getDate() + 30)
  return { dateFrom: start.toISOString(), dateTo: end.toISOString() }
}
