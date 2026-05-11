import { NextRequest, NextResponse } from "next/server"
import { db, items, communes } from "@brux/db"
import { eq, desc, inArray, and, gte, lte } from "drizzle-orm"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const types = searchParams.getAll("type") as Array<"news" | "event" | "roadwork">
  const communeId = searchParams.get("commune")
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200)
  const offset = Number(searchParams.get("offset") ?? 0)

  const conditions = []
  if (types.length > 0) conditions.push(inArray(items.type, types))
  if (communeId) conditions.push(eq(items.communeId, Number(communeId)))
  if (dateFrom) conditions.push(gte(items.publishedAt, new Date(dateFrom)))
  if (dateTo) conditions.push(lte(items.publishedAt, new Date(dateTo)))

  const rows = await db
    .select({
      id: items.id,
      type: items.type,
      title: items.title,
      summary: items.summary,
      sourceUrl: items.sourceUrl,
      sourceName: items.sourceName,
      communeId: items.communeId,
      lat: items.lat,
      lng: items.lng,
      publishedAt: items.publishedAt,
      communeName: communes.nameEn,
    })
    .from(items)
    .leftJoin(communes, eq(items.communeId, communes.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(items.publishedAt))
    .limit(limit)
    .offset(offset)

  return NextResponse.json(rows)
}
