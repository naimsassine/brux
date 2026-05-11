import { NextRequest, NextResponse } from "next/server"
import { db, items, communes } from "@brux/db"
import { eq, desc, inArray } from "drizzle-orm"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const types = searchParams.getAll("type") as Array<"news" | "event" | "roadwork">
  const communeId = searchParams.get("commune")
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100)
  const offset = Number(searchParams.get("offset") ?? 0)

  const query = db
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
    .orderBy(desc(items.publishedAt))
    .limit(limit)
    .offset(offset)

  if (types.length > 0) query.where(inArray(items.type, types))
  if (communeId) query.where(eq(items.communeId, Number(communeId)))

  const rows = await query
  return NextResponse.json(rows)
}
