export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { db, items } from "@brux/db"
import { and, desc, eq, gte, ilike, or } from "drizzle-orm"

type AlertTier = "critical" | "warning" | "info"

const TIERS: { tier: AlertTier; label: string; keywords: string[] }[] = [
  {
    tier: "critical",
    label: "Critical alert",
    keywords: [
      "%incendie%", "%brand%", "%explosion%",
      "%attentat%", "%terroris%",
      "%evacuation%", "%évacuation%", "%evacuatie%",
      "%fuite de gaz%", "%gas leak%", "%gaslek%",
      "%inondation%", "%flooding%", "%overstroming%",
    ],
  },
  {
    tier: "warning",
    label: "Warning",
    keywords: [
      "%strike%", "%grève%", "%greve%", "%staking%",
      "%manifestation%", "%protest%", "%betoging%", "%demonstration%",
      "%panne de courant%", "%stroomonderbreking%", "%power outage%", "%blackout%",
      "%storm%", "%tempête%", "%verglas%", "%sneeuw%", "%neige%",
      "%accident grave%", "%major accident%", "%crash%",
    ],
  },
  {
    tier: "info",
    label: "Disruption alert",
    keywords: [
      "%périmètre%", "%perimeter%", "%veiligheidsperimeter%",
      "%finale%", "%fan zone%", "%fanzone%",
      "%perturbation%", "%disruption%", "%hinder%",
    ],
  },
]

const ALL_KEYWORDS = TIERS.flatMap((t) => t.keywords)

function assignTier(title: string): AlertTier {
  const lower = title.toLowerCase()
  for (const { tier, keywords } of TIERS) {
    if (keywords.some((kw) => lower.includes(kw.replace(/%/g, "")))) return tier
  }
  return "info"
}

function yesterday(): Date {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d
}

export async function GET() {
  const rows = await db
    .select({
      id: items.id,
      title: items.title,
      sourceUrl: items.sourceUrl,
      sourceName: items.sourceName,
      publishedAt: items.publishedAt,
    })
    .from(items)
    .where(
      and(
        eq(items.type, "news"),
        gte(items.publishedAt, yesterday()),
        or(...ALL_KEYWORDS.map((kw) => ilike(items.title, kw)))
      )
    )
    .orderBy(desc(items.publishedAt))
    .limit(10)

  const withTier = rows.map((row) => ({
    ...row,
    tier: assignTier(row.title),
  }))

  // Sort: critical first, then warning, then info
  const tierOrder: Record<AlertTier, number> = { critical: 0, warning: 1, info: 2 }
  withTier.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier])

  return NextResponse.json(withTier, {
    headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=60" },
  })
}
