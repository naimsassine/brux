import { NextResponse } from "next/server"
import { db, items } from "@brux/db"
import { and, desc, eq, gte, ilike, or } from "drizzle-orm"

const STRIKE_KEYWORDS = ["%strike%", "%grève%", "%greve%", "%staking%"]

// Look back 4 days — captures both day-of articles and days-before warnings
function fourDaysAgo(): Date {
  const d = new Date()
  d.setDate(d.getDate() - 4)
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
        gte(items.publishedAt, fourDaysAgo()),
        or(...STRIKE_KEYWORDS.map((kw) => ilike(items.title, kw)))
      )
    )
    .orderBy(desc(items.publishedAt))
    .limit(5)

  return NextResponse.json(rows)
}
